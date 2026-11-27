import crypto from 'node:crypto';
import { getYdbClient } from './ydbClient.js';
import { getConfig } from './config.js';
import { memoryCache } from './memoryCache.js';
import { recordJournalEvent } from './journal.js';
import { callTelegramApi, escapeHtml } from './telegramClient.js';
import { findTelegramBindingByUser } from './telegramWorkflow.js';
import { computeMatchScore } from './buyBoxEngine.js';
import { logger } from './logger.js';
import { getAiLabConfig } from '../modules/proptech-ai/aiFeatureFlags.js';
import { syncCbrKeyRate } from '../modules/proptech-ai/cbrSyncService.js';
import { runLegislativeRadarScan } from '../modules/legal-core/legislativeRadarService.js';
import { getUnifiedBuyBox, syncBuyBoxAndUser } from './buyBoxSync.js';
import {
  LotDropConfig,
  BuyerBuyBox,
  BuyerApplication,
  UserProfile,
} from '../types.js';

export interface SlaSweepResult {
  ok: boolean;
  timestamp: string;
  lotsScanCount: number;
  dailyTasksExecuted: boolean;
  silverWaveOpenedCount: number;
  expiredDropsClosedCount: number;
  priority1DeadlinesAlertedCount: number;
  sellerSlaEscalatedCount: number;
  partnerReservationsExpiredCount: number;
  staleLotsAlertedCount: number;
  prunedRateLimitsCount: number;
  prunedPepOtpsCount: number;
  dryRun?: boolean;
}

/**
 * Sends a notification message to all platform staff (owner and employees) who have linked Telegram.
 */
