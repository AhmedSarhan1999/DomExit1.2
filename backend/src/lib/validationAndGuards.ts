import { UserProfile } from '../types.js';

export interface MaliciousPatternCheck {
  malicious: boolean;
  field?: string;
  pattern?: string;
}

const MALICIOUS_PATTERNS = [
  /<script\b[^>]*>/i,
  /<\/script>/i,
  /javascript:/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /<iframe\b[^>]*>/i,
  /;\s*DROP\s+TABLE/i,
  /UNION\s+SELECT/i,
  /--\s*$/m,
  /\bexec\s*\(/i,
];

/**
 * Scans object recursively for common XSS and Injection vectors.
 */
export function detectMaliciousPatterns(obj: any, path = ''): MaliciousPatternCheck {
  if (obj === null || obj === undefined) return { malicious: false };

  if (typeof obj === 'string') {
    for (const pattern of MALICIOUS_PATTERNS) {
      if (pattern.test(obj)) {
        return {
          malicious: true,
          field: path || 'root',
          pattern: pattern.toString(),
        };
      }
    }
    return { malicious: false };
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const res = detectMaliciousPatterns(obj[i], `${path}[${i}]`);
      if (res.malicious) return res;
    }
    return { malicious: false };
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      // Also check keys
      for (const pattern of MALICIOUS_PATTERNS) {
        if (pattern.test(key)) {
          return { malicious: true, field: `${path}.${key}`, pattern: pattern.toString() };
        }
      }
      const res = detectMaliciousPatterns(val, path ? `${path}.${key}` : key);
      if (res.malicious) return res;
    }
  }

  return { malicious: false };
}

/**
 * Sanitizes plain text input: trims, bounds length, strips control chars, escapes HTML entities.
 */
export function sanitizeText(str: string, maxLen = 2000): string {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim().slice(0, maxLen);
  // Strip non-printable control characters except newline and tab
  const cleaned = trimmed.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Escape dangerous HTML entities
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Mathematical validation of Russian INN (10 or 12 digits).
 */
export function validateRussianInn(inn: string | number): { valid: boolean; type?: 'legal_entity' | 'individual_or_entrepreneur'; message?: string } {
  const clean = String(inn || '').trim();
  if (!/^\d{10}$|^\d{12}$/.test(clean)) {
    return { valid: false, message: 'ИНН должен состоять ровно из 10 (юрлицо) или 12 (физлицо/ИП) цифр' };
  }

  const digits = clean.split('').map(Number);

  // 10-digit legal entity
  if (digits.length === 10) {
    const weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
    const checkDigit = (sum % 11) % 10;
    if (checkDigit !== digits[9]) {
      return { valid: false, message: 'Неверная контрольная сумма 10-значного ИНН' };
    }
    return { valid: true, type: 'legal_entity' };
  }

  // 12-digit individual / entrepreneur
  if (digits.length === 12) {
    const weights11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum11 = weights11.reduce((acc, w, i) => acc + w * digits[i], 0);
    const check11 = (sum11 % 11) % 10;

    const weights12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const sum12 = weights12.reduce((acc, w, i) => acc + w * digits[i], 0);
    const check12 = (sum12 % 11) % 10;

    if (check11 !== digits[10] || check12 !== digits[11]) {
      return { valid: false, message: 'Неверная контрольная сумма 12-значного ИНН' };
    }
    return { valid: true, type: 'individual_or_entrepreneur' };
  }

  return { valid: false, message: 'Некорректная длина ИНН' };
}

/**
 * Validates and normalizes Russian phone numbers.
 */
export function validateRussianPhone(phone: string): { valid: boolean; normalized?: string } {
  if (typeof phone !== 'string') return { valid: false };
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return { valid: true, normalized: `+7${digits.slice(1)}` };
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return { valid: true, normalized: `+7${digits}` };
  }

  return { valid: false };
}

/**
 * Detects contact leaks (phone numbers, external chat links, non-official handles) in chat messages.
 * Carefully avoids false positives on financial prices, DDU numbers, and property areas.
 */
