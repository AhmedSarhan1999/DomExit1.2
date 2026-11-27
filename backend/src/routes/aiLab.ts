/**
 * aiLab.ts — AI Lab API Routes
 * Protected endpoints for AI Laboratory feature management and external agent bridge.
 *
 * Endpoints:
 *   GET  /api/ai/config                        — public (filtered by role)
 *   PUT  /api/ai/config                        — owner only
 *   POST /api/ai/dadata/address                — requires dadataAutocomplete feature
 *   POST /api/ai/dadata/party                  — requires dadataAutocomplete feature
 *   POST /api/ai/dadata/bank                   — requires dadataAutocomplete feature
 *   POST /api/ai/cbr/sync                      — owner only
 *   GET  /api/ai/agent-bridge/tasks            — requires agentResearchBridge feature
 *   POST /api/ai/agent-bridge/tasks            — requires agentResearchBridge feature (152-FZ Zero-PII check)
 *   POST /api/ai/agent-bridge/tasks/:id/dispatch      — requires agentResearchBridge feature
 *   POST /api/ai/agent-bridge/tasks/:id/submit-manual — requires agentResearchBridge feature
 *   POST /api/ai/agent-bridge/tasks/:id/review        — staff/owner only
 *   POST /api/ai/agent-bridge/webhook/result          — external webhook (HMAC-SHA256 signature / Bearer verification)
 *   GET  /api/ai/benchmarks                    — requires agentResearchBridge feature
 */

import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, normalizeHeaders } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getConfig } from '../lib/config.js';
import { consumeQuota } from '../lib/anomalyDetector.js';
import { logger } from '../lib/logger.js';

