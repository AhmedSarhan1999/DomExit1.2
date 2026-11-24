/**
 * Federal Law 152-FZ Compliant Data Masking Layer
 * Masks Personal Identifiable Information (PII) for secure UI rendering and audit logging.
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
