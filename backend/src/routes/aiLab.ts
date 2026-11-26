/**
 * aiLab.ts — AI Lab API Routes
 * Protected endpoints for AI Laboratory feature management.
 *
 * Endpoints:
 *   GET  /api/ai/config              — public (filtered by role)
 *   PUT  /api/ai/config              — owner only
 *   POST /api/ai/dadata/address      — requires dadataAutocomplete feature
 *   POST /api/ai/dadata/party        — requires dadataAutocomplete feature
 *   POST /api/ai/dadata/bank         — requires dadataAutocomplete feature
 *   POST /api/ai/cbr/sync            — owner only
 */

import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { consumeQuota } from '../lib/anomalyDetector.js';
import { logger } from '../lib/logger.js';

import {
  getAiLabConfig,
  saveAiLabConfig,
  invalidateAiLabCache,
  canUseAiFeature,
  getEffectiveFeaturesForRole,
  AI_FEATURES_CATALOG,
  AiLabConfig,
  AiFeatureKey,
  FeatureVisibility,
} from '../modules/proptech-ai/aiFeatureFlags.js';
import {
  suggestAddress,
  findPartyByInn,
  findBankByBik,
  getDadataStats,
} from '../modules/legal-core/dadataService.js';
import { syncCbrKeyRate } from '../modules/proptech-ai/cbrSyncService.js';

const VALID_VISIBILITIES: FeatureVisibility[] = ['off', 'owner_only', 'staff_only', 'public'];

