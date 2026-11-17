/**
 * Client-Side Cooldown & Rate Limiter (Security Hardening: Anti-Flooding & Abuse Protection)
 * Prevents automated spam/brute-force submissions on SMS OTP, login modals, and lead forms.
 */

interface RateLimitRecord {
  timestamps: number[];
  cooldownUntil: number;
}

class ClientRateLimiter {
  private records = new Map<string, RateLimitRecord>();

  /**
   * Checks if an action is allowed under the rate limit.
   * @param actionKey unique identifier for action (e.g. 'sms-otp:phone_hash')
   * @param maxRequests maximum allowed requests within window
   * @param windowMs time window in milliseconds
   * @param cooldownMs mandatory cooldown if exceeded
   */
  checkLimit(
    actionKey: string,
    maxRequests = 5,
    windowMs = 60_000,
    cooldownMs = 60_000
  ): { allowed: boolean; remainingSec: number; attemptsLeft: number } {
    const now = Date.now();
    let record = this.records.get(actionKey);

    if (!record) {
      record = { timestamps: [], cooldownUntil: 0 };
      this.records.set(actionKey, record);
    }

    // Check active cooldown
    if (now < record.cooldownUntil) {
      const remainingSec = Math.ceil((record.cooldownUntil - now) / 1000);
      return { allowed: false, remainingSec, attemptsLeft: 0 };
    }

    // Filter out expired timestamps
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    if (record.timestamps.length >= maxRequests) {
      // Trigger cooldown
      record.cooldownUntil = now + cooldownMs;
      const remainingSec = Math.ceil(cooldownMs / 1000);
      return { allowed: false, remainingSec, attemptsLeft: 0 };
    }

    const attemptsLeft = maxRequests - record.timestamps.length;
    return { allowed: true, remainingSec: 0, attemptsLeft };
  }

  /**
   * Registers a consumption of the action limit.
   */
  recordHit(actionKey: string): void {
    const now = Date.now();
    let record = this.records.get(actionKey);
    if (!record) {
      record = { timestamps: [], cooldownUntil: 0 };
      this.records.set(actionKey, record);
    }
    record.timestamps.push(now);
  }

  /**
   * Resets the limit for an action upon successful authentication
   */
  reset(actionKey: string): void {
    this.records.delete(actionKey);
  }
}

export const rateLimiter = new ClientRateLimiter();
