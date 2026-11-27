import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, normalizeHeaders } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { telegramClient, escapeHtml, popPendingWebhookReply } from '../lib/telegramClient.js';
import {
  findTelegramBindingByUser,
  findTelegramBindingByChat,
  assignCuratorToLot,
  transitionLotStage,
} from '../lib/telegramWorkflow.js';
import { logger } from '../lib/logger.js';
import { consumeQuota } from '../lib/anomalyDetector.js';
import { processTelegramUpdate } from '../lib/telegramCommands.js';

// In-memory replay de-duplication buffer (up to 500 recent update IDs)
const seenUpdates = new Set<number>();
const updateIdsQueue: number[] = [];

function isDuplicateUpdateL1(updateId: number): boolean {
  if (!updateId) return false;
  if (seenUpdates.has(updateId)) return true;
  seenUpdates.add(updateId);
  updateIdsQueue.push(updateId);
  if (updateIdsQueue.length > 500) {
    const oldest = updateIdsQueue.shift();
    if (oldest !== undefined) seenUpdates.delete(oldest);
  }
  return false;
}

/**
 * Distributed deduplication across serverless instances using rate_limits_v2 table.
 * TTL is 1 hour (3600_000 ms), fail-safe with L1 in-memory fallback.
 */
async function isDuplicateUpdateDistributed(updateId: number, ydb: any): Promise<boolean> {
  if (!updateId) return false;
  // 1. Fast L1 memory check
  if (isDuplicateUpdateL1(updateId)) return true;

  // 2. Distributed L2 check in YDB rate_limits
  try {
    const key = `tg_update:${updateId}`;
    const existing = await ydb.getItem('rate_limits', key).catch(() => null);
    if (existing) {
      seenUpdates.add(updateId);
      return true;
    }
    const expiresAt = Date.now() + 3600_000;
    await ydb.putItem('rate_limits', {
      id: key,
      expiresAt,
      createdAt: new Date().toISOString(),
    }).catch(() => null);
  } catch (err: any) {
    logger.warn('Distributed telegram dedupe fallback to L1 memory', { meta: { error: err.message, updateId } });
  }

  return false;
}

