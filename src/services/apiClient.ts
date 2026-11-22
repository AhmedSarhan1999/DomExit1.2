import { BuyerBuyBox, BuyBoxTier, BuyerApplication, LotDropConfig, PriceAcceptance } from '../types';

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

  // Authentication & Recovery helpers
  auth: {
    forgotPassword: (email: string) =>
      request<{ ok: boolean; message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (email: string, code: string, newPassword: string) =>
      request<{ ok: boolean; message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, newPassword }),
      }),
  },

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

  // Free Russian Legal Toolkit
  tools: {
    lookupInn: (inn: string) =>
      request<{
        success: boolean;
        inn: string;
        type: 'individual_or_entrepreneur' | 'legal_entity';
        valid: boolean;
        source: 'local_database' | 'dadata_free' | 'algorithm_checksum';
        entity?: {
          name: string;
          ogrn?: string;
          status?: string;
          address?: string;
          management?: string;
        };
        message?: string;
      }>(`/api/tools/inn-lookup?inn=${encodeURIComponent(inn)}`, { method: 'GET' }),
  },

  // PEP Electronic Signatures (63-FZ) via Telegram OTP
  pep: {
    getPreview: (documentType: string, lotCode: string) =>
      request<{
        success: boolean;
        documentType: string;
        title: string;
        lotCode: string;
        version: string;
        text: string;
        sha256Hex: string;
        alreadySigned: boolean;
        existingSignature?: any;
      }>(`/api/pep/preview?documentType=${encodeURIComponent(documentType)}&lotCode=${encodeURIComponent(lotCode)}`, {
        method: 'GET',
      }),

    requestOtp: (documentType: string, lotCode: string, deliveryChannel: 'email' | 'telegram' | 'both' = 'email') =>
      request<{
        ok?: boolean;
        success?: boolean;
        deliveryChannel?: 'email' | 'telegram' | 'both';
        targetEmailMasked?: string;
        telegramUsername?: string | null;
        emailDelivered?: boolean;
        telegramDelivered?: boolean;
        expiresInSec: number;
        documentType?: string;
        lotCode?: string;
        documentTextHashSha256?: string;
        docHashSha256?: string;
      }>('/api/pep/request-otp', {
        method: 'POST',
        body: JSON.stringify({ documentType, lotCode, deliveryChannel }),
      }),

    verifyAndSign: (documentType: string, lotCode: string, otpCode: string) =>
      request<{
        success: boolean;
        signature: any;
        certificate: {
          signedAt: string;
          documentType: string;
          title: string;
          docHashSha256: string;
          signatory: {
            name: string;
            email: string;
            phone: string;
          };
          legalNote: string;
        };
      }>('/api/pep/verify-and-sign', {
        method: 'POST',
        body: JSON.stringify({ documentType, lotCode, otpCode }),
      }),

    getMySignatures: (lotCode?: string) => {
      const qs = lotCode ? `?lotCode=${encodeURIComponent(lotCode)}` : '';
      return request<{
        success: boolean;
        total: number;
        signatures: any[];
      }>(`/api/pep/my-signatures${qs}`, { method: 'GET' });
    },
  },

  // Hybrid Queue & Buy-Box Matching System (Phase 6)
  matching: {
    getMyBuyBox: () =>
      request<{ ok: boolean; buyBox: BuyerBuyBox | null; tier: BuyBoxTier }>('/api/matching/my-buy-box', {
        method: 'GET',
      }),

    saveMyBuyBox: (data: Partial<BuyerBuyBox>) =>
      request<{ ok: boolean; buyBox: BuyerBuyBox; tier: BuyBoxTier }>('/api/matching/my-buy-box', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMyMatches: (options?: { limit?: number }) => {
      const qs = options?.limit ? `?limit=${options.limit}` : '';
      return request<{
        ok: boolean;
        buyBoxTier: BuyBoxTier;
        totalMatches: number;
        matches: Array<{
          lot: any;
          score: number;
          breakdown: any;
          eligibleForDrop: boolean;
          canApplyNow: boolean;
          waveStatus: string;
          remainingSeats: number | null;
          goldExclusiveUntil?: string;
          closesAt?: string;
          reasons: string[];
        }>;
      }>(`/api/matching/my-matches${qs}`, { method: 'GET' });
    },

    launchLotDrop: (
      lotCode: string,
      params: { goldExclusiveHours?: number; windowHours?: number; maxApplicationsCap?: number } = {}
    ) =>
      request<{
        ok: boolean;
        lotCode?: string;
        dropConfig: LotDropConfig;
        matchedGoldCount?: number;
        matchedSilverCount?: number;
      }>(`/api/matching/lots/${encodeURIComponent(lotCode)}/launch-drop`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    applyToLotDrop: (
      lotCode: string,
      params: {
        priceAcceptance: PriceAcceptance;
        readiness24h: boolean;
        deposit48h: boolean;
        ndaSigned?: boolean;
        offeredPriceRub?: number;
      }
    ) =>
      request<{ ok: boolean; application: BuyerApplication; waveStatus: string }>(
        `/api/matching/lots/${encodeURIComponent(lotCode)}/apply`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      ),

    getLotQueue: (lotCode: string) =>
      request<{
        ok: boolean;
        lotCode: string;
        totalApplications: number;
        queue: Array<
          BuyerApplication & {
            tier: BuyBoxTier;
            reliabilityScore: number;
            noShowCount: number;
          }
        >;
      }>(`/api/matching/lots/${encodeURIComponent(lotCode)}/queue`, { method: 'GET' }),

    selectLotPriority: (
      lotCode: string,
      param1: { priority1AppId: string; reserve2AppId?: string; reserve3AppId?: string } | string,
      reserve2AppId?: string,
      reserve3AppId?: string
    ) => {
      const payload =
        typeof param1 === 'string'
          ? { priority1AppId: param1, reserve2AppId, reserve3AppId }
          : param1;
      return request<{
        ok: boolean;
        lotCode: string;
        priority1: any;
        priority1UserId?: string;
        reserve2?: any;
        reserve3?: any;
        viewingDeadlineAt?: string;
        depositDeadlineAt?: string;
      }>(`/api/matching/lots/${encodeURIComponent(lotCode)}/select-priority`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    promoteNextInQueue: (
      lotCode: string,
      param?:
        | {
            previousPriority1AppId?: string;
            reason?: 'no_show' | 'passed' | 'timeout' | 'rejected';
          }
        | string
    ) => {
      const payload = typeof param === 'string' ? { reason: param } : param || {};
      return request<{
        ok: boolean;
        lotCode: string;
        newPriority1?: any;
        promotedApp?: any;
        demotedApp?: any;
        demotedUserId?: string;
      }>(`/api/matching/lots/${encodeURIComponent(lotCode)}/promote-next`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    updateBuyerTier: (
      targetUserId: string,
      params: { tier: BuyBoxTier; reliabilityScore?: number; tierNote?: string }
    ) =>
      request<{ ok: boolean; buyBox: BuyerBuyBox }>(
        `/api/matching/buyers/${encodeURIComponent(targetUserId)}/tier`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      ),

    getDemandRadar: (params?: { city?: string; maxBudget?: number; dealTrack?: string }) => {
      const sp = new URLSearchParams();
      if (params?.city) sp.set('city', params.city);
      if (params?.maxBudget) sp.set('maxBudget', String(params.maxBudget));
      if (params?.dealTrack) sp.set('dealTrack', params.dealTrack);
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      return request<{
        ok: boolean;
        totalMatched: number;
        goldCount: number;
        silverCount: number;
        bronzeCount: number;
        totalDeclaredLiquidityRub: number;
        distributionByCity: Record<string, number>;
        distributionByTrack: Record<string, number>;
        averageBudgetRub: number;
        averageExpectedDiscountPercent: number;
      }>(`/api/matching/demand-radar${qs}`, { method: 'GET' });
    },
  },
};
