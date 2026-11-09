/**
 * 30-Day Cookie and LocalStorage Referral Tracker (152-ФЗ compliant)
 * Captures ?ref=... or ?partner=... and attributes deals to registered brokers.
 */

const STORAGE_KEY = 'domexit_partner_ref';
const COOKIE_NAME = 'domexit_partner_ref';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRefPayload {
  code: string;
  expiresAt: number;
}

export const initReferralTracker = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const incomingRef =
      params.get('ref') || params.get('partner') || params.get('partnerRefCode') || params.get('partner_code');

    if (incomingRef && incomingRef.trim()) {
      const cleanCode = incomingRef.trim().toUpperCase();
      const payload: StoredRefPayload = {
        code: cleanCode,
        expiresAt: Date.now() + THIRTY_DAYS_MS,
      };

      // 1. LocalStorage persistence (30 days)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

      // 2. Cookie persistence (30 days, Max-Age = 2592000 seconds)
      const maxAgeSeconds = 30 * 24 * 60 * 60;
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
        cleanCode
      )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;

      return cleanCode;
    }
  } catch (err) {
    console.warn('Referral tracker error on init:', err);
  }

  return getStoredReferralCode();
};

export const getStoredReferralCode = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check LocalStorage
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredRefPayload;
        if (parsed?.code && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed.code.trim().toUpperCase();
        } else if (parsed?.expiresAt && Date.now() >= parsed.expiresAt) {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Fallback for simple string format
        if (typeof raw === 'string' && raw.trim()) {
          return raw.trim().toUpperCase();
        }
      }
    }

    // 2. Fallback to Cookie
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + COOKIE_NAME + '=([^;]*)'));
    if (match && match[2]) {
      const decoded = decodeURIComponent(match[2]).trim().toUpperCase();
      if (decoded) return decoded;
    }
  } catch (err) {
    console.warn('Error reading stored referral code:', err);
  }

  return null;
};

export const setStoredReferralCode = (code: string): void => {
  if (typeof window === 'undefined' || !code) return;
  try {
    const cleanCode = code.trim().toUpperCase();
    const payload: StoredRefPayload = {
      code: cleanCode,
      expiresAt: Date.now() + THIRTY_DAYS_MS,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const maxAgeSeconds = 30 * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
      cleanCode
    )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
  } catch (err) {
    console.warn('Error setting stored referral code:', err);
  }
};

export const clearStoredReferralCode = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch (err) {
    console.warn('Error clearing stored referral code:', err);
  }
};

export const generateBrokerReferralLink = (
  referralCode: string,
  targetPath: string = '/sellers'
): string => {
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://domexit.ru';
  const cleanCode = (referralCode || 'PARTNER-777').trim().toUpperCase();
  const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${origin}${path}?ref=${encodeURIComponent(cleanCode)}`;
};
