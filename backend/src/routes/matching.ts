import crypto from 'node:crypto';
import {
  YcHttpEvent,
  YcHttpResponse,
  UserProfile,
  BuyerBuyBox,
  BuyerApplication,
  LotDropConfig,
  BuyBoxTier,
  BuyBoxPaymentMethod,
  QueueStatus,
  PriceAcceptance,
} from '../types.js';
import { json, parseBody, getClientIp } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { memoryCache, appCache } from '../lib/memoryCache.js';
import { recordJournalEvent } from '../lib/journal.js';
import { callTelegramApi, escapeHtml } from '../lib/telegramClient.js';
import { findTelegramBindingByUser } from '../lib/telegramWorkflow.js';
import { consumeQuota, recordSecurityIncident, maskEmail } from '../lib/anomalyDetector.js';
import { sanitizeLotForPublic } from './data.js';
import {
  computeMatchScore,
  computeClosingScore,
  rankApplications,
  determineDefaultTier,
} from '../lib/buyBoxEngine.js';
import {
  ACTIVE_APPLICATION_STATUSES,
  ARCHIVED_APPLICATION_STATUSES,
  getUnifiedBuyBox,
  syncBuyBoxAndUser,
  isSelfOwnedLot,
  isActiveApplication,
} from '../lib/buyBoxSync.js';
import { logger } from '../lib/logger.js';
import { runSlaSweep } from '../lib/slaSweeperService.js';

async function notifyStaff(text: string): Promise<void> {
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
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    logger.warn('Failed to send staff telegram notification', { meta: { error: err.message } });
  }
}

async function notifyUserTelegram(userId: string, text: string): Promise<void> {
  try {
    const binding = await findTelegramBindingByUser(userId);
    if (binding && binding.chatId && binding.notificationsEnabled !== false) {
      await callTelegramApi('sendMessage', {
        chat_id: binding.chatId,
        text,
        parse_mode: 'HTML',
      }).catch(() => {});
    }
  } catch (err: any) {
    logger.warn('Failed to send user telegram notification', { meta: { error: err.message, userId } });
  }
}

async function findLotByCode(ydb: any, lotCode: string): Promise<any | null> {
  let lot = await ydb.getItem('lots', lotCode);
  if (!lot) {
    const allLots = await ydb.scanAll('lots', 500);
    lot = allLots.find((l: any) => l.lotCode === lotCode || l.id === lotCode || l.code === lotCode);
  }
  return lot || null;
}

