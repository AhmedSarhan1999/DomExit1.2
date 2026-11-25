const LEGACY_PLACEHOLDER_PHONES = new Set(['78124090000', '79214567890']);
const LEGACY_PLACEHOLDER_TG = new Set([
  'domexit_official',
  '@domexit_official',
  'https://t.me/domexit_official',
  'domexit_curator',
  '@domexit_curator',
]);

/** Returns non-placeholder phone string or empty string when unset. */
export function getCleanCuratorPhone(phone?: string | null): string {
  const raw = (phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 7 || LEGACY_PLACEHOLDER_PHONES.has(digits)) return '';
  return raw;
}

/** Formats tel: URI for real curator phone numbers only. */
export function getCuratorPhoneHref(phone?: string | null): string {
  const clean = getCleanCuratorPhone(phone);
  if (!clean) return '';
  const telDigits = clean.replace(/[^\d+]/g, '');
  return telDigits ? `tel:${telDigits}` : '';
}

/** Resolves personal curator Telegram URL or falls back to configured public bot URL. */
export function getCuratorTelegramHref(
  telegram?: string | null,
  fallbackBotUrl?: string | null,
  fallbackChannelUrl?: string | null
): string {
  const raw = (telegram || '').trim();
  const normalized = raw.toLowerCase();
  if (raw && !LEGACY_PLACEHOLDER_TG.has(normalized)) {
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('tg://')) {
      return raw;
    }
    const handle = raw.replace(/^@+/, '').trim();
    if (handle) return `https://t.me/${handle}`;
  }
  return (
    (fallbackBotUrl || '').trim() ||
    (fallbackChannelUrl || '').trim() ||
    'https://t.me/domexit_bot'
  );
}

/** Resolves MAX messenger profile URL when a non-placeholder profile or number is provided. */
export function getCuratorMaxHref(maxProfile?: string | null, whatsappFallback?: string | null): string {
  const raw = (maxProfile || whatsappFallback || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d]/g, '');
  if (LEGACY_PLACEHOLDER_PHONES.has(digits)) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('max://')) {
    return raw;
  }
  if (digits.length >= 10 && /^[+\d\s()-]+$/.test(raw)) {
    return `https://max.ru/${digits}`;
  }
  const handle = raw.replace(/^@+/, '').replace(/[^\w.-]/g, '').trim();
  return handle ? `https://max.ru/${handle}` : '';
}
