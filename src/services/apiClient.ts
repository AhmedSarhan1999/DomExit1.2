import {
  BuyerBuyBox,
  BuyBoxTier,
  BuyerApplication,
  LotDropConfig,
  PriceAcceptance,
  TierVerificationRequest,
  TierVerificationProofType,
} from '../types';
import { clientCache } from './clientCache';

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
  skipCache?: boolean;
  ttlMs?: number;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function executeFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    timeoutMs = 25000,
    headers = {},
    skipCache: _skipCache,
    ttlMs: _ttlMs,
    ...customOptions
  } = options;

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

async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET') {
    if (options.skipCache) {
      return clientCache.dedupe(cleanEndpoint, () => executeFetch<T>(cleanEndpoint, options));
    }
    const effectiveTtl =
      options.ttlMs !== undefined ? options.ttlMs : clientCache.resolveTtlMs(cleanEndpoint);
    return clientCache.getOrFetch<T>(
      cleanEndpoint,
      () => executeFetch<T>(cleanEndpoint, options),
      effectiveTtl
    );
  }

  try {
    return await executeFetch<T>(cleanEndpoint, options);
  } finally {
    // Immediately invalidate related caches on any mutation (POST/PUT/PATCH/DELETE)
    clientCache.invalidateByEndpoint(cleanEndpoint);
  }
}