async function notifyStaff(text: string, replyMarkup?: any): Promise<void> {
  try {
    const ydb = getYdbClient();
    const users = await ydb.scanAll<UserProfile>('users', 200);
    const staff = (users || []).filter((u) => u.role === 'owner' || u.role === 'employee');

    for (const member of staff) {
      const binding = await findTelegramBindingByUser(member.id);
      if (binding && binding.chatId && binding.notificationsEnabled !== false) {
        await callTelegramApi('sendMessage', {
          chat_id: binding.chatId,
          text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn('Failed to send staff telegram notification in SLA sweeper', { meta: { error: err.message } });
  }
}

/**
 * Sends a notification message to the platform owner's linked Telegram.
 */
async function notifyOwner(text: string, replyMarkup?: any): Promise<void> {
  try {
    const ydb = getYdbClient();
    const users = await ydb.scanAll<UserProfile>('users', 200);
    const owner = (users || []).find((u) => u.role === 'owner');
    if (!owner) return;

    const binding = await findTelegramBindingByUser(owner.id);
    if (binding && binding.chatId && binding.notificationsEnabled !== false) {
      await callTelegramApi('sendMessage', {
        chat_id: binding.chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.warn('Failed to send owner telegram notification in SLA sweeper', { meta: { error: err.message } });
  }
}

/**
 * Sends a direct message to a specific user if their Telegram account is linked.
 */
async function notifyUser(userId: string, text: string, replyMarkup?: any): Promise<void> {
  try {
    const binding = await findTelegramBindingByUser(userId);
    if (binding && binding.chatId && binding.notificationsEnabled !== false) {
      await callTelegramApi('sendMessage', {
        chat_id: binding.chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.warn('Failed to send user telegram notification in SLA sweeper', { meta: { error: err.message, userId } });
  }
}

/**
 * The core 15-minute SLA Sweeper engine.
 * Executes 6 deterministic, idempotent, fail-safe tasks.
 */
export async function runSlaSweep(
  options: { dryRun?: boolean; env?: string; forceDailyTasks?: boolean } = {}
): Promise<SlaSweepResult> {
  const { dryRun = false, forceDailyTasks = false } = options;
  const now = new Date();
  const isoNow = now.toISOString();
  const ydb = getYdbClient();

  let lotsScanCount = 0;
  let silverWaveOpenedCount = 0;
  let expiredDropsClosedCount = 0;
  let priority1DeadlinesAlertedCount = 0;
  let sellerSlaEscalatedCount = 0;
  let partnerReservationsExpiredCount = 0;
  let staleLotsAlertedCount = 0;
  let prunedRateLimitsCount = 0;
  let prunedPepOtpsCount = 0;

  // Daily heavy/slow tasks execute once per day on the first 15-min run after 03:00 UTC (or when forced in tests)
  const isDailyWindow = now.getUTCHours() === 3 && now.getUTCMinutes() < 15;
  const dailyTasksExecuted = Boolean(forceDailyTasks || isDailyWindow);

  logger.info('Starting 15-minute SLA sweep', {
    event: 'SLA_SWEEP_START',
    meta: { timestamp: isoNow, dryRun, dailyTasksExecuted },
  });

  // Single shared lots scan reused across Task 1, Task 2, and Task 6 (eliminates 3x redundant table scans)
  let sharedLots: any[] = [];
  try {
    sharedLots = (await ydb.scanAll<any>('lots', 500)) || [];
    lotsScanCount = 1;
  } catch (err: any) {
    logger.error('Failed initial shared lots scan in SLA sweeper', { meta: { error: err.message } });
  }

  // =========================================================================
  // Task 1: Open Silver Wave Automatically for expired Gold windows
  // =========================================================================
  try {
    const candidateLots = sharedLots.filter(
      (l) =>
        l.dropConfig &&
        l.dropConfig.mode === 'staged_drop' &&
        l.dropConfig.waveStatus === 'gold_wave' &&
        now >= new Date(l.dropConfig.goldExclusiveUntil) &&
        now < new Date(l.dropConfig.closesAt) &&
        (l.dropConfig.currentValidApplications || 0) < l.dropConfig.maxApplicationsCap
    );

    if (candidateLots.length > 0) {
      const allBuyBoxes = await ydb.scanAll<BuyerBuyBox>('buy_boxes', 500);
      const activeSilverBuyBoxes = (allBuyBoxes || []).filter((bb) => bb.active !== false && bb.tier === 'silver');

      for (const lot of candidateLots) {
        const dropConfig: LotDropConfig = lot.dropConfig;
        dropConfig.waveStatus = 'silver_wave';
        dropConfig.silverWaveNotifiedAt = isoNow;
        lot.dropConfig = dropConfig;

        if (!dryRun) {
          await ydb.putItem('lots', lot);
          memoryCache.invalidate('lots');
          await recordJournalEvent({
            action: 'UPDATE',
            collection: 'lots',
            recordId: lot.lotCode || lot.id,
            actor: { role: 'system', email: 'sla-sweeper' },
            payload: { waveStatus: 'silver_wave', silverWaveNotifiedAt: isoNow },
          });

          // Notify matching Silver buyers via Telegram
          for (const bb of activeSilverBuyBoxes) {
            const matchRes = computeMatchScore(lot, bb);
            if (matchRes.eligibleForDrop) {
              const text =
                `⚡ <b>ОТКРЫТА ВОЛНА SILVER: ЛОТ #${escapeHtml(lot.lotCode)}</b>\n` +
                `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b> (${escapeHtml(lot.city || 'spb').toUpperCase()})\n` +
                `Совпадение с вашим Buy-Box: <b>${matchRes.score}%</b>\n` +
                `Осталось свободных мест: <b>${Math.max(0, dropConfig.maxApplicationsCap - (dropConfig.currentValidApplications || 0))}</b>\n\n` +
                `<i>Подайте заявку через бот (/matches) или на платформе DomExit!</i>`;

              const keyboard = {
                inline_keyboard: [[{ text: '⚡ Подать заявку', callback_data: `bb_app:${lot.lotCode}` }]],
              };

              void notifyUser(bb.userId, text, keyboard);
            }
          }
        }
        silverWaveOpenedCount++;
      }
    }
  } catch (err: any) {
    logger.error('Error in Task 1 (open silver wave)', { meta: { error: err.message } });
  }

  // =========================================================================
  // Task 2: Close Expired Drop Windows
  // =========================================================================
  try {
    const expiredDropLots = sharedLots.filter(
      (l) =>
        l.dropConfig &&
        l.dropConfig.mode === 'staged_drop' &&
        l.dropConfig.waveStatus !== 'expired_closed' &&
        l.dropConfig.waveStatus !== 'capped_closed' &&
        now >= new Date(l.dropConfig.closesAt)
    );

    for (const lot of expiredDropLots) {
      lot.dropConfig.waveStatus = 'expired_closed';
      if (!dryRun) {
        await ydb.putItem('lots', lot);
        memoryCache.invalidate('lots');
        await recordJournalEvent({
          action: 'UPDATE',
          collection: 'lots',
          recordId: lot.lotCode || lot.id,
          actor: { role: 'system', email: 'sla-sweeper' },
          payload: { waveStatus: 'expired_closed' },
        });
      }
      expiredDropsClosedCount++;
    }
  } catch (err: any) {
    logger.error('Error in Task 2 (close expired drops)', { meta: { error: err.message } });
  }

  // =========================================================================
  // Task 3: Priority #1 Deadline Alert (24h viewing or 48h deposit overdue)
  // =========================================================================
  try {
    const allApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 500);
    const overdueApps = (allApps || []).filter((a) => {
      if (a.queueStatus !== 'priority_1' || a.deadlineAlertedAt) return false;
      const viewingOverdue = a.viewingDeadlineAt && now >= new Date(a.viewingDeadlineAt);
      const depositOverdue = a.depositDeadlineAt && now >= new Date(a.depositDeadlineAt);
      return Boolean(viewingOverdue || depositOverdue);
    });

    for (const app of overdueApps) {
      app.deadlineAlertedAt = isoNow;
      if (!dryRun) {
        await ydb.putItem('buyer_applications', app);

        const alertText =
          `⚠️ <b>ИСТЕКЛА МЕРКА СРОКА У ПРИОРИТЕТА №1 [Лот #${escapeHtml(app.lotCode)}]</b>\n` +
          `Покупатель: <b>${escapeHtml(app.userName || app.userEmail || 'Покупатель')}</b>\n` +
          `Дедлайн просмотра: ${escapeHtml(app.viewingDeadlineAt || 'Не установлен')}\n` +
          `Дедлайн депозита: ${escapeHtml(app.depositDeadlineAt || 'Не установлен')}\n\n` +
          `<i>Нажмите кнопку ниже, чтобы передать лот кандидату из резерва:</i>`;

        const keyboard = {
          inline_keyboard: [[{ text: '⏭ Передать очередь №2', callback_data: `q_prom:${app.lotCode}` }]],
        };

        void notifyStaff(alertText, keyboard);
      }
      priority1DeadlinesAlertedCount++;
    }
  } catch (err: any) {
    logger.error('Error in Task 3 (priority 1 deadline alert)', { meta: { error: err.message } });
  }

  // =========================================================================
  // Task 4: 15-minute SLA Escalation for Unassigned Seller Requests
  // =========================================================================
  try {
    const allRequests = await ydb.scanAll<any>('seller_requests', 300);
    const unmoderated = (allRequests || []).filter((r) => {
      if (r.assignedEmployeeId || r.slaEscalatedAt) return false;
      const status = r.status || 'intake_moderation';
      const isUnmoderatedStatus = status === 'intake_moderation' || status === 'new' || status === 'pending';
      if (!isUnmoderatedStatus) return false;

      const createdTime = new Date(r.createdAt || r.timestamp || 0).getTime();
      return now.getTime() - createdTime > 15 * 60 * 1000; // > 15 mins
    });

    for (const req of unmoderated) {
      req.slaEscalatedAt = isoNow;
      if (!dryRun) {
        await ydb.putItem('seller_requests', req);

        const lotIdentifier = req.lotCode || req.id || 'NEW';
        const priceText = Number(req.contractPriceRub || req.price || 0).toLocaleString('ru-RU');

        const alertText =
          `🚨 <b>ЭСКАЛАЦИЯ SLA (15 МИН): Заявка продавца #${escapeHtml(lotIdentifier)} без куратора!</b>\n` +
          `ЖК: <b>${escapeHtml(req.complexName || 'Не указан')}</b> (${escapeHtml(req.city || 'spb').toUpperCase()})\n` +
          `Стоимость: <b>${priceText} ₽</b>\n` +
          `Поступила: <b>${escapeHtml(req.createdAt || req.timestamp || 'Только что')}</b>\n\n` +
          `<i>Срочно назначьте куратора для обеспечения норматива 15 минут!</i>`;

        const keyboard = {
          inline_keyboard: [[{ text: '⚡ Назначить куратора', callback_data: `assign_pick:${lotIdentifier}` }]],
        };

        void notifyOwner(alertText, keyboard);
      }
      sellerSlaEscalatedCount++;
    }
  } catch (err: any) {
    logger.error('Error in Task 4 (seller SLA escalation)', { meta: { error: err.message } });
  }

  // =========================================================================
  // Daily Slow Tasks (once daily at 03:00 UTC or when forced):
  //   Task 5: 7-day Partner Preliminary Reservation Expiration
  //   Task 6: Stale Lot Radar (10 days without reservation, reusing sharedLots)
  //   Task 7: TTL Pruning for rate_limits and pep_otps (> 24 hours expired)
  // =========================================================================
  if (dailyTasksExecuted) {
    // Task 5: 7-day Partner Preliminary Reservation Expiration
    try {
      const allPartnerReqs = await ydb.scanAll<any>('partner_preliminary_requests', 300);
      const expiredPartnerReqs = (allPartnerReqs || []).filter((pr) => {
        if (pr.status === 'expired' || pr.status === 'cancelled' || pr.status === 'closed') return false;
        if (!pr.expiresAt) return false;
        return now >= new Date(pr.expiresAt);
      });

      for (const pr of expiredPartnerReqs) {
        pr.status = 'expired';
        pr.expiredAt = isoNow;
        pr.updatedAt = isoNow;

        if (!dryRun) {
          await ydb.putItem('partner_preliminary_requests', pr);

          await recordJournalEvent({
            action: 'UPDATE',
            collection: 'partner_preliminary_requests',
            recordId: pr.id,
            actor: { role: 'system', email: 'sla-sweeper' },
            payload: { status: 'expired', expiredAt: isoNow },
          });

          // Notify partner via Telegram if partner is linked
          if (pr.partnerUserId) {
            const text =
              `⏳ <b>Срок предварительного бронирования по объекту #${escapeHtml(pr.lotCode || pr.lotId || '')} истек</b>\n` +
              `Бронь переведена в архив. Вы можете оформить новый запрос в партнерском кабинете.`;
            void notifyUser(pr.partnerUserId, text);
          }
        }
        partnerReservationsExpiredCount++;
      }
    } catch (err: any) {
      logger.error('Error in Task 5 (partner preliminary requests expiration)', { meta: { error: err.message } });
    }

    // Task 6: Stale Lot Radar (10 days without reservation — reuses sharedLots)
    try {
      const staleLots = sharedLots.filter((l) => {
        if (l.staleAlertedAt) return false;
        const status = l.status || 'available';
        if (status !== 'available' && status !== 'active') return false;

        const createdTime = new Date(l.createdAt || l.publishedAt || l.dateAdded || 0).getTime();
        if (!createdTime) return false;
        return now.getTime() - createdTime > 10 * 86400 * 1000; // > 10 days
      });

      for (const lot of staleLots) {
        lot.staleAlertedAt = isoNow;
        if (!dryRun) {
          await ydb.putItem('lots', lot);

          const alertText =
            `📉 <b>РАДАР СТАГНАЦИИ (10 ДНЕЙ): Лот #${escapeHtml(lot.lotCode)}</b>\n` +
            `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b>\n` +
            `Объект находится в каталоге более 10 дней без активной брони.\n` +
            `Рекомендуется согласовать дисконт с продавцом или перезапустить закрытый дроп (/launch-drop).`;

          void notifyOwner(alertText);
        }
        staleLotsAlertedCount++;
      }
    } catch (err: any) {
      logger.error('Error in Task 6 (stale lot radar)', { meta: { error: err.message } });
    }

    // Task 7: TTL Pruning for expired rate_limits & pep_otps older than 24 hours
    const cutoffMs = now.getTime() - 24 * 3600 * 1000;
    try {
      const rateItems = (await ydb.scanAll<any>('rate_limits', 500)) || [];
      const expiredRateIds = rateItems
        .filter((item) => {
          if (!item?.id) return false;
          const expMs =
            typeof item.expiresAt === 'number'
              ? item.expiresAt
              : item.expiresAt
              ? new Date(item.expiresAt).getTime()
              : NaN;
          if (Number.isFinite(expMs)) return expMs < cutoffMs;
          const tsMs = new Date(item.updatedAt || item.createdAt || 0).getTime();
          return Number.isFinite(tsMs) && tsMs > 0 && tsMs < cutoffMs;
        })
        .map((item) => String(item.id));

      prunedRateLimitsCount = expiredRateIds.length;
      if (!dryRun && expiredRateIds.length > 0) {
        await ydb.batchDelete('rate_limits', expiredRateIds);
      }
    } catch (err: any) {
      logger.warn('TTL pruning notice for rate_limits', { meta: { error: err.message } });
    }

    try {
      const otpItems = (await ydb.scanAll<any>('pep_otps', 500)) || [];
      const expiredOtpIds = otpItems
        .filter((item) => {
          if (!item?.id) return false;
          const createdMs = item.createdAt ? new Date(item.createdAt).getTime() : NaN;
          const expMs =
            typeof item.expiresAt === 'number'
              ? item.expiresAt
              : item.expiresAt
              ? new Date(item.expiresAt).getTime()
              : NaN;
          return (
            (Number.isFinite(expMs) && expMs < cutoffMs) ||
            (Number.isFinite(createdMs) && createdMs < cutoffMs)
          );
        })
        .map((item) => String(item.id));

      prunedPepOtpsCount = expiredOtpIds.length;
      if (!dryRun && expiredOtpIds.length > 0) {
        await ydb.batchDelete('pep_otps', expiredOtpIds);
      }
    } catch (err: any) {
      logger.warn('TTL pruning notice for pep_otps', { meta: { error: err.message } });
    }

    // Task 8: Daily CBR Key Rate Sync (when AI Lab cbrAutoSync is enabled)
    try {
      const aiCfg = await getAiLabConfig();
      if (aiCfg.masterLabEnabled && aiCfg.features?.cbrAutoSync !== 'off' && !dryRun) {
        const cbrResult = await syncCbrKeyRate();
        if (cbrResult.ok && cbrResult.changed) {
          const prevStr = cbrResult.previousRate !== null ? `${cbrResult.previousRate}%` : '—';
          const text =
            `🏦 <b>ЦБ РФ: Ключевая ставка изменилась</b>\n` +
            `Было: <b>${prevStr}</b> → Стало: <b>${cbrResult.keyRate}%</b>\n` +
            `Дата вступления: <code>${escapeHtml(cbrResult.effectiveDate || '—')}</code>\n` +
            `Источник: ${escapeHtml(cbrResult.source)} (market_settings обновлён автоматически)`;
          void notifyOwner(text);
        }
      }
    } catch (err: any) {
      logger.warn('Error in Task 8 (CBR key rate sync)', { meta: { error: err.message } });
    }

    // Task 9: Daily Legislative Radar Scan (when AI Lab legislativeRadar is enabled)
    try {
      const aiCfg = await getAiLabConfig();
      if (aiCfg.masterLabEnabled && aiCfg.features?.legislativeRadar !== 'off' && !dryRun) {
        logger.info('[SlaSweeper] Running daily legislative radar scan');
        await runLegislativeRadarScan({ maxDraftsToGenerate: 0, operatorId: 'system-sweeper' });
      }
    } catch (err: any) {
      logger.warn('Error in Task 9 (Legislative radar daily scan)', { meta: { error: err.message } });
    }

    // Task 10: Clean up stale anonymous concierge sessions (> 30 days old without userId and without buyBoxAppliedAt)
    try {
      const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 3600 * 1000;
      const sessions = (await ydb.scanAll<any>('ai_concierge_sessions', 500).catch(() => [])) || [];
      const staleAnonymousSessionIds = sessions
        .filter((s: any) => {
          if (!s?.id) return false;
          if (s.userId || s.buyBoxAppliedAt) return false;
          const ts = new Date(s.updatedAt || s.createdAt || 0).getTime();
          return Number.isFinite(ts) && ts > 0 && ts < thirtyDaysAgoMs;
        })
        .map((s: any) => String(s.id));

      if (!dryRun && staleAnonymousSessionIds.length > 0) {
        await ydb.batchDelete('ai_concierge_sessions', staleAnonymousSessionIds);
        logger.info(`[SlaSweeper] Pruned ${staleAnonymousSessionIds.length} stale anonymous concierge sessions`);
      }
    } catch (err: any) {
      logger.warn('Error in Task 10 (clean stale anonymous concierge sessions)', { meta: { error: err.message } });
    }

    // Task 11: Solvency approval expiry check (mortgage approvals / tier verification requests)
    try {
      const tierReqs = (await ydb.scanAll<any>('tier_verification_requests', 300).catch(() => [])) || [];
      const expiredReqs = tierReqs.filter((req: any) => {
        if (!req?.id || req.status !== 'approved' || !req.userId) return false;
        if (!req.expiresAt) return false;
        const expMs = new Date(req.expiresAt).getTime();
        return Number.isFinite(expMs) && expMs < now.getTime();
      });

      for (const req of expiredReqs) {
        req.status = 'expired';
        req.updatedAt = isoNow;
        if (!dryRun) {
          await ydb.putItem('tier_verification_requests', req);
          const currentBb = (await getUnifiedBuyBox(ydb, req.userId)) || ({ tier: 'silver' } as any);
          await syncBuyBoxAndUser(ydb, req.userId, {
            ...currentBb,
            tier: 'silver',
          });
          await recordJournalEvent({
            action: 'UPDATE',
            collection: 'tier_verification_requests',
            recordId: req.id,
            actor: { role: 'system', email: 'sla-sweeper' },
            payload: {
              status: 'expired',
              reason: 'solvency_approval_validity_period_ended',
              previousTier: currentBb.tier,
            },
          });
          const text =
            `⚠️ <b>Срок действия подтверждения платежеспособности истек</b>\n` +
            `Ваш статус инвестора возвращен к уровню <b>Silver</b>. Для участия в закрытых пулах Gold/Platinum обновите решение банка в личном кабинете.`;
          void notifyUser(req.userId, text);
        }
      }
    } catch (err: any) {
      logger.warn('Error in Task 11 (solvency approval expiry sweep)', { meta: { error: err.message } });
    }
  }

  const result: SlaSweepResult = {
    ok: true,
    timestamp: isoNow,
    lotsScanCount,
    dailyTasksExecuted,
    silverWaveOpenedCount,
    expiredDropsClosedCount,
    priority1DeadlinesAlertedCount,
    sellerSlaEscalatedCount,
    partnerReservationsExpiredCount,
    staleLotsAlertedCount,
    prunedRateLimitsCount,
    prunedPepOtpsCount,
    dryRun,
  };

  logger.info('Completed 15-minute SLA sweep', { event: 'SLA_SWEEP_COMPLETE', meta: result });
  return result;
}
