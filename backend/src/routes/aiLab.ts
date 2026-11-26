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

  return json(event, 404, { error: `Endpoint /api/ai${subPath} не найден` });
}
