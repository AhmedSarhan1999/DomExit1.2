/**
 * agentBridgeService.ts — External Agent Research Bridge & 152-FZ Zero-PII Firewall
 *
 * Facilitates dispatching public real-estate market research tasks to external AI agents
 * (via Webhook, Telegram Relay, or Manual Prompt Copy) and safely ingesting structured results.
 *
 * Red Lines:
 *  - 152-FZ Zero-PII Firewall: Never allows phone, email, passport, 12-digit INN, or private links.
 *  - HMAC-SHA256 Webhook Verification & Timestamp Replay Guard (±5 minutes).
 *  - Human-in-the-loop review before committing to market_benchmarks.
 */

import crypto from 'node:crypto';
import { getYdbClient } from '../../lib/ydbClient.js';
import { getConfig } from '../../lib/config.js';
import { callTelegramApi, escapeHtml } from '../../lib/telegramClient.js';
import { findTelegramBindingByUser } from '../../lib/telegramWorkflow.js';
import { logger } from '../../lib/logger.js';

export type AgentTaskType =
  | 'developer_price_check'
  | 'district_comparables'
  | 'developer_handover_news'
  | 'mortgage_programs'
  | 'legislative_topic';

export type AgentTaskStatus =
  | 'queued'
  | 'dispatched'
  | 'result_received'
  | 'approved'
  | 'rejected'
  | 'failed';

export type AgentDeliveryChannel = 'manual_copy' | 'webhook_outbound' | 'telegram_relay';

export interface PublicQueryPayload {
  region: string;
  district?: string;
  complexName?: string;
  developerName?: string;
  rooms?: string;
  areaSqm?: number;
  handoverQuarter?: string;
  question?: string;
  targetPriceRub?: number;
  [key: string]: any;
}

export interface AgentComparable {
  title: string;
  areaSqm?: number;
  priceRub: number;
  pricePerSqmRub?: number;
  sourceName: string;
  sourceUrl?: string;
}

export interface StructuredAgentResult {
  developerPricePerSqmRub?: number;
  developerFullPriceRub?: number;
  secondaryAvgPricePerSqmRub?: number;
  comparables?: AgentComparable[];
  summaryRu: string;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{ name: string; url?: string; checkedDate?: string }>;
}

export interface AgentResearchTask {
  id: string; // agt-task-...
  taskType: AgentTaskType;
  status: AgentTaskStatus;
  lotCode?: string;
  title: string;
  publicQueryPayload: PublicQueryPayload;
  generatedAgentPrompt: string;
  deliveryChannel: AgentDeliveryChannel;
  dispatchedAt?: string;
  receivedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rawResultText?: string;
  structuredResult?: StructuredAgentResult;
  reviewNotes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketBenchmarkRecord {
  id: string;
  complexKey: string;
  complexName: string;
  region: string;
  district?: string;
  developerName?: string;
  rooms?: string;
  lotCode?: string;
  developerPricePerSqmRub?: number;
  developerFullPriceRub?: number;
  secondaryAvgPricePerSqmRub?: number;
  comparables?: AgentComparable[];
  sources?: Array<{ name: string; url?: string; checkedDate?: string }>;
  sourceTaskId: string;
  verifiedBy: string;
  verifiedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// =========================================================================
// 152-FZ Zero-PII Firewall
// =========================================================================

const PII_PATTERNS = [
  { name: 'phone', regex: /(?:\+7|8)[\s\-(]?9\d{2}[\s\-)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}|\b(?:\+7|8)\d{10}\b/ },
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: 'passport', regex: /\b\d{4}\s?\d{6}\b/ },
  { name: 'inn_12', regex: /\b\d{12}\b/ },
  { name: 'private_storage', regex: /(?:storage\.yandexcloud\.net[^\s]*private|private-docs|X-Amz-Signature)/i },
];

/**
 * Validates that an object contains NO Personally Identifiable Information (PII).
 * Recursively scans all strings.
 */
export function assertAndScrubNoPii(data: any, pathPrefix = ''): { valid: boolean; field?: string; violation?: string } {
  if (data === null || data === undefined) return { valid: true };

  if (typeof data === 'string') {
    for (const pattern of PII_PATTERNS) {
      if (pattern.regex.test(data)) {
        return {
          valid: false,
          field: pathPrefix || 'root',
          violation: `PII_DETECTED_IN_EXTERNAL_TASK (${pattern.name})`,
        };
      }
    }
    return { valid: true };
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const res = assertAndScrubNoPii(data[i], `${pathPrefix}[${i}]`);
      if (!res.valid) return res;
    }
    return { valid: true };
  }

