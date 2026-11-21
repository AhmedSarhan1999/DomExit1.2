import crypto from 'node:crypto';
import { UserProfile, UserRole, YcHttpEvent, YcHttpResponse } from '../types.js';
import {
  json,
  redirect,
  parseBody,
  parseCookies,
  getClientIp,
  createSessionCookie,
  clearSessionCookie,
  createOAuthStateCookie,
  clearOAuthStateCookie,
} from '../lib/http.js';
import { getConfig } from '../lib/config.js';
import { getYdbClient } from '../lib/ydbClient.js';
import {
  hashPassword,
  verifyPassword,
  createJwt,
  getAuthenticatedUser,
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogin,
} from '../lib/cryptoAuth.js';

export async function handleAuth(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = event.httpMethod.toUpperCase();
  const cfg = getConfig();
  const ydb = getYdbClient();

  // POST /api/auth/register
  if (subPath === '/register' && method === 'POST') {
    const body = parseBody<{
      email?: string;
      password?: string;
      name?: string;
      phone?: string;
      role?: string;
    }>(event);

    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;
    const name = body?.name?.trim();
    const phone = body?.phone?.trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(event, 400, { error: 'Некорректный адрес электронной почты' });
    }
    if (!password || password.length < 8) {
      return json(event, 400, { error: 'Пароль должен содержать не менее 8 символов' });
    }
    if (!name) {
      return json(event, 400, { error: 'Имя обязательно для заполнения' });
    }

    // Role security check: public registration only allows buyer or seller
    let assignedRole: UserRole = 'buyer';
    if (body?.role === 'seller') {
      assignedRole = 'seller';
    }

    // Check if user already exists
    const existingList = await ydb.findByField<UserProfile>('users', 'email', email);
    const existingWithPass = existingList.find((u) => Boolean(u.passwordHash));

    if (existingWithPass) {
      return json(event, 409, { error: 'Пользователь с таким email уже зарегистрирован' });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    let userToSave: UserProfile;
    if (existingList.length > 0) {
      // User existed (e.g. from OAuth) without password: safe merge without duplicate record
      const existing = existingList[0];
      userToSave = {
        ...existing,
        email,
        name: name || existing.name,
        phone: phone || existing.phone,
        passwordHash,
        authProvider: existing.authProvider || 'local',
      };
    } else {
      const userId = `usr-${crypto.randomUUID().substring(0, 12)}`;
      userToSave = {
        id: userId,
        email,
        name,
        phone,
        role: assignedRole,
        activeRole: assignedRole,
        roles: [assignedRole],
        registeredAt: now,
        authProvider: 'local',
        favorites: [],
        passwordHash,
      };
    }

    await ydb.putItem('users', userToSave);

    const sessionToken = createJwt(
      {
        userId: userToSave.id,
        email: userToSave.email,
        role: userToSave.role,
        activeRole: userToSave.activeRole,
        roles: userToSave.roles,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = { ...userToSave };
    delete cleanUser.passwordHash;

    return json(
      event,
      201,
      { success: true, user: cleanUser },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // POST /api/auth/login
  if (subPath === '/login' && method === 'POST') {
    const clientIp = getClientIp(event);
    const body = parseBody<{ email?: string; password?: string }>(event);
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    if (!email || !password) {
      return json(event, 400, { error: 'Укажите email и пароль' });
    }

    const rateKey = `${clientIp}:${email}`;
    if (!checkLoginRateLimit(rateKey)) {
      return json(event, 429, {
        error: 'Слишком много неудачных попыток входа. Пожалуйста, подождите 5 минут.',
      });
    }

    const matchingUsers = await ydb.findByField<UserProfile>('users', 'email', email);
    // Prioritize record containing passwordHash if multiple duplicates exist
    const user = matchingUsers.find((u) => Boolean(u.passwordHash)) || matchingUsers[0];

    if (!user || !user.passwordHash) {
      recordFailedLogin(rateKey);
      return json(event, 401, { error: 'Неверный адрес эл. почты или пароль' });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordFailedLogin(rateKey);
      return json(event, 401, { error: 'Неверный адрес эл. почты или пароль' });
    }

    resetFailedLogin(rateKey);

    const sessionToken = createJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        activeRole: user.activeRole || user.role,
        roles: user.roles || [user.role],
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = { ...user };
    delete cleanUser.passwordHash;

    return json(
      event,
      200,
      { success: true, user: cleanUser },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // POST /api/auth/logout
  if (subPath === '/logout' && method === 'POST') {
    return json(event, 200, { success: true }, { cookies: [clearSessionCookie()] });
  }

  // GET /api/auth/me
  if (subPath === '/me' && method === 'GET') {
    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' }, { cookies: [clearSessionCookie()] });
    }
    return json(event, 200, { user });
  }

  // PATCH /api/auth/profile
  if (subPath === '/profile' && method === 'PATCH') {
    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' });
    }

    const body = parseBody<Record<string, any>>(event);
    if (!body) {
      return json(event, 400, { error: 'Отсутствуют данные для обновления' });
    }

    // Strict boundary: Only allow safe fields for profile update
    const allowedKeys = ['name', 'phone', 'inn', 'favorites', 'photoURL'];
    const updates: Record<string, any> = {};

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Fetch full existing record to strictly preserve passwordHash
    const existing = await ydb.getItem<UserProfile>('users', user.id);
    if (!existing) {
      return json(event, 404, { error: 'Пользователь не найден' });
    }

    const updatedUser: UserProfile = {
      ...existing,
      ...updates,
      // CRITICAL: Strictly preserve passwordHash and immutable roles
      passwordHash: existing.passwordHash,
      role: existing.role,
      roles: existing.roles,
      activeRole: existing.activeRole,
      isPartnerApproved: existing.isPartnerApproved,
      isInvestorApproved: existing.isInvestorApproved,
      registeredAt: existing.registeredAt,
      authProvider: existing.authProvider,
    };

    await ydb.putItem('users', updatedUser);

    const cleanUser: UserProfile = { ...updatedUser };
    delete cleanUser.passwordHash;

    return json(event, 200, { success: true, user: cleanUser });
  }

  // POST /api/auth/switch-role
  if (subPath === '/switch-role' && method === 'POST') {
    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' });
    }

    const body = parseBody<{ targetRole?: UserRole }>(event);
    const targetRole = body?.targetRole;

    if (!targetRole) {
      return json(event, 400, { error: 'Укажите целевую роль' });
    }

    const userRoles = user.roles || [user.role];
    if (!userRoles.includes(targetRole)) {
      return json(event, 403, {
        error: 'Запрошенная роль не назначена вашему профилю',
      });
    }

    const existing = await ydb.getItem<UserProfile>('users', user.id);
    if (!existing) {
      return json(event, 404, { error: 'Пользователь не найден' });
    }

    existing.activeRole = targetRole;
    // ensure existing record is saved with passwordHash intact
    await ydb.putItem('users', existing);

    const sessionToken = createJwt(
      {
        userId: existing.id,
        email: existing.email,
        role: existing.role,
        activeRole: targetRole,
        roles: existing.roles,
      },
      cfg.JWT_SIGNING_SECRET
    );

    return json(
      event,
      200,
      { success: true, activeRole: targetRole },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // GET /api/auth/yandex/start
  if (subPath === '/yandex/start' && method === 'GET') {
    const state = crypto.randomBytes(24).toString('hex');
    const redirectUri = `${cfg.PUBLIC_BASE_URL}/api/auth/yandex/callback`;
    const yandexAuthUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${
      cfg.YANDEX_OAUTH_CLIENT_ID
    }&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return redirect(event, yandexAuthUrl, [createOAuthStateCookie(state)], cfg.PUBLIC_BASE_URL);
  }

  // GET /api/auth/yandex/callback
  if (subPath === '/yandex/callback' && method === 'GET') {
    const query = event.queryStringParameters || {};
    const code = query['code'];
    const state = query['state'];

    const cookies = parseCookies(event);
    const storedState = cookies['domexit_oauth_state'];

    if (!state || !storedState || state !== storedState) {
      return json(event, 400, { error: 'Недействительный параметр состояния OAuth (state mismatch)' });
    }

    if (!code) {
      return json(event, 400, { error: 'Отсутствует код авторизации Yandex' });
    }

    const redirectUri = `${cfg.PUBLIC_BASE_URL}/api/auth/yandex/callback`;

    // Exchange code for token
    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: cfg.YANDEX_OAUTH_CLIENT_ID,
        client_secret: cfg.YANDEX_OAUTH_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[Yandex OAuth] Token exchange failed:', errText);
      return json(event, 400, { error: 'Ошибка обмена токена Yandex OAuth' });
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;

    // Fetch user info from Yandex Login API
    const userRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: {
        Authorization: `OAuth ${accessToken}`,
      },
    });

    if (!userRes.ok) {
      return json(event, 400, { error: 'Не удалось получить данные профиля из Yandex' });
    }

    const yandexProfile = (await userRes.json()) as any;
    const yandexEmail = (yandexProfile.default_email || yandexProfile.emails?.[0])?.trim().toLowerCase();
    const yandexName =
      yandexProfile.real_name ||
      yandexProfile.display_name ||
      `${yandexProfile.first_name || ''} ${yandexProfile.last_name || ''}`.trim() ||
      'Пользователь Yandex';
    const yandexAvatar = yandexProfile.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${yandexProfile.default_avatar_id}/islands-200`
      : undefined;

    if (!yandexEmail) {
      return json(event, 400, { error: 'В профиле Yandex отсутствует адрес электронной почты' });
    }

    // Check if user already exists
    const existingList = await ydb.findByField<UserProfile>('users', 'email', yandexEmail);
    // Prioritize user with passwordHash if multiple duplicate records exist
    let user = existingList.find((u) => Boolean(u.passwordHash)) || existingList[0];

    const isMasterOwnerEmail =
      yandexEmail === 'amaas9499@gmail.com' ||
      yandexEmail === (process.env.BOOTSTRAP_OWNER_EMAIL || '').trim().toLowerCase();

    if (user) {
      // Existing user: preserve existing passwordHash & roles, ensure master owner role if email matches
      if (isMasterOwnerEmail && user.role !== 'owner') {
        user.role = 'owner';
        user.roles = ['owner', 'employee', 'seller', 'buyer'];
        user.activeRole = 'owner';
      }
      user.yandexId = yandexProfile.id;
      if (!user.photoURL && yandexAvatar) user.photoURL = yandexAvatar;
      // Do NOT erase passwordHash!
      await ydb.putItem('users', user);
    } else {
      // New user
      const assignedRole: UserRole = isMasterOwnerEmail ? 'owner' : 'buyer';
      const assignedRoles: UserRole[] = isMasterOwnerEmail
        ? ['owner', 'employee', 'seller', 'buyer']
        : ['buyer'];

      user = {
        id: `usr-yx-${crypto.randomUUID().substring(0, 10)}`,
        email: yandexEmail,
        name: yandexName,
        role: assignedRole,
        activeRole: assignedRole,
        roles: assignedRoles,
        yandexId: yandexProfile.id,
        photoURL: yandexAvatar,
        favorites: [],
        registeredAt: new Date().toISOString(),
        authProvider: 'yandex',
      };
      await ydb.putItem('users', user);
    }

    const sessionToken = createJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        activeRole: user.activeRole || user.role,
        roles: user.roles,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const redirectPath =
      user.role === 'owner' || user.role === 'employee' ? '/admin/dashboard' : '/portal';
    const finalUrl = `${cfg.PUBLIC_BASE_URL}${redirectPath}`;

    return redirect(
      event,
      finalUrl,
      [createSessionCookie(sessionToken), clearOAuthStateCookie()],
      cfg.PUBLIC_BASE_URL
    );
  }

  return json(event, 404, { error: 'Auth route not found' });
}