export async function handleMatching(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const ydb = getYdbClient();
  const cfg = getConfig();
  const clientIp = getClientIp(event);

  // =========================================================================
  // 10. GET /api/matching/demand-radar (Publicly accessible, Zero PII)
  // =========================================================================
  if (subPath === '/demand-radar' && method === 'GET') {
    const cached = memoryCache.get<any>('demand_radar_summary');
    if (cached) {
      return json(event, 200, { ok: true, ...cached, cached: true });
    }

    try {
      const allBuyBoxes = await ydb.scanAll<BuyerBuyBox>('buy_boxes', 500);
      const activeBoxes = (allBuyBoxes || []).filter((bb) => bb.active !== false);

      let goldCount = 0;
      let silverCount = 0;
      let totalDeclaredLiquidityRub = 0;

      for (const bb of activeBoxes) {
        if (bb.tier === 'gold') goldCount++;
        else if (bb.tier === 'silver') silverCount++;

        const liquidity = Number(bb.availableLiquidityRub || bb.maxBudgetRub || 0);
        if (liquidity > 0 && liquidity <= 500000000) {
          totalDeclaredLiquidityRub += liquidity;
        }
      }

      const summary = {
        totalMatched: activeBoxes.length,
        goldCount,
        silverCount,
        totalDeclaredLiquidityRub,
      };

      memoryCache.set('demand_radar_summary', summary, 60000); // 60s warm cache

      return json(event, 200, { ok: true, ...summary, cached: false });
    } catch (err: any) {
      logger.error('Error computing demand-radar summary', { meta: { error: err.message } });
      return json(event, 200, {
        ok: true,
        totalMatched: 0,
        goldCount: 0,
        silverCount: 0,
        totalDeclaredLiquidityRub: 0,
        cached: false,
      });
    }
  }

  // All subsequent routes require authenticated user session
  const authUser = await getAuthenticatedUser(event);
  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация для доступа к Buy-Box и дропам' });
  }

  const isOwner = authUser.role === 'owner';
  const isEmployee = authUser.role === 'employee';
  const isStaff = isOwner || isEmployee;

  // =========================================================================
  // 1. GET /api/matching/my-buy-box
  // =========================================================================
  if (subPath === '/my-buy-box' && method === 'GET') {
    try {
      const buyBox = await getUnifiedBuyBox(ydb, authUser.id);
      const effectiveTier = buyBox?.tier || (authUser as any).buyerTier || 'silver';
      return json(event, 200, {
        ok: true,
        buyBox: buyBox || null,
        tier: effectiveTier,
        reliabilityScore: buyBox?.reliabilityScore ?? 100,
      });
    } catch (err: any) {
      logger.error('Error fetching my-buy-box', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Ошибка загрузки параметров Buy-Box' });
    }
  }

  // =========================================================================
  // 2. PUT /api/matching/my-buy-box (With Strict Tier Tampering Guard)
  // =========================================================================
  if (subPath === '/my-buy-box' && (method === 'PUT' || method === 'POST')) {
    const body = parseBody<Partial<BuyerBuyBox>>(event);
    if (!body) {
      return json(event, 400, { error: 'Тело запроса отсутствует или не в формате JSON' });
    }

    // Tier Tampering Guard: Non-staff users MUST NOT set or modify verification tier or reliability scores
    const protectedFields = [
      'tier',
      'tierVerifiedAt',
      'tierVerifiedBy',
      'tierNote',
      'reliabilityScore',
      'noShowCount',
      'completedViewingsCount',
    ];

    if (!isStaff) {
      const tamperedField = protectedFields.find((f) => (body as any)[f] !== undefined && (body as any)[f] !== null);
      if (tamperedField) {
        await recordSecurityIncident({
          type: 'privilege_tampering',
          severity: 'high',
          actorUserId: authUser.id,
          actorRole: authUser.role,
          clientIp,
          endpoint: '/api/matching/my-buy-box',
          summary: `Попытка несанкционированного изменения поля ${tamperedField} покупателем ${maskEmail(authUser.email)}`,
        });

        return json(event, 403, {
          code: 'privilege_tampering',
          error: 'Покупатель не может изменять свой уровень верификации (tier) или рейтинг надежности',
        });
      }
    }

    try {
      const existing = await getUnifiedBuyBox(ydb, authUser.id);
      const now = new Date().toISOString();

      const paymentMethod = body.paymentMethod || existing?.paymentMethod || 'cash_100';
      const defaultTier = determineDefaultTier(paymentMethod);
      const preservedTier = isStaff && body.tier ? body.tier : existing?.tier || defaultTier;

      const buyBoxToSave: BuyerBuyBox = {
        id: `bb:${authUser.id}`,
        userId: authUser.id,
        active: body.active !== undefined ? Boolean(body.active) : existing?.active ?? true,
        cities: Array.isArray(body.cities) ? body.cities : existing?.cities || ['spb'],
        districts: Array.isArray(body.districts) ? body.districts : existing?.districts || [],
        complexNames: Array.isArray(body.complexNames) ? body.complexNames : existing?.complexNames || [],
        dealTracks: Array.isArray(body.dealTracks) ? body.dealTracks : existing?.dealTracks || ['ddu_cession'],
        rooms: Array.isArray(body.rooms) ? body.rooms : existing?.rooms || [],
        minAreaM2: body.minAreaM2 !== undefined ? Number(body.minAreaM2) : existing?.minAreaM2,
        maxAreaM2: body.maxAreaM2 !== undefined ? Number(body.maxAreaM2) : existing?.maxAreaM2,
        maxBudgetRub: Number(body.maxBudgetRub ?? existing?.maxBudgetRub ?? 15000000),
        minDiscountPercent: Number(body.minDiscountPercent ?? existing?.minDiscountPercent ?? 10),
        paymentMethod,
        preferredBanks: Array.isArray(body.preferredBanks) ? body.preferredBanks : existing?.preferredBanks || [],
        goal: body.goal || existing?.goal || 'living',
        readinessHours: Number(body.readinessHours ?? existing?.readinessHours ?? 24),
        availableLiquidityRub:
          body.availableLiquidityRub !== undefined ? Number(body.availableLiquidityRub) : existing?.availableLiquidityRub,
        tier: preservedTier,
        tierVerifiedAt: isStaff && body.tier ? now : existing?.tierVerifiedAt,
        tierVerifiedBy: isStaff && body.tier ? authUser.email : existing?.tierVerifiedBy,
        tierNote: isStaff && body.tierNote !== undefined ? body.tierNote : existing?.tierNote,
        reliabilityScore:
          isStaff && body.reliabilityScore !== undefined ? Number(body.reliabilityScore) : existing?.reliabilityScore ?? 100,
        noShowCount: existing?.noShowCount ?? 0,
        withdrawalCount: (existing as any)?.withdrawalCount ?? 0,
        completedViewingsCount: existing?.completedViewingsCount ?? 0,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      const saved = await syncBuyBoxAndUser(ydb, authUser.id, buyBoxToSave);

      await recordJournalEvent({
        action: existing ? 'UPDATE' : 'CREATE',
        collection: 'buy_boxes',
        recordId: saved.id,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: saved,
      });

      return json(event, 200, {
        ok: true,
        buyBox: saved,
        tier: saved.tier,
        reliabilityScore: saved.reliabilityScore,
      });
    } catch (err: any) {
      logger.error('Error saving my-buy-box', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Не удалось сохранить настройки Buy-Box' });
    }
  }

  // =========================================================================
  // 2b. GET /api/matching/my-applications (Enriched 3-Slot Active & Archived)
  // =========================================================================
  if (subPath === '/my-applications' && method === 'GET') {
    try {
      const [buyBox, allApps, allLots, allDeals] = await Promise.all([
        getUnifiedBuyBox(ydb, authUser.id),
        ydb.scanAll<BuyerApplication>('buyer_applications', 500),
        ydb.scanAll<any>('lots', 500),
        ydb.scanAll<any>('deals', 500),
      ]);

      const lotMap = new Map<string, any>();
      for (const l of allLots || []) {
        if (l.lotCode) lotMap.set(String(l.lotCode).toUpperCase(), l);
        if (l.id) lotMap.set(String(l.id).toUpperCase(), l);
      }
      const dealMap = new Map<string, any>();
      for (const d of allDeals || []) {
        if (d.lotCode) dealMap.set(String(d.lotCode).toUpperCase(), d);
      }

      const myApps = (allApps || [])
        .filter((a) => a.userId === authUser.id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

      const enriched = myApps.map((app) => {
        const codeKey = String(app.lotCode || '').toUpperCase();
        const lot = lotMap.get(codeKey);
        const deal = dealMap.get(codeKey);
        return {
          ...app,
          tier: buyBox?.tier || 'silver',
          reliabilityScore: buyBox?.reliabilityScore ?? 100,
          availableLiquidityRub:
            app.offeredPriceRub ||
            buyBox?.availableLiquidityRub ||
            buyBox?.maxBudgetRub ||
            lot?.cashPaidBySeller ||
            0,
          paymentMethod: buyBox?.paymentMethod || 'cash_100',
          lotTitle: lot ? `${lot.complexName || 'ЖК'}${lot.district ? ` (${lot.district})` : ''}` : `Лот #${app.lotCode}`,
          lotDistrict: lot?.district || '',
          lotPriceRub: lot?.cashPaidBySeller || 0,
          lotDduPriceRub: lot?.dduContractPrice || 0,
          lotStatus: lot?.status || 'available',
          dealStage: deal?.stage || null,
          curatorName:
            deal?.assignedCuratorName ||
            deal?.assignedEmployeeName ||
            deal?.curatorName ||
            lot?.assignedCuratorName ||
            lot?.assignedEmployeeName ||
            lot?.curator?.name ||
            'Куратор DomExit',
        };
      });

      const activeApplications = enriched.filter((a) => isActiveApplication(a));
      const archivedApplications = enriched.filter((a) => !isActiveApplication(a));
      const activeWin = activeApplications.find((a) => a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal');

      return json(event, 200, {
        ok: true,
        activeApplications,
        archivedApplications,
        activeCount: activeApplications.length,
        maxSlots: 3,
        hasActiveDeal: Boolean(activeWin),
        activeDealLotCode: activeWin?.lotCode || null,
        tier: buyBox?.tier || 'silver',
        reliabilityScore: buyBox?.reliabilityScore ?? 100,
      });
    } catch (err: any) {
      logger.error('Error fetching my-applications', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Не удалось загрузить ваши заявки на покупку' });
    }
  }

  // =========================================================================
  // 3. GET /api/matching/my-matches
  // =========================================================================
  if (subPath === '/my-matches' && method === 'GET') {
    try {
      const buyBox = await getUnifiedBuyBox(ydb, authUser.id);
      if (!buyBox || buyBox.active === false) {
        return json(event, 200, {
          ok: true,
          matches: [],
          totalMatches: 0,
          buyBoxConfigured: Boolean(buyBox),
          buyBoxTier: buyBox?.tier || 'silver',
          tier: buyBox?.tier || 'silver',
          reliabilityScore: buyBox?.reliabilityScore ?? 100,
        });
      }

      const allLots = await ydb.scanAll<any>('lots', 300);
      const allMyApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 200);
      const myAppsMap = new Map<string, BuyerApplication>();
      for (const a of allMyApps || []) {
        if (a.userId === authUser.id) {
          myAppsMap.set(a.lotCode, a);
        }
      }

      const now = new Date();
      const matches: any[] = [];

      for (const rawLot of allLots || []) {
        // Only active approved lots in catalog
        const status = rawLot.status || 'available';
        if (status === 'draft' || status === 'hidden' || status === 'blocked' || status === 'closed') {
          continue;
        }
        if (isSelfOwnedLot(rawLot, authUser)) {
          continue;
        }

        const matchRes = computeMatchScore(rawLot, buyBox);
        if (matchRes.score < 50) {
          continue; // Filter out low matches
        }

        const dropConfig: LotDropConfig | undefined = rawLot.dropConfig;
        let canApplyNow = true;
        let unlocksAt: string | null = null;
        let waveStatus = dropConfig?.waveStatus || 'open';
        let remainingSeats = dropConfig ? Math.max(0, dropConfig.maxApplicationsCap - dropConfig.currentValidApplications) : null;

        if (dropConfig && dropConfig.mode === 'staged_drop') {
          const goldUntil = dropConfig.goldExclusiveUntil ? new Date(dropConfig.goldExclusiveUntil) : now;

          if (dropConfig.currentValidApplications >= dropConfig.maxApplicationsCap) {
            waveStatus = 'capped_closed';
            canApplyNow = false;
          } else if ((dropConfig.goldExclusiveHours || 0) > 0 && now < goldUntil) {
            waveStatus = 'gold_wave';
            if (buyBox.tier === 'gold') {
              canApplyNow = true;
            } else {
              canApplyNow = false;
              unlocksAt = dropConfig.goldExclusiveUntil;
            }
          } else {
            waveStatus = 'open';
            canApplyNow = true;
          }
        }

        const existingApp = myAppsMap.get(rawLot.lotCode);
        const alreadyApplied = Boolean(existingApp && isActiveApplication(existingApp));

        const cleanLot = sanitizeLotForPublic(rawLot, authUser);

        matches.push({
          lot: cleanLot,
          matchScore: matchRes.score,
          score: matchRes.score,
          breakdown: matchRes.breakdown,
          eligibleForDrop: matchRes.eligibleForDrop,
          reasons: matchRes.reasons,
          canApplyNow: canApplyNow && !alreadyApplied,
          unlocksAt,
          remainingSeats,
          alreadyApplied,
          myQueueStatus: existingApp?.queueStatus || null,
          myQueuePosition: existingApp?.queuePosition || null,
        });
      }

      // Sort matches descending by match score
      matches.sort((a, b) => b.matchScore - a.matchScore);

      return json(event, 200, {
        ok: true,
        matches,
        totalMatches: matches.length,
        buyBoxConfigured: true,
        buyBoxTier: buyBox.tier,
        tier: buyBox.tier,
        reliabilityScore: buyBox.reliabilityScore ?? 100,
      });
    } catch (err: any) {
      logger.error('Error fetching my-matches', { meta: { error: err.message, userId: authUser.id } });
      return json(event, 500, { error: 'Ошибка вычисления совпадений по объектам' });
    }
  }

  // =========================================================================
  // 4. POST /api/matching/lots/:lotCode/launch-drop OR POST /api/matching/launch-drop
  // =========================================================================
  const launchMatch = subPath.match(/^\/lots\/([^/]+)\/launch-drop$/);
  const isDirectLaunch = subPath === '/launch-drop' && method === 'POST';
  if ((launchMatch || isDirectLaunch) && method === 'POST') {
    const body = parseBody<{
      lotCode?: string;
      goldExclusiveHours?: number;
      windowHours?: number;
      maxApplicationsCap?: number;
    }>(event) || {};

    const lotCode = launchMatch ? launchMatch[1] : body.lotCode;
    if (!lotCode) {
      return json(event, 400, { error: 'Укажите код лота (lotCode)' });
    }

    const lot = await findLotByCode(ydb, lotCode);
    if (!lot) {
      return json(event, 404, { error: `Объект #${lotCode} не найден` });
    }

    const isAssigned =
      lot.assignedEmployeeId === authUser.assignedEmployeeId || lot.assignedEmployeeId === authUser.id;
    if (!isOwner && !isAssigned) {
      return json(event, 403, { error: 'Запуск дропа разрешен только владельцу или назначенному куратору' });
    }

    const goldExclusiveHours = Math.max(0, Math.min(72, Number(body.goldExclusiveHours !== undefined ? body.goldExclusiveHours : 0)));
    const windowHours = Math.max(4, Math.min(168, Number(body.windowHours || 48)));
    const maxApplicationsCap = Math.max(2, Math.min(50, Number(body.maxApplicationsCap || 5)));

    try {
      // Scan active buy-boxes to compute matched gold and silver buyers
      const allBuyBoxes = await ydb.scanAll<BuyerBuyBox>('buy_boxes', 500);
      let matchedGoldCount = 0;
      let matchedSilverCount = 0;
      const matchedGoldChatIds: string[] = [];

      for (const bb of allBuyBoxes || []) {
        if (bb.active === false) continue;
        const res = computeMatchScore(lot, bb);
        if (res.eligibleForDrop) {
          if (bb.tier === 'gold') {
            matchedGoldCount++;
          } else if (bb.tier === 'silver') {
            matchedSilverCount++;
          }
        }
      }

      const now = new Date();
      const goldUntil = goldExclusiveHours > 0
        ? new Date(now.getTime() + goldExclusiveHours * 3600 * 1000).toISOString()
        : now.toISOString();
      const closesAt = new Date(now.getTime() + windowHours * 3600 * 1000).toISOString();

      const dropConfig: LotDropConfig = {
        mode: 'staged_drop',
        launchedAt: now.toISOString(),
        launchedBy: authUser.email,
        goldExclusiveHours,
        goldExclusiveUntil: goldUntil,
        windowHours,
        closesAt,
        maxApplicationsCap,
        currentValidApplications: 0,
        waveStatus: goldExclusiveHours > 0 ? 'gold_wave' : 'silver_wave',
        matchedGoldCount,
        matchedSilverCount,
        reDropCount: (lot.dropConfig?.reDropCount || 0) + 1,
      };

      lot.dropConfig = dropConfig;
      await ydb.putItem('lots', lot);
      memoryCache.invalidate('lots');

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'lots',
        recordId: lotCode,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: { dropConfig },
      });

      // Telegram notification to Platform Owner / Staff
      const text =
        `🚀 <b>ДРОП ЗАПУЩЕН: #${escapeHtml(lotCode)}</b>\n` +
        `ЖК: <b>${escapeHtml(lot.complexName || 'Не указан')}</b> (${escapeHtml(lot.city || 'spb').toUpperCase()})\n` +
        `Эксклюзив Gold: <b>${goldExclusiveHours} ч.</b> (до ${escapeHtml(goldUntil)})\n` +
        `Лимит заявок: <b>${maxApplicationsCap}</b>\n` +
        `Потенциальные инвесторы: <b>${matchedGoldCount} Gold</b>, <b>${matchedSilverCount} Silver</b>`;

      await notifyStaff(text).catch((err: any) =>
        logger.warn('Failed to notify staff about drop launch', { meta: { error: err.message } })
      );

      return json(event, 200, {
        ok: true,
        lotCode,
        dropConfig,
        matchedGoldCount,
        matchedSilverCount,
      });
    } catch (err: any) {
      logger.error('Error launching drop', { meta: { error: err.message, lotCode } });
      return json(event, 500, { error: 'Не удалось активировать дроп лота' });
    }
  }

  // =========================================================================
  // 5. POST /api/matching/lots/:lotCode/apply (Buyer Application in Queue)
  // =========================================================================
  const applyMatch = subPath.match(/^\/lots\/([^/]+)\/apply$/);
  if (applyMatch && method === 'POST') {
    const lotCode = applyMatch[1];

    // Quota: 5 applications / day per buyer
    const quotaRes = await consumeQuota({
      scope: 'buyer_app_day',
      actorKey: authUser.id,
      limit: 5,
      windowSec: 86400,
    });
    if (!quotaRes.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен суточный лимит подачи заявок (максимум 5 в день).',
          retryAfter: quotaRes.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(quotaRes.retryAfterSec) } }
      );
    }

    const lot = await findLotByCode(ydb, lotCode);
    if (!lot) {
      return json(event, 404, { error: `Объект #${lotCode} не найден` });
    }

    // Forbid self-application by the lot owner/seller
    if (isSelfOwnedLot(lot, authUser)) {
      return json(event, 400, {
        code: 'SELF_APPLICATION_FORBIDDEN',
        error: 'Это ваш объект (вы продавец). Подача заявки на покупку собственного лота запрещена.',
      });
    }

    const dropConfig: LotDropConfig | undefined = lot.dropConfig;
    const now = new Date();

    // Check expiration or cap
    if (dropConfig) {
      if (dropConfig.currentValidApplications >= dropConfig.maxApplicationsCap) {
        return json(event, 410, { error: 'Лимит заявок на данный лот исчерпан. Окно закрыто.' });
      }
      if (dropConfig.closesAt && now > new Date(dropConfig.closesAt) && lot.status !== 'available') {
        return json(event, 410, { error: 'Срок действия закрытого дропа истек.' });
      }
    }

    // Check buyer's unified Buy-Box
    const fetchedBuyBox = await getUnifiedBuyBox(ydb, authUser.id);
    let buyBox: BuyerBuyBox;
    if (!fetchedBuyBox) {
      // Auto-provision standard Buy-Box for registered client so application is not blocked
      buyBox = await syncBuyBoxAndUser(ydb, authUser.id, {
        id: `bb:${authUser.id}`,
        userId: authUser.id,
        active: true,
        cities: [],
        districts: [],
        complexNames: [],
        dealTracks: ['ddu_cession', 'secondary_dkp'],
        rooms: [],
        maxBudgetRub: 50000000,
        minDiscountPercent: 0,
        paymentMethod: 'cash_100',
        preferredBanks: [],
        goal: 'living',
        readinessHours: 24,
        tier: 'silver',
        reliabilityScore: 100,
        noShowCount: 0,
        completedViewingsCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    } else {
      buyBox = fetchedBuyBox;
    }

    // Check Gold wave exclusivity: only active if goldExclusiveHours > 0 AND now < goldExclusiveUntil AND waveStatus === 'gold_wave'
    if (dropConfig && dropConfig.waveStatus === 'gold_wave' && (dropConfig.goldExclusiveHours || 0) > 0) {
      if (now < new Date(dropConfig.goldExclusiveUntil)) {
        if (buyBox.tier !== 'gold') {
          return json(event, 403, {
            code: 'gold_exclusive_wave',
            error: `Эксклюзивная волна для инвесторов Gold. Для всех остальных клиентов лот откроется в ${dropConfig.goldExclusiveUntil}`,
            unlocksAt: dropConfig.goldExclusiveUntil,
          });
        }
      }
    }

    // Check duplicate applications & strict 3-slot limit
    const allApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 500);
    const myApps = (allApps || []).filter((a) => a.userId === authUser.id);
    const myActiveApps = myApps.filter((a) => isActiveApplication(a));

    const existingOnThisLot = myActiveApps.find(
      (a) => String(a.lotCode || '').toUpperCase() === lotCode.toUpperCase()
    );
    if (existingOnThisLot) {
      return json(event, 409, { error: 'Вы уже подали активную заявку на участие в сделке по данному объекту' });
    }

    if (myActiveApps.length >= 3) {
      return json(event, 400, {
        code: 'MAX_ACTIVE_APPLICATIONS_REACHED',
        error: 'Достигнут лимит активных заявок (максимум 3). Вы можете отозвать одну из открытых заявок в личном кабинете, чтобы подать на новый объект.',
        activeCount: myActiveApps.length,
        maxSlots: 3,
      });
    }

    const activeWinElsewhere = myActiveApps.find(
      (a) => (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal') && String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase()
    );

    // Check NDA signature
    const allSigs = await ydb.scanAll<any>('pep_signatures', 200);
    const ndaSig = (allSigs || []).find(
      (s) => s.lotCode === lotCode && s.userId === authUser.id && s.documentType === 'nda_viewing_act' && s.status === 'signed'
    );
    const ndaSigned = Boolean(ndaSig);

    const body = parseBody<{
      priceAcceptance?: PriceAcceptance;
      offeredPriceRub?: number;
      readiness24h?: boolean;
      deposit48h?: boolean;
      source?: 'web' | 'telegram';
    }>(event) || {};

    const matchRes = computeMatchScore(lot, buyBox);
    const closingRes = computeClosingScore(
      {
        priceAcceptance: body.priceAcceptance,
        readiness24h: body.readiness24h,
        deposit48h: body.deposit48h,
      },
      buyBox,
      lot
    );

    const appId = `app:${lotCode}:${authUser.id}`;
    const newApp: BuyerApplication = {
      id: appId,
      lotCode,
      userId: authUser.id,
      userEmail: authUser.email,
      userName: authUser.name,
      userPhone: authUser.phone,
      buyBoxId: buyBox.id,
      status: 'active',
      closingScore: closingRes.closingScore,
      matchScore: matchRes.score,
      scoreBreakdown: closingRes.breakdown,
      queueStatus: activeWinElsewhere ? 'standby_in_other_deal' : 'pending_review',
      activeDealLotCode: activeWinElsewhere ? activeWinElsewhere.lotCode : undefined,
      priceAcceptance: body.priceAcceptance || 'full_price',
      offeredPriceRub: body.offeredPriceRub,
      readiness24h: Boolean(body.readiness24h),
      deposit48h: Boolean(body.deposit48h),
      ndaSigned,
      source: body.source || 'web',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await ydb.putItem('buyer_applications', newApp);

    // Update drop counter
    if (dropConfig) {
      dropConfig.currentValidApplications = (dropConfig.currentValidApplications || 0) + 1;
      if (dropConfig.currentValidApplications >= dropConfig.maxApplicationsCap) {
        dropConfig.waveStatus = 'capped_closed';
      }
      lot.dropConfig = dropConfig;
      await ydb.putItem('lots', lot);
      memoryCache.invalidate('lots');
    }

    await recordJournalEvent({
      action: 'CREATE',
      collection: 'buyer_applications',
      recordId: appId,
      actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
      payload: newApp,
    });

    // Notify staff on Telegram
    const text =
      `📥 <b>НОВАЯ ЗАЯВКА В ТАКТОВЫЙ ТАБОР: #${escapeHtml(lotCode)}</b>\n` +
      `Покупатель: <b>${escapeHtml(authUser.name || authUser.email)}</b> (Ранг: <b>${buyBox.tier.toUpperCase()}</b>)\n` +
      `Closing Score: <b>${closingRes.closingScore}/105</b> (Match: ${matchRes.score}%)\n` +
      `Оплата: <b>${escapeHtml(buyBox.paymentMethod)}</b>\n` +
      `Готовность: 24ч=${body.readiness24h ? 'Да' : 'Нет'}, Депозит 48ч=${body.deposit48h ? 'Да' : 'Нет'}`;

    await notifyStaff(text).catch((err: any) =>
      logger.warn('Failed to notify staff about queue application', { meta: { error: err.message } })
    );

    return json(event, 200, {
      ok: true,
      application: newApp,
      waveStatus: dropConfig?.waveStatus || 'open',
    });
  }

  // =========================================================================
  // 6. GET /api/matching/lots/:lotCode/queue (Staff Only: Ranked Hybrid Queue)
  // =========================================================================
  const queueMatch = subPath.match(/^\/lots\/([^/]+)\/queue$/);
  if (queueMatch && method === 'GET') {
    if (!isStaff) {
      return json(event, 403, { error: 'Доступ к управлению очередью разрешен только сотрудникам' });
    }

    const lotCode = queueMatch[1];
    try {
      const allApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 500);
      const lotApps = (allApps || []).filter(
        (a) =>
          a.lotCode === lotCode &&
          !ARCHIVED_APPLICATION_STATUSES.has(String(a.queueStatus || ''))
      );

      const allBuyBoxes = await ydb.scanAll<BuyerBuyBox>('buy_boxes', 500);
      const bbMap = new Map<string, BuyerBuyBox>();
      for (const bb of allBuyBoxes || []) {
        const existing = bbMap.get(bb.userId);
        if (!existing || (bb.tier === 'gold' && existing.tier !== 'gold')) {
          bbMap.set(bb.userId, bb);
        }
      }

      const enriched = lotApps.map((a) => {
        const bb = bbMap.get(a.userId);
        return {
          ...a,
          tier: bb?.tier || 'silver',
          reliabilityScore: bb?.reliabilityScore ?? 100,
          noShowCount: bb?.noShowCount ?? 0,
        };
      });

      const ranked = rankApplications(enriched);

      return json(event, 200, {
        ok: true,
        lotCode,
        totalApplications: ranked.length,
        queue: ranked,
      });
    } catch (err: any) {
      logger.error('Error fetching lot queue', { meta: { error: err.message, lotCode } });
      return json(event, 500, { error: 'Не удалось загрузить очередь заявок' });
    }
  }

  // =========================================================================
  // 7. POST /api/matching/lots/:lotCode/select-priority (Staff Only)
  // =========================================================================
  const selectPriorityMatch = subPath.match(/^\/lots\/([^/]+)\/select-priority$/);
  if (selectPriorityMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Назначение приоритета разрешено только сотрудникам платформы' });
    }

    const lotCode = selectPriorityMatch[1];
    const body = parseBody<{
      priority1AppId?: string;
      priority1UserId?: string;
      reserve2AppId?: string;
      reserve2UserId?: string;
      reserve3AppId?: string;
      reserve3UserId?: string;
    }>(event) || {};

    try {
      const allApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 200);
      const lotApps = (allApps || []).filter((a) => a.lotCode === lotCode);

      let p1Id = body.priority1AppId;
      if (!p1Id && body.priority1UserId) {
        const found = lotApps.find((a) => a.userId === body.priority1UserId);
        if (found) p1Id = found.id;
      }
      let r2Id = body.reserve2AppId;
      if (!r2Id && body.reserve2UserId) {
        const found = lotApps.find((a) => a.userId === body.reserve2UserId);
        if (found) r2Id = found.id;
      }
      let r3Id = body.reserve3AppId;
      if (!r3Id && body.reserve3UserId) {
        const found = lotApps.find((a) => a.userId === body.reserve3UserId);
        if (found) r3Id = found.id;
      }

      if (!p1Id) {
        return json(event, 400, { error: 'Укажите идентификатор заявки №1 (priority1AppId или priority1UserId)' });
      }

      // Guard: Check if chosen Priority #1 buyer is frozen in standby_in_other_deal or already has an active deal elsewhere
      const candidateP1 = lotApps.find((a) => a.id === p1Id);
      if (!candidateP1) {
        return json(event, 404, { error: 'Выбранная заявка №1 не найдена в очереди этого лота' });
      }
      const otherActiveWin = (allApps || []).find(
        (a) =>
          a.userId === candidateP1.userId &&
          String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase() &&
          (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
      );
      if (candidateP1.queueStatus === 'standby_in_other_deal' || otherActiveWin) {
        const conflictCode = candidateP1.activeDealLotCode || otherActiveWin?.lotCode || 'другом лоте';
        return json(event, 400, {
          code: 'BUYER_IN_ACTIVE_DEAL',
          error: `Нельзя назначить победителем: покупатель уже участвует в активной сделке (#${conflictCode}) и находится в листе ожидания.`,
          activeDealLotCode: conflictCode,
        });
      }

      const now = new Date();
      const viewingDeadlineAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
      const depositDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

      let priority1App: BuyerApplication | null = null;
      let reserve2App: BuyerApplication | null = null;
      let reserve3App: BuyerApplication | null = null;

      for (const app of lotApps) {
        if (app.id === p1Id) {
          app.queueStatus = 'priority_1';
          app.queuePosition = 1;
          app.activeDealLotCode = undefined;
          app.viewingDeadlineAt = viewingDeadlineAt;
          app.depositDeadlineAt = depositDeadlineAt;
          app.updatedAt = now.toISOString();
          priority1App = app;
          await ydb.putItem('buyer_applications', app);
        } else if (r2Id && app.id === r2Id) {
          if (app.queueStatus !== 'standby_in_other_deal') {
            app.queueStatus = 'reserve_2';
          }
          app.queuePosition = 2;
          app.updatedAt = now.toISOString();
          reserve2App = app;
          await ydb.putItem('buyer_applications', app);
        } else if (r3Id && app.id === r3Id) {
          if (app.queueStatus !== 'standby_in_other_deal') {
            app.queueStatus = 'reserve_3';
          }
          app.queuePosition = 3;
          app.updatedAt = now.toISOString();
          reserve3App = app;
          await ydb.putItem('buyer_applications', app);
        } else if (app.queueStatus === 'pending_review') {
          app.queueStatus = 'waitlist';
          app.updatedAt = now.toISOString();
          await ydb.putItem('buyer_applications', app);
        }
      }

      // Freeze winning buyer's other active applications across all other lots -> standby_in_other_deal
      let frozenAppsCount = 0;
      if (priority1App) {
        const otherAppsToFreeze = (allApps || []).filter(
          (a) =>
            a.userId === priority1App!.userId &&
            String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase() &&
            isActiveApplication(a) &&
            a.queueStatus !== 'priority_1' &&
            a.queueStatus !== 'in_deal'
        );
        for (const otherApp of otherAppsToFreeze) {
          otherApp.queueStatus = 'standby_in_other_deal';
          otherApp.activeDealLotCode = lotCode;
          otherApp.updatedAt = now.toISOString();
          await ydb.putItem('buyer_applications', otherApp);
          frozenAppsCount++;
        }
      }

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'buyer_applications',
        recordId: `${lotCode}:priority_selected`,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: { priority1AppId: p1Id, reserve2AppId: r2Id, reserve3AppId: r3Id },
      });

      // Atomically sync winning buyer to Lot and Deal
      if (priority1App) {
        try {
          const allLots = await ydb.scanAll<any>('lots');
          const targetLot = (allLots || []).find((l: any) =>
            (l.lotCode && String(l.lotCode).trim().toUpperCase() === lotCode.toUpperCase()) ||
            (l.id && String(l.id).trim().toUpperCase() === lotCode.toUpperCase())
          );
          if (targetLot) {
            targetLot.buyerUserId = priority1App.userId;
            targetLot.buyerName = priority1App.userName || targetLot.buyerName || 'Покупатель';
            targetLot.status = 'in_deal';
            targetLot.currentStage = 4;
            targetLot.updatedAt = now.toISOString();
            await ydb.putItem('lots', targetLot);
            memoryCache.invalidate('lots');
            appCache.invalidatePrefix('lots');
            appCache.invalidatePrefix('lot:');

            const allDeals = await ydb.scanAll<any>('deals');
            let targetDeal = (allDeals || []).find((d: any) =>
              (d.lotCode && String(d.lotCode).trim().toUpperCase() === lotCode.toUpperCase()) ||
              (d.lotId && String(d.lotId).trim().toUpperCase() === String(targetLot.id).toUpperCase())
            );
            if (targetDeal) {
              targetDeal.buyerUserId = priority1App.userId;
              targetDeal.buyerName = priority1App.userName || targetDeal.buyerName || 'Покупатель';
              targetDeal.stage = 'closing_escrow';
              targetDeal.status = 'in_deal';
              targetDeal.updatedAt = now.toISOString();
              await ydb.putItem('deals', targetDeal);
              memoryCache.invalidate('deals');
              appCache.invalidatePrefix('deals');
            }
          }
        } catch (lotSyncErr) {
          logger.warn('Failed to sync lot and deal for priority1 winner', { meta: { error: lotSyncErr, lotCode } });
        }
      }

      return json(event, 200, {
        ok: true,
        lotCode,
        priority1: priority1App,
        priority1UserId: priority1App?.userId,
        reserve2: reserve2App,
        reserve3: reserve3App,
        frozenAppsCount,
        viewingDeadlineAt,
        depositDeadlineAt,
      });
    } catch (err: any) {
      logger.error('Error selecting priority in queue', { meta: { error: err.message, lotCode } });
      return json(event, 500, { error: 'Не удалось зафиксировать приоритет в очереди' });
    }
  }

  // =========================================================================
  // 8. POST /api/matching/lots/:lotCode/promote-next (Staff Only: Rotation)
  // =========================================================================
  const promoteMatch = subPath.match(/^\/lots\/([^/]+)\/promote-next$/);
  if (promoteMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Ротация очереди разрешена только сотрудникам платформы' });
    }

    const lotCode = promoteMatch[1];
    const body = parseBody<{
      previousPriority1AppId?: string;
      reason?: 'no_show' | 'passed' | 'timeout' | 'rejected';
    }>(event) || {};

    const reason = body.reason || 'passed';

    try {
      const allApps = await ydb.scanAll<BuyerApplication>('buyer_applications', 200);
      const lotApps = (allApps || []).filter((a) => a.lotCode === lotCode);

      let prevP1 = body.previousPriority1AppId
        ? lotApps.find((a) => a.id === body.previousPriority1AppId)
        : lotApps.find((a) => a.queueStatus === 'priority_1');

      if (prevP1) {
        prevP1.queueStatus = reason === 'no_show' ? 'rejected' : reason === 'passed' ? 'withdrawn' : 'expired';
        prevP1.updatedAt = new Date().toISOString();
        await ydb.putItem('buyer_applications', prevP1);

        // If no-show, penalize Buy-Box reliability by 15 points
        if (reason === 'no_show') {
          const bb = await getUnifiedBuyBox(ydb, prevP1.userId);
          if (bb) {
            bb.reliabilityScore = Math.max(0, (bb.reliabilityScore ?? 100) - 15);
            bb.noShowCount = (bb.noShowCount || 0) + 1;
            bb.updatedAt = new Date().toISOString();
            await syncBuyBoxAndUser(ydb, prevP1.userId, bb);
          }
        }
      }

      // Unfreeze prevP1's other applications if no longer in active deal
      if (prevP1) {
        const frozenApps = (allApps || []).filter(
          (a) =>
            a.userId === prevP1!.userId &&
            a.queueStatus === 'standby_in_other_deal' &&
            String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase()
        );
        if (frozenApps.length > 0) {
          const prevBb = await getUnifiedBuyBox(ydb, prevP1.userId);
          for (const fa of frozenApps) {
            fa.queueStatus = 'pending_review';
            fa.activeDealLotCode = undefined;
            if (prevBb) {
              const linkedLot = await findLotByCode(ydb, fa.lotCode);
              if (linkedLot) {
                const rescored = computeClosingScore(fa, prevBb, linkedLot);
                fa.closingScore = rescored.closingScore;
                fa.scoreBreakdown = rescored.breakdown;
              }
            }
            fa.updatedAt = new Date().toISOString();
            await ydb.putItem('buyer_applications', fa);
          }
        }
      }

      // Find eligible Reserve #2 (skipping buyers busy in another active deal)
      const isBusyElsewhere = (cand: BuyerApplication) =>
        cand.queueStatus === 'standby_in_other_deal' ||
        (allApps || []).some(
          (a) =>
            a.userId === cand.userId &&
            String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase() &&
            (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
        );

      const reserve2Candidate = lotApps.find((a) => a.queueStatus === 'reserve_2' && !isBusyElsewhere(a));
      const reserve3Candidate = lotApps.find((a) => a.queueStatus === 'reserve_3' && !isBusyElsewhere(a));
      const reserve2 = reserve2Candidate || reserve3Candidate;
      const reserve3 = reserve2Candidate ? reserve3Candidate : undefined;

      const now = new Date();
      if (reserve2) {
        reserve2.queueStatus = 'priority_1';
        reserve2.queuePosition = 1;
        reserve2.activeDealLotCode = undefined;
        reserve2.promotedFromReserveAt = now.toISOString();
        reserve2.viewingDeadlineAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
        reserve2.depositDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
        reserve2.updatedAt = now.toISOString();
        await ydb.putItem('buyer_applications', reserve2);

        // Freeze newly promoted winner's other applications
        const otherAppsToFreeze = (allApps || []).filter(
          (a) =>
            a.userId === reserve2.userId &&
            String(a.lotCode || '').toUpperCase() !== lotCode.toUpperCase() &&
            isActiveApplication(a) &&
            a.queueStatus !== 'priority_1' &&
            a.queueStatus !== 'in_deal'
        );
        for (const oa of otherAppsToFreeze) {
          oa.queueStatus = 'standby_in_other_deal';
          oa.activeDealLotCode = lotCode;
          oa.updatedAt = now.toISOString();
          await ydb.putItem('buyer_applications', oa);
        }
      }

      if (reserve3) {
        reserve3.queueStatus = 'reserve_2';
        reserve3.queuePosition = 2;
        reserve3.updatedAt = now.toISOString();
        await ydb.putItem('buyer_applications', reserve3);
      }

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'buyer_applications',
        recordId: `${lotCode}:promoted_next`,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: {
          previousPriority1AppId: body.previousPriority1AppId,
          reason: body.reason,
          promotedAppId: reserve2?.id,
        },
      });

      // Atomically sync promoted winner (or revert) to Lot and Deal
      try {
        const allLots = await ydb.scanAll<any>('lots');
        const targetLot = (allLots || []).find((l: any) =>
          (l.lotCode && String(l.lotCode).trim().toUpperCase() === lotCode.toUpperCase()) ||
          (l.id && String(l.id).trim().toUpperCase() === lotCode.toUpperCase())
        );
        const allDeals = await ydb.scanAll<any>('deals');
        let targetDeal = (allDeals || []).find((d: any) =>
          (d.lotCode && String(d.lotCode).trim().toUpperCase() === lotCode.toUpperCase()) ||
          (targetLot && d.lotId && String(d.lotId).trim().toUpperCase() === String(targetLot.id).toUpperCase())
        );

        if (reserve2) {
          if (targetLot) {
            targetLot.buyerUserId = reserve2.userId;
            targetLot.buyerName = reserve2.userName || targetLot.buyerName || 'Покупатель';
            targetLot.status = 'in_deal';
            targetLot.currentStage = 4;
            targetLot.updatedAt = now.toISOString();
            await ydb.putItem('lots', targetLot);
          }
          if (targetDeal) {
            targetDeal.buyerUserId = reserve2.userId;
            targetDeal.buyerName = reserve2.userName || targetDeal.buyerName || 'Покупатель';
            targetDeal.stage = 'closing_escrow';
            targetDeal.status = 'in_deal';
            targetDeal.updatedAt = now.toISOString();
            await ydb.putItem('deals', targetDeal);
          }
        } else {
          // No reserves left - revert lot to available Stage 3
          if (targetLot) {
            targetLot.buyerUserId = null;
            targetLot.buyerName = null;
            targetLot.status = 'available';
            targetLot.currentStage = 3;
            targetLot.updatedAt = now.toISOString();
            await ydb.putItem('lots', targetLot);
          }
          if (targetDeal) {
            targetDeal.buyerUserId = null;
            targetDeal.buyerName = null;
            targetDeal.stage = 'buyer_matching';
            targetDeal.status = 'active';
            targetDeal.updatedAt = now.toISOString();
            await ydb.putItem('deals', targetDeal);
          }
        }
        memoryCache.invalidate('lots');
        memoryCache.invalidate('deals');
        appCache.invalidatePrefix('lots');
        appCache.invalidatePrefix('lot:');
        appCache.invalidatePrefix('deals');
      } catch (syncErr) {
        logger.warn('Failed to sync lot and deal on promote-next', { meta: { error: syncErr, lotCode } });
      }

      return json(event, 200, {
        ok: true,
        lotCode,
        promotedAppId: reserve2?.id || null,
        newPriority1: reserve2 || null,
        promotedApp: reserve2 || null,
        demotedApp: prevP1 || null,
        demotedUserId: prevP1?.userId,
        newQueueStatus: 'priority_1',
      });
    } catch (err: any) {
      logger.error('Error promoting next in queue', { meta: { error: err.message, lotCode } });
      return json(event, 500, { error: 'Не удалось выполнить ротацию очереди' });
    }
  }

  // =========================================================================
  // 9. PATCH/PUT/POST /api/matching/buyers/:userId/tier OR /buy-boxes/:userId/tier (Staff Only, strictly audited)
  // =========================================================================
  const tierMatch = subPath.match(/^\/(?:buyers|buy-boxes)\/([^/]+)\/tier$/);
  if (tierMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
    if (!isStaff) {
      return json(event, 403, { error: 'Изменение уровня верификации разрешено только сотрудникам' });
    }

    const targetUserId = tierMatch[1];
    const body = parseBody<{
      tier: BuyBoxTier;
      reliabilityScore?: number;
      tierNote?: string;
      reason?: string;
    }>(event);

    if (!body?.tier || !['gold', 'silver', 'bronze'].includes(body.tier)) {
      return json(event, 400, { error: 'Укажите корректный уровень tier: gold, silver или bronze' });
    }

    const isOwner = authUser.role === 'owner';
    const reason = (body.reason || body.tierNote || '').trim();
    if (!isOwner && reason.length < 3) {
      return json(event, 400, {
        error: 'Для ручного изменения ранга куратором обязательно указание обоснования (reason, минимум 3 символа)',
      });
    }

    try {
      const existing = await getUnifiedBuyBox(ydb, targetUserId);
      const now = new Date().toISOString();

      const updatedBuyBox: BuyerBuyBox = existing || {
        id: `bb:${targetUserId}`,
        userId: targetUserId,
        active: true,
        cities: ['spb'],
        districts: [],
        complexNames: [],
        dealTracks: ['ddu_cession'],
        rooms: [],
        maxBudgetRub: 20000000,
        minDiscountPercent: 10,
        paymentMethod: 'cash_100',
        preferredBanks: [],
        goal: 'living',
        readinessHours: 24,
        tier: body.tier,
        reliabilityScore: 100,
        noShowCount: 0,
        completedViewingsCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      updatedBuyBox.tier = body.tier;
      updatedBuyBox.tierVerifiedAt = now;
      updatedBuyBox.tierVerifiedBy = authUser.email;
      if (body.reliabilityScore !== undefined) {
        updatedBuyBox.reliabilityScore = Math.max(0, Math.min(100, Number(body.reliabilityScore)));
      }
      if (reason) {
        updatedBuyBox.tierNote = reason;
      }
      updatedBuyBox.updatedAt = now;

      await syncBuyBoxAndUser(ydb, targetUserId, updatedBuyBox);

      // Mandatory Audit Log for manual tier changes
      await ydb.putItem('audit_logs', {
        id: `log-${crypto.randomUUID()}`,
        timestamp: now,
        operatorId: authUser.id,
        operatorName: authUser.name || authUser.email,
        operatorRole: isOwner ? 'owner' : 'curator',
        actionType: 'tier_modified_manual',
        title: `Ручное изменение ранга инвестора ${targetUserId} на ${body.tier.toUpperCase()}`,
        description: `Ранг изменен на ${body.tier.toUpperCase()} сотрудником ${authUser.email}. Обоснование: ${reason || 'Установлено владельцем платформы'}`,
        performedBy: authUser.id,
        userEmail: authUser.email,
        action: 'MANUAL_TIER_UPDATE',
        metadata: {
          targetUserId,
          newTier: body.tier,
          reliabilityScore: updatedBuyBox.reliabilityScore,
          reason: reason || null,
          operatorRole: authUser.role,
        },
      });

      await recordJournalEvent({
        action: existing ? 'UPDATE' : 'CREATE',
        collection: 'buy_boxes',
        recordId: updatedBuyBox.id,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: { tier: body.tier, reliabilityScore: updatedBuyBox.reliabilityScore, reason },
      });

      return json(event, 200, { ok: true, buyBox: updatedBuyBox });
    } catch (err: any) {
      logger.error('Error updating buyer tier', { meta: { error: err.message, targetUserId } });
      return json(event, 500, { error: 'Не удалось обновить статус покупателя' });
    }
  }

  // =========================================================================
  // 9b. POST /api/matching/confirm-step (Staff Only: SLA Reliability Recovery)
  // =========================================================================
  if (subPath === '/confirm-step' && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Подтверждение этапов сделки доступно только сотрудникам' });
    }

    const body = parseBody<{
      lotCode?: string;
      userId: string;
      step: 'completed_viewing' | 'escrow_confirmed';
      notes?: string;
    }>(event);

    const targetUserId = body?.userId;
    const step = body?.step;

    if (!targetUserId || (step !== 'completed_viewing' && step !== 'escrow_confirmed')) {
      return json(event, 400, {
        error: 'Укажите userId и корректный этап step: completed_viewing или escrow_confirmed',
      });
    }

    try {
      const existing = await getUnifiedBuyBox(ydb, targetUserId);
      const now = new Date().toISOString();

      const updatedBuyBox: BuyerBuyBox = existing || {
        id: `bb:${targetUserId}`,
        userId: targetUserId,
        active: true,
        cities: ['spb'],
        districts: [],
        complexNames: [],
        dealTracks: ['ddu_cession'],
        rooms: [],
        maxBudgetRub: 20000000,
        minDiscountPercent: 10,
        paymentMethod: 'cash_100',
        preferredBanks: [],
        goal: 'living',
        readinessHours: 24,
        tier: 'silver',
        reliabilityScore: 100,
        noShowCount: 0,
        completedViewingsCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      const prevScore = updatedBuyBox.reliabilityScore ?? 100;
      const newScore = Math.min(100, prevScore + 5);
      const prevCount = updatedBuyBox.completedViewingsCount ?? 0;
      const newCount = prevCount + 1;

      updatedBuyBox.reliabilityScore = newScore;
      updatedBuyBox.completedViewingsCount = newCount;
      updatedBuyBox.updatedAt = now;

      await syncBuyBoxAndUser(ydb, targetUserId, updatedBuyBox);

      const stepLabel =
        step === 'completed_viewing'
          ? 'Успешный просмотр объекта'
          : 'Подтверждение эскроу-депозита';

      await ydb.putItem('audit_logs', {
        id: `log-${crypto.randomUUID()}`,
        timestamp: now,
        operatorId: authUser.id,
        operatorName: authUser.name || authUser.email,
        operatorRole: authUser.role === 'owner' ? 'owner' : 'curator',
        actionType: 'sla_reliability_restored',
        title: `Восстановление рейтинга SLA (+5) для покупателя ${targetUserId}`,
        description: `Подтвержден этап: «${stepLabel}». Рейтинг надежности: ${prevScore}% -> ${newScore}%. Всего завершенных просмотров: ${newCount}.`,
        performedBy: authUser.id,
        userEmail: authUser.email,
        action: 'SLA_RELIABILITY_RESTORED',
        metadata: {
          targetUserId,
          lotCode: body?.lotCode || null,
          step,
          prevScore,
          newScore,
          completedViewingsCount: newCount,
          notes: body?.notes || null,
        },
      });

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'buy_boxes',
        recordId: updatedBuyBox.id,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: {
          step,
          prevScore,
          newScore,
          completedViewingsCount: newCount,
          lotCode: body?.lotCode,
        },
      });

      return json(event, 200, {
        ok: true,
        message: `Этап «${stepLabel}» успешно подтвержден. Рейтинг надежности SLA увеличен на +5 (текущий: ${newScore}%).`,
        reliabilityScore: newScore,
        completedViewingsCount: newCount,
        buyBox: updatedBuyBox,
      });
    } catch (err: any) {
      logger.error('Error confirming deal step for SLA recovery', {
        meta: { error: err.message, targetUserId, step },
      });
      return json(event, 500, { error: 'Не удалось подтвердить этап сделки' });
    }
  }

  // =========================================================================
  // 10b. POST /api/matching/applications/:id/withdraw (Buyer Self-Withdrawal)
  // =========================================================================
  const withdrawMatch = subPath.match(/^\/applications\/([^/]+)\/withdraw$/);
  if (withdrawMatch && method === 'POST') {
    const appId = decodeURIComponent(withdrawMatch[1]);
    const body = parseBody<{ reason?: string }>(event) || {};

    try {
      const app = await ydb.getItem<BuyerApplication>('buyer_applications', appId);
      if (!app) {
        return json(event, 404, { error: 'Заявка на покупку не найдена' });
      }
      if (!isStaff && app.userId !== authUser.id) {
        return json(event, 403, { error: 'Вы можете отозвать только собственную заявку' });
      }
      if (ARCHIVED_APPLICATION_STATUSES.has(String(app.queueStatus || ''))) {
        return json(event, 400, { error: 'Эта заявка уже была закрыта или отозвана ранее' });
      }

      const now = new Date().toISOString();
      const wasWinner = app.queueStatus === 'priority_1' || app.queueStatus === 'in_deal';
      const existingBb = await getUnifiedBuyBox(ydb, app.userId);
      let penaltyApplied = 0;
      let newReliabilityScore: number = existingBb?.reliabilityScore ?? 100;
      let unfrozenCount = 0;

      app.queueStatus = wasWinner ? 'withdrawn_from_deal' : 'withdrawn_from_queue';
      app.status = 'withdrawn';
      app.withdrawnAt = now;
      app.withdrawalReason = (body.reason || '').trim().slice(0, 300) || undefined;
      app.updatedAt = now;
      await ydb.putItem('buyer_applications', app);

      // Update lot dropConfig seat counter and revert lot if winner withdrew
      const lot = await findLotByCode(ydb, app.lotCode);
      if (lot) {
        if (lot.dropConfig) {
          lot.dropConfig.currentValidApplications = Math.max(0, (lot.dropConfig.currentValidApplications || 1) - 1);
          if (lot.dropConfig.waveStatus === 'capped_closed' && lot.dropConfig.currentValidApplications < lot.dropConfig.maxApplicationsCap) {
            lot.dropConfig.waveStatus = 'silver_wave';
          }
        }
        if (wasWinner) {
          lot.buyerUserId = null;
          lot.buyerName = null;
          lot.status = 'available';
          lot.currentStage = 3;
        }
        lot.updatedAt = now;
        await ydb.putItem('lots', lot);
        memoryCache.invalidate('lots');
        appCache.invalidatePrefix('lots');
        appCache.invalidatePrefix('lot:');
      }

      if (wasWinner) {
        // 1. Apply -15 SLA penalty to unified buy_box
        const bbToUpdate: BuyerBuyBox = existingBb || {
          id: `bb:${app.userId}`,
          userId: app.userId,
          active: true,
          cities: ['spb'],
          districts: [],
          complexNames: [],
          dealTracks: ['ddu_cession'],
          rooms: [],
          maxBudgetRub: 20000000,
          minDiscountPercent: 0,
          paymentMethod: 'cash_100',
          preferredBanks: [],
          goal: 'living',
          readinessHours: 24,
          tier: 'silver',
          reliabilityScore: 100,
          noShowCount: 0,
          withdrawalCount: 0,
          completedViewingsCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        const prevScore = bbToUpdate.reliabilityScore ?? 100;
        newReliabilityScore = Math.max(0, prevScore - 15);
        penaltyApplied = prevScore - newReliabilityScore;
        bbToUpdate.reliabilityScore = newReliabilityScore;
        bbToUpdate.noShowCount = (bbToUpdate.noShowCount || 0) + 1;
        bbToUpdate.withdrawalCount = ((bbToUpdate as any).withdrawalCount || 0) + 1;
        bbToUpdate.updatedAt = now;
        await syncBuyBoxAndUser(ydb, app.userId, bbToUpdate);

        // 2. Revert linked deal back to buyer_matching
        try {
          const allDeals = await ydb.scanAll<any>('deals', 300);
          const linkedDeal = (allDeals || []).find(
            (d: any) => String(d.lotCode || '').toUpperCase() === String(app.lotCode || '').toUpperCase()
          );
          if (linkedDeal) {
            linkedDeal.buyerUserId = null;
            linkedDeal.buyerName = null;
            linkedDeal.stage = 'buyer_matching';
            linkedDeal.status = 'active';
            linkedDeal.updatedAt = now;
            await ydb.putItem('deals', linkedDeal);
            memoryCache.invalidate('deals');
            appCache.invalidatePrefix('deals');
          }
        } catch {
          // Non-fatal
        }

        // 3. Re-enable standby_in_other_deal applications and recalculate Closing Score with penalized SLA
        const allUserApps = (await ydb.scanAll<BuyerApplication>('buyer_applications', 500)) || [];
        const frozenApps = allUserApps.filter(
          (a) =>
            a.userId === app.userId &&
            a.id !== app.id &&
            a.queueStatus === 'standby_in_other_deal'
        );
        for (const fa of frozenApps) {
          fa.queueStatus = 'pending_review';
          fa.activeDealLotCode = undefined;
          const otherLot = await findLotByCode(ydb, fa.lotCode);
          if (otherLot) {
            const rescored = computeClosingScore(fa, bbToUpdate, otherLot);
            fa.closingScore = rescored.closingScore;
            fa.scoreBreakdown = rescored.breakdown;
          }
          fa.updatedAt = now;
          await ydb.putItem('buyer_applications', fa);
          unfrozenCount++;
        }

        // 4. Audit log + staff Telegram alert
        await ydb.putItem('audit_logs', {
          id: `log-${crypto.randomUUID()}`,
          timestamp: now,
          lotCode: app.lotCode,
          operatorId: authUser.id,
          operatorName: authUser.name || authUser.email,
          operatorRole: 'client',
          actionType: 'buyer_deal_withdrawn_sla_penalty',
          title: `Отказ победителя от сделки по лоту #${app.lotCode} (штраф SLA -15)`,
          description: `Покупатель ${app.userName || app.userEmail} отказался от активной сделки. Рейтинг SLA: ${prevScore}% → ${newReliabilityScore}%. Разморожено заявок в листе ожидания: ${unfrozenCount}.`,
          performedBy: authUser.id,
          userEmail: authUser.email,
          metadata: {
            lotCode: app.lotCode,
            appId: app.id,
            prevScore,
            newReliabilityScore,
            penaltyApplied,
            unfrozenCount,
          },
        });

        await notifyStaff(
          `⚠️ <b>ОТКАЗ ПОБЕДИТЕЛЯ ОТ СДЕЛКИ: #${escapeHtml(app.lotCode)}</b>\n` +
          `Покупатель: <b>${escapeHtml(app.userName || app.userEmail || app.userId)}</b>\n` +
          `Штраф SLA: <b>-15 баллов</b> (${prevScore}% → <b>${newReliabilityScore}%</b>)\n` +
          `Лот #${escapeHtml(app.lotCode)} возвращен в статус «Доступен» (Этап 3) для выбора следующего кандидата.`
        ).catch(() => {});
      }

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'buyer_applications',
        recordId: app.id,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: {
          queueStatus: app.queueStatus,
          wasWinner,
          penaltyApplied,
          newReliabilityScore,
          unfrozenCount,
        },
      });

      return json(event, 200, {
        ok: true,
        application: app,
        wasWinner,
        penaltyApplied,
        reliabilityScore: newReliabilityScore,
        unfrozenCount,
        unfrozenAppsCount: unfrozenCount,
        message: wasWinner
          ? `Вы отказались от сделки по лоту #${app.lotCode}. Начислен штраф -15 баллов к SLA (текущий рейтинг: ${newReliabilityScore}/100).`
          : `Заявка по лоту #${app.lotCode} отозвана из очереди без штрафа к SLA.`,
      });
    } catch (err: any) {
      logger.error('Error withdrawing buyer application', { meta: { error: err.message, appId } });
      return json(event, 500, { error: 'Не удалось отозвать заявку' });
    }
  }

  // =========================================================================
  // 11. POST /api/matching/run-sla-sweep (Staff Only: Manual SLA Sweep Trigger)
  // =========================================================================
  if ((subPath === '/run-sla-sweep' || subPath === '/sla-sweep') && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Запуск SLA Sweeper разрешен только сотрудникам' });
    }

    const body = parseBody<{ dryRun?: boolean }>(event);
    try {
      const result = await runSlaSweep({ dryRun: Boolean(body?.dryRun) });
      return json(event, 200, result);
    } catch (err: any) {
      logger.error('Error executing manual SLA sweep', { meta: { error: err.message } });
      return json(event, 500, { error: 'Не удалось выполнить проверку SLA', details: err.message });
    }
  }

  return json(event, 404, { error: `Endpoint /api/matching${subPath} не найден` });
}