export async function handleTelegram(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const cfg = getConfig();
  const ydb = getYdbClient();

  // Normalize subPath: e.g. /api/telegram/webhook or /telegram/status
  const action = subPath.replace(/^\/(?:api\/)?telegram\/?/, '').split('?')[0].toLowerCase();

  // -------------------------------------------------------------
  // 1. PUBLIC WEBHOOK (Telegram -> Cloud Function)
  // -------------------------------------------------------------
  if (action === 'webhook') {
    if (method !== 'POST') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    // Verify secret token from Telegram header case-insensitively
    const normHeaders = normalizeHeaders(event.headers, event.multiValueHeaders);
    const incomingSecret = (normHeaders['x-telegram-bot-api-secret-token'] || '').trim();
    const expectedSecret = cfg.TELEGRAM_WEBHOOK_SECRET?.trim() || '';

    if (
      !expectedSecret ||
      Buffer.byteLength(incomingSecret) !== Buffer.byteLength(expectedSecret)
    ) {
      logger.warn('Telegram webhook rejected: secret mismatch or empty', {
        event: 'TELEGRAM_WEBHOOK_UNAUTHORIZED',
      });
      return json(event, 403, { error: 'Forbidden: invalid webhook secret' });
    }

    const isAuthorized = crypto.timingSafeEqual(
      Buffer.from(incomingSecret),
      Buffer.from(expectedSecret)
    );
    if (!isAuthorized) {
      logger.warn('Telegram webhook rejected: secret mismatch', {
        event: 'TELEGRAM_WEBHOOK_UNAUTHORIZED',
      });
      return json(event, 403, { error: 'Forbidden: invalid webhook secret' });
    }

    const body = parseBody(event);
    if (!body || typeof body !== 'object') {
      return json(event, 200, { ok: true, skipped: 'empty_body' });
    }

    // Distributed De-duplicate update_id (L1 Memory + L2 YDB rate_limits)
    if (body.update_id && (await isDuplicateUpdateDistributed(Number(body.update_id), ydb))) {
      return json(event, 200, { ok: true, skipped: 'duplicate_update' });
    }

    // Reset any previous webhook reply
    popPendingWebhookReply();

    try {
      await processTelegramUpdate(body, ydb, cfg);
    } catch (err: any) {
      logger.error('Error processing telegram update', {
        event: 'TELEGRAM_PROCESS_ERROR',
        meta: { error: err.message },
      });
    }

    const inlineReply = popPendingWebhookReply();
    if (inlineReply && inlineReply.method) {
      return json(event, 200, inlineReply);
    }

    return json(event, 200, { ok: true });
  }

  // -------------------------------------------------------------
  // 2. REST API (Authenticated Web Client -> Server)
  // -------------------------------------------------------------
  const authUser = await getAuthenticatedUser(event);

  // GET /api/telegram/status
  if (action === 'status' && method === 'GET') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);

    return json(event, 200, {
      configured: telegramClient.isConfigured(),
      botUsername: cfg.TELEGRAM_BOT_USERNAME || '',
      linked: Boolean(binding && binding.chatId),
      telegramUsername: binding?.telegramUsername || undefined,
      notificationsEnabled: binding?.notificationsEnabled !== false,
      boundAt: binding?.boundAt || undefined,
    });
  }

  // POST /api/telegram/link-token
  if (action === 'link-token' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const tokenQuota = await consumeQuota({
      scope: 'telegram_link_token',
      actorKey: authUser.id,
      limit: 5,
      windowSec: 3600,
    });
    if (!tokenQuota.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен лимит генерации токенов Telegram (максимум 5 в час).',
          retryAfter: tokenQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(tokenQuota.retryAfterSec) } }
      );
    }

    // Generate 32-character hex token (16 bytes) so bind_<token> is 37 chars <= 64 chars
    const token = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes

    await ydb.putItem('telegram_link_tokens', {
      id: token,
      token,
      userId: authUser.id,
      userEmail: authUser.email,
      role: authUser.role,
      used: false,
      createdAt: now.toISOString(),
      expiresAt,
    });

    const botUser = cfg.TELEGRAM_BOT_USERNAME || 'DomExitOfficialBot';
    const deepLink = `https://t.me/${botUser}?start=bind_${token}`;

    return json(event, 200, {
      success: true,
      token,
      deepLink,
      expiresInSec: 600,
      configured: telegramClient.isConfigured(),
      botUsername: botUser,
    });
  }

  // POST /api/telegram/unlink
  if (action === 'unlink' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);
    if (binding) {
      if (binding.chatId) {
        await ydb.deleteItem('telegram_bindings', `chat:${binding.chatId}`);
      }
      await ydb.deleteItem('telegram_bindings', `user:${authUser.id}`);
    }

    return json(event, 200, { success: true });
  }

  // PATCH /api/telegram/preferences
  if (action === 'preferences' && (method === 'PATCH' || method === 'POST')) {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = parseBody(event) || {};
    const enabled = body.notificationsEnabled !== false;

    const binding = await findTelegramBindingByUser(authUser.id);
    if (binding) {
      const updated = {
        ...binding,
        notificationsEnabled: enabled,
        updatedAt: new Date().toISOString(),
      };
      await ydb.putItem('telegram_bindings', { ...updated, id: `user:${authUser.id}` });
      if (binding.chatId) {
        await ydb.putItem('telegram_bindings', { ...updated, id: `chat:${binding.chatId}` });
      }
    }

    return json(event, 200, { success: true, notificationsEnabled: enabled });
  }

  // POST /api/telegram/assign (Staff / Owner only)
  if (action === 'assign' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    if (authUser.role !== 'owner' && authUser.role !== 'employee') {
      return json(event, 403, { error: 'Назначение доступно только сотрудникам и владельцу' });
    }

    const body = parseBody(event) || {};
    const { lotCode, employeeId } = body;

    if (!lotCode || !employeeId) {
      return json(event, 400, { error: 'Не указан lotCode или employeeId' });
    }

    try {
      const result = await assignCuratorToLot({
        lotCode,
        employeeId,
        actor: {
          id: authUser.id,
          role: authUser.role,
          name: authUser.name,
          email: authUser.email,
        },
      });
      return json(event, 200, { success: true, ...result });
    } catch (err: any) {
      return json(event, 400, { error: err.message });
    }
  }

  // POST /api/telegram/stage (Owner or assigned curator)
  if (action === 'stage' && method === 'POST') {
    if (!authUser) {
      return json(event, 401, { error: 'Требуется авторизация' });
    }

    const body = parseBody(event) || {};
    const { lotCode, nextStage, reason } = body;

    if (!lotCode || !nextStage) {
      return json(event, 400, { error: 'Не указан lotCode или nextStage' });
    }

    try {
      const result = await transitionLotStage({
        lotCode,
        nextStage,
        reason,
        actor: {
          id: authUser.id,
          role: authUser.role,
          name: authUser.name,
          email: authUser.email,
          assignedEmployeeId: authUser.assignedEmployeeId,
        },
      });
      return json(event, 200, { success: true, ...result });
    } catch (err: any) {
      return json(event, 400, { error: err.message });
    }
  }

  // POST /api/telegram/test (Owner only - live verification test)
  if (action === 'test' && method === 'POST') {
    if (!authUser || authUser.role !== 'owner') {
      return json(event, 403, { error: 'Тестовая отправка разрешена только владельцу' });
    }

    const binding = await findTelegramBindingByUser(authUser.id);
    if (!binding || !binding.chatId) {
      return json(event, 400, {
        error: 'Telegram аккаунт владельца еще не привязан. Нажмите "Подключить Telegram" в панели.',
      });
    }

    const now = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const sendRes = await telegramClient.sendMessage({
      chat_id: binding.chatId,
      text: [
        `⚡ <b>Тестовое уведомление DomExit OS</b>`,
        `Связь установлена успешно!`,
        `Время проверки: <code>${now} (MSK)</code>`,
        `Владелец: <b>${escapeHtml(authUser.email)}</b>`,
      ].join('\n'),
    });

    return json(event, 200, {
      success: sendRes.ok,
      sent: sendRes.ok,
      description: sendRes.description,
    });
  }

  return json(event, 404, { error: `Endpoint /api/telegram/${action} не найден` });
}