export function detectContactLeakInChat(text: string): { leaked: boolean; reason?: string } {
  if (!text || typeof text !== 'string') return { leaked: false };

  // 1. External messenger links
  const linkPatterns = [
    /\bt\.me\/[a-zA-Z0-9_+]+/i,
    /\btelegram\.me\/[a-zA-Z0-9_+]+/i,
    /\bwa\.me\/[0-9]+/i,
    /\bwhatsapp\.com/i,
    /\bvk\.com\/[a-zA-Z0-9_+.]+/i,
    /\binstagram\.com/i,
    /\bviber\.com/i,
  ];
  for (const lp of linkPatterns) {
    if (lp.test(text)) {
      return { leaked: true, reason: 'Внешние ссылки на мессенджеры и социальные сети запрещены в чате' };
    }
  }

  // 2. Telegram username handles (excluding official @domexit*)
  const handleMatches = text.match(/@([a-zA-Z0-9_]{4,})/g);
  if (handleMatches) {
    for (const h of handleMatches) {
      if (!h.toLowerCase().startsWith('@domexit')) {
        return { leaked: true, reason: 'Передача прямых никнеймов Telegram запрещена в чате' };
      }
    }
  }

  // 3. Russian mobile numbers (+7 / 8 / 79 / 89 / 9XX mobile prefixes)
  // Formats: +7 (9XX) XXX-XX-XX, 89XXXXXXXXX, +79XXXXXXXXX, 9XX-XXX-XX-XX
  const formattedMobilePattern = /(?:\+7|8)[\s\-\(\)]*9\d{2}[\s\-\(\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/;
  if (formattedMobilePattern.test(text)) {
    return { leaked: true, reason: 'Передача личных номеров телефонов в чате запрещена' };
  }

  const rawMobilePattern = /\b(?:79|89)\d{9}\b/;
  if (rawMobilePattern.test(text)) {
    return { leaked: true, reason: 'Передача личных номеров телефонов в чате запрещена' };
  }

  const tenDigitMobilePattern = /\b9\d{2}[\s\-\.]\d{3}[\s\-\.]\d{2}[\s\-\.]\d{2}\b/;
  if (tenDigitMobilePattern.test(text)) {
    return { leaked: true, reason: 'Передача личных номеров телефонов в чате запрещена' };
  }

  return { leaked: false };
}

/**
 * Checks for unauthorized privilege tampering / mass assignment.
 */
export function checkPrivilegeTampering(
  collection: string,
  payload: Record<string, any>,
  authUser: UserProfile | null
): { tampered: boolean; field?: string } {
  const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';

  if (!isStaff) {
    // Universal privilege escalations
    if (payload.role && payload.role !== authUser?.role) {
      return { tampered: true, field: 'role' };
    }
    if (payload.roles && Array.isArray(payload.roles)) {
      if (payload.roles.includes('owner') || payload.roles.includes('employee')) {
        return { tampered: true, field: 'roles' };
      }
    }

    if (collection === 'lots') {
      const protectedLotFields = ['isApproved', 'approvedAt', 'assignedEmployeeId', 'curatorId', 'legalStatus'];
      for (const f of protectedLotFields) {
        if (payload[f] !== undefined && payload[f] !== null && payload[f] !== false && payload[f] !== '') {
          return { tampered: true, field: f };
        }
      }
    }

    if (collection === 'deals' || collection === 'buyer_applications' || collection === 'seller_requests') {
      const protectedDealFields = ['assignedEmployeeId', 'curatorId', 'commissionPaid', 'payoutStatus'];
      for (const f of protectedDealFields) {
        if (payload[f] !== undefined && payload[f] !== null) {
          return { tampered: true, field: f };
        }
      }
    }

    if (collection === 'partners' || collection === 'partner_applications') {
      if (payload.isApproved === true || payload.status === 'approved' || payload.fixedRewardPerDealRub !== undefined) {
        return { tampered: true, field: 'partner_approval_tampering' };
      }
    }

    if (collection === 'buy_boxes') {
      const protectedBuyBoxFields = ['tier', 'tierVerifiedAt', 'tierVerifiedBy', 'tierNote', 'reliabilityScore', 'noShowCount', 'completedViewingsCount'];
      for (const f of protectedBuyBoxFields) {
        if (payload[f] !== undefined && payload[f] !== null) {
          return { tampered: true, field: f };
        }
      }
    }
  }

  return { tampered: false };
}

export interface ValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  sanitizedPayload?: Record<string, any>;
  incidentType?: string;
}

/**
 * Central schema validation engine for data operations.
 */
export async function validateCollectionPayload(params: {
  collection: string;
  payload: Record<string, any>;
  method: string;
  authUser: UserProfile | null;
  ydb: any;
}): Promise<ValidationResult> {
  const { collection, payload, method, authUser, ydb } = params;

  // 1. Payload Size Cap (256 KB)
  const rawSize = JSON.stringify(payload).length;
  if (rawSize > 262144) {
    return {
      valid: false,
      statusCode: 413,
      error: 'Превышен максимальный размер полезной нагрузки (макс. 256 КБ)',
      incidentType: 'payload_size_exceeded',
    };
  }

  // 2. Malicious Patterns Check (XSS / Injections)
  const malCheck = detectMaliciousPatterns(payload);
  if (malCheck.malicious) {
    return {
      valid: false,
      statusCode: 400,
      error: `Обнаружен недопустимый или потенциально опасный фрагмент данных в поле: ${malCheck.field}`,
      incidentType: 'xss_or_injection_attempt',
    };
  }

  // 3. Privilege Tampering Check
  const privCheck = checkPrivilegeTampering(collection, payload, authUser);
  if (privCheck.tampered) {
    return {
      valid: false,
      statusCode: 403,
      error: `Попытка несанкционированной модификации защищенного поля: ${privCheck.field}`,
      incidentType: 'privilege_tampering',
    };
  }

  const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';
  const sanitized = { ...payload };

  // 4. Per-Collection Validation Rules
  if (collection === 'lots') {
    if (sanitized.dealTrack) {
      if (sanitized.dealTrack !== 'ddu_cession' && sanitized.dealTrack !== 'secondary_dkp') {
        sanitized.dealTrack = 'ddu_cession';
      }
    } else {
      sanitized.dealTrack = 'ddu_cession';
    }

    const isSecondary = sanitized.dealTrack === 'secondary_dkp';
    const contractPrice = Number(sanitized.dduContractPrice ?? sanitized.contractPriceRub ?? sanitized.price);
    if (!isNaN(contractPrice)) {
      if (contractPrice < 1000000 || contractPrice > 500000000) {
        return {
          valid: false,
          statusCode: 400,
          error: isSecondary
            ? 'Стоимость недвижимости (ДКП) должна быть в диапазоне от 1 000 000 до 500 000 000 ₽'
            : 'Стоимость ДДУ должна быть в диапазоне от 1 000 000 до 500 000 000 ₽',
        };
      }
    }

    const paidAmount = Number(sanitized.cashPaidBySeller ?? sanitized.paidAmountRub);
    if (!isNaN(paidAmount)) {
      if (paidAmount <= 0) {
        return { valid: false, statusCode: 400, error: 'Внесенная сумма должна быть больше 0 ₽' };
      }
      if (!isNaN(contractPrice) && contractPrice > 0 && paidAmount > contractPrice) {
        return {
          valid: false,
          statusCode: 400,
          error: isSecondary
            ? 'Внесенная продавцом сумма не может превышать стоимость недвижимости по ДКП'
            : 'Внесенная продавцом сумма не может превышать стоимость договора ДДУ',
        };
      }
    }

    if (sanitized.todayDeveloperPrice !== undefined) {
      const devPrice = Number(sanitized.todayDeveloperPrice);
      if (devPrice < 1000000 || devPrice > 700000000) {
        return { valid: false, statusCode: 400, error: 'Текущая цена застройщика должна быть в диапазоне от 1 000 000 до 700 000 000 ₽' };
      }
    }

    if (sanitized.areaM2 !== undefined || sanitized.area !== undefined) {
      const area = Number(sanitized.areaM2 ?? sanitized.area);
      if (area < 15 || area > 600) {
        return { valid: false, statusCode: 400, error: 'Площадь квартиры должна быть в диапазоне от 15 до 600 м²' };
      }
    }

    if (sanitized.floor !== undefined && sanitized.totalFloors !== undefined) {
      const fl = Number(sanitized.floor);
      const tf = Number(sanitized.totalFloors);
      if (fl < 1 || tf < 1 || tf > 120 || fl > tf) {
        return { valid: false, statusCode: 400, error: `Недопустимый этаж (${fl}) для здания в ${tf} этажей` };
      }
    }

    if (sanitized.sellerInn) {
      const innRes = validateRussianInn(sanitized.sellerInn);
      if (!innRes.valid) return { valid: false, statusCode: 400, error: innRes.message };
    }
    if (sanitized.developerInn) {
      const innRes = validateRussianInn(sanitized.developerInn);
      if (!innRes.valid) return { valid: false, statusCode: 400, error: innRes.message };
    }

    // Force non-staff submission defaults
    if (!isStaff && method === 'POST') {
      sanitized.status = 'intake_moderation';
      sanitized.isApproved = false;
      delete sanitized.curatorApprovedImages;
      delete sanitized.legalVerification;
    }
  }

  if (collection === 'seller_requests') {
    if (sanitized.dealTrack) {
      if (sanitized.dealTrack !== 'ddu_cession' && sanitized.dealTrack !== 'secondary_dkp') {
        sanitized.dealTrack = 'ddu_cession';
      }
    } else {
      sanitized.dealTrack = 'ddu_cession';
    }

    const isSecondary = sanitized.dealTrack === 'secondary_dkp';
    const rawContractPrice = sanitized.contractPriceRub ?? sanitized.dduContractPrice ?? sanitized.price;
    const hasContractPrice = rawContractPrice !== undefined && rawContractPrice !== null;

    if (!isStaff || hasContractPrice) {
      const contractPrice = Number(rawContractPrice);
      if (isNaN(contractPrice) || contractPrice < 1000000 || contractPrice > 500000000) {
        return {
          valid: false,
          statusCode: 400,
          error: isSecondary
            ? 'Стоимость объекта (ДКП) должна быть от 1 000 000 до 500 000 000 ₽'
            : 'Стоимость договора ДДУ должна быть от 1 000 000 до 500 000 000 ₽',
        };
      }

      const rawPaidAmount = sanitized.paidAmountRub ?? sanitized.cashPaidBySeller;
      const hasPaidAmount = rawPaidAmount !== undefined && rawPaidAmount !== null;
      if (!isStaff || hasPaidAmount) {
        const paidAmount = Number(rawPaidAmount);
        if (isNaN(paidAmount) || paidAmount <= 0) {
          return { valid: false, statusCode: 400, error: 'Укажите фактически внесенную сумму (больше 0 ₽)' };
        }
        if (paidAmount > contractPrice) {
          return {
            valid: false,
            statusCode: 400,
            error: isSecondary
              ? 'Внесенная сумма не может быть больше стоимости объекта по ДКП'
              : 'Внесенная сумма не может быть больше стоимости договора',
          };
        }
      }
    }

    if (sanitized.areaM2 !== undefined) {
      const area = Number(sanitized.areaM2);
      if (area < 15 || area > 600) {
        return { valid: false, statusCode: 400, error: 'Площадь квартиры должна быть от 15 до 600 м²' };
      }
    }

    if (sanitized.floor !== undefined && sanitized.totalFloors !== undefined) {
      const fl = Number(sanitized.floor);
      const tf = Number(sanitized.totalFloors);
      if (fl < 1 || tf < 1 || tf > 120 || fl > tf) {
        return { valid: false, statusCode: 400, error: `Этаж ${fl} не может быть больше общей этажности ${tf}` };
      }
    }

    if (sanitized.sellerPhone || sanitized.phone) {
      const phRes = validateRussianPhone(sanitized.sellerPhone || sanitized.phone);
      if (!phRes.valid) return { valid: false, statusCode: 400, error: 'Укажите корректный номер телефона РФ' };
    }

    if (sanitized.developerInn) {
      const innRes = validateRussianInn(sanitized.developerInn);
      if (!innRes.valid) return { valid: false, statusCode: 400, error: innRes.message };
    }

    if (sanitized.complexName) sanitized.complexName = sanitizeText(sanitized.complexName, 160);
    if (sanitized.developer) sanitized.developer = sanitizeText(sanitized.developer, 160);
    if (sanitized.dduNumber) sanitized.dduNumber = sanitizeText(sanitized.dduNumber, 80);
    if (sanitized.notes) sanitized.notes = sanitizeText(sanitized.notes, 2000);
  }

  if (collection === 'buyer_applications') {
    const lotCode = (sanitized.lotCode || sanitized.lotId || '').trim();
    if (!lotCode) {
      return { valid: false, statusCode: 400, error: 'Не указан обязательный идентификатор лота (lotCode)' };
    }

    // Server-side YDB existence check
    let lot = await ydb.getItem('lots', lotCode);
    if (!lot) {
      const allLots = await ydb.scanAll('lots', 500);
      lot = allLots.find((l: any) => l.lotCode === lotCode || l.id === lotCode || l.code === lotCode);
    }

    if (!lot) {
      return { valid: false, statusCode: 404, error: `Объект с кодом ${lotCode} не найден в каталоге` };
    }

    if (!isStaff) {
      const validStatuses = new Set(['active', 'available', 'reserved']);
      if (!lot.isApproved || !validStatuses.has(lot.status)) {
        return { valid: false, statusCode: 400, error: `Лот #${lotCode} недоступен для подачи заявок` };
      }
    }

    if (sanitized.availableLiquidity !== undefined) {
      const liq = Number(sanitized.availableLiquidity);
      if (liq < 0 || liq > 500000000) {
        return { valid: false, statusCode: 400, error: 'Доступная сумма ликвидности должна быть от 0 до 500 000 000 ₽' };
      }
    }

    // Duplicate Bid Guard for clients on POST
    if (!isStaff && method === 'POST' && authUser) {
      const allBids = await ydb.scanAll('buyer_applications', 500);
      const existingActiveBid = allBids.find(
        (b: any) =>
          (b.userId === authUser.id || b.uid === authUser.id) &&
          (b.lotCode === lotCode || b.lotId === lotCode) &&
          b.status !== 'cancelled' &&
          b.status !== 'declined' &&
          b.status !== 'rejected'
      );

      if (existingActiveBid) {
        return {
          valid: false,
          statusCode: 409,
          error: `Вы уже подали активную заявку на лот #${lotCode}. Повторная заявка не требуется.`,
        };
      }
    }
  }

  if (collection === 'curator_messages' || collection === 'deal_messages') {
    const rawText = String(sanitized.text || '').trim();
    if (!rawText) {
      return { valid: false, statusCode: 400, error: 'Сообщение не может быть пустым' };
    }
    if (rawText.length > 2000) {
      return { valid: false, statusCode: 400, error: 'Длина сообщения не должна превышать 2000 символов' };
    }

    // Check contact leak for clients
    if (!isStaff) {
      const leakCheck = detectContactLeakInChat(rawText);
      if (leakCheck.leaked) {
        return {
          valid: false,
          statusCode: 400,
          error:
            'В целях безопасности сделки обмен личными телефонами и внешними ссылками в чате ограничен. Все контакты координирует куратор DomExit.',
          incidentType: 'chat_contact_leak_attempt',
        };
      }
    }

    sanitized.text = sanitizeText(rawText, 2000);
  }

  if (collection === 'partner_preliminary_requests') {
    if (sanitized.clientPhone) {
      const phRes = validateRussianPhone(sanitized.clientPhone);
      if (!phRes.valid) return { valid: false, statusCode: 400, error: 'Укажите корректный номер телефона клиента' };
    }

    if (!isStaff && method === 'POST') {
      const now = new Date();
      sanitized.createdAt = now.toISOString();
      sanitized.expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
      sanitized.fixedRewardPerDealRub = 30000;
      sanitized.status = 'pending_client';

      // Check duplicate client phone or code
      const cleanPhone = (sanitized.clientPhone || '').replace(/\D/g, '');
      const cleanClientCode = (sanitized.clientCode || '').trim().toUpperCase();

      if (cleanPhone || cleanClientCode) {
        const allPre = await ydb.scanAll('partner_preliminary_requests', 500);
        const nowMs = Date.now();
        const activeDuplicate = allPre.find((p: any) => {
          if (p.status === 'expired' || new Date(p.expiresAt).getTime() < nowMs) return false;
          const pPhone = (p.clientPhone || '').replace(/\D/g, '');
          const pCode = (p.clientCode || '').trim().toUpperCase();
          return (cleanPhone && pPhone === cleanPhone) || (cleanClientCode && pCode === cleanClientCode);
        });

        if (activeDuplicate) {
          return {
            valid: false,
            statusCode: 409,
            error: 'Клиент с такими данными уже зафиксирован действующей предварительной заявкой на 7 дней.',
          };
        }
      }
    }
  }

  if (collection === 'partners' || collection === 'partner_applications' || collection === 'investor_applications') {
    if (sanitized.phone || sanitized.contactTelegramOrPhone) {
      const ph = sanitized.phone || sanitized.contactTelegramOrPhone;
      // If looks like phone number, check format
      if (/\d{7,}/.test(ph)) {
        const phRes = validateRussianPhone(ph);
        if (!phRes.valid) return { valid: false, statusCode: 400, error: 'Укажите корректный номер телефона РФ' };
      }
    }

    if (sanitized.inn) {
      const innRes = validateRussianInn(sanitized.inn);
      if (!innRes.valid) return { valid: false, statusCode: 400, error: innRes.message };
    }

    if (sanitized.name) sanitized.name = sanitizeText(sanitized.name, 160);
    if (sanitized.fullName) sanitized.fullName = sanitizeText(sanitized.fullName, 160);
    if (sanitized.email) sanitized.email = sanitizeText(sanitized.email, 160).trim().toLowerCase();
    if (sanitized.organization) sanitized.organization = sanitizeText(sanitized.organization, 160);
    if (sanitized.customProposal) sanitized.customProposal = sanitizeText(sanitized.customProposal, 2000);
  }

  return { valid: true, sanitizedPayload: sanitized };
}
