/**
 * Federal Law 152-FZ Compliant Data Masking Layer
 * Masks Personal Identifiable Information (PII) before external AI analysis or telemetry.
 */

export function maskRussianPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '+7 (***) ***-**-**';
  const last2 = digits.slice(-2);
  const code = digits.slice(-10, -7);
  return `+7 (${code}) ***-**-${last2}`;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.ru';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
  const domainParts = domain.split('.');
  const maskedDomain = domainParts.length > 1 ? `***.${domainParts[domainParts.length - 1]}` : '***.ru';
  return `${maskedLocal}@${maskedDomain}`;
}

export function maskFullName(fullName: string): string {
  if (!fullName) return 'Субъект ПД';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0][0]}***** [Субъект ПД]`;
  }
  const lastName = parts[0];
  const initials = parts.slice(1).map((p) => `${p[0]}.`).join('');
  return `${lastName[0]}***** ${initials} [Субъект ПД]`;
}

export function maskContractNumber(contractNum: string): string {
  if (!contractNum) return '';
  if (contractNum.length <= 4) return 'ДДУ-****';
  return `ДДУ-***-${contractNum.slice(-4)}`;
}

export function maskPromptText(text: string): string {
  if (!text) return '';
  // Mask phone numbers
  let sanitized = text.replace(/(\+7|8)[\s(-]*(\d{3})[\s)-]*(\d{3})[\s-]*(\d{2})[\s-]*(\d{2})/g, '+7 ($2) ***-**-$5');
  // Mask emails
  sanitized = sanitized.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '***@***.ru');
  // Mask passport series & numbers (4 digits + 6 digits)
  sanitized = sanitized.replace(/\b\d{4}\s+\d{6}\b/g, '**** ******');
  // Mask SNILS (11 digits)
  sanitized = sanitized.replace(/\b\d{3}-\d{3}-\d{3}\s+\d{2}\b/g, '***-***-*** **');
  return sanitized;
}

export const maskSensitiveData = maskPromptText;
