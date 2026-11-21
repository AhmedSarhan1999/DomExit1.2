import crypto from 'node:crypto';
import { getYdbClient } from './ydbClient.js';
import { telegramClient, escapeHtml } from './telegramClient.js';
import { findTelegramBindingByUser } from './telegramWorkflow.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';

// In-Memory Fast Fallback Cache for Rate Limits
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

// In-Memory Alert Cooldowns (10 minutes)
const alertCooldowns = new Map<string, number>();

/**
 * 152-FZ Privacy Compliance helper:
 * Masks email address for incident logs, summaries and telemetry (e.g., a***d@e***.ru).
 */
export function maskEmail(email?: string): string {
  if (!email || typeof email !== 'string') return 'unknown_user';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const maskedLocal =
    local.length <= 2
      ? `${local.charAt(0)}*`
      : `${local.charAt(0)}***${local.charAt(local.length - 1)}`;
  const domainParts = domain.split('.');
  const maskedDomain =
    domainParts.length >= 2
      ? `${domainParts[0].charAt(0)}***.${domainParts.slice(1).join('.')}`
      : domain;
  return `${maskedLocal}@${maskedDomain}`;
}

export interface QuotaConsumeParams {
  scope: string;
  actorKey: string;
  limit: number;
  windowSec: number;
}

export interface QuotaConsumeResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  retryAfterSec: number;
}

/**
 * Distributed Rate Limiting & Quota Consumption Engine.
 * Operates on YDB table 'rate_limits' with fail-safe in-memory fallback.
 */
