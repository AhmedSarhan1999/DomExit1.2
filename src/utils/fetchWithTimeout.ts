/**
 * Network Timeout & AbortController Wrapper (Criterion 20: Strict Timeouts)
 * Enforces 8-10s timeouts on network calls to prevent UI freezes.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 9000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Превышено время ожидания ответа сервера (${timeoutMs / 1000}с)`));
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: init?.signal ? composeSignals(init.signal, controller.signal) : controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function composeSignals(signalA: AbortSignal, signalB: AbortSignal): AbortSignal {
  if (signalA.aborted) return signalA;
  if (signalB.aborted) return signalB;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signalA.addEventListener('abort', onAbort, { once: true });
  signalB.addEventListener('abort', onAbort, { once: true });
  return controller.signal;
}

/**
 * Executes a Promise with a strict timeout fallback
 */
export function withPromiseTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 9000,
  fallbackValue?: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (fallbackValue !== undefined) {
        resolve(fallbackValue);
      } else {
        reject(new Error(`Таймаут операции (${timeoutMs / 1000} сек)`));
      }
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}