  if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      const fieldPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const res = assertAndScrubNoPii(v, fieldPath);
      if (!res.valid) return res;
    }
    return { valid: true };
  }

  return { valid: true };
}

export function normalizeComplexKey(complexName?: string, region?: string): string {
  const c = String(complexName || '').toLowerCase().replace(/["'«»]/g, '').trim();
  const r = String(region || 'spb').toLowerCase().trim();
  return `${c}__${r}`.replace(/[\s\-_]+/g, '_');
}

// =========================================================================
// Structured Prompt Generator
// =========================================================================

const TASK_TYPE_TITLES: Record<AgentTaskType, string> = {
  developer_price_check: 'Проверка текущих цен застройщика',
  district_comparables: 'Сбор аналогов на вторичном рынке района',
  developer_handover_news: 'Мониторинг статуса стройки и сроков сдачи',
  mortgage_programs: 'Анализ актуальных ипотечных программ по объекту',
  legislative_topic: 'Юридический анализ законодательного вопроса',
};

export function buildStructuredAgentPrompt(task: {
  id: string;
  taskType: AgentTaskType;
  publicQueryPayload: PublicQueryPayload;
}): string {
  const p = task.publicQueryPayload;
  const titleRu = TASK_TYPE_TITLES[task.taskType] || 'Исследование рынка';

  return `ВЫПОЛНИТЕ ИССЛЕДОВАНИЕ РЫНКА ДЛЯ СЕРВИСА DOMEXIT
Номер задачи: #${task.id}
Тип задачи: ${titleRu}
Объект / ЖК: ${p.complexName || 'Не указан'}
Регион: ${p.region} ${p.district ? `(${p.district})` : ''}
Застройщик: ${p.developerName || 'Не указан'}
Параметры: ${p.rooms || 'Любая комнатность'}, ${p.areaSqm ? p.areaSqm + ' м²' : 'площадь не указана'}, срок сдачи: ${p.handoverQuarter || 'любой'}

Вопрос / Задача:
${p.question || 'Проверить текущие официальные цены застройщика на аналогичные квартиры и средние цены на вторичном рынке района.'}

ИНСТРУКЦИЯ ПО ФОРМАТУ ОТВЕТА:
Верните результат строго в формате JSON (допускается внутри блока \`\`\`json ... \`\`\`):
{
  "developerPricePerSqmRub": 250000,
  "developerFullPriceRub": 16250000,
  "secondaryAvgPricePerSqmRub": 235000,
  "comparables": [
    {
      "title": "Квартира аналогичной площади в том же ЖК",
      "areaSqm": ${p.areaSqm || 60},
      "priceRub": 15500000,
      "pricePerSqmRub": 238000,
      "sourceName": "Циан / ДомКлик / Сайт застройщика",
      "sourceUrl": "https://..."
    }
  ],
  "summaryRu": "Краткое аналитическое резюме рынка по объекту (2-4 предложения).",
  "confidence": "high",
  "sources": [
    {
      "name": "Официальный сайт застройщика",
      "url": "https://...",
      "checkedDate": "${new Date().toISOString().slice(0, 10)}"
    }
  ]
}`.trim();
}

// =========================================================================
// Dispatcher
// =========================================================================

export async function dispatchTaskToExternalAgent(
  task: AgentResearchTask
): Promise<{ ok: boolean; channel: AgentDeliveryChannel; error?: string }> {
  const cfg = getConfig();
  const ydb = getYdbClient();
  const now = new Date().toISOString();

  if (task.deliveryChannel === 'webhook_outbound') {
    const webhookUrl = cfg.EXTERNAL_AGENT_WEBHOOK_URL;
    if (!webhookUrl) {
      return { ok: false, channel: 'webhook_outbound', error: 'EXTERNAL_AGENT_WEBHOOK_URL не настроен' };
    }

    const secret = cfg.AGENT_BRIDGE_SECRET || 'domexit-agent-bridge-default-secret';
    const payload = JSON.stringify({
      taskId: task.id,
      taskType: task.taskType,
      publicQueryPayload: task.publicQueryPayload,
      generatedAgentPrompt: task.generatedAgentPrompt,
      callbackUrl: `${cfg.PUBLIC_BASE_URL}/api/ai/agent-bridge/webhook/result`,
      timestamp: now,
    });

    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DomExit-Signature': `sha256=${sig}`,
          'X-DomExit-Timestamp': now,
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (!res.ok) {
        throw new Error(`External webhook responded with HTTP ${res.status}`);
      }

      task.status = 'dispatched';
      task.dispatchedAt = now;
      task.updatedAt = now;
      await ydb.putItem('agent_research_tasks', task);

      return { ok: true, channel: 'webhook_outbound' };
    } catch (err: any) {
      logger.error('Failed to dispatch task to external webhook', { meta: { taskId: task.id, error: err.message } });
      task.status = 'failed';
      task.updatedAt = now;
      await ydb.putItem('agent_research_tasks', task);
      return { ok: false, channel: 'webhook_outbound', error: err.message };
    }
  }

  if (task.deliveryChannel === 'telegram_relay') {
    try {
      const targetChatId = cfg.AGENT_TELEGRAM_CHAT_ID;
      let recipientChatId = targetChatId;

      if (!recipientChatId) {
        // Fallback to platform owner Telegram
        const users = ydb.isV2TablesEnabled()
          ? await ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' })
          : await ydb.scanAll<any>('users', 200);
        const owner = users.find((u: any) => u.role === 'owner');
        if (owner) {
          const binding = await findTelegramBindingByUser(owner.id);
          if (binding && binding.chatId) recipientChatId = binding.chatId;
        }
      }

      if (recipientChatId) {
        const text = [
          `🤖 <b>НОВАЯ ЗАДАЧА ДЛЯ AI-АГЕНТА [#${escapeHtml(task.id)}]</b>`,
          `Тип: <b>${escapeHtml(TASK_TYPE_TITLES[task.taskType] || task.taskType)}</b>`,
          `Объект: <b>${escapeHtml(task.publicQueryPayload.complexName || 'Не указан')}</b>`,
          `Регион: <b>${escapeHtml(task.publicQueryPayload.region || '')}</b>`,
          ``,
          `<code>${escapeHtml(task.generatedAgentPrompt)}</code>`,
        ].join('\n');

        await callTelegramApi('sendMessage', {
          chat_id: recipientChatId,
          text,
          parse_mode: 'HTML',
        });
      }

      task.status = 'dispatched';
      task.dispatchedAt = now;
      task.updatedAt = now;
      await ydb.putItem('agent_research_tasks', task);

      return { ok: true, channel: 'telegram_relay' };
    } catch (err: any) {
      return { ok: false, channel: 'telegram_relay', error: err.message };
    }
  }

  // Manual copy: status is dispatched / ready for copy
  task.status = 'dispatched';
  task.dispatchedAt = now;
  task.updatedAt = now;
  await ydb.putItem('agent_research_tasks', task);
  return { ok: true, channel: 'manual_copy' };
}

// =========================================================================
// Webhook Signature & Replay Guard
// =========================================================================

export function verifyWebhookSignature(params: {
  signatureHeader?: string;
  timestampHeader?: string;
  rawBody: string;
  authHeader?: string;
}): { ok: boolean; reason?: string } {
  const cfg = getConfig();
  const secret = cfg.AGENT_BRIDGE_SECRET;

  if (!secret) {
    return { ok: false, reason: 'AGENT_BRIDGE_NOT_CONFIGURED' };
  }

  // 1. Timestamp Replay Guard (±5 minutes)
  if (params.timestampHeader) {
    const ts = new Date(params.timestampHeader).getTime();
    if (isNaN(ts) || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
      return { ok: false, reason: 'TIMESTAMP_OUT_OF_WINDOW' };
    }
  }

  // 2. Bearer Token Check
  if (params.authHeader && params.authHeader.startsWith('Bearer ')) {
    const token = params.authHeader.slice(7).trim();
    if (token.length === secret.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return { ok: true };
    }
  }

  // 3. HMAC-SHA256 Signature Check
  if (params.signatureHeader) {
    const rawSig = params.signatureHeader.replace(/^sha256=/i, '').trim();
    const expectedSig = crypto.createHmac('sha256', secret).update(params.rawBody).digest('hex');
    if (rawSig.length === expectedSig.length && crypto.timingSafeEqual(Buffer.from(rawSig), Buffer.from(expectedSig))) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'INVALID_SIGNATURE' };
}

// =========================================================================
// Result Ingestion
// =========================================================================

export function parseStructuredResult(raw: string | object): StructuredAgentResult {
  let obj: any = raw;
  if (typeof raw === 'string') {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const cleanStr = jsonMatch ? jsonMatch[1] : raw;
    try {
      obj = JSON.parse(cleanStr);
    } catch {
      throw new Error('Не удалось разобрать JSON ответа агента');
    }
  }

  if (!obj || typeof obj !== 'object') {
    throw new Error('Ответ агента должен быть JSON объектом');
  }

  // Sanitize numeric fields
  const devSqm = Number(obj.developerPricePerSqmRub);
  const devFull = Number(obj.developerFullPriceRub);
  const secSqm = Number(obj.secondaryAvgPricePerSqmRub);

  // Sanitize sources URLs
  const sources = Array.isArray(obj.sources)
    ? obj.sources.map((s: any) => ({
        name: String(s.name || 'Источник'),
        url: typeof s.url === 'string' && /^https?:\/\//i.test(s.url) ? s.url : undefined,
        checkedDate: s.checkedDate ? String(s.checkedDate) : undefined,
      }))
    : [];

  const comparables = Array.isArray(obj.comparables)
    ? obj.comparables.map((c: any) => ({
        title: String(c.title || 'Аналог'),
        areaSqm: Number(c.areaSqm) || undefined,
        priceRub: Math.max(0, Number(c.priceRub) || 0),
        pricePerSqmRub: Number(c.pricePerSqmRub) || undefined,
        sourceName: String(c.sourceName || 'Агрегатор'),
        sourceUrl: typeof c.sourceUrl === 'string' && /^https?:\/\//i.test(c.sourceUrl) ? c.sourceUrl : undefined,
      }))
    : [];

  return {
    developerPricePerSqmRub: Number.isFinite(devSqm) && devSqm > 0 ? devSqm : undefined,
    developerFullPriceRub: Number.isFinite(devFull) && devFull > 0 ? devFull : undefined,
    secondaryAvgPricePerSqmRub: Number.isFinite(secSqm) && secSqm > 0 ? secSqm : undefined,
    comparables,
    summaryRu: String(obj.summaryRu || obj.summary || 'Аналитический отчет сформирован.').trim(),
    confidence: obj.confidence === 'high' || obj.confidence === 'low' ? obj.confidence : 'medium',
    sources,
  };
}

export async function ingestAgentResult(
  taskId: string,
  rawResultTextOrJson: string | object,
  _receivedFrom?: string
): Promise<{ ok: boolean; task?: AgentResearchTask; error?: string }> {
  const ydb = getYdbClient();
  const task = await ydb.getItem<AgentResearchTask>('agent_research_tasks', taskId);

  if (!task) {
    return { ok: false, error: 'Задача не найдена' };
  }
  if (task.status === 'approved' || task.status === 'rejected') {
    return { ok: false, error: `Задача уже закрыта со статусом ${task.status}` };
  }

  let structured: StructuredAgentResult;
  try {
    structured = parseStructuredResult(rawResultTextOrJson);
  } catch (err: any) {
    return { ok: false, error: err.message };
  }

  const now = new Date().toISOString();
  task.status = 'result_received';
  task.rawResultText = typeof rawResultTextOrJson === 'string' ? rawResultTextOrJson : JSON.stringify(rawResultTextOrJson, null, 2);
  task.structuredResult = structured;
  task.receivedAt = now;
  task.updatedAt = now;

  await ydb.putItem('agent_research_tasks', task);

  // Notify owner via Telegram
  try {
    const users = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<any>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' })
      : await ydb.scanAll<any>('users', 200);
    const owner = users.find((u: any) => u.role === 'owner');
    if (owner) {
      const binding = await findTelegramBindingByUser(owner.id);
      if (binding && binding.chatId) {
        const text = [
          `🔔 <b>ПОЛУЧЕН ОТВЕТ ВНЕШНЕГО АГЕНТА</b> [#${escapeHtml(task.id)}]`,
          `Объект: <b>${escapeHtml(task.publicQueryPayload.complexName || 'Не указан')}</b>`,
          `Тип: ${escapeHtml(TASK_TYPE_TITLES[task.taskType] || task.taskType)}`,
          `Уверенность: <b>${escapeHtml(structured.confidence)}</b>`,
          `<i>Ожидает проверки и утверждения в AI Lab.</i>`,
        ].join('\n');
        await callTelegramApi('sendMessage', { chat_id: binding.chatId, text, parse_mode: 'HTML' });
      }
    }
  } catch {
    // Non-fatal
  }

  return { ok: true, task };
}

// =========================================================================
// Human Approval & Application
// =========================================================================

export async function approveAndApplyResult(
  taskId: string,
  options: { decision: 'approve' | 'reject'; applyToLotPrice?: boolean; reviewNotes?: string },
  reviewedBy: string
): Promise<{ ok: boolean; task?: AgentResearchTask; benchmark?: MarketBenchmarkRecord; error?: string }> {
  const ydb = getYdbClient();
  const task = await ydb.getItem<AgentResearchTask>('agent_research_tasks', taskId);

  if (!task) return { ok: false, error: 'Задача не найдена' };
  if (!task.structuredResult && options.decision === 'approve') {
    return { ok: false, error: 'Невозможно утвердить задачу без полученного результата' };
  }

  const now = new Date().toISOString();
  task.status = options.decision === 'approve' ? 'approved' : 'rejected';
  task.reviewedAt = now;
  task.reviewedBy = reviewedBy;
  task.reviewNotes = options.reviewNotes || '';
  task.updatedAt = now;

  let benchmark: MarketBenchmarkRecord | undefined = undefined;

  if (options.decision === 'approve' && task.structuredResult) {
    const exp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const benchmarkId = `bm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const complexKey = normalizeComplexKey(task.publicQueryPayload.complexName, task.publicQueryPayload.region);

    benchmark = {
      id: benchmarkId,
      complexKey,
      complexName: task.publicQueryPayload.complexName || 'Не указан',
      region: task.publicQueryPayload.region || 'spb',
      district: task.publicQueryPayload.district,
      developerName: task.publicQueryPayload.developerName,
      rooms: task.publicQueryPayload.rooms,
      lotCode: task.lotCode,
      developerPricePerSqmRub: task.structuredResult.developerPricePerSqmRub,
      developerFullPriceRub: task.structuredResult.developerFullPriceRub,
      secondaryAvgPricePerSqmRub: task.structuredResult.secondaryAvgPricePerSqmRub,
      comparables: task.structuredResult.comparables,
      sources: task.structuredResult.sources,
      sourceTaskId: task.id,
      verifiedBy: reviewedBy,
      verifiedAt: now,
      expiresAt: exp,
      createdAt: now,
      updatedAt: now,
    };

    await ydb.putItem('market_benchmarks', benchmark);

    // If attached to a lot, update lot.marketBenchmark
    if (task.lotCode) {
      try {
        const lot = await ydb.getItem<any>('lots', task.lotCode);
        if (lot) {
          lot.marketBenchmark = {
            benchmarkId,
            verifiedAt: now,
            developerPricePerSqmRub: benchmark.developerPricePerSqmRub,
            secondaryAvgPricePerSqmRub: benchmark.secondaryAvgPricePerSqmRub,
            confidence: task.structuredResult.confidence,
            summaryRu: task.structuredResult.summaryRu,
          };
          if (options.applyToLotPrice && benchmark.developerFullPriceRub && benchmark.developerFullPriceRub > 0) {
            lot.developerPriceTodayRub = benchmark.developerFullPriceRub;
          }
          lot.updatedAt = now;
          await ydb.putItem('lots', lot);
        }
      } catch (err: any) {
        logger.warn('Failed to update lot with market benchmark', { meta: { lotCode: task.lotCode, error: err.message } });
      }
    }

    // Audit log
    try {
      await ydb.putItem('audit_logs', {
        id: `aud-bm-${Date.now()}`,
        action: 'MARKET_BENCHMARK_APPROVED',
        actorId: reviewedBy,
        actorRole: 'owner',
        targetId: benchmarkId,
        payload: JSON.stringify({ taskId: task.id, lotCode: task.lotCode, complexKey }),
        timestamp: now,
      });
    } catch {
      // non-fatal
    }
  }

  await ydb.putItem('agent_research_tasks', task);
  return { ok: true, task, benchmark };
}