export async function consumeQuota(params: QuotaConsumeParams): Promise<QuotaConsumeResult> {
  const { scope, actorKey, limit, windowSec } = params;
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const bucket = Math.floor(nowSec / windowSec);
  const key = `rl:${scope}:${actorKey}:${bucket}`;
  const windowEndSec = (bucket + 1) * windowSec;
  const retryAfterSec = Math.max(1, windowEndSec - nowSec);

  let currentCount = 1;

  try {
    const ydb = getYdbClient();
    const existing = await ydb.getItem<{ id: string; count: number; expiresAt: number }>('rate_limits', key);

    if (existing && typeof existing.count === 'number') {
      currentCount = existing.count + 1;
      await ydb.putItem('rate_limits', {
        id: key,
        count: currentCount,
        scope,
        actorKey,
        expiresAt: (bucket + 2) * windowSec * 1000,
        updatedAt: new Date().toISOString(),
      });
    } else {
      currentCount = 1;
      await ydb.putItem('rate_limits', {
        id: key,
        count: 1,
        scope,
        actorKey,
        expiresAt: (bucket + 2) * windowSec * 1000,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (ydbErr: any) {
    // Fail-safe In-Memory Fallback if YDB rate_limits is temporarily degraded
    logger.warn('YDB rate_limits degraded, using memory fallback', {
      meta: { error: ydbErr.message, key },
    });

    const mem = memoryRateLimits.get(key);
    if (mem && mem.expiresAt > now) {
      currentCount = mem.count + 1;
      mem.count = currentCount;
    } else {
      currentCount = 1;
      memoryRateLimits.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    }
  }

  const allowed = currentCount <= limit;

  return {
    allowed,
    currentCount,
    limit,
    retryAfterSec,
  };
}

export interface SecurityIncidentParams {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actorUserId?: string;
  actorRole?: string;
  clientIp?: string;
  endpoint?: string;
  collection?: string;
  summary: string;
  details?: any;
}

/**
 * Records a security incident in 'security_incidents' and triggers real-time Telegram alert to owner.
 */
export async function recordSecurityIncident(params: SecurityIncidentParams): Promise<void> {
  const {
    type,
    severity,
    actorUserId = 'anonymous',
    actorRole = 'guest',
    clientIp = '',
    endpoint = '',
    collection = '',
    summary,
    details = {},
  } = params;

  const now = new Date();
  const iso = now.toISOString();
  const deadline24h = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const rand = crypto.randomBytes(3).toString('hex');
  const incidentId = `inc-${Date.now()}-${rand}`;

  // 152-FZ Privacy Compliance: Hash IP address, never store raw visitor IP in incident logs
  const ipHash = clientIp
    ? crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16)
    : 'unknown_ip';

  const incidentRecord = {
    id: incidentId,
    type,
    severity,
    status: 'open',
    title: summary,
    summary,
    description: typeof details === 'string' ? details : JSON.stringify(details || {}),
    details: details || {},
    actorUserId,
    actorRole,
    ipHash,
    endpoint,
    collection,
    timestamp: iso,
    createdAt: iso,
    deadline24h,
    affectedRecordsCount: 1,
    reportedToRoskomnadzor: false,
  };

  try {
    const ydb = getYdbClient();
    await ydb.putItem('security_incidents', incidentRecord);

    logger.warn(`[SecurityIncident] ${severity.toUpperCase()} - ${type}: ${summary}`, {
      event: 'SECURITY_INCIDENT_RECORDED',
      meta: { incidentId, type, severity, actorUserId, endpoint },
    });
  } catch (err: any) {
    logger.error('Failed to save security incident in YDB', {
      meta: { error: err.message, incidentId },
    });
  }

  // Telegram Alert for high/critical or repeated incidents (with 10-minute cooldown)
  const isHighSeverity = severity === 'high' || severity === 'critical';
  if (isHighSeverity || severity === 'medium') {
    const cooldownKey = `${type}:${actorUserId || ipHash}`;
    const lastAlert = alertCooldowns.get(cooldownKey) || 0;
    const cooldownMs = 10 * 60 * 1000; // 10 minutes

    if (now.getTime() - lastAlert > cooldownMs) {
      alertCooldowns.set(cooldownKey, now.getTime());
      try {
        await notifyOwnerSecurityIncident(incidentRecord);
      } catch (err: any) {
        logger.warn('Failed to notify owner of security incident', { meta: { error: err.message } });
      }
    }
  }
}

/**
 * Dispatches an instant security push notification to owner's Telegram account.
 */
async function notifyOwnerSecurityIncident(incident: Record<string, any>): Promise<void> {
  try {
    if (!telegramClient.isConfigured()) return;
    const cfg = getConfig();
    const ydb = getYdbClient();

    // Find platform owner
    const users = await ydb.scanAll('users', 200);
    const owner = users.find((u: any) => u.role === 'owner');
    if (!owner) return;

    const binding = await findTelegramBindingByUser(owner.id);
    if (!binding || !binding.chatId || binding.notificationsEnabled === false) return;

    const severityIcon =
      incident.severity === 'critical'
        ? '🚨🚨🚨'
        : incident.severity === 'high'
        ? '🚨'
        : '⚠️';

    const text = [
      `${severityIcon} <b>РАДАР БЕЗОПАСНОСТИ DOMEXIT</b>`,
      `Уровень: <b>${escapeHtml(incident.severity.toUpperCase())}</b>`,
      `Тип: <code>${escapeHtml(incident.type)}</code>`,
      `Описание: <b>${escapeHtml(incident.summary)}</b>`,
      ``,
      `• Субъект: <code>${escapeHtml(incident.actorRole)} (${escapeHtml(incident.actorUserId)})</code>`,
      `• Эндпоинт: <code>${escapeHtml(incident.endpoint || 'N/A')}</code>`,
      `• Время: <code>${new Date(incident.createdAt).toLocaleTimeString('ru-RU')} (MSK)</code>`,
      ``,
      `<i>Инцидент зарегистрирован в журнале аудита. Вход на портал защищен.</i>`,
    ].join('\n');

    await telegramClient.sendMessage({
      chat_id: binding.chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛡 Открыть панель управления', url: `${cfg.PUBLIC_BASE_URL}/admin/dashboard` }],
        ],
      },
    });
  } catch (err: any) {
    logger.warn('Failed to dispatch Telegram security alert to owner', {
      meta: { error: err.message },
    });
  }
}
