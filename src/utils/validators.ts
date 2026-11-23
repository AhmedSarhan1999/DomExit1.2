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
 * Normalizes developer name by stripping any trailing (ИНН ...) or extra whitespace.
 */
export function cleanDeveloperName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\([Ии][Нн][Нн]\s*[\d\s]+\)\s*$/, '').trim();
}

/**
 * Strict mathematical FNS checksum validation for Russian INN:
 * - 10 digits: Legal entity (Юридическое лицо)
 * - 12 digits: Individual or sole proprietor (Физическое лицо / ИП)
 */
export function validateRussianInnChecksum(inn: string | number): {
  valid: boolean;
  type?: 'legal_entity' | 'individual';
  messageRu?: string;
  messageEn?: string;
} {
  const clean = String(inn || '').trim().replace(/\D/g, '');
  if (!clean) {
    return {
      valid: false,
      messageRu: 'ИНН не может быть пустым.',
      messageEn: 'INN cannot be empty.',
    };
  }

  if (clean.length !== 10 && clean.length !== 12) {
    return {
      valid: false,
      messageRu: 'ИНН должен содержать ровно 10 цифр (для юрлиц) или 12 цифр (для физлиц/ИП).',
      messageEn: 'INN must contain strictly 10 digits (corporate) or 12 digits (individual).',
    };
  }

  if (/^(\d)\1+$/.test(clean)) {
    return {
      valid: false,
      messageRu: 'Указан некорректный ИНН (все цифры одинаковые).',
      messageEn: 'Invalid INN sequence (all digits identical).',
    };
  }

  const digits = clean.split('').map(Number);

  // 10-digit legal entity checksum
  if (digits.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    const checkDigit = (sum % 11) % 10;
    if (checkDigit !== digits[9]) {
      return {
        valid: false,
        messageRu: 'Неверная контрольная сумма 10-значного ИНН юрлица.',
        messageEn: 'Invalid checksum for 10-digit corporate INN.',
      };
    }
    return { valid: true, type: 'legal_entity' };
  }

  // 12-digit individual / entrepreneur checksum
  if (digits.length === 12) {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum11 = weights11.reduce((acc, w, i) => acc + w * digits[i], 0);
    const check11 = (sum11 % 11) % 10;

    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum12 = weights12.reduce((acc, w, i) => acc + w * digits[i], 0);
    const check12 = (sum12 % 11) % 10;

    if (check11 !== digits[10] || check12 !== digits[11]) {
      return {
        valid: false,
        messageRu: 'Неверная контрольная сумма 12-значного ИНН физического лица.',
        messageEn: 'Invalid checksum for 12-digit individual INN.',
      };
    }
    return { valid: true, type: 'individual' };
  }

  return { valid: false, messageRu: 'Некорректный ИНН.', messageEn: 'Invalid INN.' };
}

/**
 * Validates Developer INN (strictly 10 digits for Russian corporate developers with FNS checksum).
 */
export function validateDeveloperInn(inn: string | number): {
  valid: boolean;
  messageRu?: string;
  messageEn?: string;
} {
  const clean = String(inn || '').trim().replace(/\D/g, '');
  if (!clean) {
    return {
      valid: false,
      messageRu: 'Укажите ИНН застройщика (10 цифр).',
      messageEn: 'Please enter developer INN (10 digits).',
    };
  }
  if (clean.length !== 10) {
    return {
      valid: false,
      messageRu: 'ИНН застройщика (юрлица) должен состоять строго из 10 цифр.',
      messageEn: 'Developer INN must contain strictly 10 digits.',
    };
  }
  const res = validateRussianInnChecksum(clean);
  if (!res.valid) {
    return {
      valid: false,
      messageRu: 'Неверная контрольная сумма ИНН застройщика (10 цифр).',
      messageEn: 'Invalid checksum for 10-digit developer INN.',
    };
  }
  return { valid: true };
}

/**
 * Validates Right-holder / Seller INN (12 digits for individuals, 10 digits for legal entities).
 */
export function validateRightHolderInn(
  inn: string | number,
  optional = false
): {
  valid: boolean;
  messageRu?: string;
  messageEn?: string;
} {
  const clean = String(inn || '').trim().replace(/\D/g, '');
  if (!clean) {
    if (optional) return { valid: true };
    return {
      valid: false,
      messageRu: 'Укажите ИНН правообладателя (12 цифр для физлиц или 10 для юрлиц).',
      messageEn: 'Please enter right-holder INN.',
    };
  }
  const res = validateRussianInnChecksum(clean);
  if (!res.valid) {
    return {
      valid: false,
      messageRu: 'Неверная контрольная сумма ИНН правообладателя (12 или 10 цифр).',
      messageEn: 'Invalid checksum for right-holder INN.',
    };
  }
  return { valid: true };
}

/**
 * Validates Russian Individual Taxpayer Identification Number (ИНН физического лица - 12 digits, optional by default).
 */
