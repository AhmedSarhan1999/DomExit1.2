/**
 * Unified Client API Gateway Client for DomExit Platform
 *
 * Enforces:
 * - credentials: 'include' for HttpOnly secure session cookies (domexit_session)
 * - Same-Origin API routes when deployed (/api/*)
 * - Configurable base URL via VITE_API_BASE_URL (for localhost dev / proxy)
 * - Structured ApiError with HTTP status and localized server messages
 * - Timeout handling via AbortController
 */

export class ApiError extends Error {
  readonly status: number;
  readonly data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 25000, headers = {}, ...customOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const defaultHeaders: Record<string, string> = {
    Accept: 'application/json',
  };

  if (!(customOptions.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      ...customOptions,
      headers: {
        ...defaultHeaders,
        ...(headers as Record<string, string>),
      },
    });

    clearTimeout(timer);

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const errMsg =
        data?.error ||
        data?.message ||
        `HTTP ${res.status}: ${res.statusText || 'Request failed'}`;
      throw new ApiError(res.status, errMsg, data);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError(408, 'Превышено время ожидания ответа сервера (Timeout)');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, err.message || 'Ошибка сети при обращении к серверу');
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};
