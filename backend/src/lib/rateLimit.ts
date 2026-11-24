import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { getClientIp, json } from './http.js';

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowSec: number;
  key?: string;
  customMessageRu?: string;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSec: number;
  retryAfterSec: number;
}

interface WindowRecord {
  timestamps: number[];
  lastAccess: number;
}

class SlidingWindowRateLimiter {
  private records = new Map<string, WindowRecord>();
  private maxKeys = 2000;

  check(scopeKey: string, limit: number, windowSec: number): RateLimitCheckResult {
    const now = Date.now();
    const windowMs = windowSec * 1000;
    const threshold = now - windowMs;

    let record = this.records.get(scopeKey);
    if (!record) {
      if (this.records.size >= this.maxKeys) {
        // Evict expired records to avoid memory growth in Cloud Functions
        for (const [k, v] of this.records.entries()) {
          if (now - v.lastAccess > windowMs) {
            this.records.delete(k);
          }
        }
        if (this.records.size >= this.maxKeys) {
          const first = this.records.keys().next().value;
          if (first) this.records.delete(first);
        }
      }
      record = { timestamps: [], lastAccess: now };
      this.records.set(scopeKey, record);
    }

    record.lastAccess = now;
    // Evict timestamps outside current sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);

    if (record.timestamps.length >= limit) {
      const oldestInWindow = record.timestamps[0] || threshold;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSec: retryAfterSec,
        retryAfterSec,
      };
    }

    // Register current hit
    record.timestamps.push(now);
    const remaining = Math.max(0, limit - record.timestamps.length);
    const oldest = record.timestamps[0] || now;
    const resetSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));

    return {
      allowed: true,
      limit,
      remaining,
      resetSec,
      retryAfterSec: 0,
    };
  }

  reset(scopeKey: string): void {
    this.records.delete(scopeKey);
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();

/**
 * Enforces rate limiting on an incoming API Gateway request.
 * Automatically extracts client IP, constructs sliding window headers, and returns an optional 429 response.
 */
export function checkRateLimit(
  event: YcHttpEvent,
  options: RateLimitOptions
): {
  allowed: boolean;
  headers: Record<string, string>;
  response?: YcHttpResponse;
} {
  const clientIp = getClientIp(event);
  const identifier = options.key || clientIp;
  const scopeKey = `${options.scope}:${identifier}`;

  const res = rateLimiter.check(scopeKey, options.limit, options.windowSec);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(res.limit),
    'X-RateLimit-Remaining': String(res.remaining),
    'X-RateLimit-Reset': String(res.resetSec),
  };

  if (!res.allowed) {
    headers['Retry-After'] = String(res.retryAfterSec);

    const message =
      options.customMessageRu ||
      `Слишком много запросов. Пожалуйста, повторите попытку через ${res.retryAfterSec} сек.`;

    const response = json(
      event,
      429,
      {
        error: message,
        code: 'rate_limit_exceeded',
        retryAfterSec: res.retryAfterSec,
      },
      { extraHeaders: headers }
    );

    return { allowed: false, headers, response };
  }

  return { allowed: true, headers };
}