export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  totalMatching?: number;
  page?: number;
  limit: number;
  totalPages?: number;
  hasMore: boolean;
  nextCursor?: string | null;
  stats?: {
    totalCount: number;
    activeCount: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string | null;
  fields?: 'card' | 'summary' | 'full';
  status?: string;
  category?: string;
  role?: string;
  lotCode?: string;
  city?: string;
  region?: string;
  district?: string;
  developer?: string;
  rooms?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'discount_desc' | string;
  fresh?: boolean;
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  /**
   * Quietly prefetches lot details into clientCache at most once per 30s per lotCode.
   */
  prefetchLot: (lotCode?: string | null): void => {
    const clean = String(lotCode || '').trim().toUpperCase();
    if (!clean) return;
    if (!clientCache.shouldPrefetch(`lot:${clean}`, 30_000)) return;
    void request(`/api/data/lots/${encodeURIComponent(clean)}`, {
      method: 'GET',
      ttlMs: 30_000,
    }).catch(() => {});
  },

  clearCache: (): void => {
    clientCache.clear();
  },

  getPaginated: <T = any>(collection: string, params: PaginationParams = {}, options?: RequestOptions) => {
    const query = new URLSearchParams({ paginated: '1' });
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.fields) query.set('fields', params.fields);
    if (params.status) query.set('status', params.status);
    if (params.category) query.set('category', params.category);
    if (params.role) query.set('role', params.role);
    if (params.lotCode) query.set('lotCode', params.lotCode);
    if (params.city) query.set('city', params.city);
    if (params.region) query.set('region', params.region);
    if (params.district) query.set('district', params.district);
    if (params.developer) query.set('developer', params.developer);
    if (params.rooms) query.set('rooms', params.rooms);
    if (params.priceMin !== undefined) query.set('priceMin', String(params.priceMin));
    if (params.priceMax !== undefined) query.set('priceMax', String(params.priceMax));
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
        ok?: boolean;
        success?: boolean;
        preview?: {
          documentType: string;
          documentTitle: string;
          documentVersion: string;
          canonicalText: string;
          documentTextHashSha256: string;
        };
        documentType?: string;
        title?: string;
        lotCode?: string;
        version?: string;
        text?: string;
        sha256Hex?: string;
        alreadySigned: boolean;
        signatureRecord?: any;
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
        ok?: boolean;
        success: boolean;
        signature: any;
        certificate?: {
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
      request<{ ok: boolean; buyBox: BuyerBuyBox | null; tier: BuyBoxTier; reliabilityScore?: number }>(
        '/api/matching/my-buy-box',
        { method: 'GET' }
      ),

    saveMyBuyBox: (data: Partial<BuyerBuyBox>) =>
      request<{ ok: boolean; buyBox: BuyerBuyBox; tier: BuyBoxTier; reliabilityScore?: number }>(
        '/api/matching/my-buy-box',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),

    getMyApplications: () =>
      request<{
        ok: boolean;
        activeApplications: BuyerApplication[];
        archivedApplications: BuyerApplication[];
        activeCount: number;
        maxSlots: number;
        hasActiveDeal: boolean;
        activeDealLotCode: string | null;
        tier: BuyBoxTier;
        reliabilityScore: number;
      }>('/api/matching/my-applications', { method: 'GET' }),

    withdrawApplication: (appId: string, reason?: string) =>
      request<{
        ok: boolean;
        application: BuyerApplication;
        wasWinner: boolean;
        penaltyApplied: number;
        reliabilityScore: number | null;
        unfrozenCount: number;
        message: string;
      }>(`/api/matching/applications/${encodeURIComponent(appId)}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    getMyMatches: (options?: { limit?: number }) => {
      const qs = options?.limit ? `?limit=${options.limit}` : '';
      return request<{
        ok: boolean;
        buyBoxTier: BuyBoxTier;
        tier?: BuyBoxTier;
        reliabilityScore?: number;
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
        paymentMethod?: 'cash_100' | 'family_mortgage_approved' | 'standard_mortgage_approved' | 'alternative';
        confirmedCashRub?: number;
        buyerComment?: string;
        proofDocuments?: Array<{
          name: string;
          objectKey: string;
          mimeType: string;
          size: number;
          uploadedAt: string;
        }>;
        readiness24h: boolean;
        deposit48h: boolean;
        ndaSigned?: boolean;
        offeredPriceRub?: number;
      }
    ) =>
      request<{
        ok: boolean;
        application: BuyerApplication;
        waveStatus: string;
        currentValidApplications?: number;
      }>(
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
        activeApplicationsCount?: number;
        archivedCount?: number;
        queue: Array<
          BuyerApplication & {
            tier: BuyBoxTier;
            reliabilityScore: number;
            noShowCount: number;
            completedViewingsCount?: number;
            totalPlatformAppsCount?: number;
            offerSigned?: boolean;
            buyBoxSummary?: {
              maxBudgetRub?: number;
              availableLiquidityRub?: number;
              paymentMethod?: string;
              cities?: string[];
              preferredBanks?: string[];
              goal?: string;
            } | null;
            goldVerification?: {
              requestId: string;
              proofType?: string;
              declaredBudgetRub?: number;
              documentName?: string;
              reviewedAt?: string;
            } | null;
          }
        >;
        archivedQueue?: Array<BuyerApplication & { tier: BuyBoxTier; reliabilityScore: number }>;
      }>(`/api/matching/lots/${encodeURIComponent(lotCode)}/queue`, { method: 'GET' }),

    verifyApplication: (
      appId: string,
      params: {
        curatorVerificationStatus: 'pending' | 'verified' | 'needs_clarification';
        curatorVerificationNote?: string;
      }
    ) =>
      request<{ ok: boolean; application: BuyerApplication }>(
        `/api/matching/applications/${encodeURIComponent(appId)}/verify`,
        {
          method: 'PATCH',
          body: JSON.stringify(params),
        }
      ),

    selectWinnerApplication: (appId: string, params?: { replaceExistingWinner?: boolean }) =>
      request<{
        ok: boolean;
        lotCode: string;
        application: BuyerApplication;
        frozenAppsCount: number;
        viewingDeadlineAt?: string;
        depositDeadlineAt?: string;
      }>(`/api/matching/applications/${encodeURIComponent(appId)}/select-winner`, {
        method: 'POST',
        body: JSON.stringify(params || {}),
      }),

    setWaitlistApplication: (
      appId: string,
      params: {
        targetStatus: 'reserve_2' | 'reserve_3' | 'waitlist' | 'pending_review';
        note?: string;
      }
    ) =>
      request<{ ok: boolean; application: BuyerApplication; wasWinner: boolean }>(
        `/api/matching/applications/${encodeURIComponent(appId)}/set-waitlist`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      ),

    rejectApplication: (appId: string, params: { rejectionReason: string }) =>
      request<{
        ok: boolean;
        application: BuyerApplication;
        wasWinner: boolean;
        unfrozenCount: number;
        currentValidApplications: number;
        waveStatus: string;
      }>(`/api/matching/applications/${encodeURIComponent(appId)}/reject`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),

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
      params: { tier: BuyBoxTier; reliabilityScore?: number; tierNote?: string; reason?: string }
    ) =>
      request<{ ok: boolean; buyBox: BuyerBuyBox }>(
        `/api/matching/buyers/${encodeURIComponent(targetUserId)}/tier`,
        {
          method: 'POST',
          body: JSON.stringify(params),
        }
      ),

    confirmStep: (params: {
      lotCode?: string;
      userId: string;
      step: 'completed_viewing' | 'escrow_confirmed';
      notes?: string;
    }) =>
      request<{
        ok: boolean;
        message: string;
        reliabilityScore: number;
        completedViewingsCount: number;
        buyBox: BuyerBuyBox;
      }>('/api/matching/confirm-step', {
        method: 'POST',
        body: JSON.stringify(params),
      }),

    runSlaSweep: (options?: { dryRun?: boolean; forceDailyTasks?: boolean }) =>
      request<{
        ok: boolean;
        lotsScanCount?: number;
        dailyTasksExecuted?: boolean;
        silverWaveOpenedCount?: number;
        expiredDropsClosedCount?: number;
        priority1DeadlinesAlertedCount?: number;
        sellerSlaEscalatedCount?: number;
        partnerReservationsExpiredCount?: number;
        staleLotsAlertedCount?: number;
        prunedRateLimitsCount?: number;
        prunedPepOtpsCount?: number;
        scannedLotsCount?: number;
        promotedCount?: number;
        penalizedCount?: number;
        results?: any[];
      }>('/api/matching/run-sla-sweep', {
        method: 'POST',
        body: JSON.stringify(options || {}),
      }),

    finalizeDeal: (dealId: string, bankOfficerName?: string) =>
      request<{
        ok: boolean;
        deal: any;
        lot?: any;
        closedApplicationsCount: number;
        unfrozenApplicationsCount: number;
      }>(`/api/matching/deals/${encodeURIComponent(dealId)}/finalize`, {
        method: 'POST',
        body: JSON.stringify({ bankOfficerName }),
      }),

    createDealTask: (
      dealId: string,
      payload: {
        title: string;
        assignee: 'seller' | 'buyer';
        kind?: 'upload_doc' | 'sign_pep' | 'confirm';
        pepDocumentType?: 'nda_viewing_act' | 'buyer_reservation_terms' | 'seller_exclusive_consent';
      }
    ) =>
      request<{ ok: boolean; task: any; deal: any }>(
        `/api/matching/deals/${encodeURIComponent(dealId)}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      ),

    submitDealTask: (
      dealId: string,
      taskId: string,
      payload?: { uploadedDocKey?: string; uploadedDocName?: string; note?: string }
    ) =>
      request<{ ok: boolean; task: any; deal: any }>(
        `/api/matching/deals/${encodeURIComponent(dealId)}/tasks/${encodeURIComponent(taskId)}/submit`,
        {
          method: 'POST',
          body: JSON.stringify(payload || {}),
        }
      ),

    approveDealTask: (dealId: string, taskId: string) =>
      request<{ ok: boolean; task: any; deal: any }>(
        `/api/matching/deals/${encodeURIComponent(dealId)}/tasks/${encodeURIComponent(taskId)}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({}),
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

  // Tier Verification & Governance
  tierVerification: {
    getMyRequests: () =>
      request<{
        ok: boolean;
        requests: TierVerificationRequest[];
        currentRequest: TierVerificationRequest | null;
      }>('/api/tier-requests/my', { method: 'GET' }),

    submitRequest: (data: {
      proofType: TierVerificationProofType;
      declaredBudgetRub: number;
      documentKey: string;
      documentName: string;
      documentMime?: string;
      documentSize?: number;
      comment?: string;
    }) =>
      request<{
        ok: boolean;
        request: TierVerificationRequest;
        message: string;
      }>('/api/tier-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getRequests: (params?: { status?: 'pending' | 'archive'; page?: number; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.page) sp.set('page', String(params.page));
      if (params?.limit) sp.set('limit', String(params.limit));
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      return request<PaginatedResult<TierVerificationRequest>>(`/api/tier-requests${qs}`, {
        method: 'GET',
      });
    },

    getDocumentUrl: (id: string) =>
      request<{
        ok: boolean;
        downloadUrl: string;
        expiresIn: number;
        filename?: string;
      }>(`/api/tier-requests/${encodeURIComponent(id)}/document-url`, {
        method: 'GET',
      }),

    makeDecision: (
      id: string,
      data: { decision: 'approved' | 'rejected'; reviewNote?: string }
    ) =>
      request<{
        ok: boolean;
        request: TierVerificationRequest;
        message: string;
      }>(`/api/tier-requests/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // AI Laboratory — Feature Flags & Connectors
  aiLab: {
    getConfig: () =>
      request<any>('/api/ai/config', { method: 'GET', ttlMs: 60_000 }),

    updateConfig: (payload: { masterLabEnabled: boolean; features: Record<string, string> }) =>
      request<any>('/api/ai/config', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    suggestAddress: (query: string, region?: string) =>
      request<any>('/api/ai/dadata/address', {
        method: 'POST',
        body: JSON.stringify({ query, region, count: 5 }),
        skipCache: true,
      }),

    lookupParty: (inn: string) =>
      request<any>('/api/ai/dadata/party', {
        method: 'POST',
        body: JSON.stringify({ inn }),
        skipCache: true,
      }),

    lookupBank: (bik: string) =>
      request<any>('/api/ai/dadata/bank', {
        method: 'POST',
        body: JSON.stringify({ bik }),
        skipCache: true,
      }),

    syncCbrRate: () =>
      request<any>('/api/ai/cbr/sync', {
        method: 'POST',
        body: JSON.stringify({}),
        skipCache: true,
      }),

    getTasks: (params?: { status?: string; lotCode?: string; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set('status', params.status);
      if (params?.lotCode) sp.set('lotCode', params.lotCode);
      if (params?.limit) sp.set('limit', String(params.limit));
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      return request<{ ok: boolean; tasks: any[] }>(`/api/ai/agent-bridge/tasks${qs}`, {
        method: 'GET',
        skipCache: true,
      });
    },

    createTask: (payload: {
      taskType: string;
      lotCode?: string;
      title?: string;
      publicQueryPayload: any;
      deliveryChannel?: string;
      autoDispatch?: boolean;
    }) =>
      request<{ ok: boolean; task: any }>(`/api/ai/agent-bridge/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCache: true,
      }),

    dispatchTask: (taskId: string, channel?: string) =>
      request<{ ok: boolean; channel?: string; error?: string }>(
        `/api/ai/agent-bridge/tasks/${encodeURIComponent(taskId)}/dispatch`,
        {
          method: 'POST',
          body: JSON.stringify({ channel }),
          skipCache: true,
        }
      ),

    submitManualResult: (taskId: string, payload: { rawResultText?: string; result?: any }) =>
      request<{ ok: boolean; task: any }>(
        `/api/ai/agent-bridge/tasks/${encodeURIComponent(taskId)}/submit-manual`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          skipCache: true,
        }
      ),

    reviewTask: (
      taskId: string,
      payload: { decision: 'approve' | 'reject'; applyToLotPrice?: boolean; reviewNotes?: string }
    ) =>
      request<{ ok: boolean; task: any; benchmark?: any }>(
        `/api/ai/agent-bridge/tasks/${encodeURIComponent(taskId)}/review`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
          skipCache: true,
        }
      ),

    getBenchmarks: (params?: { lotCode?: string; complexKey?: string; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params?.lotCode) sp.set('lotCode', params.lotCode);
      if (params?.complexKey) sp.set('complexKey', params.complexKey);
      if (params?.limit) sp.set('limit', String(params.limit));
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      return request<{ ok: boolean; benchmarks: any[] }>(`/api/ai/benchmarks${qs}`, {
        method: 'GET',
        skipCache: true,
      });
    },

    startOcrJob: (payload: { lotCode: string; documentId: string; forceReprocess?: boolean }) =>
      request<{ ok: boolean; job: any; isExisting?: boolean }>(`/api/ai/ocr/jobs`, {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCache: true,
      }),

    getOcrJobs: (lotCode: string) =>
      request<{ ok: boolean; jobs: any[] }>(`/api/ai/ocr/jobs?lotCode=${encodeURIComponent(lotCode)}`, {
        method: 'GET',
        skipCache: true,
      }),

    getOcrJob: (jobId: string) =>
      request<{ ok: boolean; job: any }>(`/api/ai/ocr/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        skipCache: true,
      }),

    analyzeDduContract: (payload: { lotCode: string; ocrJobId?: string; forceReanalyze?: boolean }) =>
      request<{ ok: boolean; analysis: any }>(`/api/ai/legal-copilot/analyze`, {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCache: true,
      }),

    getLegalAnalyses: (lotCode: string) =>
      request<{ ok: boolean; analyses: any[] }>(
        `/api/ai/legal-copilot/analyses?lotCode=${encodeURIComponent(lotCode)}`,
        {
          method: 'GET',
          skipCache: true,
        }
      ),

    verifyBuyerProof: (payload: {
      targetType: 'tier_request' | 'buyer_application';
      targetId: string;
      objectKey?: string;
      forceReanalyze?: boolean;
    }) =>
      request<{ ok: boolean; verification: any }>(`/api/ai/buyer-verify/run`, {
        method: 'POST',
        body: JSON.stringify(payload),
        skipCache: true,
      }),

    getBuyerVerifications: (targetId: string) =>
      request<{ ok: boolean; results: any[] }>(
        `/api/ai/buyer-verify/results?targetId=${encodeURIComponent(targetId)}`,
        {
          method: 'GET',
          skipCache: true,
        }
      ),
  },
};
