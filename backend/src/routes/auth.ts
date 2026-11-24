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
import { consumeQuota, recordSecurityIncident } from '../lib/anomalyDetector.js';
import { sendEmail, renderPasswordResetEmail, maskEmail } from '../lib/emailService.js';
import { logger } from '../lib/logger.js';
import { checkRateLimit } from '../lib/rateLimit.js';

export function normalizeRussianPhone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  let normalized = digits;
  if (normalized.startsWith('8') || normalized.startsWith('7')) {
    normalized = normalized.slice(1);
  }
  normalized = normalized.slice(0, 10);
  if (normalized.length === 10) {
    return `+7 (${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 8)}-${normalized.slice(8, 10)}`;
  }
  return raw.trim();
}

export function normalizeE164Phone(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  let normalized = digits;
  if (normalized.startsWith('8') && normalized.length === 11) {
    normalized = '7' + normalized.slice(1);
  } else if (normalized.length === 10) {
    normalized = '7' + normalized;
  }
  if (normalized.length >= 11) {
    return `+${normalized}`;
  }
  return undefined;
}

export async function handleAuth(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = event.httpMethod.toUpperCase();
  const cfg = getConfig();
  const ydb = getYdbClient();

  // POST /api/auth/register
  if (subPath === '/register' && method === 'POST') {
    const rateCheck = checkRateLimit(event, {
      scope: 'auth_register',
      limit: 10,
      windowSec: 900,
      customMessageRu: 'Превышен лимит регистраций с вашего IP-адреса. Пожалуйста, подождите 15 минут.',
    });
    if (!rateCheck.allowed) return rateCheck.response!;

    const clientIp = getClientIp(event);
    const regQuota = await consumeQuota({
      scope: 'auth_register_ip',
      actorKey: clientIp || 'unknown_ip',
      limit: 10,
      windowSec: 900,
    });
    if (!regQuota.allowed) {
      await recordSecurityIncident({
        type: 'auth_bruteforce_or_probe',
        severity: 'medium',
        clientIp,
        endpoint: '/api/auth/register',
        summary: 'Превышен лимит регистраций с одного IP адреса (максимум 5 в час)',
      });
      return json(
        event,
        429,
        {
          error: 'Превышен лимит регистраций с вашего IP-адреса. Пожалуйста, подождите.',
          retryAfter: regQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(regQuota.retryAfterSec) } }
      );
    }

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
    const phone = normalizeRussianPhone(body?.phone);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(event, 400, { error: 'Некорректный адрес электронной почты' });
    }
    if (!password || password.length < 8) {
      return json(event, 400, { error: 'Пароль должен содержать не менее 8 символов' });
    }
    if (!name) {
      return json(event, 400, { error: 'Имя обязательно для заполнения' });
    }

    // Role security check: public registration always creates a unified client (buyer + seller)
    const assignedRole: UserRole = 'buyer';
    const clientRoles: UserRole[] = ['buyer', 'seller'];

    // Check if user already exists
    const existingList = await ydb.findByField<UserProfile>('users', 'email', email);
    const existingWithPass = existingList.find((u) => Boolean(u.passwordHash));

    if (existingWithPass) {
      return json(event, 409, { error: 'Пользователь с таким email уже зарегистрирован' });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();
    const phoneNormalized = normalizeE164Phone(body?.phone);

    let userToSave: UserProfile;
    if (existingList.length > 0) {
      // User existed (e.g. from OAuth) without password: safe merge without duplicate record
      const existing = existingList[0];
      const providers = new Set(existing.authProviders || []);
      providers.add('password');
      if (existing.yandexId || existing.authProvider === 'yandex') providers.add('yandex');
      userToSave = {
        ...existing,
        email,
        name: name || existing.name,
        phone: phone || existing.phone,
        phoneNormalized: phoneNormalized || existing.phoneNormalized,
        passwordHash,
        authProviders: Array.from(providers) as Array<'password' | 'yandex' | 'phone'>,
        tokenVersion: (existing.tokenVersion ?? 1) + 1,
        authProvider: existing.authProvider || 'local',
      };
    } else {
      const userId = `usr-${crypto.randomUUID().substring(0, 12)}`;
      userToSave = {
        id: userId,
        email,
        name,
        phone,
        phoneNormalized,
        role: assignedRole,
        activeRole: assignedRole,
        roles: clientRoles,
        registeredAt: now,
        authProvider: 'local',
        authProviders: ['password'],
        tokenVersion: 1,
        favorites: [],
        passwordHash,
      };
    }

    // Auto-link accredited partner if approved in partners
    try {
      const allPartners = await ydb.scanAll<any>('partners');
      const cleanEmail = (userToSave.email || '').trim().toLowerCase();
      const approvedPartner = allPartners.find(
        (p: any) =>
          p.email &&
          p.email.trim().toLowerCase() === cleanEmail &&
          (p.status === 'approved' || p.isApproved)
      );
      if (approvedPartner) {
        if (!userToSave.roles.includes('partner')) {
          userToSave.roles.push('partner');
        }
        userToSave.isPartnerApproved = true;
        userToSave.partnerId = approvedPartner.id;
        userToSave.partnerRefCode = approvedPartner.referralCode || userToSave.partnerRefCode;
        userToSave.referralCode = approvedPartner.referralCode || userToSave.referralCode;
        if (!approvedPartner.userId) {
          approvedPartner.userId = userToSave.id;
          await ydb.putItem('partners', approvedPartner);
        }
      }
    } catch (partnerErr) {
      console.warn('[auth] Non-fatal partner auto-link error:', partnerErr);
    }

    await ydb.putItem('users', userToSave);

    const tokenVersion = userToSave.tokenVersion ?? 1;
    const sessionToken = createJwt(
      {
        userId: userToSave.id,
        email: userToSave.email,
        role: userToSave.role,
        activeRole: userToSave.activeRole,
        roles: userToSave.roles,
        tv: tokenVersion,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = {
      ...userToSave,
      hasPassword: true,
      authProviders: userToSave.authProviders || ['password'],
      tokenVersion,
    };
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
    const rateCheck = checkRateLimit(event, {
      scope: 'auth_login',
      limit: 10,
      windowSec: 900,
      customMessageRu: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут.',
    });
    if (!rateCheck.allowed) return rateCheck.response!;

    const clientIp = getClientIp(event);
    const body = parseBody<{ email?: string; password?: string }>(event);
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    if (!email || !password) {
      return json(event, 400, { error: 'Укажите email и пароль' }, { extraHeaders: rateCheck.headers });
    }

    const rateKey = `${clientIp}:${email}`;
    const accountCheck = checkRateLimit(event, {
      scope: `auth_account_${email}`,
      limit: 5,
      windowSec: 300,
      customMessageRu: 'Слишком много неудачных попыток входа. Пожалуйста, подождите 5 минут.',
    });
    if (!accountCheck.allowed) {
      await recordSecurityIncident({
        type: 'auth_bruteforce_or_probe',
        severity: 'high',
        clientIp,
        endpoint: '/api/auth/login',
        summary: `Блокировка перебора паролей для аккаунта: ${email}`,
        details: { email, clientIp },
      });
      return accountCheck.response!;
    }

    const matchingUsers = await ydb.findByField<UserProfile>('users', 'email', email);
    // If user account was created via OAuth (Yandex) without a local password
    if (matchingUsers.length > 0 && !matchingUsers.some((u) => Boolean(u.passwordHash))) {
      return json(event, 400, {
        error: 'Для этого аккаунта вход настроен через Яндекс ID. Войдите через Яндекс ID и задайте пароль в профиле, либо воспользуйтесь восстановлением пароля.',
        code: 'oauth_only_account',
      });
    }

    // Prioritize record containing passwordHash if multiple duplicates exist
    const user = matchingUsers.find((u) => Boolean(u.passwordHash)) || matchingUsers[0];

    if (!user || !user.passwordHash) {
      recordFailedLogin(rateKey);
      return json(event, 401, { error: 'Неверный адрес эл. почты или пароль' }, { extraHeaders: rateCheck.headers });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      recordFailedLogin(rateKey);
      return json(event, 401, { error: 'Неверный адрес эл. почты или пароль' }, { extraHeaders: rateCheck.headers });
    }

    resetFailedLogin(rateKey);

    const tokenVersion = user.tokenVersion ?? 1;
    const sessionToken = createJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        activeRole: user.activeRole || user.role,
        roles: user.roles || [user.role],
        tv: tokenVersion,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = {
      ...user,
      hasPassword: true,
      authProviders: user.authProviders || ['password'],
      tokenVersion,
    };
    delete cleanUser.passwordHash;

    return json(
      event,
      200,
      { success: true, user: cleanUser },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // POST /api/auth/set-password
  if (subPath === '/set-password' && method === 'POST') {
    const rateCheck = checkRateLimit(event, {
      scope: 'auth_set_password',
      limit: 5,
      windowSec: 900,
      customMessageRu: 'Превышен лимит запросов на установку пароля. Попробуйте через 15 минут.',
    });
    if (!rateCheck.allowed) return rateCheck.response!;

    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' });
    }

    const body = parseBody<{
      newPassword?: string;
      confirmPassword?: string;
    }>(event);

    const newPassword = body?.newPassword?.trim();
    const confirmPassword = body?.confirmPassword?.trim();

    if (!newPassword || newPassword.length < 8) {
      return json(event, 400, { error: 'Новый пароль должен содержать не менее 8 символов' });
    }
    if (!/[A-Za-zА-Яа-я]/.test(newPassword) || !/\d/.test(newPassword)) {
      return json(event, 400, { error: 'Пароль должен содержать как буквы, так и цифры' });
    }
    if (newPassword !== confirmPassword) {
      return json(event, 400, { error: 'Новый пароль и подтверждение пароля не совпадают' });
    }

    const dbUser = await ydb.getItem<UserProfile>('users', user.id);
    if (!dbUser) {
      return json(event, 404, { error: 'Пользователь не найден' });
    }

    const passwordHash = await hashPassword(newPassword);
    dbUser.passwordHash = passwordHash;
    const currentProviders = new Set(dbUser.authProviders || []);
    currentProviders.add('password');
    if (dbUser.yandexId || dbUser.authProvider === 'yandex') {
      currentProviders.add('yandex');
    }
    dbUser.authProviders = Array.from(currentProviders) as Array<'password' | 'yandex' | 'phone'>;
    const nextTokenVersion = (dbUser.tokenVersion ?? 1) + 1;
    dbUser.tokenVersion = nextTokenVersion;
    dbUser.updatedAt = new Date().toISOString();

    await ydb.putItem('users', dbUser);

    const sessionToken = createJwt(
      {
        userId: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        activeRole: dbUser.activeRole || dbUser.role,
        roles: dbUser.roles || [dbUser.role],
        tv: nextTokenVersion,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = {
      ...dbUser,
      hasPassword: true,
      authProviders: dbUser.authProviders,
      tokenVersion: nextTokenVersion,
    };
    delete cleanUser.passwordHash;

    return json(
      event,
      200,
      { success: true, user: cleanUser, message: 'Пароль успешно установлен' },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // POST /api/auth/change-password
  if (subPath === '/change-password' && method === 'POST') {
    const rateCheck = checkRateLimit(event, {
      scope: 'auth_change_password',
      limit: 5,
      windowSec: 900,
      customMessageRu: 'Превышен лимит запросов на смену пароля. Попробуйте через 15 минут.',
    });
    if (!rateCheck.allowed) return rateCheck.response!;

    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' });
    }

    const body = parseBody<{
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    }>(event);

    const currentPassword = body?.currentPassword;
    const newPassword = body?.newPassword?.trim();
    const confirmPassword = body?.confirmPassword?.trim();

    const dbUser = await ydb.getItem<UserProfile>('users', user.id);
    if (!dbUser) {
      return json(event, 404, { error: 'Пользователь не найден' });
    }

    // If user already has a password, verify current password
    if (dbUser.passwordHash) {
      if (!currentPassword) {
        return json(event, 400, { error: 'Введите текущий пароль' });
      }
      const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!isValid) {
        return json(event, 400, { error: 'Неверный текущий пароль' });
      }
    }

    if (!newPassword || newPassword.length < 8) {
      return json(event, 400, { error: 'Новый пароль должен содержать не менее 8 символов' });
    }
    if (!/[A-Za-zА-Яа-я]/.test(newPassword) || !/\d/.test(newPassword)) {
      return json(event, 400, { error: 'Пароль должен содержать как буквы, так и цифры' });
    }
    if (newPassword !== confirmPassword) {
      return json(event, 400, { error: 'Новый пароль и подтверждение пароля не совпадают' });
    }

    const passwordHash = await hashPassword(newPassword);
    dbUser.passwordHash = passwordHash;
    const currentProviders = new Set(dbUser.authProviders || []);
    currentProviders.add('password');
    if (dbUser.yandexId || dbUser.authProvider === 'yandex') {
      currentProviders.add('yandex');
    }
    dbUser.authProviders = Array.from(currentProviders) as Array<'password' | 'yandex' | 'phone'>;
    const nextTokenVersion = (dbUser.tokenVersion ?? 1) + 1;
    dbUser.tokenVersion = nextTokenVersion;
    dbUser.updatedAt = new Date().toISOString();

    await ydb.putItem('users', dbUser);

    const sessionToken = createJwt(
      {
        userId: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        activeRole: dbUser.activeRole || dbUser.role,
        roles: dbUser.roles || [dbUser.role],
        tv: nextTokenVersion,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const cleanUser: UserProfile = {
      ...dbUser,
      hasPassword: true,
      authProviders: dbUser.authProviders,
      tokenVersion: nextTokenVersion,
    };
    delete cleanUser.passwordHash;

    return json(
      event,
      200,
      { success: true, user: cleanUser, message: 'Пароль успешно обновлен' },
      { cookies: [createSessionCookie(sessionToken)] }
    );
  }

  // POST /api/auth/dismiss-password-setup
  if (subPath === '/dismiss-password-setup' && method === 'POST') {
    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' });
    }
    const dbUser = await ydb.getItem<UserProfile>('users', user.id);
    if (dbUser) {
      dbUser.passwordSetupDismissedAt = new Date().toISOString();
      await ydb.putItem('users', dbUser);
    }
    return json(event, 200, { success: true });
  }

  // POST /api/auth/logout
  if (subPath === '/logout' && method === 'POST') {
    return json(event, 200, { success: true }, { cookies: [clearSessionCookie()] });
  }

  // POST /api/auth/forgot-password
  if (subPath === '/forgot-password' && method === 'POST') {
    const clientIp = getClientIp(event);
    const body = parseBody<{ email?: string }>(event);
    const email = body?.email?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(event, 400, { error: 'Укажите корректный адрес электронной почты' });
    }

    // Rate Limiting: max 5 requests per 15 minutes per IP
    const ipQuota = await consumeQuota({
      scope: 'auth_forgot_ip',
      actorKey: clientIp || 'unknown_ip',
      limit: 5,
      windowSec: 900,
    });
    if (!ipQuota.allowed) {
      return json(
        event,
        429,
        {
          error: 'Слишком много запросов на восстановление пароля. Пожалуйста, подождите 15 минут.',
          retryAfter: ipQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(ipQuota.retryAfterSec) } }
      );
    }

    // Rate Limiting: max 3 requests per 15 minutes per email
    const emailQuota = await consumeQuota({
      scope: 'auth_forgot_email',
      actorKey: email,
      limit: 3,
      windowSec: 900,
    });
    if (!emailQuota.allowed) {
      return json(
        event,
        429,
        {
          error: 'Слишком много запросов для этого адреса. Пожалуйста, подождите 15 минут.',
          retryAfter: emailQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(emailQuota.retryAfterSec) } }
      );
    }

    // Generic anti-enumeration response message
    const genericSuccessMessage =
      'Если аккаунт существует, код восстановления отправлен на указанный email.';

    try {
      const users = await ydb.findByField<UserProfile>('users', 'email', email);
      const user = users.find((u) => Boolean(u.passwordHash)) || users[0];

      if (user) {
        // Generate random 6-digit code
        const rawCode = crypto.randomInt(100000, 1000000).toString();
        const otpSalt = crypto.randomBytes(16).toString('hex');
        const otpHash = crypto
          .createHash('sha256')
          .update(`${rawCode}:${otpSalt}`)
          .digest('hex');

        const now = Date.now();
        const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); // 15 minutes
        const otpRecordKey = `pwreset:${email}`;

        await ydb.putItem('pep_otps', {
          id: otpRecordKey,
          userId: user.id,
          email,
          type: 'password_reset',
          otpSalt,
          otpHash,
          attempts: 0,
          maxAttempts: 5,
          createdAt: new Date(now).toISOString(),
          expiresAt,
          used: false,
        });

        // Send email with emerald template
        const emailContent = renderPasswordResetEmail({
          code: rawCode,
          expiresInMinutes: 15,
        });

        await sendEmail({
          to: email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
      }
    } catch (err: any) {
      console.warn('[auth:forgot-password] Error processing reset request:', err.message);
    }

    return json(event, 200, {
      ok: true,
      message: genericSuccessMessage,
    });
  }

  // POST /api/auth/reset-password
  if (subPath === '/reset-password' && method === 'POST') {
    const clientIp = getClientIp(event);
    const body = parseBody<{
      email?: string;
      code?: string;
      newPassword?: string;
    }>(event);

    const email = body?.email?.trim().toLowerCase();
    const code = String(body?.code || '').trim();
    const newPassword = body?.newPassword;

    if (!email || !code || !newPassword) {
      return json(event, 400, { error: 'Укажите email, код подтверждения и новый пароль' });
    }

    if (newPassword.length < 8) {
      return json(event, 400, { error: 'Новый пароль должен содержать не менее 8 символов' });
    }

    if (!/^\d{6}$/.test(code)) {
      return json(event, 400, { error: 'Код подтверждения должен состоять из 6 цифр' });
    }

    const otpRecordKey = `pwreset:${email}`;
    const otpRecord = await ydb.getItem<any>('pep_otps', otpRecordKey);

    if (!otpRecord || otpRecord.used) {
      return json(event, 400, {
        error: 'Код восстановления не запрашивался или уже был использован. Запросите новый код.',
      });
    }

    if (new Date(otpRecord.expiresAt).getTime() < Date.now()) {
      return json(event, 400, {
        error: 'Срок действия кода восстановления истек (15 минут). Запросите новый код.',
      });
    }

    if (otpRecord.attempts >= 5) {
      return json(event, 423, {
        error: 'Превышено максимальное количество попыток (5). Код заблокирован. Запросите новый.',
        locked: true,
      });
    }

    // Timing-safe comparison
    const candidateHash = crypto
      .createHash('sha256')
      .update(`${code}:${otpRecord.otpSalt}`)
      .digest('hex');

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(candidateHash),
      Buffer.from(otpRecord.otpHash)
    );

    if (!isMatch) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      const isLocked = newAttempts >= 5;

      await ydb.putItem('pep_otps', {
        ...otpRecord,
        attempts: newAttempts,
        used: isLocked ? true : otpRecord.used,
      });

      if (isLocked) {
        await recordSecurityIncident({
          type: 'auth_bruteforce_or_probe',
          severity: 'high',
          clientIp,
          endpoint: '/api/auth/reset-password',
          summary: `Блокировка подбора кода сброса пароля для: ${maskEmail(email)}`,
        });
        return json(event, 423, {
          error: 'Превышено максимальное число неверных попыток (5). Код аннулирован.',
          locked: true,
        });
      }

      return json(event, 400, {
        error: `Неверный код подтверждения. Осталось попыток: ${5 - newAttempts}`,
        remainingAttempts: 5 - newAttempts,
      });
    }

    // Code is valid! Mark used
    await ydb.putItem('pep_otps', {
      ...otpRecord,
      used: true,
      usedAt: new Date().toISOString(),
    });

    // Update user password
    const users = await ydb.findByField<UserProfile>('users', 'email', email);
    const user = users.find((u) => Boolean(u.passwordHash)) || users[0];

    if (!user) {
      return json(event, 404, { error: 'Пользователь не найден' });
    }

    const newPasswordHash = await hashPassword(newPassword);
    user.passwordHash = newPasswordHash;
    user.tokenVersion = (user.tokenVersion ?? 1) + 1;
    (user as any).updatedAt = new Date().toISOString();
    await ydb.putItem('users', user);

    // Audit log
    try {
      await ydb.putItem('audit_logs', {
        id: `aud-${crypto.randomUUID()}`,
        action: 'PASSWORD_RESET',
        targetUserId: user.id,
        targetEmailMasked: maskEmail(email),
        clientIp,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return json(event, 200, {
      ok: true,
      message: 'Пароль успешно обновлен. Теперь вы можете войти в систему с новым паролем.',
    });
  }

  // GET /api/auth/me
  if (subPath === '/me' && method === 'GET') {
    const user = await getAuthenticatedUser(event);
    if (!user) {
      return json(event, 401, { error: 'Не авторизован' }, { cookies: [clearSessionCookie()] });
    }

    // Auto-sync Telegram binding into user profile if missing in users table
    if (!user.telegram || !user.telegramUsername) {
      try {
        const binding = await ydb.getItem<any>('telegram_bindings', `user:${user.id}`);
        if (binding?.telegramUsername) {
          const rawUname = binding.telegramUsername.replace(/^@+/, '');
          user.telegram = user.telegram || `@${rawUname}`;
          user.telegramUsername = user.telegramUsername || rawUname;
          user.telegramChatId = user.telegramChatId || String(binding.chatId || '');
          user.telegramBotUsername = user.telegramBotUsername || rawUname;
          user.updatedAt = new Date().toISOString();
          void ydb.putItem('users', user);
        }
      } catch (err: any) {
        logger.warn('Failed to auto-sync telegram binding in /api/auth/me', { meta: { error: err.message, userId: user.id } });
      }
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
    const allowedKeys = ['name', 'phone', 'phoneNormalized', 'inn', 'favorites', 'photoURL', 'telegram', 'telegramUsername'];
    const updates: Record<string, any> = {};

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Auto-normalize Russian phone if provided
    if (body.phone !== undefined) {
      updates.phone = normalizeRussianPhone(String(body.phone)) || '';
      updates.phoneNormalized = normalizeE164Phone(String(body.phone)) || '';
    }

    // Auto-sanitize and harmonize Telegram account (@username and username)
    if (body.telegram !== undefined || body.telegramUsername !== undefined) {
      const rawTg = String(body.telegram ?? body.telegramUsername ?? '').trim();
      const cleanTg = rawTg
        .replace(/^https?:\/\/t\.me\//i, '')
        .replace(/^t\.me\//i, '')
        .replace(/^@+/, '')
        .trim();
      if (cleanTg) {
        updates.telegram = `@${cleanTg}`;
        updates.telegramUsername = cleanTg;
      } else {
        updates.telegram = '';
        updates.telegramUsername = '';
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
        tv: existing.tokenVersion ?? 1,
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
    const redirectUri = cfg.YANDEX_REDIRECT_URI || `${cfg.PUBLIC_BASE_URL}/api/auth/yandex/callback`;
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

    const redirectUri = cfg.YANDEX_REDIRECT_URI || `${cfg.PUBLIC_BASE_URL}/api/auth/yandex/callback`;

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

    const rawYandexPhone = yandexProfile.default_phone?.number || yandexProfile.phone;
    const yandexPhone = normalizeRussianPhone(rawYandexPhone);
    const yandexPhoneNormalized = normalizeE164Phone(rawYandexPhone);

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
      if (!user.phone && yandexPhone) user.phone = yandexPhone;
      if (!user.phoneNormalized && yandexPhoneNormalized) user.phoneNormalized = yandexPhoneNormalized;
      const providers = new Set(user.authProviders || []);
      providers.add('yandex');
      if (user.passwordHash) providers.add('password');
      user.authProviders = Array.from(providers) as Array<'password' | 'yandex' | 'phone'>;
      user.tokenVersion = user.tokenVersion ?? 1;
      // Do NOT erase passwordHash!
      await ydb.putItem('users', user);
    } else {
      // New user: unified client by default
      const assignedRole: UserRole = isMasterOwnerEmail ? 'owner' : 'buyer';
      const assignedRoles: UserRole[] = isMasterOwnerEmail
        ? ['owner', 'employee', 'seller', 'buyer']
        : ['buyer', 'seller'];

      user = {
        id: `usr-yx-${crypto.randomUUID().substring(0, 10)}`,
        email: yandexEmail,
        name: yandexName,
        phone: yandexPhone,
        phoneNormalized: yandexPhoneNormalized,
        role: assignedRole,
        activeRole: assignedRole,
        roles: assignedRoles,
        yandexId: yandexProfile.id,
        photoURL: yandexAvatar,
        favorites: [],
        registeredAt: new Date().toISOString(),
        authProvider: 'yandex',
        authProviders: ['yandex'],
        tokenVersion: 1,
      };
      await ydb.putItem('users', user);
    }

    // Auto-link accredited partner if approved in partners
    try {
      const allPartners = await ydb.scanAll<any>('partners');
      const cleanEmail = yandexEmail.trim().toLowerCase();
      const approvedPartner = allPartners.find(
        (p: any) =>
          p.email &&
          p.email.trim().toLowerCase() === cleanEmail &&
          (p.status === 'approved' || p.isApproved)
      );
      if (approvedPartner) {
        if (!user.roles.includes('partner')) {
          user.roles.push('partner');
        }
        user.isPartnerApproved = true;
        user.partnerId = approvedPartner.id;
        user.partnerRefCode = approvedPartner.referralCode || user.partnerRefCode;
        user.referralCode = approvedPartner.referralCode || user.referralCode;
        if (!approvedPartner.userId) {
          approvedPartner.userId = user.id;
          await ydb.putItem('partners', approvedPartner);
        }
        await ydb.putItem('users', user);
      }
    } catch (partnerErr) {
      console.warn('[auth] Non-fatal partner auto-link in yandex callback:', partnerErr);
    }

    const sessionToken = createJwt(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        activeRole: user.activeRole || user.role,
        roles: user.roles,
        tv: user.tokenVersion ?? 1,
      },
      cfg.JWT_SIGNING_SECRET
    );

    const isStaff = user.role === 'owner' || user.role === 'employee';
    const hasNoPassword = !user.passwordHash;
    const redirectPath = isStaff
      ? '/admin/dashboard'
      : hasNoPassword
      ? '/portal?setup_password=1'
      : '/portal';
    const finalUrl = `${cfg.FRONTEND_URL || cfg.PUBLIC_BASE_URL}${redirectPath}`;

    return redirect(
      event,
      finalUrl,
      [createSessionCookie(sessionToken), clearOAuthStateCookie()],
      cfg.FRONTEND_URL || cfg.PUBLIC_BASE_URL
    );
  }

  return json(event, 404, { error: 'Auth route not found' });
}
