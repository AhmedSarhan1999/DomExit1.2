import { YcHttpEvent, YcHttpResponse } from '../types.js';

export function normalizeHeaders(
  headers?: Record<string, string>,
  multiValueHeaders?: Record<string, string[]>
): Record<string, string> {
  const norm: Record<string, string> = {};
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      norm[k.toLowerCase()] = v;
    }
  }
  if (multiValueHeaders) {
    for (const [k, vList] of Object.entries(multiValueHeaders)) {
      if (vList && vList.length > 0) {
        norm[k.toLowerCase()] = vList.join('; ');
      }
    }
  }
  return norm;
}

export function parseCookies(event: YcHttpEvent): Record<string, string> {
  const norm = normalizeHeaders(event.headers, event.multiValueHeaders);
  const cookieHeader = norm['cookie'] || '';
  const result: Record<string, string> = {};

  if (!cookieHeader) return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

export function parseBody<T = any>(event: YcHttpEvent): T | null {
  if (!event.body) return null;
  try {
    let raw = event.body;
    if (event.isBase64Encoded) {
      raw = Buffer.from(raw, 'base64').toString('utf-8');
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getClientIp(event: YcHttpEvent): string {
  const norm = normalizeHeaders(event.headers, event.multiValueHeaders);
  return (
    norm['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.requestContext?.identity?.sourceIp ||
    '127.0.0.1'
  );
}

export function resolveCorsHeaders(
  event: YcHttpEvent,
  publicBaseUrl?: string,
  appEnv: 'staging' | 'production' = (process.env.APP_ENV || 'staging') as 'staging' | 'production',
  customDomain?: string
): Record<string, string> {
  const norm = normalizeHeaders(event.headers, event.multiValueHeaders);
  const origin = norm['origin'] || '';

  const cors: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  };

  const isDomExit = origin === 'https://domexit.ru' || origin === 'https://www.domexit.ru';
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
  const isYandexApigw = /^https:\/\/.*\.apigw\.yandexcloud\.net$/.test(origin);
  const isMatchPublicBase = Boolean(publicBaseUrl && origin === publicBaseUrl);
  const isMatchCustomDomain = Boolean(customDomain && origin === customDomain);

  let isAllowed = false;
  if (appEnv === 'production') {
    // In production: Strictly allow domexit.ru, publicBaseUrl, customDomain, or production Yandex API Gateway
    // Ban localhost completely in production!
    isAllowed = Boolean(origin && (isMatchPublicBase || isMatchCustomDomain || isYandexApigw || isDomExit));
  } else {
    // In staging / dev: allow localhost as well
    isAllowed = Boolean(origin && (isLocalhost || isYandexApigw || isMatchPublicBase || isMatchCustomDomain || isDomExit));
  }

  if (isAllowed) {
    cors['Access-Control-Allow-Origin'] = origin;
    cors['Access-Control-Allow-Credentials'] = 'true';
    cors['Vary'] = 'Origin';
  }

  return cors;
}

const MANDATORY_SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(
  event: YcHttpEvent,
  statusCode: number,
  data: any,
  options?: {
    cookies?: string[];
    extraHeaders?: Record<string, string>;
    publicBaseUrl?: string;
  }
): YcHttpResponse {
  const cors = resolveCorsHeaders(event, options?.publicBaseUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    ...MANDATORY_SECURITY_HEADERS,
    ...cors,
    ...(options?.extraHeaders || {}),
  };

  const res: YcHttpResponse = {
    statusCode,
    headers,
    body: JSON.stringify(data),
  };

  if (options?.cookies && options.cookies.length > 0) {
    res.multiValueHeaders = {
      'Set-Cookie': options.cookies,
    };
  }

  return res;
}

export function redirect(
  event: YcHttpEvent,
  location: string,
  cookies?: string[],
  publicBaseUrl?: string
): YcHttpResponse {
  const cors = resolveCorsHeaders(event, publicBaseUrl);
  const headers: Record<string, string> = {
    Location: location,
    ...MANDATORY_SECURITY_HEADERS,
    ...cors,
  };

  const res: YcHttpResponse = {
    statusCode: 302,
    headers,
    body: '',
  };

  if (cookies && cookies.length > 0) {
    res.multiValueHeaders = {
      'Set-Cookie': cookies,
    };
  }

  return res;
}

export function handleOptions(
  event: YcHttpEvent,
  publicBaseUrl?: string,
  appEnv: 'staging' | 'production' = (process.env.APP_ENV || 'staging') as 'staging' | 'production',
  customDomain?: string
): YcHttpResponse {
  const cors = resolveCorsHeaders(event, publicBaseUrl, appEnv, customDomain);
  return {
    statusCode: 204,
    headers: {
      ...MANDATORY_SECURITY_HEADERS,
      ...cors,
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}

export function createSessionCookie(token: string, maxAgeSeconds = 604800): string {
  return `domexit_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `domexit_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function createOAuthStateCookie(state: string): string {
  return `domexit_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
}

export function clearOAuthStateCookie(): string {
  return `domexit_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
