/**
 * Strict Russian Federation Fintech & PropTech Field Validators (Phase 1)
 */

/**
 * Formats any input string into the strict Russian phone standard: +7 (XXX) XXX-XX-XX
 * Blocks random letters/symbols automatically.
 */
export function formatRussianPhoneInput(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '+7 ';

  let normalized = digitsOnly;
  if (normalized.startsWith('8') || normalized.startsWith('7')) {
    normalized = normalized.slice(1);
  }
  normalized = normalized.slice(0, 10);

  if (normalized.length === 0) return '+7 ';
  if (normalized.length <= 3) return `+7 (${normalized}`;
  if (normalized.length <= 6) {
    return `+7 (${normalized.slice(0, 3)}) ${normalized.slice(3)}`;
  }
  if (normalized.length <= 8) {
    return `+7 (${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }
  return `+7 (${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6, 8)}-${normalized.slice(8, 10)}`;
}

export function isValidRussianPhone(phone: string): boolean {
  return /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone.trim());
}

/**
 * Strips non-numeric characters for strict numeric fields (ИНН, amounts).
 */
export function sanitizeDigitsOnly(raw: string, maxLen = 15): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Validates Russian Taxpayer Identification Number (ИНН: 10 digits for legal entities or 12 digits for individuals).
 */
export function validateRussianInn(inn: string): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = inn.trim();
  if (!/^\d{10}(\d{2})?$/.test(clean)) {
    return {
      valid: false,
      messageRu: 'ИНН должен содержать строго 12 цифр (физлицо) или 10 цифр (юрлицо) без букв.',
      messageEn: 'INN must contain strictly 12 digits (individual) or 10 digits (company).',
    };
  }
  if (/^(\d)\1+$/.test(clean)) {
    return {
      valid: false,
      messageRu: 'Указан некорректный ИНН (повторяющиеся цифры).',
      messageEn: 'Invalid INN sequence.',
    };
  }
  return { valid: true };
}

/**
 * Validates DDU contract / property code (must include digits, allowed letters/digits/hyphens/slashes, no pure text).
 */
export function validateDduOrLotCode(code: string): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = code.trim();
  if (clean.length < 3 || clean.length > 32) {
    return {
      valid: false,
      messageRu: 'Код договора ДДУ / лота должен содержать от 3 до 32 символов (например: ДДУ-78/10566).',
      messageEn: 'DDU / Lot code must be 3–32 characters (e.g. DDU-78/10566).',
    };
  }
  if (!/\d/.test(clean) || !/^[A-Za-zА-Яа-яЁё0-9№\-/_.\s]+$/.test(clean)) {
    return {
      valid: false,
      messageRu: 'Код объекта/ДДУ должен содержать номер (цифры) и допустимые символы (-, /, №).',
      messageEn: 'Property/DDU code must contain digits and valid separators (-, /).',
    };
  }
  return { valid: true };
}

/**
 * Validates Developer or Complex Name (prevents entering pure numbers into text fields).
 */
export function validateTextEntityName(
  value: string,
  fieldLabelRu = 'Название застройщика'
): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = value.trim();
  if (clean.length < 2) {
    return {
      valid: false,
      messageRu: `${fieldLabelRu}: введите корректное наименование (минимум 2 символа).`,
      messageEn: 'Please enter a valid name (at least 2 characters).',
    };
  }
  if (/^\d+$/.test(clean) || !/[A-Za-zА-Яа-яЁё]{2,}/.test(clean)) {
    return {
      valid: false,
      messageRu: `${fieldLabelRu} не может состоять только из цифр или спецсимволов.`,
      messageEn: 'Field cannot consist solely of digits or symbols.',
    };
  }
  return { valid: true };
}

export const MIN_SELLER_PAID_RUB = 2_000_000;
export const MAX_SELLER_PAID_RUB = 50_000_000;

/**
 * Strictly validates seller financial parameters:
 * - paidAmount between 2,000,000 ₽ and 50,000,000 ₽
 * - paidAmount strictly less than contractPrice
 */
export function validateSellerFinancials(
  paidAmount: number,
  contractPrice: number
): {
  valid: boolean;
  paidErrorRu?: string;
  paidErrorEn?: string;
  contractErrorRu?: string;
  contractErrorEn?: string;
} {
  let paidErrorRu: string | undefined;
  let paidErrorEn: string | undefined;
  let contractErrorRu: string | undefined;
  let contractErrorEn: string | undefined;

  if (!Number.isFinite(paidAmount) || paidAmount < MIN_SELLER_PAID_RUB || paidAmount > MAX_SELLER_PAID_RUB) {
    paidErrorRu = 'Выплаченная застройщику сумма должна быть в диапазоне от 2 000 000 ₽ до 50 000 000 ₽.';
    paidErrorEn = 'Amount paid to developer must be between 2,000,000 ₽ and 50,000,000 ₽.';
  }

  if (!Number.isFinite(contractPrice) || contractPrice <= MIN_SELLER_PAID_RUB) {
    contractErrorRu = 'Полная стоимость договора ДДУ должна превышать 2 000 000 ₽.';
    contractErrorEn = 'Total DDU contract price must exceed 2,000,000 ₽.';
  } else if (paidAmount >= contractPrice) {
    contractErrorRu = 'Сумма, выплаченная застройщику, должна быть строго меньше полной стоимости договора ДДУ.';
    contractErrorEn = 'Amount paid to developer must be strictly less than total DDU contract price.';
  }

  return {
    valid: !paidErrorRu && !contractErrorRu,
    paidErrorRu,
    paidErrorEn,
    contractErrorRu,
    contractErrorEn,
  };
}