export async function handleAiLab(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const authUser = await getAuthenticatedUser(event);
  const userRole = authUser?.role as 'owner' | 'employee' | 'buyer' | 'guest' | undefined;

  // ============================================================
  // GET /api/ai/config
  // ============================================================
  if (subPath === '/config' && method === 'GET') {
    const config = await getAiLabConfig();
    const effectiveFeatures = getEffectiveFeaturesForRole(config, userRole);

    // Public response (for all roles including guest)
    const publicResponse = {
      masterLabEnabled: config.masterLabEnabled,
      effectiveFeatures,
    };

    // Extended response for owner only
    if (userRole === 'owner') {
      const dadataStats = getDadataStats();
      let currentKeyRate: number | null = null;
      let cbrEffectiveDate: string | null = null;
      let cbrUpdatedAt: string | null = null;
      try {
        const ydb = getYdbClient();
        const ms = await ydb.getItem('market_settings', 'market_parameters');
        currentKeyRate = ms?.cbrKeyRatePercent ? Number(ms.cbrKeyRatePercent) : ms?.keyRate ? Number(ms.keyRate) : null;
        cbrEffectiveDate = ms?.cbrEffectiveDate || null;
        cbrUpdatedAt = ms?.cbrUpdatedAt || null;
      } catch {
        // non-fatal
      }

      return json(event, 200, {
        ...publicResponse,
        config,
        catalog: AI_FEATURES_CATALOG,
        connectors: {
          dadata: {
            configured: Boolean(process.env.DADATA_API_KEY),
            dailyUsed: dadataStats.dailyUsed,
            dailySoftCap: dadataStats.dailySoftCap,
            mode: 'free_suggestions_only',
          },
          cbr: {
            currentKeyRate,
            effectiveDate: cbrEffectiveDate,
            lastUpdatedAt: cbrUpdatedAt,
          },
          yandexAi: {
            configured: Boolean(process.env.YC_FOLDER_ID),
          },
        },
      });
    }

    return json(event, 200, publicResponse);
  }

  // ============================================================
  // PUT /api/ai/config — owner only
  // ============================================================
  if (subPath === '/config' && method === 'PUT') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(event, 400, { error: 'Некорректный JSON' });
    }

    // Validate masterLabEnabled
    if (typeof body.masterLabEnabled !== 'boolean') {
      return json(event, 400, { error: 'masterLabEnabled обязателен и должен быть boolean' });
    }

    // Validate features
    const features = body.features;
    if (!features || typeof features !== 'object') {
      return json(event, 400, { error: 'features обязателен и должен быть объектом' });
    }

    const validatedFeatures: Partial<Record<AiFeatureKey, FeatureVisibility>> = {};
    for (const feat of AI_FEATURES_CATALOG) {
      const val = features[feat.key];
      if (val !== undefined) {
        if (!VALID_VISIBILITIES.includes(val)) {
          return json(event, 400, { error: `Недопустимое значение для ${feat.key}: ${val}. Допустимо: ${VALID_VISIBILITIES.join(', ')}` });
        }
        // Reject enabling unimplemented features to non-off
        if (!feat.implemented && val !== 'off') {
          return json(event, 400, { error: `Функция ${feat.key} ещё не реализована (${feat.roadmapStep}). Только значение 'off' допустимо.` });
        }
        validatedFeatures[feat.key] = val;
      }
    }

    const currentConfig = await getAiLabConfig();
    const newConfig: AiLabConfig = {
      ...currentConfig,
      masterLabEnabled: body.masterLabEnabled,
      features: { ...currentConfig.features, ...validatedFeatures } as Record<AiFeatureKey, FeatureVisibility>,
      updatedAt: new Date().toISOString(),
      updatedBy: authUser.id,
    };

    await saveAiLabConfig(newConfig);

    // Audit log
    try {
      const ydb = getYdbClient();
      await ydb.putItem('audit_logs', {
        id: `ai-cfg-${Date.now()}`,
        action: 'AI_LAB_CONFIG_UPDATED',
        actorId: authUser.id,
        actorRole: 'owner',
        payload: JSON.stringify({ masterLabEnabled: newConfig.masterLabEnabled }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    logger.info('AI Lab config updated by owner', { meta: { actorId: authUser.id, masterLabEnabled: newConfig.masterLabEnabled } });

    return json(event, 200, {
      ok: true,
      config: newConfig,
      effectiveFeatures: getEffectiveFeaturesForRole(newConfig, 'owner'),
    });
  }

  // ============================================================
  // POST /api/ai/dadata/address
  // ============================================================
  if (subPath === '/dadata/address' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'dadataAutocomplete', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'dadataAutocomplete' });
    }

    // Per-role quota: 60/hr for buyers, 300/hr for staff
    const isStaff = userRole === 'owner' || userRole === 'employee';
    const quota = await consumeQuota({
      scope: 'ai_dadata_address',
      actorKey: authUser?.id || 'guest',
      limit: isStaff ? 300 : 60,
      windowSec: 3600,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Превышен лимит запросов', retryAfter: quota.retryAfterSec }, { extraHeaders: { 'Retry-After': String(quota.retryAfterSec) } });
    }

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(event, 400, { error: 'Некорректный JSON' }); }

    const query = String(body.query || '').trim();
    if (!query || query.length < 3 || query.length > 200) {
      return json(event, 400, { error: 'query должен быть от 3 до 200 символов' });
    }

    const result = await suggestAddress(query, { count: body.count || 5, region: body.region });
    return json(event, 200, result);
  }

  // ============================================================
  // POST /api/ai/dadata/party
  // ============================================================
  if (subPath === '/dadata/party' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'dadataAutocomplete', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'dadataAutocomplete' });
    }

    const isStaff = userRole === 'owner' || userRole === 'employee';
    const quota = await consumeQuota({
      scope: 'ai_dadata_party',
      actorKey: authUser?.id || 'guest',
      limit: isStaff ? 300 : 60,
      windowSec: 3600,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Превышен лимит запросов', retryAfter: quota.retryAfterSec }, { extraHeaders: { 'Retry-After': String(quota.retryAfterSec) } });
    }

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(event, 400, { error: 'Некорректный JSON' }); }

    const inn = String(body.inn || '').replace(/\D/g, '');
    if (inn.length !== 10 && inn.length !== 12) {
      return json(event, 400, { error: 'ИНН должен содержать 10 цифр (юр. лицо) или 12 цифр (ИП/физ. лицо)' });
    }

    const result = await findPartyByInn(inn);
    return json(event, 200, result);
  }

  // ============================================================
  // POST /api/ai/dadata/bank
  // ============================================================
  if (subPath === '/dadata/bank' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'dadataAutocomplete', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'dadataAutocomplete' });
    }

    const isStaff = userRole === 'owner' || userRole === 'employee';
    const quota = await consumeQuota({
      scope: 'ai_dadata_bank',
      actorKey: authUser?.id || 'guest',
      limit: isStaff ? 300 : 60,
      windowSec: 3600,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Превышен лимит запросов', retryAfter: quota.retryAfterSec }, { extraHeaders: { 'Retry-After': String(quota.retryAfterSec) } });
    }

    let body: any = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { return json(event, 400, { error: 'Некорректный JSON' }); }

    const bik = String(body.bik || '').replace(/\D/g, '');
    if (bik.length !== 9) {
      return json(event, 400, { error: 'БИК должен содержать 9 цифр' });
    }

    const result = await findBankByBik(bik);
    return json(event, 200, result);
  }

  // ============================================================
  // POST /api/ai/cbr/sync — owner only
  // ============================================================
  if (subPath === '/cbr/sync' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    logger.info('CBR key rate manual sync initiated by owner', { meta: { actorId: authUser.id } });
    const result = await syncCbrKeyRate();

    // Audit log
    try {
      const ydb = getYdbClient();
      await ydb.putItem('audit_logs', {
        id: `cbr-sync-${Date.now()}`,
        action: 'CBR_KEY_RATE_SYNCED',
        actorId: authUser.id,
        actorRole: 'owner',
        payload: JSON.stringify({ keyRate: result.keyRate, changed: result.changed, source: result.source }),
        timestamp: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    return json(event, result.ok ? 200 : 502, result);
  }

  return json(event, 404, { error: `Endpoint /api/ai${subPath} не найден` });
}