export function validateIndividualInn(
  inn: string,
  optional = true
): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = inn.trim().replace(/\D/g, '');
  if (!clean) {
    if (optional) return { valid: true };
    return {
      valid: false,
      messageRu: 'Укажите ИНН физического лица (12 цифр).',
      messageEn: 'Please enter individual INN (12 digits).',
    };
  }
  if (clean.length !== 12) {
    return {
      valid: false,
      messageRu: 'ИНН физического лица должен содержать строго 12 цифр без букв и спецсимволов.',
      messageEn: 'Individual INN must contain strictly 12 digits.',
    };
  }
  const res = validateRussianInnChecksum(clean);
  if (!res.valid || res.type !== 'individual') {
    return {
      valid: false,
      messageRu: 'Неверная контрольная сумма 12-значного ИНН физического лица.',
      messageEn: 'Invalid checksum for 12-digit individual INN.',
    };
  }
  return { valid: true };
}

/**
 * Validates Russian Taxpayer Identification Number (ИНН: 10 digits for legal entities or 12 digits for individuals).
 */
export function validateRussianInn(inn: string): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = inn.trim().replace(/\D/g, '');
  if (!/^\d{10}(\d{2})?$/.test(clean)) {
    return {
      valid: false,
      messageRu: 'ИНН должен содержать строго 12 цифр (физлицо) или 10 цифр (юрлицо) без букв.',
      messageEn: 'INN must contain strictly 12 digits (individual) or 10 digits (company).',
    };
  }
  return validateRussianInnChecksum(clean);
}

/**
 * Validates DDU contract / property code or cadastral number.
 */
export function validateDduOrLotCode(
  code: string,
  isSecondary = false
): { valid: boolean; messageRu?: string; messageEn?: string } {
  const clean = code.trim();
  const maxLen = isSecondary ? 40 : 32;
  if (clean.length < 3 || clean.length > maxLen) {
    return {
      valid: false,
      messageRu: isSecondary
        ? `Кадастровый номер или номер документа должен содержать от 3 до ${maxLen} символов (например: 78:34:0004123:4567).`
        : 'Код договора ДДУ / лота должен содержать от 3 до 32 символов (например: ДДУ-78/10566).',
      messageEn: isSecondary
        ? `Cadastral or ownership number must be 3–${maxLen} characters (e.g. 78:34:0004123:4567).`
        : 'DDU / Lot code must be 3–32 characters (e.g. DDU-78/10566).',
    };
  }
  if (!/\d/.test(clean) || !/^[A-Za-zА-Яа-яЁё0-9№\-/_.:\s]+$/.test(clean)) {
    return {
      valid: false,
      messageRu: isSecondary
        ? 'Номер объекта должен содержать цифры и допустимые разделители (-, /, :, №).'
        : 'Код объекта/ДДУ должен содержать номер (цифры) и допустимые символы (-, /, №).',
      messageEn: isSecondary
        ? 'Property code must contain digits and valid separators (-, /, :).'
        : 'Property/DDU code must contain digits and valid separators (-, /).',
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
  // Allow letters combined with numbers and symbols (e.g. "А101", "СК-10", "3S Group").
  // Reject only if there are NO letters at all (pure digits, pure symbols, or punctuation).
  if (!/[A-Za-zА-Яа-яЁё]/.test(clean)) {
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
 * - For DDU: paidAmount strictly less than contractPrice
 * - For Secondary: paidAmount can equal contractPrice (no developer debt), cannot exceed contractPrice
 */
export function validateSellerFinancials(
  paidAmount: number,
  contractPrice: number,
  isSecondary = false
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
    paidErrorRu = isSecondary
      ? 'Желаемая сумма к получению должна быть в диапазоне от 2 000 000 ₽ до 50 000 000 ₽.'
      : 'Выплаченная застройщику сумма должна быть в диапазоне от 2 000 000 ₽ до 50 000 000 ₽.';
    paidErrorEn = isSecondary
      ? 'Desired exit payout must be between 2,000,000 ₽ and 50,000,000 ₽.'
      : 'Amount paid to developer must be between 2,000,000 ₽ and 50,000,000 ₽.';
  }

  if (!Number.isFinite(contractPrice) || contractPrice <= MIN_SELLER_PAID_RUB) {
    contractErrorRu = isSecondary
      ? 'Рыночная стоимость недвижимости должна превышать 2 000 000 ₽.'
      : 'Полная стоимость договора ДДУ должна превышать 2 000 000 ₽.';
    contractErrorEn = isSecondary
      ? 'Market value of the property must exceed 2,000,000 ₽.'
      : 'Total DDU contract price must exceed 2,000,000 ₽.';
  } else if (!isSecondary && paidAmount >= contractPrice) {
    contractErrorRu = 'Сумма, выплаченная застройщику, должна быть строго меньше полной стоимости договора ДДУ.';
    contractErrorEn = 'Amount paid to developer must be strictly less than total DDU contract price.';
  } else if (isSecondary && paidAmount > contractPrice) {
    contractErrorRu = 'Желаемая цена выхода не может превышать рыночную стоимость аналогов.';
    contractErrorEn = 'Desired exit price cannot exceed the market value of analogues.';
  }

  return {
    valid: !paidErrorRu && !contractErrorRu,
    paidErrorRu,
    paidErrorEn,
    contractErrorRu,
    contractErrorEn,
  };
}
