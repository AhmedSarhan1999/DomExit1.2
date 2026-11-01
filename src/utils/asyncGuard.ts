/**
 * Unified Async Guard & Validation Utilities
 * Provides double-submit protection, 15-second safety timeout, and INN validation.
 */

export const ASYNC_SAFETY_TIMEOUT_MS = 15000;
export const ASYNC_NETWORK_TIMEOUT_MESSAGE =
  'Ошибка сети или превышено время ожидания. Пожалуйста, проверьте подключение и повторите попытку.';

/**
 * Wraps any promise with a safety timeout (default 15 seconds)
 * to prevent UI freezing and endless loading states.
 */
export async function withAsyncTimeout<T>(
  promise: Promise<T>,
  timeoutMs = ASYNC_SAFETY_TIMEOUT_MS,
  timeoutMessage = ASYNC_NETWORK_TIMEOUT_MESSAGE
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Validates Russian Taxpayer Identification Number (ИНН):
 * - Legal entities (Юрлица): exactly 10 digits
 * - Individual entrepreneurs (ИП): exactly 12 digits
 */
export function isValidInn(inn?: string | null): boolean {
  if (!inn) return false;
  const clean = inn.trim();
  return /^\d{10}$/.test(clean) || /^\d{12}$/.test(clean);
}

/**
 * Returns formatted INN error message if invalid, or null if valid.
 */
export function getInnValidationError(inn?: string | null): string | null {
  if (!inn || !inn.trim()) {
    return 'Укажите ИНН застройщика / подрядчика (10 цифр для юрлиц или 12 для ИП).';
  }
  const clean = inn.trim();
  if (!/^\d+$/.test(clean)) {
    return 'ИНН должен содержать только цифры.';
  }
  if (clean.length !== 10 && clean.length !== 12) {
    return `Неверная длина ИНН (${clean.length} знаков). Требуется 10 цифр (юрлицо) или 12 цифр (ИП).`;
  }
  return null;
}
