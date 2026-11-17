/**
 * DomExit Enterprise Security Guards & Shield Suite (152-ФЗ / 63-ФЗ Compliance)
 * Protects against Open Redirects, Privilege Escalation, SMS Bombing, and PII Leaks.
 */

// 1. Open Redirect Phishing Protection (DomExit Shield 7)
export function sanitizeReturnUrl(returnUrl?: string | null, fallback = '/'): string {
  if (!returnUrl || typeof returnUrl !== 'string') return fallback;

  const trimmed = returnUrl.trim();

  // Must begin with a single '/' and not start with '//' (protocol-relative) or contain protocols
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /^(https?:|javascript:|data:|vbscript:)/i.test(trimmed)
  ) {
    return fallback;
  }

  // Ensure no CRLF injection
  return trimmed.replace(/[\r\n\t]/g, '');
}

// 2. Privilege Escalation Guard (DomExit Shield 5)
// Only system super-admins can assign administrative roles; client inputs are stripped
export function sanitizeUserRoleInput(roleCandidate: string | undefined): 'buyer' | 'seller' {
  const allowedClientRoles = ['buyer', 'seller'];
  if (roleCandidate && allowedClientRoles.includes(roleCandidate.toLowerCase())) {
    return roleCandidate.toLowerCase() as 'buyer' | 'seller';
  }
  return 'buyer'; // Safe fallback
}

// 3. Anti-SMS Bombing & Rate Limiter (DomExit Shield 6 & 63-ФЗ)
interface SmsHistory {
  lastSentAt: number;
  timestampsInHour: number[];
}

const smsRegistry = new Map<string, SmsHistory>();
const COOLDOWN_SECONDS = 60;
const MAX_SMS_PER_HOUR = 3;

export function checkSmsRateLimit(phone: string): { allowed: boolean; remainingSec: number; error?: string } {
  const cleanPhone = phone.replace(/\D/g, '');
  const now = Date.now();
  let record = smsRegistry.get(cleanPhone);

  if (!record) {
    record = { lastSentAt: 0, timestampsInHour: [] };
    smsRegistry.set(cleanPhone, record);
  }

  // 1. Check 60-second cooldown
  const elapsedSinceLast = Math.floor((now - record.lastSentAt) / 1000);
  if (elapsedSinceLast < COOLDOWN_SECONDS) {
    const remaining = COOLDOWN_SECONDS - elapsedSinceLast;
    return {
      allowed: false,
      remainingSec: remaining,
      error: `Повторная отправка СМС возможна через ${remaining} сек. (Защита 152-ФЗ)`,
    };
  }

  // 2. Check 1-hour quota (max 3 SMS/hour)
  const oneHourAgo = now - 3600_000;
  record.timestampsInHour = record.timestampsInHour.filter((ts) => ts > oneHourAgo);

  if (record.timestampsInHour.length >= MAX_SMS_PER_HOUR) {
    const oldest = record.timestampsInHour[0];
    const waitMin = Math.ceil((oldest + 3600_000 - now) / 60000);
    return {
      allowed: false,
      remainingSec: waitMin * 60,
      error: `Превышен лимит запросов СМС (максимум ${MAX_SMS_PER_HOUR} в час). Попробуйте через ${waitMin} мин.`,
    };
  }

  return { allowed: true, remainingSec: 0 };
}

export function recordSmsSent(phone: string): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const now = Date.now();
  let record = smsRegistry.get(cleanPhone);
  if (!record) {
    record = { lastSentAt: 0, timestampsInHour: [] };
    smsRegistry.set(cleanPhone, record);
  }
  record.lastSentAt = now;
  record.timestampsInHour.push(now);
}

// 4. Contact Masking & Anti-Scraping (DomExit Shield 8 & 152-ФЗ PII Protection)
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '+7 ••• •••-••-••';
  const last2 = digits.slice(-2);
  const code = digits.slice(-10, -7);
  return `+7 (${code}) •••-••-${last2}`;
}

export function maskPassportData(passport?: string | null): string {
  if (!passport) return '';
  const clean = passport.replace(/\s+/g, '');
  if (clean.length < 6) return '•••• ••••••';
  return `${clean.slice(0, 2)}•• ••••${clean.slice(-2)}`;
}

export function maskInn(inn?: string | null): string {
  if (!inn) return '';
  const clean = inn.trim();
  if (clean.length < 6) return '••••••••••••';
  return `${clean.slice(0, 3)}••••••${clean.slice(-3)}`;
}
