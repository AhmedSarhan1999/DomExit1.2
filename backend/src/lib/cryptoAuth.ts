import crypto from 'node:crypto';
import { AuthSessionPayload, UserProfile, YcHttpEvent } from '../types.js';
import { normalizeHeaders, parseCookies } from './http.js';
import { getConfig } from './config.js';
import { getYdbClient } from './ydbClient.js';

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const [saltHex, keyHex] = storedHash.split(':');
      if (!saltHex || !keyHex) return resolve(false);

      const salt = Buffer.from(saltHex, 'hex');
      const expectedKey = Buffer.from(keyHex, 'hex');

      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        if (derivedKey.length !== expectedKey.length) return resolve(false);
        resolve(crypto.timingSafeEqual(derivedKey, expectedKey));
      });
    } catch {
      resolve(false);
    }
  });
}

function base64UrlEncode(strOrBuf: string | Buffer): string {
  const buf = typeof strOrBuf === 'string' ? Buffer.from(strOrBuf, 'utf-8') : strOrBuf;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function createJwt(
  payload: Record<string, any>,
  secret: string,
  expiresInSeconds = 604800
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encHeader}.${encPayload}`;

  const sig = crypto.createHmac('sha256', secret).update(data).digest();
  const encSig = base64UrlEncode(sig);

  return `${data}.${encSig}`;
}

export function verifyJwt<T = any>(token: string, secret: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encHeader, encPayload, encSig] = parts;
    const data = `${encHeader}.${encPayload}`;

    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest();
    const actualSig = Buffer.from(
      encSig.replace(/-/g, '+').replace(/_/g, '/') +
        '==='.slice((encSig.length + 3) % 4),
      'base64'
    );

    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const payload = JSON.parse(base64UrlDecode(encPayload)) as any;
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload as T;
  } catch {
    return null;
  }
}

// In-Memory Rate Limiter for Login Attempts
interface AttemptRecord {
  count: number;
  resetAt: number;
}
const loginAttempts = new Map<string, AttemptRecord>();

export function checkLoginRateLimit(key: string, maxAttempts = 5, windowMs = 300000): boolean {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec) return true;
  if (now > rec.resetAt) {
    loginAttempts.delete(key);
    return true;
  }
  return rec.count < maxAttempts;
}

export function recordFailedLogin(key: string, windowMs = 300000): void {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    rec.count += 1;
  }
}

export function resetFailedLogin(key: string): void {
  loginAttempts.delete(key);
}

export async function getAuthenticatedUser(event: YcHttpEvent): Promise<UserProfile | null> {
  const cookies = parseCookies(event);
  let token = cookies['domexit_session'];
  if (!token) {
    const norm = normalizeHeaders(event.headers, event.multiValueHeaders);
    const authHdr = norm['authorization'] || '';
    if (authHdr.toLowerCase().startsWith('bearer ')) {
      token = authHdr.slice(7).trim();
    }
  }
  if (!token) return null;

  const cfg = getConfig();
  const payload = verifyJwt<AuthSessionPayload>(token, cfg.JWT_SIGNING_SECRET);
  if (!payload?.userId) return null;

  try {
    const ydb = getYdbClient();
    const user = await ydb.getItem<UserProfile>('users', payload.userId);
    if (!user) return null;

    // Verify token version for session invalidation (defaults to 1 if unset)
    const expectedTokenVersion = user.tokenVersion ?? 1;
    if (payload.tv !== undefined && payload.tv !== expectedTokenVersion) {
      return null;
    }

    // Never expose passwordHash; compute secure provider and password status
    const hasPassword = Boolean(user.passwordHash && user.passwordHash.length > 0);
    const authProviders: Array<'password' | 'yandex' | 'phone'> =
      user.authProviders && user.authProviders.length > 0
        ? user.authProviders
        : hasPassword
        ? ['password']
        : ['yandex'];

    const cleanUser: UserProfile = {
      ...user,
      hasPassword,
      authProviders,
      tokenVersion: expectedTokenVersion,
    };
    delete cleanUser.passwordHash;
    return cleanUser;
  } catch (err: any) {
    console.error('[getAuthenticatedUser] Failed reading user from YDB:', err.message);
    return null;
  }
}