import {
  getAiLabConfig,
  saveAiLabConfig,
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
import {
  assertAndScrubNoPii,
  buildStructuredAgentPrompt,
  dispatchTaskToExternalAgent,
  verifyWebhookSignature,
  ingestAgentResult,
  approveAndApplyResult,
  AgentResearchTask,
  AgentTaskType,
  AgentDeliveryChannel,
  MarketBenchmarkRecord,
} from '../modules/proptech-ai/agentBridgeService.js';
import {
  enqueueOcrJob,
  getOcrJobsForLot,
  getOcrJobById,
  getOcrStats,
  AiOcrJobRecord,
} from '../modules/legal-core/ocrQueueService.js';
import { getGptUsageSummary } from '../modules/legal-core/yandexGptClient.js';
import {
  analyzeLotFromOcr,
  getLegalAnalysesForLot,
  AiLegalAnalysisRecord,
} from '../modules/legal-core/dduLegalCopilotService.js';
import {
  verifyBuyerProofDocument,
  getBuyerVerifications,
  AiBuyerVerificationRecord,
} from '../modules/legal-core/buyerProofAiService.js';
import {
  syncDeveloperProjectsFromEiszh,
  upsertEiszhProjectManual,
  findMatchingEiszhProject,
  getEiszhStats,
  EiszhProjectRecord,
} from '../modules/proptech-ai/nashDomSyncService.js';
import {
  computeAssignmentAvm,
  getAvmHistoryForLot,
  getAvmStats,
  AvmValuationInput,
} from '../modules/proptech-ai/avmValuationEngine.js';
import {
  inspectLotPhotos,
  analyzePhoto,
} from '../modules/proptech-ai/photoQaService.js';
import {
  enrichLotGeoInfrastructure,
  findNearestMetros,
} from '../modules/proptech-ai/geoInfrastructureService.js';
import {
  generateListingCopy,
  ListingCopyInput,
} from '../modules/proptech-ai/aiListingCopyService.js';
import {
  runLegislativeRadarScan,
  ingestManualRadarTopic,
  LegislativeRadarItem,
  RadarCategory,
  RadarItemStatus,
} from '../modules/legal-core/legislativeRadarService.js';
import {
  generateArticleDraftFromRadar,
  JournalArticleRecord,
} from '../modules/proptech-ai/contentDraftService.js';
import {
  publishJournalArticle,
  unpublishJournalArticle,
  createManualJournalArticle,
  validateArticleForPublish,
} from '../modules/proptech-ai/journalSeoService.js';
import {
  rebuildRagKnowledgeIndex,
  getRagIndexMeta,
} from '../modules/proptech-ai/ragKnowledgeIndexer.js';
import {
  handleConciergeMessage,
  applyConciergeBuyBoxDraft,
  requestConciergeHumanHandoff,
  getPendingHandoffs,
  resolveHandoff,
  getDailyConciergeStats,
} from '../modules/proptech-ai/ragConciergeService.js';

const VALID_VISIBILITIES: FeatureVisibility[] = ['off', 'owner_only', 'staff_only', 'public'];

function getEventBody<T = any>(event: YcHttpEvent): T | null {
  if (!event.body) return null;
  try {
    let raw = event.body;
    if (event.isBase64Encoded) {
      raw = Buffer.from(raw, 'base64').toString('utf-8');
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getRawEventBody(event: YcHttpEvent): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf-8');
  }
  return event.body;
}

export async function handleAiLab(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const cfg = getConfig();

  // ============================================================
  // POST /api/ai/agent-bridge/webhook/result (External agent webhook, no JWT required)
  // ============================================================
  if (subPath === '/agent-bridge/webhook/result' && method === 'POST') {
    const rawBody = getRawEventBody(event);
    const headers = normalizeHeaders(event.headers, event.multiValueHeaders);
    const sigHeader = headers['x-domexit-signature'];
    const tsHeader = headers['x-domexit-timestamp'];
    const authHeader = headers['authorization'];

    const verifyRes = verifyWebhookSignature({
      signatureHeader: sigHeader,
      timestampHeader: tsHeader,
      rawBody,
      authHeader,
    });

    if (!verifyRes.ok) {
      if (verifyRes.reason === 'AGENT_BRIDGE_NOT_CONFIGURED') {
        return json(event, 503, { error: 'AGENT_BRIDGE_NOT_CONFIGURED' });
      }
      logger.warn('External agent webhook rejected', { meta: { reason: verifyRes.reason } });
      return json(event, 401, { error: 'UNAUTHORIZED_WEBHOOK', reason: verifyRes.reason });
    }

    let body: any = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json(event, 400, { error: 'INVALID_JSON' });
    }

    const taskId = String(body.taskId || '').trim();
    if (!taskId) {
      return json(event, 400, { error: 'taskId обязателен' });
    }

    const resultPayload = body.result !== undefined ? body.result : body.rawResultText !== undefined ? body.rawResultText : body;
    const ingestRes = await ingestAgentResult(taskId, resultPayload, 'webhook');
    if (!ingestRes.ok) {
      return json(event, 400, { error: ingestRes.error });
    }

    return json(event, 200, { ok: true, task: ingestRes.task });
  }

  // All other endpoints require session verification
  const authUser = await getAuthenticatedUser(event);
  const userRole = authUser?.role as 'owner' | 'employee' | 'buyer' | 'guest' | undefined;

  // ============================================================
  // GET /api/ai/config
  // ============================================================
  if (subPath === '/config' && method === 'GET') {
    const config = await getAiLabConfig();
    const effectiveFeatures = getEffectiveFeaturesForRole(config, userRole);

    const publicResponse = {
      masterLabEnabled: config.masterLabEnabled,
      effectiveFeatures,
    };

    if (userRole === 'owner') {
      const dadataStats = getDadataStats();
      let currentKeyRate: number | null = null;
      let cbrEffectiveDate: string | null = null;
      let cbrUpdatedAt: string | null = null;
      let pendingReviewCount = 0;

      const ydb = getYdbClient();
      try {
        const ms = await ydb.getItem('market_settings', 'market_parameters');
        currentKeyRate = ms?.cbrKeyRatePercent ? Number(ms.cbrKeyRatePercent) : ms?.keyRate ? Number(ms.keyRate) : null;
        cbrEffectiveDate = ms?.cbrEffectiveDate || null;
        cbrUpdatedAt = ms?.cbrUpdatedAt || null;
      } catch {
        // non-fatal
      }

      try {
        const pendingTasks = ydb.isV2TablesEnabled()
          ? await ydb.queryAllByIndex<any>({
              tableName: 'agent_research_tasks',
              indexName: 'status-createdAt-index',
              hashKey: 'status',
              hashValue: 'result_received',
              limit: 50,
            })
          : await ydb.findByField<any>('agent_research_tasks', 'status', 'result_received', 50);
        pendingReviewCount = pendingTasks.length;
      } catch {
        // non-fatal
      }

      const ocrStats = await getOcrStats();
      const eiszhStats = await getEiszhStats();
      const avmStats = await getAvmStats();

      let radarStats = {
        lastScanAt: null as string | null,
        totalRadarItems: 0,
        highImpactPendingCount: 0,
        articleDraftsCount: 0,
      };
      try {
        const radarItems = await ydb.scanAll<any>('legislative_radar_items', 100).catch(() => []);
        radarStats.totalRadarItems = radarItems.length;
        radarStats.highImpactPendingCount = radarItems.filter((r) => r.complianceImpact === 'high' && r.status === 'new').length;
        if (radarItems.length > 0) {
          const sorted = [...radarItems].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          radarStats.lastScanAt = sorted[0].createdAt || null;
        }
        const drafts = await ydb.scanAll<any>('journal_articles', 100).catch(() => []);
        radarStats.articleDraftsCount = drafts.length;
      } catch {
        // non-fatal
      }

      let ragMeta = null;
      let pendingHandoffsCount = 0;
      try {
        ragMeta = await getRagIndexMeta();
        const pending = await getPendingHandoffs();
        pendingHandoffsCount = pending.length;
      } catch {
        // non-fatal
      }
      const conciergeStats = getDailyConciergeStats();

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
          agentBridge: {
            webhookSecretConfigured: Boolean(process.env.AGENT_BRIDGE_SECRET || cfg.AGENT_BRIDGE_SECRET),
            outboundWebhookConfigured: Boolean(process.env.EXTERNAL_AGENT_WEBHOOK_URL || cfg.EXTERNAL_AGENT_WEBHOOK_URL),
            pendingReviewCount,
            webhookUrl: `${cfg.PUBLIC_BASE_URL}/api/ai/agent-bridge/webhook/result`,
          },
          ocr: ocrStats,
          yandexGpt: getGptUsageSummary(),
          yandexAi: {
            configured: Boolean(process.env.YC_FOLDER_ID),
          },
          eiszhAvm: {
            configured: true,
            eiszhProjectsCount: eiszhStats.projectsCount,
            eiszhLastSyncAt: eiszhStats.lastSyncAt,
            totalAvmEstimates: avmStats.totalEstimates,
          },
          packagingStudio: {
            configured: Boolean(process.env.YC_FOLDER_ID),
            yandexMapsKeyConfigured: Boolean(process.env.YANDEX_MAPS_API_KEY),
          },
          legislativeRadar: radarStats,
          conciergeRag: {
            configured: Boolean(cfg.S3_PRIVATE_BUCKET),
            indexChunksCount: ragMeta?.chunksCount || 0,
            lastIndexedAt: ragMeta?.lastIndexedAt || null,
            compressedSizeKb: ragMeta?.compressedSizeKb || 0,
            dailyMessagesUsed: conciergeStats.dailyMessagesUsed,
            dailyMessagesCap: conciergeStats.dailyMessagesCap,
            pendingHandoffsCount,
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

    const body = getEventBody<any>(event) || {};
    if (typeof body.masterLabEnabled !== 'boolean') {
      return json(event, 400, { error: 'masterLabEnabled обязателен и должен быть boolean' });
    }

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

    const body = getEventBody<any>(event) || {};
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

    const body = getEventBody<any>(event) || {};
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

    const body = getEventBody<any>(event) || {};
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

    const result = await syncCbrKeyRate();
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

  // ============================================================
  // AGENT RESEARCH BRIDGE ROUTES (requires agentResearchBridge feature)
  // ============================================================

  // 1. GET /api/ai/agent-bridge/tasks
  if (subPath === '/agent-bridge/tasks' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'agentResearchBridge', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'agentResearchBridge' });
    }

    const ydb = getYdbClient();
    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status;
    const lotCodeFilter = queryParams.lotCode;
    const limit = Math.min(Number(queryParams.limit) || 50, 100);

    let tasks: AgentResearchTask[] = [];
    try {
      if (statusFilter && ydb.isV2TablesEnabled()) {
        tasks = await ydb.queryAllByIndex<AgentResearchTask>({
          tableName: 'agent_research_tasks',
          indexName: 'status-createdAt-index',
          hashKey: 'status',
          hashValue: statusFilter,
          scanIndexForward: false,
          limit,
        });
      } else if (lotCodeFilter && ydb.isV2TablesEnabled()) {
        tasks = await ydb.queryAllByIndex<AgentResearchTask>({
          tableName: 'agent_research_tasks',
          indexName: 'lotCode-createdAt-index',
          hashKey: 'lotCode',
          hashValue: lotCodeFilter,
          scanIndexForward: false,
          limit,
        });
      } else {
        tasks = await ydb.scanAll<AgentResearchTask>('agent_research_tasks', limit);
        tasks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      }
    } catch (err: any) {
      logger.error('Failed to list agent_research_tasks', { meta: { error: err.message } });
      return json(event, 500, { error: 'Ошибка получения задач исследований' });
    }

    return json(event, 200, { ok: true, tasks });
  }

  // 2. POST /api/ai/agent-bridge/tasks (Create new research task with 152-FZ Zero-PII check)
  if (subPath === '/agent-bridge/tasks' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'agentResearchBridge', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'agentResearchBridge' });
    }

    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = getEventBody<any>(event) || {};
    const taskType: AgentTaskType = body.taskType || 'developer_price_check';
    const lotCode = body.lotCode ? String(body.lotCode).trim().toUpperCase() : undefined;
    const title = String(body.title || 'Исследование рынка').trim();
    const publicQueryPayload = body.publicQueryPayload || {};
    const deliveryChannel: AgentDeliveryChannel = body.deliveryChannel || 'manual_copy';

    // 152-FZ Zero-PII Firewall Check
    const piiCheck = assertAndScrubNoPii({
      title,
      publicQueryPayload,
    });

    if (!piiCheck.valid) {
      logger.warn('152-FZ PII detected in external agent task creation', {
        meta: { field: piiCheck.field, violation: piiCheck.violation, userId: authUser.id },
      });
      return json(event, 400, {
        error: 'PII_DETECTED_IN_EXTERNAL_TASK',
        field: piiCheck.field,
        violation: piiCheck.violation,
        message: 'Обнаружены персональные данные (152-ФЗ). Запрещено передавать персональные данные (телефоны, почты, паспорт, ИНН физлиц, приватные ссылки) во внешние задачи исследований.',
      });
    }

    const now = new Date().toISOString();
    const taskId = `agt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const promptText = buildStructuredAgentPrompt({
      id: taskId,
      taskType,
      publicQueryPayload,
    });

    const newTask: AgentResearchTask = {
      id: taskId,
      taskType,
      status: 'queued',
      lotCode,
      title,
      publicQueryPayload,
      generatedAgentPrompt: promptText,
      deliveryChannel,
      createdBy: authUser.id,
      createdAt: now,
      updatedAt: now,
    };

    const ydb = getYdbClient();
    await ydb.putItem('agent_research_tasks', newTask);

    if (body.autoDispatch) {
      await dispatchTaskToExternalAgent(newTask);
    }

    return json(event, 201, { ok: true, task: newTask });
  }

  // 3. Sub-resource matching: /agent-bridge/tasks/:id/(dispatch|submit-manual|review)
  const taskSubMatch = subPath.match(/^\/agent-bridge\/tasks\/([^/]+)\/(dispatch|submit-manual|review)$/);
  if (taskSubMatch && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'agentResearchBridge', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'agentResearchBridge' });
    }

    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const taskId = decodeURIComponent(taskSubMatch[1]);
    const action = taskSubMatch[2];
    const body = getEventBody<any>(event) || {};
    const ydb = getYdbClient();

    if (action === 'dispatch') {
      const task = await ydb.getItem<AgentResearchTask>('agent_research_tasks', taskId);
      if (!task) return json(event, 404, { error: 'Задача не найдена' });

      if (body.channel) task.deliveryChannel = body.channel;
      const dispatchRes = await dispatchTaskToExternalAgent(task);
      return json(event, dispatchRes.ok ? 200 : 400, dispatchRes);
    }

    if (action === 'submit-manual') {
      const resultData = body.rawResultText !== undefined ? body.rawResultText : body.result !== undefined ? body.result : body;
      const ingestRes = await ingestAgentResult(taskId, resultData, 'manual');
      if (!ingestRes.ok) return json(event, 400, { error: ingestRes.error });
      return json(event, 200, { ok: true, task: ingestRes.task });
    }

    if (action === 'review') {
      const isStaff = userRole === 'owner' || userRole === 'employee';
      if (!isStaff) {
        return json(event, 403, { error: 'Только сотрудники и владелец могут утверждать результаты' });
      }

      const decision = body.decision;
      if (decision !== 'approve' && decision !== 'reject') {
        return json(event, 400, { error: "decision должен быть 'approve' или 'reject'" });
      }

      const reviewRes = await approveAndApplyResult(
        taskId,
        {
          decision,
          applyToLotPrice: Boolean(body.applyToLotPrice),
          reviewNotes: body.reviewNotes,
        },
        authUser.id
      );

      if (!reviewRes.ok) return json(event, 400, { error: reviewRes.error });
      return json(event, 200, { ok: true, task: reviewRes.task, benchmark: reviewRes.benchmark });
    }
  }

  // 4. GET /api/ai/benchmarks
  if (subPath === '/benchmarks' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'agentResearchBridge', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'agentResearchBridge' });
    }

    const ydb = getYdbClient();
    const queryParams = event.queryStringParameters || {};
    const lotCode = queryParams.lotCode;
    const complexKey = queryParams.complexKey;
    const limit = Math.min(Number(queryParams.limit) || 50, 100);

    let benchmarks: MarketBenchmarkRecord[] = [];
    try {
      if (lotCode && ydb.isV2TablesEnabled()) {
        benchmarks = await ydb.queryAllByIndex<MarketBenchmarkRecord>({
          tableName: 'market_benchmarks',
          indexName: 'lotCode-verifiedAt-index',
          hashKey: 'lotCode',
          hashValue: String(lotCode).toUpperCase(),
          scanIndexForward: false,
          limit,
        });
      } else if (complexKey && ydb.isV2TablesEnabled()) {
        benchmarks = await ydb.queryAllByIndex<MarketBenchmarkRecord>({
          tableName: 'market_benchmarks',
          indexName: 'complexKey-verifiedAt-index',
          hashKey: 'complexKey',
          hashValue: String(complexKey).toLowerCase(),
          scanIndexForward: false,
          limit,
        });
      } else {
        benchmarks = await ydb.scanAll<MarketBenchmarkRecord>('market_benchmarks', limit);
        benchmarks.sort((a, b) => (b.verifiedAt || '').localeCompare(a.verifiedAt || ''));
      }
    } catch (err: any) {
      logger.error('Failed to query market_benchmarks', { meta: { error: err.message } });
      return json(event, 500, { error: 'Ошибка получения бенчмарков' });
    }

    return json(event, 200, { ok: true, benchmarks });
  }

  // ============================================================
  // POST /api/ai/ocr/jobs (Enqueue document for Vision OCR)
  // ============================================================
  if (subPath === '/ocr/jobs' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'visionOcrPreAudit', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'visionOcrPreAudit' });
    }

    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = getEventBody<{ lotCode?: string; documentId?: string; forceReprocess?: boolean }>(event) || {};
    const lotCode = body.lotCode?.trim().toUpperCase();
    const documentId = body.documentId?.trim();

    if (!lotCode || !documentId) {
      return json(event, 400, { error: 'lotCode и documentId обязательны' });
    }

    const ydb = getYdbClient();

    // Verify employee access if employee
    if (userRole === 'employee') {
      const lot = await ydb.getItem<any>('lots', lotCode);
      if (lot && lot.assignedEmployeeId && lot.assignedEmployeeId !== authUser.id) {
        return json(event, 403, { error: 'Вы не назначены куратором данного объекта' });
      }
    }

    // Fetch document from documents_vault
    const doc = await ydb.getItem<any>('documents_vault', documentId);
    if (!doc) {
      return json(event, 404, { error: 'Документ не найден в хранилище' });
    }

    const objectKey = doc.objectKey || doc.fileKey || doc.s3Key || doc.url;
    if (!objectKey) {
      return json(event, 400, { error: 'Ключ файла документа отсутствует в записи' });
    }

    try {
      const enqueueRes = await enqueueOcrJob({
        lotCode,
        documentId,
        objectKey,
        docCategory: doc.category || doc.type || 'other',
        requestedBy: authUser.id,
        forceReprocess: Boolean(body.forceReprocess),
      });

      return json(event, 200, { ok: true, job: enqueueRes.job, isExisting: enqueueRes.isExisting });
    } catch (err: any) {
      logger.error('Failed to enqueue OCR job', { meta: { lotCode, documentId, error: err.message } });
      return json(event, 400, { error: err.message || 'Ошибка постановки задачи OCR в очередь' });
    }
  }

  // ============================================================
  // GET /api/ai/ocr/jobs (Get OCR jobs for lot)
  // ============================================================
  if (subPath === '/ocr/jobs' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'visionOcrPreAudit', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'visionOcrPreAudit' });
    }

    const queryParams = event.queryStringParameters || {};
    const lotCode = queryParams.lotCode;
    if (!lotCode) {
      return json(event, 400, { error: 'Параметр lotCode обязателен' });
    }

    try {
      const jobs = await getOcrJobsForLot(lotCode);
      return json(event, 200, { ok: true, jobs });
    } catch (err: any) {
      logger.error('Failed to fetch OCR jobs for lot', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения задач OCR' });
    }
  }

  // ============================================================
  // GET /api/ai/ocr/jobs/:jobId (Get single OCR job status)
  // ============================================================
  const ocrJobMatch = subPath.match(/^\/ocr\/jobs\/([^/]+)$/);
  if (ocrJobMatch && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'visionOcrPreAudit', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'visionOcrPreAudit' });
    }

    const jobId = decodeURIComponent(ocrJobMatch[1]);
    const job = await getOcrJobById(jobId);
    if (!job) {
      return json(event, 404, { error: 'Задача OCR не найдена' });
    }

    return json(event, 200, { ok: true, job });
  }

  // ============================================================
  // POST /api/ai/legal-copilot/analyze (YandexGPT Pro DDU Analysis)
  // ============================================================
  if (subPath === '/legal-copilot/analyze' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'gptLegalCopilot', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'gptLegalCopilot' });
    }
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = getEventBody<{ lotCode?: string; ocrJobId?: string; forceReanalyze?: boolean }>(event) || {};
    const lotCode = body.lotCode?.trim().toUpperCase();
    if (!lotCode) {
      return json(event, 400, { error: 'lotCode обязателен' });
    }

    const ydb = getYdbClient();
    if (userRole === 'employee') {
      const lot = await ydb.getItem<any>('lots', lotCode);
      if (lot && lot.assignedEmployeeId && lot.assignedEmployeeId !== authUser.id) {
        return json(event, 403, { error: 'Вы не назначены куратором данного объекта' });
      }
    }

    try {
      const analysis = await analyzeLotFromOcr({
        lotCode,
        ocrJobId: body.ocrJobId,
        requestedBy: authUser.id,
        forceReanalyze: Boolean(body.forceReanalyze),
      });
      return json(event, 200, { ok: true, analysis });
    } catch (err: any) {
      logger.error('Failed legal copilot analysis', { meta: { lotCode, error: err.message } });
      return json(event, 400, { error: err.message || 'Ошибка юридического анализа ДДУ' });
    }
  }

  // ============================================================
  // GET /api/ai/legal-copilot/analyses (List analyses for lot)
  // ============================================================
  if (subPath === '/legal-copilot/analyses' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'gptLegalCopilot', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'gptLegalCopilot' });
    }

    const queryParams = event.queryStringParameters || {};
    const lotCode = queryParams.lotCode;
    if (!lotCode) {
      return json(event, 400, { error: 'Параметр lotCode обязателен' });
    }

    try {
      const analyses = await getLegalAnalysesForLot(lotCode);
      return json(event, 200, { ok: true, analyses });
    } catch (err: any) {
      logger.error('Failed fetching legal analyses for lot', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения анализов ДДУ' });
    }
  }

  // ============================================================
  // POST /api/ai/buyer-verify/run (OCR + YandexGPT Lite Solvency Proof)
  // ============================================================
  if (subPath === '/buyer-verify/run' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'gptLegalCopilot', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'gptLegalCopilot' });
    }
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = getEventBody<{
      targetType?: 'tier_request' | 'buyer_application';
      targetId?: string;
      objectKey?: string;
      forceReanalyze?: boolean;
    }>(event) || {};

    const targetType = body.targetType;
    const targetId = body.targetId?.trim();
    if (!targetType || !targetId) {
      return json(event, 400, { error: 'targetType и targetId обязательны' });
    }

    const ydb = getYdbClient();
    let applicantName = '';
    let declaredAmountRub = 0;
    let resolvedObjectKey = body.objectKey?.trim() || '';
    let targetUserId = '';
    let targetLotCode: string | undefined = undefined;

    if (targetType === 'tier_request') {
      const isStaff = userRole === 'owner' || userRole === 'employee';
      if (!isStaff) {
        return json(event, 403, { error: 'Только сотрудники и владелец могут проверять документы верификации Gold' });
      }
      const tr = await ydb.getItem<any>('tier_verification_requests', targetId);
      if (!tr) return json(event, 404, { error: 'Запрос на верификацию не найден' });
      targetUserId = tr.userId;
      if (!resolvedObjectKey) {
        resolvedObjectKey = tr.proofFileKey || tr.fileKey || tr.documentKey || tr.s3Key || '';
      }
      declaredAmountRub = Number(tr.budgetRub || tr.declaredAmountRub || 0);

      if (targetUserId) {
        const u = await ydb.getItem<any>('users', targetUserId);
        applicantName = u?.fullName || u?.name || u?.login || '';
      }
    } else if (targetType === 'buyer_application') {
      const app = await ydb.getItem<any>('buyer_applications', targetId);
      if (!app) return json(event, 404, { error: 'Заявка покупателя не найдена' });

      targetUserId = app.userId;
      targetLotCode = app.lotId || app.lotCode;

      if (userRole === 'employee' && app.assignedCuratorId && app.assignedCuratorId !== authUser.id) {
        return json(event, 403, { error: 'Вы не назначены куратором данной заявки' });
      }

      if (!resolvedObjectKey) {
        resolvedObjectKey = app.proofFileKey || app.solvencyDocKey || app.documentKey || '';
      }
      declaredAmountRub = Number(app.offerPriceRub || app.budgetRub || 0);

      if (targetUserId) {
        const u = await ydb.getItem<any>('users', targetUserId);
        applicantName = u?.fullName || u?.name || u?.login || '';
      }
    }

    if (!resolvedObjectKey) {
      return json(event, 400, { error: 'В заявке отсутствует прикрепленный файл документа подтверждения' });
    }

    try {
      const verification = await verifyBuyerProofDocument({
        targetType,
        targetId,
        objectKey: resolvedObjectKey,
        applicantName,
        declaredAmountRub,
        lotCode: targetLotCode,
        userId: targetUserId,
        requestedBy: authUser.id,
        forceReanalyze: Boolean(body.forceReanalyze),
      });

      return json(event, 200, { ok: true, verification });
    } catch (err: any) {
      logger.error('Failed buyer proof verification', { meta: { targetId, error: err.message } });
      return json(event, 400, { error: err.message || 'Ошибка проверки документа покупателя' });
    }
  }

  // ============================================================
  // GET /api/ai/buyer-verify/results (Get verification results)
  // ============================================================
  if (subPath === '/buyer-verify/results' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'gptLegalCopilot', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'gptLegalCopilot' });
    }

    const queryParams = event.queryStringParameters || {};
    const targetId = queryParams.targetId;
    if (!targetId) {
      return json(event, 400, { error: 'Параметр targetId обязателен' });
    }

    try {
      const results = await getBuyerVerifications(targetId);
      return json(event, 200, { ok: true, results });
    } catch (err: any) {
      logger.error('Failed fetching buyer verification results', { meta: { targetId, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения результатов проверки' });
    }
  }

  // ============================================================
  // POST /api/ai/eiszh/sync — owner only
  // ============================================================
  if (subPath === '/eiszh/sync' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const body = getEventBody<any>(event) || {};
    try {
      const result = await syncDeveloperProjectsFromEiszh({
        developerInn: body.developerInn ? String(body.developerInn).trim() : undefined,
        limitPerDeveloper: body.limitPerDeveloper ? Number(body.limitPerDeveloper) : undefined,
      });

      return json(event, 200, { ok: true, result });
    } catch (err: any) {
      logger.error('EISZH sync failed', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка синхронизации ЕИСЖС' });
    }
  }

  // ============================================================
  // GET /api/ai/eiszh/projects — requires avmValuation
  // ============================================================
  if (subPath === '/eiszh/projects' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'avmValuation', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'avmValuation' });
    }

    const q = event.queryStringParameters || {};
    const complexName = q.complexName ? String(q.complexName).trim() : undefined;
    const developerInn = q.developerInn ? String(q.developerInn).trim() : undefined;
    const region = q.region ? String(q.region).trim() : undefined;

    if (complexName || developerInn) {
      const match = await findMatchingEiszhProject({ complexName, developerInn, region });
      return json(event, 200, { ok: true, project: match });
    }

    const ydb = getYdbClient();
    try {
      const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
      const projects = await ydb.scanAll<EiszhProjectRecord>('eiszh_projects', limit);
      return json(event, 200, { ok: true, projects });
    } catch (err: any) {
      return json(event, 500, { error: 'Ошибка получения проектов ЕИСЖС' });
    }
  }

  // ============================================================
  // POST /api/ai/eiszh/projects/manual — staff/owner only
  // ============================================================
  if (subPath === '/eiszh/projects/manual' && method === 'POST') {
    if (!authUser || (userRole !== 'owner' && userRole !== 'employee')) {
      return json(event, 403, { error: 'Доступ запрещён: требуется роль сотрудника или владельца' });
    }

    const body = getEventBody<any>(event) || {};
    if (!body.complexName || !body.developerName || !body.region) {
      return json(event, 400, { error: 'Поля complexName, developerName и region обязательны' });
    }

    try {
      const project = await upsertEiszhProjectManual({
        complexName: String(body.complexName).trim(),
        developerName: String(body.developerName).trim(),
        developerInn: String(body.developerInn || '0000000000').trim(),
        region: String(body.region).trim(),
        address: String(body.address || '').trim(),
        escrowBankName: body.escrowBankName ? String(body.escrowBankName).trim() : undefined,
        plannedHandoverQuarter: body.plannedHandoverQuarter ? String(body.plannedHandoverQuarter).trim() : undefined,
        delayMonths: Number(body.delayMonths) || 0,
        readinessPct: body.readinessPct !== undefined ? Number(body.readinessPct) : undefined,
        avgPricePerSqmRub: body.avgPricePerSqmRub ? Number(body.avgPricePerSqmRub) : undefined,
        propertyClass: body.propertyClass || 'Комфорт',
        isProblematic: Boolean(body.isProblematic),
        sourceUrl: body.sourceUrl ? String(body.sourceUrl).trim() : undefined,
        eiszhObjId: body.eiszhObjId ? String(body.eiszhObjId).trim() : undefined,
      });

      return json(event, 200, { ok: true, project });
    } catch (err: any) {
      logger.error('Failed manual EISZH project upsert', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка сохранения проекта ЕИСЖС' });
    }
  }

  // ============================================================
  // POST /api/ai/avm/estimate — requires avmValuation
  // ============================================================
  if (subPath === '/avm/estimate' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'avmValuation', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'avmValuation' });
    }

    const rateKey = authUser?.id || (event.requestContext?.identity?.sourceIp ? `ip_${event.requestContext.identity.sourceIp}` : 'anon');
    const quota = await consumeQuota({
      scope: 'avm_estimate',
      actorKey: rateKey,
      limit: 60,
      windowSec: 60,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Слишком много запросов на оценку. Попробуйте через минуту.' });
    }

    const body = getEventBody<any>(event) || {};
    if (!body.complexName || !body.region || !body.areaSqm || !body.dduFullPriceRub) {
      return json(event, 400, {
        error: 'Обязательные поля: complexName, region, areaSqm (площадь > 0), dduFullPriceRub (цена ДДУ > 0)',
      });
    }

    const areaSqm = Number(body.areaSqm);
    const dduFullPriceRub = Number(body.dduFullPriceRub);
    if (isNaN(areaSqm) || areaSqm <= 0 || isNaN(dduFullPriceRub) || dduFullPriceRub <= 0) {
      return json(event, 400, { error: 'Некорректная площадь или цена ДДУ' });
    }

    try {
      const input: AvmValuationInput = {
        lotCode: body.lotCode ? String(body.lotCode).trim().toUpperCase() : undefined,
        complexName: String(body.complexName).trim(),
        developerName: body.developerName ? String(body.developerName).trim() : undefined,
        developerInn: body.developerInn ? String(body.developerInn).trim() : undefined,
        region: String(body.region).trim(),
        areaSqm,
        rooms: body.rooms !== undefined ? Number(body.rooms) : undefined,
        floor: body.floor !== undefined ? Number(body.floor) : undefined,
        totalFloors: body.totalFloors !== undefined ? Number(body.totalFloors) : undefined,
        dduFullPriceRub,
        paidToDeveloperRub: body.paidToDeveloperRub !== undefined ? Number(body.paidToDeveloperRub) : dduFullPriceRub,
        remainingDebtRub: body.remainingDebtRub !== undefined ? Number(body.remainingDebtRub) : undefined,
        handoverQuarter: body.handoverQuarter ? String(body.handoverQuarter).trim() : undefined,
        familyMortgageEligible: body.familyMortgageEligible !== undefined ? Boolean(body.familyMortgageEligible) : undefined,
        developerConsentFeeRub: body.developerConsentFeeRub !== undefined ? Number(body.developerConsentFeeRub) : undefined,
        developerPriceTodayRub: body.developerPriceTodayRub !== undefined ? Number(body.developerPriceTodayRub) : undefined,
        curatorOverrideBenchmarkSqmRub: body.curatorOverrideBenchmarkSqmRub !== undefined ? Number(body.curatorOverrideBenchmarkSqmRub) : undefined,
        saveHistory: body.saveHistory !== undefined ? Boolean(body.saveHistory) : Boolean(body.lotCode),
        requestedBy: authUser?.id || 'guest',
      };

      const valuation = await computeAssignmentAvm(input);
      return json(event, 200, { ok: true, valuation });
    } catch (err: any) {
      logger.error('Failed computing assignment AVM', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка расчёта экспресс-оценки AVM' });
    }
  }

  // ============================================================
  // GET /api/ai/avm/history — requires avmValuation
  // ============================================================
  if (subPath === '/avm/history' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'avmValuation', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'avmValuation' });
    }

    const q = event.queryStringParameters || {};
    const lotCode = q.lotCode ? String(q.lotCode).trim() : '';
    if (!lotCode) {
      return json(event, 400, { error: 'Параметр lotCode обязателен' });
    }

    try {
      const history = await getAvmHistoryForLot(lotCode);
      return json(event, 200, { ok: true, history });
    } catch (err: any) {
      logger.error('Failed fetching AVM history', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения истории оценок AVM' });
    }
  }

  // ============================================================
  // POST /api/ai/packaging/photo-qa — requires aiPackagingStudio
  // ============================================================
  if (subPath === '/packaging/photo-qa' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'aiPackagingStudio', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'aiPackagingStudio' });
    }

    const rateKey = authUser?.id || (event.requestContext?.identity?.sourceIp ? `ip_${event.requestContext.identity.sourceIp}` : 'anon');
    const quota = await consumeQuota({
      scope: 'photo_qa',
      actorKey: rateKey,
      limit: 30,
      windowSec: 60,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Слишком много запросов на проверку фото. Попробуйте через минуту.' });
    }

    const body = getEventBody<any>(event) || {};
    const lotCode = body.lotCode ? String(body.lotCode).trim().toUpperCase() : '';
    if (!lotCode) {
      return json(event, 400, { error: 'Параметр lotCode обязателен' });
    }

    let photoUrls: string[] = Array.isArray(body.photoUrls) ? body.photoUrls : [];

    if (photoUrls.length === 0) {
      const ydb = getYdbClient();
      try {
        const lot = await ydb.getItem<any>('lots', lotCode);
        if (lot) {
          const list = [
            ...(lot.sellerUploadedPhotos || []),
            ...(lot.sellerSubmittedImages || []),
            ...(lot.galleryImages || []),
            ...(lot.images || []),
            lot.imageUrl,
          ].filter(Boolean);
          photoUrls = Array.from(new Set(list));
        }
      } catch (err: any) {
        logger.warn('[PhotoQA] Failed querying lot photos from YDB', { meta: { lotCode, error: err.message } });
      }
    }

    if (photoUrls.length === 0) {
      return json(event, 400, { error: 'В лоте нет прикрепленных фотографий для проверки' });
    }

    try {
      const report = await inspectLotPhotos({
        lotCode,
        photoUrls,
        forceReprocess: Boolean(body.forceReprocess),
        operatorId: authUser?.id || 'system',
      });

      return json(event, 200, { ok: true, report });
    } catch (err: any) {
      logger.error('Photo QA inspection failed', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка проверки качества и приватности фотографий' });
    }
  }

  // ============================================================
  // POST /api/ai/packaging/geo-enrich — requires aiPackagingStudio
  // ============================================================
  if (subPath === '/packaging/geo-enrich' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'aiPackagingStudio', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'aiPackagingStudio' });
    }

    const body = getEventBody<any>(event) || {};
    const lotCode = body.lotCode ? String(body.lotCode).trim().toUpperCase() : undefined;
    let address = body.address ? String(body.address).trim() : undefined;
    let city = body.city ? String(body.city).trim() : undefined;
    let lat = body.lat !== undefined ? Number(body.lat) : undefined;
    let lon = body.lon !== undefined ? Number(body.lon) : undefined;

    if ((!address || !lat) && lotCode) {
      const ydb = getYdbClient();
      try {
        const lot = await ydb.getItem<any>('lots', lotCode);
        if (lot) {
          address = address || lot.streetAddress || lot.district || lot.complexName;
          city = city || lot.city;
          if (!lat && lot.coordinates?.lat) lat = Number(lot.coordinates.lat);
          if (!lon && lot.coordinates?.lng) lon = Number(lot.coordinates.lng);
        }
      } catch {
        // ignore
      }
    }

    try {
      const geo = await enrichLotGeoInfrastructure({
        lotCode,
        address,
        city,
        lat,
        lon,
        operatorId: authUser?.id || 'system',
      });

      return json(event, 200, { ok: true, geo });
    } catch (err: any) {
      logger.error('Geo enrichment failed', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка определения геолокации и станций метро' });
    }
  }

  // ============================================================
  // POST /api/ai/packaging/generate-copy — requires aiPackagingStudio
  // ============================================================
  if (subPath === '/packaging/generate-copy' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'aiPackagingStudio', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'aiPackagingStudio' });
    }

    const rateKey = authUser?.id || (event.requestContext?.identity?.sourceIp ? `ip_${event.requestContext.identity.sourceIp}` : 'anon');
    const quota = await consumeQuota({
      scope: 'generate_copy',
      actorKey: rateKey,
      limit: 20,
      windowSec: 60,
    });
    if (!quota.allowed) {
      return json(event, 429, { error: 'Слишком много запросов генерации описаний. Попробуйте через минуту.' });
    }

    const body = getEventBody<any>(event) || {};
    const lotCode = body.lotCode ? String(body.lotCode).trim().toUpperCase() : '';
    if (!lotCode || !body.complexName || !body.areaSqm || !body.dduPriceRub) {
      return json(event, 400, {
        error: 'Обязательные поля: lotCode, complexName, areaSqm, dduPriceRub',
      });
    }

    try {
      const draft = await generateListingCopy({
        lotCode,
        complexName: String(body.complexName).trim(),
        developerName: body.developerName ? String(body.developerName).trim() : undefined,
        region: String(body.region || 'spb').trim(),
        district: body.district ? String(body.district).trim() : undefined,
        address: body.address ? String(body.address).trim() : undefined,
        areaSqm: Number(body.areaSqm),
        rooms: body.rooms,
        floor: body.floor !== undefined ? Number(body.floor) : undefined,
        totalFloors: body.totalFloors !== undefined ? Number(body.totalFloors) : undefined,
        handoverQuarter: body.handoverQuarter ? String(body.handoverQuarter).trim() : undefined,
        dduPriceRub: Number(body.dduPriceRub),
        cashToSellerRub: Number(body.cashToSellerRub || body.dduPriceRub),
        debtToDevRub: Number(body.debtToDevRub || 0),
        todayDeveloperPriceRub: body.todayDeveloperPriceRub ? Number(body.todayDeveloperPriceRub) : undefined,
        buyerNetSavingsRub: body.buyerNetSavingsRub ? Number(body.buyerNetSavingsRub) : undefined,
        isNegotiable: Boolean(body.isNegotiable),
        nearestMetroName: body.nearestMetroName ? String(body.nearestMetroName).trim() : undefined,
        nearestMetroDistanceKm: body.nearestMetroDistanceKm !== undefined ? Number(body.nearestMetroDistanceKm) : undefined,
        nearestMetroWalkMinutes: body.nearestMetroWalkMinutes !== undefined ? Number(body.nearestMetroWalkMinutes) : undefined,
        nearestMetroTransportMinutes: body.nearestMetroTransportMinutes !== undefined ? Number(body.nearestMetroTransportMinutes) : undefined,
        infraTags: Array.isArray(body.infraTags) ? body.infraTags : undefined,
        tone: body.tone || 'balanced',
        forceReprocess: Boolean(body.forceReprocess),
        operatorId: authUser?.id || 'system',
      });

      return json(event, 200, { ok: true, draft });
    } catch (err: any) {
      logger.error('Listing copy generation failed', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка генерации продающего описания YandexGPT' });
    }
  }

  // ============================================================
  // GET /api/ai/packaging/results — requires aiPackagingStudio
  // ============================================================
  if (subPath === '/packaging/results' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'aiPackagingStudio', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'aiPackagingStudio' });
    }

    const q = event.queryStringParameters || {};
    const lotCode = q.lotCode ? String(q.lotCode).trim().toUpperCase() : '';
    if (!lotCode) {
      return json(event, 400, { error: 'Параметр lotCode обязателен' });
    }

    const ydb = getYdbClient();
    try {
      const [photoQa, geo, copy] = await Promise.all([
        ydb.getItem<any>('ai_packaging_results', `pkg-${lotCode}-photoqa`).catch(() => null),
        ydb.getItem<any>('ai_packaging_results', `pkg-${lotCode}-geo`).catch(() => null),
        ydb.getItem<any>('ai_packaging_results', `pkg-${lotCode}-copy`).catch(() => null),
      ]);

      return json(event, 200, {
        ok: true,
        lotCode,
        photoQa: photoQa?.photoQaResults || null,
        geo: geo?.geoResult || null,
        copyDraft: copy?.copyDraft || null,
      });
    } catch (err: any) {
      logger.error('Failed fetching packaging results', { meta: { lotCode, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения результатов упаковки' });
    }
  }

  // ============================================================
  // POST /api/ai/radar/scan — owner only
  // ============================================================
  if (subPath === '/radar/scan' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'legislativeRadar', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'legislativeRadar' });
    }

    try {
      const result = await runLegislativeRadarScan({ operatorId: authUser.id });
      return json(event, 200, { ok: true, result });
    } catch (err: any) {
      logger.error('Legislative radar scan failed', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка сканирования законодательного радара' });
    }
  }

  // ============================================================
  // POST /api/ai/radar/manual — owner only
  // ============================================================
  if (subPath === '/radar/manual' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'legislativeRadar', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'legislativeRadar' });
    }

    const body = getEventBody<any>(event) || {};
    const originalTitle = (body.originalTitle || '').trim();
    if (!originalTitle) {
      return json(event, 400, { error: 'Заголовок новости/закона обязателен' });
    }

    try {
      const item = await ingestManualRadarTopic({
        originalTitle,
        originalUrl: body.originalUrl,
        excerptRaw: body.excerptRaw,
        category: body.category as RadarCategory,
        operatorId: authUser.id,
      });

      return json(event, 200, { ok: true, item });
    } catch (err: any) {
      logger.error('Manual radar ingestion failed', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка ручного добавления в радар' });
    }
  }

  // ============================================================
  // GET /api/ai/radar/items — requires legislativeRadar feature
  // ============================================================
  if (subPath === '/radar/items' && method === 'GET') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'legislativeRadar', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'legislativeRadar' });
    }

    const q = event.queryStringParameters || {};
    const status = q.status ? String(q.status).trim() : '';
    const category = q.category ? String(q.category).trim() : '';
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '50', 10)));

    const ydb = getYdbClient();
    try {
      let items: LegislativeRadarItem[] = [];
      if (status && ydb.isV2TablesEnabled()) {
        items = await ydb.queryAllByIndex<LegislativeRadarItem>({
          tableName: 'legislative_radar_items',
          indexName: 'status-publishedAt-index',
          hashKey: 'status',
          hashValue: status,
          limit,
        });
      } else if (category && ydb.isV2TablesEnabled()) {
        items = await ydb.queryAllByIndex<LegislativeRadarItem>({
          tableName: 'legislative_radar_items',
          indexName: 'category-publishedAt-index',
          hashKey: 'category',
          hashValue: category,
          limit,
        });
      } else {
        items = await ydb.scanAll<LegislativeRadarItem>('legislative_radar_items', limit);
      }

      // Sort by publishedAt or createdAt descending
      items.sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || ''));

      return json(event, 200, { ok: true, items });
    } catch (err: any) {
      logger.error('Failed fetching radar items', { meta: { error: err.message } });
      return json(event, 500, { error: 'Ошибка получения элементов законодательного радара' });
    }
  }

  // ============================================================
  // POST /api/ai/radar/items/:id/generate-draft — owner only
  // ============================================================
  if (subPath.startsWith('/radar/items/') && subPath.endsWith('/generate-draft') && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'legislativeRadar', userRole)) {
      return json(event, 403, { error: 'AI_FEATURE_DISABLED', feature: 'legislativeRadar' });
    }

    const radarItemId = subPath.replace('/radar/items/', '').replace('/generate-draft', '').trim();
    if (!radarItemId) {
      return json(event, 400, { error: 'Идентификатор элемента радара обязателен' });
    }

    const body = getEventBody<any>(event) || {};
    try {
      const result = await generateArticleDraftFromRadar({
        radarItemId,
        customAngleRu: body.customAngleRu,
        requestedBy: authUser.id,
        forceRegenerate: Boolean(body.forceRegenerate),
      });

      return json(event, 200, result);
    } catch (err: any) {
      logger.error('Article draft generation from radar failed', { meta: { radarItemId, error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка генерации статьи YandexGPT Pro' });
    }
  }

  // ============================================================
  // PATCH /api/ai/radar/items/:id — owner only
  // ============================================================
  if (subPath.startsWith('/radar/items/') && method === 'PATCH') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const radarItemId = subPath.replace('/radar/items/', '').split('/')[0].trim();
    if (!radarItemId) {
      return json(event, 400, { error: 'Идентификатор элемента радара обязателен' });
    }

    const ydb = getYdbClient();
    try {
      const existing = await ydb.getItem<LegislativeRadarItem>('legislative_radar_items', radarItemId);
      if (!existing) {
        return json(event, 404, { error: 'Элемент радара не найден' });
      }

      const body = getEventBody<any>(event) || {};
      const updated: LegislativeRadarItem = {
        ...existing,
        status: (body.status as RadarItemStatus) || existing.status,
        reviewNotes: body.reviewNotes !== undefined ? String(body.reviewNotes) : existing.reviewNotes,
        complianceActionPlanRu: body.complianceActionPlanRu !== undefined ? String(body.complianceActionPlanRu) : existing.complianceActionPlanRu,
        reviewedBy: authUser.id,
        reviewedAt: new Date().toISOString(),
      };

      await ydb.putItem('legislative_radar_items', updated);
      return json(event, 200, { ok: true, item: updated });
    } catch (err: any) {
      logger.error('Failed updating radar item', { meta: { radarItemId, error: err.message } });
      return json(event, 500, { error: 'Ошибка обновления элемента радара' });
    }
  }

  // ============================================================
  // GET /api/ai/journal/drafts — owner only
  // ============================================================
  if (subPath === '/journal/drafts' && method === 'GET') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const q = event.queryStringParameters || {};
    const status = q.status ? String(q.status).trim() : '';
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '50', 10)));

    const ydb = getYdbClient();
    try {
      let drafts: JournalArticleRecord[] = [];
      if (status && ydb.isV2TablesEnabled()) {
        drafts = await ydb.queryAllByIndex<JournalArticleRecord>({
          tableName: 'journal_articles',
          indexName: 'status-publishedAt-index',
          hashKey: 'status',
          hashValue: status,
          limit,
        });
      } else {
        drafts = await ydb.scanAll<JournalArticleRecord>('journal_articles', limit);
      }

      drafts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return json(event, 200, { ok: true, drafts });
    } catch (err: any) {
      logger.error('Failed fetching journal drafts', { meta: { error: err.message } });
      return json(event, 500, { error: 'Ошибка получения черновиков журнала' });
    }
  }

  // ============================================================
  // PATCH /api/ai/journal/drafts/:id — owner only
  // ============================================================
  if (subPath.startsWith('/journal/drafts/') && method === 'PATCH') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const draftId = subPath.replace('/journal/drafts/', '').split('/')[0].trim();
    if (!draftId) {
      return json(event, 400, { error: 'Идентификатор статьи обязателен' });
    }

    const ydb = getYdbClient();
    try {
      const existing = await ydb.getItem<JournalArticleRecord>('journal_articles', draftId);
      if (!existing) {
        return json(event, 404, { error: 'Черновик статьи не найден' });
      }

      const body = getEventBody<any>(event) || {};
      const nowIso = new Date().toISOString();

      const updated: JournalArticleRecord = {
        ...existing,
        titleRu: body.titleRu !== undefined ? String(body.titleRu).trim() : existing.titleRu,
        subtitleRu: body.subtitleRu !== undefined ? String(body.subtitleRu).trim() : existing.subtitleRu,
        markdownBodyRu: body.markdownBodyRu !== undefined ? String(body.markdownBodyRu) : existing.markdownBodyRu,
        telegramPostDraftRu: body.telegramPostDraftRu !== undefined ? String(body.telegramPostDraftRu) : existing.telegramPostDraftRu,
        newsletterSnippetRu: body.newsletterSnippetRu !== undefined ? String(body.newsletterSnippetRu) : existing.newsletterSnippetRu,
        status: body.status || (existing.status === 'ai_draft' ? 'in_review' : existing.status),
        tagsRu: Array.isArray(body.tagsRu) ? body.tagsRu : existing.tagsRu,
        humanEdited: true, // Mark human-edited when updated by owner
        updatedAt: nowIso,
      };

      await ydb.putItem('journal_articles', updated);
      return json(event, 200, { ok: true, article: updated });
    } catch (err: any) {
      logger.error('Failed updating journal draft', { meta: { draftId, error: err.message } });
      return json(event, 500, { error: 'Ошибка обновления черновика статьи' });
    }
  }

  // ============================================================
  // POST /api/ai/journal/articles — owner only (Manual article create)
  // ============================================================
  if (subPath === '/journal/articles' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const body = getEventBody<any>(event) || {};
    if (!body.titleRu || !body.titleRu.trim()) {
      return json(event, 400, { error: 'Поле titleRu обязательно' });
    }

    try {
      const article = await createManualJournalArticle(body, {
        id: authUser.id,
        name: authUser.name,
      });
      return json(event, 201, { ok: true, article });
    } catch (err: any) {
      logger.error('Failed creating manual article', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка создания статьи' });
    }
  }

  // ============================================================
  // POST /api/ai/journal/articles/:id/validate — owner only
  // ============================================================
  if (subPath.startsWith('/journal/articles/') && subPath.endsWith('/validate') && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const articleId = subPath.replace('/journal/articles/', '').replace('/validate', '').trim();
    const ydb = getYdbClient();
    try {
      const article = await ydb.getItem<JournalArticleRecord>('journal_articles', articleId);
      if (!article) {
        return json(event, 404, { error: 'Статья не найдена' });
      }
      const validation = validateArticleForPublish(article);
      return json(event, 200, { ok: true, validation });
    } catch (err: any) {
      logger.error('Failed validating article', { meta: { articleId, error: err.message } });
      return json(event, 500, { error: 'Ошибка валидации статьи' });
    }
  }

  // ============================================================
  // POST /api/ai/journal/articles/:id/publish — owner only
  // ============================================================
  if (subPath.startsWith('/journal/articles/') && subPath.endsWith('/publish') && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const articleId = subPath.replace('/journal/articles/', '').replace('/publish', '').trim();
    const body = getEventBody<any>(event) || {};

    try {
      const result = await publishJournalArticle({
        articleId,
        actor: {
          id: authUser.id,
          name: authUser.name,
          role: authUser.role,
        },
        publishToTelegram: Boolean(body.publishToTelegram),
        telegramDryRun: Boolean(body.telegramDryRun),
        forceTelegramRepost: Boolean(body.forceTelegramRepost),
        publicBaseUrl: cfg.PUBLIC_BASE_URL || 'https://domexit.ru',
      });

      return json(event, 200, result);
    } catch (err: any) {
      logger.error('Failed publishing article', { meta: { articleId, error: err.message } });
      const statusCode = err.statusCode || 400;
      return json(event, statusCode, {
        error: err.message || 'Ошибка публикации статьи',
        errorCode: err.errorCode || 'PUBLISH_FAILED',
        blockers: err.blockers || [],
      });
    }
  }

  // ============================================================
  // POST /api/ai/journal/articles/:id/unpublish — owner only
  // ============================================================
  if (subPath.startsWith('/journal/articles/') && subPath.endsWith('/unpublish') && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const articleId = subPath.replace('/journal/articles/', '').replace('/unpublish', '').trim();
    try {
      const article = await unpublishJournalArticle(articleId, {
        id: authUser.id,
        role: authUser.role,
      });
      return json(event, 200, { ok: true, article });
    } catch (err: any) {
      logger.error('Failed unpublishing article', { meta: { articleId, error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка снятия с публикации' });
    }
  }

  // ============================================================
  // DELETE /api/ai/journal/articles/:id — owner only
  // ============================================================
  if (subPath.startsWith('/journal/articles/') && method === 'DELETE') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    const articleId = subPath.replace('/journal/articles/', '').split('/')[0].trim();
    const ydb = getYdbClient();
    try {
      const existing = await ydb.getItem<JournalArticleRecord>('journal_articles', articleId);
      if (!existing) {
        return json(event, 404, { error: 'Статья не найдена' });
      }

      await ydb.deleteItem('journal_articles', articleId);
      return json(event, 200, { ok: true, deleted: articleId });
    } catch (err: any) {
      logger.error('Failed deleting article', { meta: { articleId, error: err.message } });
      return json(event, 500, { error: 'Ошибка удаления статьи' });
    }
  }

  // ============================================================
  // POST /api/ai/rag/reindex — owner only
  // ============================================================
  if (subPath === '/rag/reindex' && method === 'POST') {
    if (!authUser || userRole !== 'owner') {
      return json(event, 403, { error: 'Доступ запрещён: только владелец платформы' });
    }

    try {
      const meta = await rebuildRagKnowledgeIndex({ requestedBy: authUser.id });
      return json(event, 200, { ok: true, meta });
    } catch (err: any) {
      logger.error('Failed rebuilding RAG index', { meta: { error: err.message } });
      return json(event, 500, { error: err.message || 'Ошибка переиндексации базы знаний' });
    }
  }

  // ============================================================
  // POST /api/ai/concierge/chat — gated by aiConciergeRag
  // ============================================================
  if (subPath === '/concierge/chat' && method === 'POST') {
    const config = await getAiLabConfig();
    if (!canUseAiFeature(config, 'aiConciergeRag', userRole)) {
      return json(event, 403, { error: 'Функция AI-Консьерж временно недоступна для вашей роли' });
    }

    const body = getEventBody<any>(event) || {};
    if (!body.messageText || typeof body.messageText !== 'string' || !body.messageText.trim()) {
      return json(event, 400, { error: 'messageText обязателен' });
    }

    try {
      const res = await handleConciergeMessage({
        sessionId: body.sessionId,
        channel: 'web',
        user: authUser ? { id: authUser.id, role: authUser.role, name: authUser.name, phone: authUser.phone } : undefined,
        anonymousId: body.anonymousId,
        messageText: body.messageText.trim(),
      });
      return json(event, 200, { ok: true, ...res });
    } catch (err: any) {
      const isQuota = err.message === 'DAILY_CONCIERGE_QUOTA_EXCEEDED';
      return json(event, isQuota ? 429 : 500, {
        error: isQuota
          ? 'Превышен дневной лимит сообщений AI-Консьержа. Попробуйте снова завтра или вызовите куратора.'
          : err.message || 'Ошибка обработки сообщения консьержа',
      });
    }
  }

  // ============================================================
  // GET /api/ai/concierge/sessions/:sessionId
  // ============================================================
  if (
    subPath.startsWith('/concierge/sessions/') &&
    !subPath.includes('/apply-buybox') &&
    !subPath.includes('/handoff') &&
    method === 'GET'
  ) {
    const sessionId = subPath.replace('/concierge/sessions/', '').trim();
    const ydb = getYdbClient();
    try {
      const session = await ydb.getItem<any>('ai_concierge_sessions', sessionId);
      if (!session) {
        return json(event, 404, { error: 'Сессия не найдена' });
      }
      return json(event, 200, { ok: true, session });
    } catch (err: any) {
      return json(event, 500, { error: err.message || 'Ошибка загрузки сессии' });
    }
  }

  // ============================================================
  // POST /api/ai/concierge/sessions/:sessionId/apply-buybox
  // ============================================================
  if (subPath.startsWith('/concierge/sessions/') && subPath.endsWith('/apply-buybox') && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Для сохранения Buy-Box необходимо войти в аккаунт' });
    }

    const sessionId = subPath.replace('/concierge/sessions/', '').replace('/apply-buybox', '').trim();
    try {
      const res = await applyConciergeBuyBoxDraft(sessionId, authUser);
      return json(event, 200, res);
    } catch (err: any) {
      return json(event, 400, { error: err.message || 'Ошибка сохранения Buy-Box' });
    }
  }

  // ============================================================
  // POST /api/ai/concierge/sessions/:sessionId/handoff
  // ============================================================
  if (subPath.startsWith('/concierge/sessions/') && subPath.endsWith('/handoff') && method === 'POST') {
    const sessionId = subPath.replace('/concierge/sessions/', '').replace('/handoff', '').trim();
    const body = getEventBody<any>(event) || {};
    try {
      const res = await requestConciergeHumanHandoff(
        sessionId,
        authUser ? { id: authUser.id, name: authUser.name, phone: authUser.phone, role: authUser.role } : undefined,
        body.contactNote
      );
      return json(event, 200, res);
    } catch (err: any) {
      return json(event, 500, { error: err.message || 'Ошибка запроса куратора' });
    }
  }

  // ============================================================
  // GET /api/ai/concierge/handoffs — staff / owner only
  // ============================================================
  if (subPath === '/concierge/handoffs' && method === 'GET') {
    if (!authUser || (userRole !== 'owner' && userRole !== 'employee')) {
      return json(event, 403, { error: 'Доступ запрещён: только сотрудники платформы' });
    }

    try {
      const handoffs = await getPendingHandoffs();
      return json(event, 200, { ok: true, handoffs });
    } catch (err: any) {
      return json(event, 500, { error: err.message || 'Ошибка загрузки запросов куратора' });
    }
  }

  // ============================================================
  // PATCH /api/ai/concierge/handoffs/:sessionId — staff / owner only
  // ============================================================
  if (subPath.startsWith('/concierge/handoffs/') && method === 'PATCH') {
    if (!authUser || (userRole !== 'owner' && userRole !== 'employee')) {
      return json(event, 403, { error: 'Доступ запрещён: только сотрудники платформы' });
    }

    const sessionId = subPath.replace('/concierge/handoffs/', '').trim();
    try {
      const res = await resolveHandoff(sessionId, authUser.id);
      return json(event, 200, res);
    } catch (err: any) {
      return json(event, 500, { error: err.message || 'Ошибка закрытия запроса' });
    }
  }

  return json(event, 404, { error: `Endpoint /api/ai${subPath} не найден` });
}
