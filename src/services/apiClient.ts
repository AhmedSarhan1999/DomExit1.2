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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  status?: string;
  lotCode?: string;
  city?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'discount_desc' | string;
  fresh?: boolean;
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  getPaginated: <T = any>(collection: string, params: PaginationParams = {}, options?: RequestOptions) => {
    const query = new URLSearchParams({ paginated: '1' });
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);
    if (params.lotCode) query.set('lotCode', params.lotCode);
    if (params.city) query.set('city', params.city);
    if (params.search) query.set('search', params.search);
    if (params.sort) query.set('sort', params.sort);
    if (params.fresh) query.set('fresh', '1');

    const cleanCol = collection.startsWith('/api/data/')
      ? collection
      : collection.startsWith('api/data/')
      ? `/${collection}`
      : `/api/data/${collection}`;

    return request<PaginatedResult<T>>(`${cleanCol}?${query.toString()}`, { method: 'GET', ...options });
  },

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

  // Telegram Operating System helpers
  telegram: {
    getStatus: () =>
      request<{
        configured: boolean;
        botUsername: string;
        linked: boolean;
        telegramUsername?: string;
        notificationsEnabled: boolean;
        boundAt?: string;
      }>('/api/telegram/status', { method: 'GET' }),

    createLinkToken: () =>
      request<{
        success: boolean;
        token: string;
        deepLink: string;
        expiresInSec: number;
        configured: boolean;
        botUsername: string;
      }>('/api/telegram/link-token', { method: 'POST' }),

    unlink: () =>
      request<{ success: boolean }>('/api/telegram/unlink', { method: 'POST' }),

    updatePreferences: (notificationsEnabled: boolean) =>
      request<{ success: boolean; notificationsEnabled: boolean }>('/api/telegram/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ notificationsEnabled }),
      }),

    assignCurator: (lotCode: string, employeeId: string) =>
      request<{ success: boolean; lot: any; employee: any }>('/api/telegram/assign', {
        method: 'POST',
        body: JSON.stringify({ lotCode, employeeId }),
      }),

    transitionStage: (lotCode: string, nextStage: string, reason?: string) =>
      request<{ success: boolean; lot: any; previousStage: string; currentStage: string }>(
        '/api/telegram/stage',
        {
          method: 'POST',
          body: JSON.stringify({ lotCode, nextStage, reason }),
        }
      ),

    testNotification: () =>
      request<{ success: boolean; sent: boolean; description?: string }>('/api/telegram/test', {
        method: 'POST',
      }),
  },

  // Owner Governance & Admin helpers
  admin: {
    getSystemHealth: () => request<any>('/api/admin/system-health', { method: 'GET' }),
    getBackups: () =>
      request<{ success: boolean; total: number; backups: any[] }>('/api/admin/backups', { method: 'GET' }),
    runBackupNow: () =>
      request<{ success: boolean; message?: string; key?: string; totalRecords?: number }>('/api/admin/backups/run', {
        method: 'POST',
      }),
  },
};
