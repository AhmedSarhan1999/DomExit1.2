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
import { isEmployeeAssignedToRecord } from '../lib/rbac.js';

async function notifyStaff(text: string): Promise<void> {
  try {
    const ydb = getYdbClient();
    const users = ydb.isV2TablesEnabled()
      ? await Promise.all([
          ydb.queryAllByIndex<UserProfile>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'owner' }),
          ydb.queryAllByIndex<UserProfile>({ tableName: 'users', indexName: 'role-createdAt-index', hashKey: 'role', hashValue: 'employee' }),
        ]).then(([owners, emps]) => [...owners, ...emps])
      : await ydb.scanAll<UserProfile>('users', 200);
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
  const cleanCode = String(lotCode || '').trim();
  if (!cleanCode) return null;
  let lot = await ydb.getItem('lots', cleanCode);
  if (!lot) {
    if (ydb.isV2TablesEnabled?.()) {
      const upperCode = cleanCode.toUpperCase();
      const [exactMatches, upperMatches] = await Promise.all([
        ydb.queryAllByIndex({ tableName: 'lots', indexName: 'lotCode-index', hashKey: 'lotCode', hashValue: cleanCode, limit: 5 }),
        upperCode !== cleanCode
          ? ydb.queryAllByIndex({ tableName: 'lots', indexName: 'lotCode-index', hashKey: 'lotCode', hashValue: upperCode, limit: 5 })
          : Promise.resolve([]),
      ]);
      lot = exactMatches[0] || upperMatches[0] || null;
    } else {
      const allLots = await ydb.scanAll('lots', 500);
      lot = allLots.find(
        (l: any) =>
          String(l.lotCode || '').trim().toUpperCase() === cleanCode.toUpperCase() ||
          String(l.id || '').trim().toUpperCase() === cleanCode.toUpperCase() ||
          String(l.code || '').trim().toUpperCase() === cleanCode.toUpperCase()
      );
    }
  }
  return lot || null;
}

const VERIFICATION_STATUS_SET = new Set(['pending', 'verified', 'needs_clarification']);
const WAITLIST_TARGET_SET = new Set(['reserve_2', 'reserve_3', 'waitlist', 'pending_review']);

async function writeMatchingAuditLog(
  ydb: any,
  authUser: UserProfile,
  params: { lotCode: string; actionType: string; title: string; description: string; metadata?: Record<string, any> }
): Promise<void> {
  try {
    await ydb.putItem('audit_logs', {
      id: `aud-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      lotCode: params.lotCode,
      operatorId: authUser.id,
      performedBy: authUser.id,
      operatorName: authUser.name || authUser.email || 'Куратор DomExit',
      operatorRole: authUser.role === 'owner' ? 'owner' : 'curator',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      userEmail: authUser.email,
      metadata: params.metadata || {},
    });
  } catch (err: any) {
    logger.warn('Failed writing matching audit log', { meta: { error: err.message, lotCode: params.lotCode } });
  }
}

async function syncLotDropSeats(ydb: any, lotCode: string, preloadedApps?: BuyerApplication[]): Promise<any | null> {
  const lot = await findLotByCode(ydb, lotCode);
  if (!lot || !lot.dropConfig) return lot;
  const targetCode = String(lotCode || '').trim().toUpperCase();
  const allApps: BuyerApplication[] =
    preloadedApps ||
    (ydb.isV2TablesEnabled?.()
      ? await ydb.queryAllByIndex({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: targetCode, limit: 200 })
      : ((await ydb.scanAll('buyer_applications', 500)) as BuyerApplication[])) ||
    [];
  const activeCount = allApps.filter(
    (a: BuyerApplication) => String(a.lotCode || '').trim().toUpperCase() === targetCode && isActiveApplication(a)
  ).length;
  const maxCap = Number(lot.dropConfig.maxApplicationsCap || 5);
  lot.dropConfig.currentValidApplications = activeCount;
  if (activeCount >= maxCap && lot.status === 'available') {
    lot.dropConfig.waveStatus = 'capped_closed';
  } else if (activeCount < maxCap && lot.dropConfig.waveStatus === 'capped_closed' && lot.status === 'available') {
    lot.dropConfig.waveStatus = 'silver_wave';
  }
  lot.updatedAt = new Date().toISOString();
  await ydb.putItem('lots', lot);
  memoryCache.invalidate('lots');
  appCache.invalidatePrefix('lots');
  appCache.invalidatePrefix('lot:');
  return lot;
}

async function syncLotAndDealAssignment(
  ydb: any,
  lotCode: string,
  winner: { userId: string; userName?: string } | null
): Promise<void> {
  const now = new Date().toISOString();
  const targetCode = String(lotCode || '').trim().toUpperCase();
  const targetLot = await findLotByCode(ydb, lotCode);

  if (targetLot) {
    if (winner) {
      targetLot.buyerUserId = winner.userId;
      targetLot.buyerName = winner.userName || targetLot.buyerName || 'Покупатель';
      targetLot.status = 'in_deal';
      targetLot.currentStage = 4;
    } else {
      targetLot.buyerUserId = null;
      targetLot.buyerName = null;
      targetLot.status = 'available';
      targetLot.currentStage = 3;
      if (targetLot.dropConfig) {
        const allApps =
          (ydb.isV2TablesEnabled?.()
            ? await ydb.queryAllByIndex({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: targetCode, limit: 200 })
            : ((await ydb.scanAll('buyer_applications', 500)) as BuyerApplication[])) || [];
        const activeCount = allApps.filter(
          (a: BuyerApplication) => String(a.lotCode || '').trim().toUpperCase() === targetCode && isActiveApplication(a)
        ).length;
        const maxCap = Number(targetLot.dropConfig.maxApplicationsCap || 5);
        targetLot.dropConfig.currentValidApplications = activeCount;
        if (targetLot.dropConfig.waveStatus === 'capped_closed' && activeCount < maxCap) {
          targetLot.dropConfig.waveStatus = 'silver_wave';
        }
      }
    }
    targetLot.updatedAt = now;
    await ydb.putItem('lots', targetLot);
    memoryCache.invalidate('lots');
    appCache.invalidatePrefix('lots');
    appCache.invalidatePrefix('lot:');
  }

  let targetDeal: any = null;
  if (ydb.isV2TablesEnabled?.()) {
    const dealCandidates = await Promise.all([
      ydb.queryAllByIndex({ tableName: 'deals', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: targetCode, limit: 10 }),
      targetLot && targetLot.id !== targetCode
        ? ydb.queryAllByIndex({ tableName: 'deals', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: String(targetLot.id), limit: 10 })
        : Promise.resolve([]),
    ]);
    targetDeal = dealCandidates.flat()[0] || null;
  } else {
    const allDeals = ((await ydb.scanAll('deals', 300)) as any[]) || [];
    targetDeal = allDeals.find(
      (d: any) =>
        String(d.lotCode || '').trim().toUpperCase() === targetCode ||
        (targetLot && String(d.lotId || '').trim().toUpperCase() === String(targetLot.id).trim().toUpperCase())
    );
  }
  if (targetDeal) {
    if (winner) {
      targetDeal.buyerUserId = winner.userId;
      targetDeal.buyerName = winner.userName || targetDeal.buyerName || 'Покупатель';
      targetDeal.stage = 'closing_escrow';
      targetDeal.status = 'in_deal';
    } else {
      targetDeal.buyerUserId = null;
      targetDeal.buyerName = null;
      targetDeal.stage = 'buyer_matching';
      targetDeal.status = 'active';
    }
    targetDeal.updatedAt = now;
    await ydb.putItem('deals', targetDeal);
    memoryCache.invalidate('deals');
    appCache.invalidatePrefix('deals');
  }
}

async function unfreezeBuyerOtherApplications(ydb: any, userId: string, excludedAppId?: string): Promise<number> {
  const allApps: BuyerApplication[] =
    (ydb.isV2TablesEnabled?.()
      ? await ydb.queryAllByIndex({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: userId, limit: 100 })
      : ((await ydb.scanAll('buyer_applications', 500)) as BuyerApplication[])) || [];
  const otherWin = allApps.find(
    (a: BuyerApplication) =>
      a.userId === userId && a.id !== excludedAppId && (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
  );
  if (otherWin) return 0;

  const frozen = allApps.filter(
    (a: BuyerApplication) => a.userId === userId && a.id !== excludedAppId && a.queueStatus === 'standby_in_other_deal'
  );
  if (frozen.length === 0) return 0;

  const bb = await getUnifiedBuyBox(ydb, userId);
  const now = new Date().toISOString();
  for (const fa of frozen) {
    fa.queueStatus = 'pending_review';
    fa.activeDealLotCode = undefined;
    if (bb) {
      const otherLot = await findLotByCode(ydb, fa.lotCode);
      if (otherLot) {
        const rescored = computeClosingScore(fa, bb, otherLot);
        fa.closingScore = rescored.closingScore;
        fa.scoreBreakdown = rescored.breakdown;
      }
    }
    fa.updatedAt = now;
    await ydb.putItem('buyer_applications', fa);
  }
  return frozen.length;
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
      const [buyBox, myRawApps] = await Promise.all([
        getUnifiedBuyBox(ydb, authUser.id),
        ydb.isV2TablesEnabled()
          ? ydb.queryAllByIndex<BuyerApplication>({
              tableName: 'buyer_applications',
              indexName: 'userId-createdAt-index',
              hashKey: 'userId',
              hashValue: authUser.id,
              scanIndexForward: false,
            })
          : ydb.scanAll<BuyerApplication>('buyer_applications', 500),
      ]);

      const myApps = (myRawApps || [])
        .filter((a) => a.userId === authUser.id)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

      const lotMap = new Map<string, any>();
      const dealMap = new Map<string, any>();
      if (ydb.isV2TablesEnabled()) {
        const uniqueCodes = Array.from(new Set(myApps.map((a) => String(a.lotCode || '').trim()).filter(Boolean)));
        const [resolvedLots, buyerDeals] = await Promise.all([
          Promise.all(uniqueCodes.map((code) => findLotByCode(ydb, code).catch(() => null))),
          ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'buyerId-createdAt-index', hashKey: 'buyerId', hashValue: authUser.id }),
        ]);
        for (const l of resolvedLots) {
          if (!l) continue;
          if (l.lotCode) lotMap.set(String(l.lotCode).toUpperCase(), l);
          if (l.id) lotMap.set(String(l.id).toUpperCase(), l);
        }
        for (const d of buyerDeals || []) {
          if (d.lotCode) dealMap.set(String(d.lotCode).toUpperCase(), d);
        }
      } else {
        const [allLots, allDeals] = await Promise.all([
          ydb.scanAll<any>('lots', 500),
          ydb.scanAll<any>('deals', 500),
        ]);
        for (const l of allLots || []) {
          if (l.lotCode) lotMap.set(String(l.lotCode).toUpperCase(), l);
          if (l.id) lotMap.set(String(l.id).toUpperCase(), l);
        }
        for (const d of allDeals || []) {
          if (d.lotCode) dealMap.set(String(d.lotCode).toUpperCase(), d);
        }
      }

      const enriched = myApps.map((app) => {
        const codeKey = String(app.lotCode || '').toUpperCase();
        const lot = lotMap.get(codeKey);
        const deal = dealMap.get(codeKey);
        return {
          ...app,
          tier: buyBox?.tier || 'silver',
          reliabilityScore: buyBox?.reliabilityScore ?? 100,
          availableLiquidityRub:
            app.confirmedCashRub ||
            app.availableLiquidityRub ||
            app.offeredPriceRub ||
            buyBox?.availableLiquidityRub ||
            buyBox?.maxBudgetRub ||
            lot?.cashPaidBySeller ||
            0,
          paymentMethod: app.paymentMethod || buyBox?.paymentMethod || 'cash_100',
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

      const [allLots, allMyApps] = ydb.isV2TablesEnabled()
        ? await Promise.all([
            Promise.all(
              ['available', 'in_deal', 'reserved', 'active'].map((st) =>
                ydb.queryAllByIndex<any>({ tableName: 'lots', indexName: 'status-publishedAt-index', hashKey: 'status', hashValue: st, scanIndexForward: false, limit: 200 })
              )
            ).then((chunks) => Array.from(new Map(chunks.flat().map((l: any) => [l.id, l])).values())),
            ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: authUser.id }),
          ])
        : await Promise.all([
            ydb.scanAll<any>('lots', 300),
            ydb.scanAll<BuyerApplication>('buyer_applications', 200),
          ]);
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

    if (!isOwner && !isEmployeeAssignedToRecord(authUser, lot)) {
      return json(event, 403, {
        error: 'Запуск дропа разрешен только владельцу или назначенному куратору',
        code: 'NOT_ASSIGNED_TO_LOT',
      });
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
    const myApps = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<BuyerApplication>({
          tableName: 'buyer_applications',
          indexName: 'userId-createdAt-index',
          hashKey: 'userId',
          hashValue: authUser.id,
        })
      : ((await ydb.scanAll<BuyerApplication>('buyer_applications', 500)) || []).filter((a) => a.userId === authUser.id);
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
    const allSigs = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<any>({ tableName: 'pep_signatures', indexName: 'userId-signedAt-index', hashKey: 'userId', hashValue: authUser.id })
      : await ydb.scanAll<any>('pep_signatures', 200);
    const ndaSig = (allSigs || []).find(
      (s) => s.lotCode === lotCode && s.userId === authUser.id && s.documentType === 'nda_viewing_act' && s.status === 'signed'
    );
    const ndaSigned = Boolean(ndaSig);

    const body = parseBody<{
      priceAcceptance?: PriceAcceptance;
      offeredPriceRub?: number;
      paymentMethod?: BuyBoxPaymentMethod;
      confirmedCashRub?: number;
      buyerComment?: string;
      proofDocuments?: Array<{
        name?: string;
        objectKey?: string;
        mimeType?: string;
        size?: number;
        uploadedAt?: string;
      }>;
      readiness24h?: boolean;
      deposit48h?: boolean;
      source?: 'web' | 'telegram';
    }>(event) || {};

    const validPaymentMethods = new Set<BuyBoxPaymentMethod>([
      'cash_100',
      'family_mortgage_approved',
      'standard_mortgage_approved',
      'alternative',
    ]);
    const submittedPaymentMethod: BuyBoxPaymentMethod =
      body.paymentMethod && validPaymentMethods.has(body.paymentMethod)
        ? body.paymentMethod
        : buyBox.paymentMethod || 'cash_100';

    const resolvedConfirmedCash =
      typeof body.confirmedCashRub === 'number' && Number.isFinite(body.confirmedCashRub) && body.confirmedCashRub > 0
        ? Math.round(body.confirmedCashRub)
        : Number(buyBox.availableLiquidityRub || lot.cashPaidBySeller || 0);

    const sanitizedProofDocs = Array.isArray(body.proofDocuments)
      ? body.proofDocuments
          .slice(0, 3)
          .filter(
            (d) =>
              d &&
              typeof d.objectKey === 'string' &&
              d.objectKey.trim().length > 0 &&
              !d.objectKey.startsWith('data:') &&
              !d.objectKey.startsWith('http')
          )
          .map((d) => ({
            name: String(d.name || 'Документ_идентификации.pdf').trim().slice(0, 180),
            objectKey: String(d.objectKey).trim(),
            mimeType: String(d.mimeType || 'application/pdf').trim().slice(0, 120),
            size: Math.max(0, Number(d.size || 0)),
            uploadedAt: String(d.uploadedAt || now.toISOString()),
          }))
      : [];

    const effectiveBuyBoxForScore: BuyerBuyBox = {
      ...buyBox,
      paymentMethod: submittedPaymentMethod,
      availableLiquidityRub: resolvedConfirmedCash || buyBox.availableLiquidityRub,
    };

    const matchRes = computeMatchScore(lot, effectiveBuyBoxForScore);
    const closingRes = computeClosingScore(
      {
        priceAcceptance: body.priceAcceptance,
        readiness24h: body.readiness24h,
        deposit48h: body.deposit48h,
      },
      effectiveBuyBoxForScore,
      lot
    );

    const freshUserRecord = await ydb.getItem<UserProfile>('users', authUser.id).catch(() => null);
    const resolvedTelegram =
      (freshUserRecord as any)?.telegram ||
      (freshUserRecord as any)?.telegramUsername ||
      (authUser as any)?.telegram ||
      authUser.telegramUsername ||
      '';
    const resolvedPhone = freshUserRecord?.phone || authUser.phone || '';
    const resolvedEmail = freshUserRecord?.email || authUser.email || '';

    const appId = `app:${lotCode}:${authUser.id}`;
    const newApp: BuyerApplication = {
      id: appId,
      lotCode,
      userId: authUser.id,
      userEmail: resolvedEmail,
      userName: freshUserRecord?.name || authUser.name,
      userPhone: resolvedPhone,
      buyerEmail: resolvedEmail,
      buyerPhone: resolvedPhone,
      buyerTelegram: resolvedTelegram,
      telegramUsername: resolvedTelegram,
      telegramChatId: (freshUserRecord as any)?.telegramChatId || (authUser as any)?.telegramChatId || undefined,
      buyBoxId: buyBox.id,
      status: 'active',
      tier: buyBox.tier,
      reliabilityScore: buyBox.reliabilityScore ?? 100,
      paymentMethod: submittedPaymentMethod,
      confirmedCashRub: resolvedConfirmedCash,
      availableLiquidityRub: resolvedConfirmedCash,
      buyerComment: (body.buyerComment || '').trim().slice(0, 1000) || undefined,
      proofDocuments: sanitizedProofDocs,
      curatorVerificationStatus: 'pending',
      curatorVerificationNote: '',
      rejectionReason: '',
      closingScore: closingRes.closingScore,
      matchScore: matchRes.score,
      scoreBreakdown: closingRes.breakdown,
      queueStatus: activeWinElsewhere ? 'standby_in_other_deal' : 'pending_review',
      activeDealLotCode: activeWinElsewhere ? activeWinElsewhere.lotCode : undefined,
      priceAcceptance: body.priceAcceptance || 'full_price',
      offeredPriceRub: body.offeredPriceRub || resolvedConfirmedCash || undefined,
      readiness24h: Boolean(body.readiness24h),
      deposit48h: Boolean(body.deposit48h),
      ndaSigned,
      source: body.source || 'web',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await ydb.putItem('buyer_applications', newApp);

    // Sync active seat counter accurately on lot
    const updatedLot = await syncLotDropSeats(ydb, lotCode);

    await recordJournalEvent({
      action: 'CREATE',
      collection: 'buyer_applications',
      recordId: appId,
      actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
      payload: newApp,
    });

    // Notify staff on Telegram
    const text =
      `📥 <b>НОВАЯ ЗАЯВКА В ТАКТОВЫЙ ДРОП: #${escapeHtml(lotCode)}</b>\n` +
      `Покупатель: <b>${escapeHtml(newApp.userName || resolvedEmail)}</b> (Ранг: <b>${buyBox.tier.toUpperCase()}</b> • SLA: <b>${buyBox.reliabilityScore ?? 100}%</b>)\n` +
      `Closing Score: <b>${closingRes.closingScore}/105</b> (Match: ${matchRes.score}%)\n` +
      `Оплата: <b>${escapeHtml(submittedPaymentMethod)}</b> • Кэш: <b>${resolvedConfirmedCash.toLocaleString('ru-RU')} ₽</b>\n` +
      `Документов прикреплено: <b>${sanitizedProofDocs.length}</b> • Готовность: 24ч=${body.readiness24h ? 'Да' : 'Нет'}, Депозит 48ч=${body.deposit48h ? 'Да' : 'Нет'}` +
      (newApp.buyerComment ? `\nКомментарий: <i>${escapeHtml(newApp.buyerComment.slice(0, 220))}</i>` : '');

    await notifyStaff(text).catch((err: any) =>
      logger.warn('Failed to notify staff about queue application', { meta: { error: err.message } })
    );

    return json(event, 200, {
      ok: true,
      application: newApp,
      waveStatus: updatedLot?.dropConfig?.waveStatus || dropConfig?.waveStatus || 'open',
      currentValidApplications: updatedLot?.dropConfig?.currentValidApplications ?? dropConfig?.currentValidApplications ?? 1,
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

    const lotCode = decodeURIComponent(queueMatch[1]);
    try {
      const targetLot = await findLotByCode(ydb, lotCode);
      if (targetLot && !isEmployeeAssignedToRecord(authUser, targetLot)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этого объекта',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      const upperLotCode = lotCode.toUpperCase();
      let lotAllApps: BuyerApplication[] = [];
      let allUsers: UserProfile[] = [];
      let allTierReqs: any[] = [];
      let allPepSigs: any[] = [];

      if (ydb.isV2TablesEnabled()) {
        const [appsByLot, pepByLot] = await Promise.all([
          ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: upperLotCode, scanIndexForward: false }),
          ydb.queryAllByIndex<any>({ tableName: 'pep_signatures', indexName: 'dealId-signedAt-index', hashKey: 'dealId', hashValue: upperLotCode, scanIndexForward: false }),
        ]);
        lotAllApps = appsByLot;
        allPepSigs = pepByLot;
        const applicantIds = Array.from(new Set(lotAllApps.map((a) => a.userId).filter(Boolean)));
        const [fetchedUsers, fetchedTiers] = await Promise.all([
          Promise.all(applicantIds.map((uid) => ydb.getItem<UserProfile>('users', uid).catch(() => null))),
          Promise.all(
            applicantIds.map((uid) =>
              ydb.queryAllByIndex<any>({ tableName: 'tier_verification_requests', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: uid, limit: 10 }).catch(() => [])
            )
          ),
        ]);
        allUsers = fetchedUsers.filter((u): u is UserProfile => Boolean(u));
        allTierReqs = fetchedTiers.flat();
      } else {
        const [allAppsRaw, allUsersRaw, allTierReqsRaw, allPepSigsRaw] = await Promise.all([
          ydb.scanAll<BuyerApplication>('buyer_applications', 500),
          ydb.scanAll<UserProfile>('users', 300),
          ydb.scanAll<any>('tier_verification_requests', 200),
          ydb.scanAll<any>('pep_signatures', 300),
        ]);
        lotAllApps = (allAppsRaw || []).filter(
          (a) => String(a.lotCode || '').trim().toUpperCase() === upperLotCode
        );
        allUsers = allUsersRaw || [];
        allTierReqs = allTierReqsRaw || [];
        allPepSigs = allPepSigsRaw || [];
      }

      // Resolve LIVE Buy-Box for every unique applicant on this lot to avoid stale SLA/Tier mismatches
      const uniqueUserIds = Array.from(new Set(lotAllApps.map((a) => a.userId).filter(Boolean)));
      const liveBuyBoxes = new Map<string, BuyerBuyBox | null>();
      await Promise.all(
        uniqueUserIds.map(async (uid) => {
          const bb = await getUnifiedBuyBox(ydb, uid).catch(() => null);
          liveBuyBoxes.set(uid, bb);
        })
      );

      const userMap = new Map<string, UserProfile>();
      for (const u of allUsers || []) {
        if (u.id) userMap.set(u.id, u);
      }

      const appCountByUser = new Map<string, number>();
      if (ydb.isV2TablesEnabled()) {
        await Promise.all(
          uniqueUserIds.map(async (uid) => {
            const uApps = await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: uid, limit: 50 }).catch(() => []);
            appCountByUser.set(uid, uApps.length);
          })
        );
      } else {
        for (const a of lotAllApps || []) {
          if (a.userId) appCountByUser.set(a.userId, (appCountByUser.get(a.userId) || 0) + 1);
        }
      }

      const enrichApp = (a: BuyerApplication) => {
        const bb = liveBuyBoxes.get(a.userId);
        const u = userMap.get(a.userId);
        const approvedGoldReq = (allTierReqs || []).find(
          (tr: any) => tr.userId === a.userId && tr.status === 'approved'
        );
        const userLotSigs = (allPepSigs || []).filter(
          (s: any) =>
            String(s.lotCode || '').toUpperCase() === upperLotCode &&
            s.userId === a.userId &&
            s.status === 'signed'
        );
        const ndaSignedLive = Boolean(a.ndaSigned || userLotSigs.some((s: any) => s.documentType === 'nda_viewing_act'));
        const offerSignedLive = userLotSigs.some((s: any) => s.documentType === 'buyer_reservation_terms');

        return {
          ...a,
          userName: a.userName || u?.name || 'Покупатель',
          userEmail: a.userEmail || u?.email || '',
          userPhone: a.userPhone || u?.phone || '',
          buyerEmail: a.buyerEmail || a.userEmail || u?.email || '',
          buyerPhone: a.buyerPhone || a.userPhone || u?.phone || '',
          buyerTelegram:
            a.buyerTelegram ||
            a.telegramUsername ||
            (u as any)?.telegram ||
            (u as any)?.telegramUsername ||
            '',
          paymentMethod: a.paymentMethod || bb?.paymentMethod || 'cash_100',
          confirmedCashRub: a.confirmedCashRub || a.availableLiquidityRub || a.offeredPriceRub || bb?.availableLiquidityRub || 0,
          tier: bb?.tier || (u as any)?.buyerTier || 'silver',
          reliabilityScore: bb?.reliabilityScore ?? (u as any)?.reliabilityScore ?? 100,
          noShowCount: bb?.noShowCount ?? 0,
          completedViewingsCount: bb?.completedViewingsCount ?? 0,
          buyBoxSummary: bb
            ? {
                maxBudgetRub: bb.maxBudgetRub,
                availableLiquidityRub: bb.availableLiquidityRub,
                paymentMethod: bb.paymentMethod,
                cities: bb.cities || [],
                preferredBanks: bb.preferredBanks || [],
                goal: bb.goal,
              }
            : null,
          totalPlatformAppsCount: appCountByUser.get(a.userId) || 1,
          goldVerification: approvedGoldReq
            ? {
                requestId: approvedGoldReq.id,
                proofType: approvedGoldReq.proofType,
                declaredBudgetRub: approvedGoldReq.declaredBudgetRub,
                documentName: approvedGoldReq.documentName,
                reviewedAt: approvedGoldReq.reviewedAt,
              }
            : null,
          ndaSigned: ndaSignedLive,
          offerSigned: offerSignedLive,
        };
      };

      const activeApps = lotAllApps.filter((a) => !ARCHIVED_APPLICATION_STATUSES.has(String(a.queueStatus || '')));
      const archivedApps = lotAllApps.filter((a) => ARCHIVED_APPLICATION_STATUSES.has(String(a.queueStatus || '')));

      const rankedRaw = rankApplications(activeApps.map(enrichApp));
      const statusPriority = (qs?: string) => {
        if (qs === 'priority_1' || qs === 'in_deal') return 0;
        if (qs === 'reserve_2') return 1;
        if (qs === 'reserve_3') return 2;
        if (qs === 'waitlist') return 3;
        if (qs === 'pending_review') return 4;
        if (qs === 'standby_in_other_deal') return 5;
        return 6;
      };
      const ranked = [...rankedRaw]
        .sort((a, b) => {
          const pd = statusPriority(a.queueStatus) - statusPriority(b.queueStatus);
          if (pd !== 0) return pd;
          return (b.closingScore || 0) - (a.closingScore || 0);
        })
        .map((item, idx) => ({ ...item, queuePosition: idx + 1 }));

      const archivedQueue = archivedApps
        .map(enrichApp)
        .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

      return json(event, 200, {
        ok: true,
        lotCode,
        totalApplications: ranked.length,
        activeApplicationsCount: ranked.length,
        archivedCount: archivedQueue.length,
        queue: ranked,
        archivedQueue,
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
    const lotForCheck = await findLotByCode(ydb, lotCode);
    if (!isEmployeeAssignedToRecord(authUser, lotForCheck)) {
      return json(event, 403, {
        error: 'Вы не назначены куратором этого объекта',
        code: 'NOT_ASSIGNED_TO_LOT',
      });
    }
    const body = parseBody<{
      priority1AppId?: string;
      priority1UserId?: string;
      reserve2AppId?: string;
      reserve2UserId?: string;
      reserve3AppId?: string;
      reserve3UserId?: string;
    }>(event) || {};

    try {
      const upperLotCode = lotCode.toUpperCase();
      const lotAppsRaw = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: upperLotCode })
        : ((await ydb.scanAll<BuyerApplication>('buyer_applications', 200)) || []).filter((a) => a.lotCode === lotCode);
      const lotApps = lotAppsRaw.filter((a) => String(a.lotCode || '').trim().toUpperCase() === upperLotCode);

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
      const winnerAllApps = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: candidateP1.userId })
        : lotAppsRaw;
      const otherActiveWin = (winnerAllApps || []).find(
        (a) =>
          a.userId === candidateP1.userId &&
          String(a.lotCode || '').toUpperCase() !== upperLotCode &&
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
        const otherAppsToFreeze = (winnerAllApps || []).filter(
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
          await syncLotAndDealAssignment(ydb, lotCode, {
            userId: priority1App.userId,
            userName: priority1App.userName,
          });
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
    const lotForCheck = await findLotByCode(ydb, lotCode);
    if (!isEmployeeAssignedToRecord(authUser, lotForCheck)) {
      return json(event, 403, {
        error: 'Вы не назначены куратором этого объекта',
        code: 'NOT_ASSIGNED_TO_LOT',
      });
    }
    const body = parseBody<{
      previousPriority1AppId?: string;
      reason?: 'no_show' | 'passed' | 'timeout' | 'rejected';
    }>(event) || {};

    const reason = body.reason || 'passed';

    try {
      const upperLotCode = lotCode.toUpperCase();
      const lotApps = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: upperLotCode })
        : ((await ydb.scanAll<BuyerApplication>('buyer_applications', 200)) || []).filter((a) => a.lotCode === lotCode);

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
        await unfreezeBuyerOtherApplications(ydb, prevP1.userId, prevP1.id);
      }

      const reserveUserIds = Array.from(
        new Set(lotApps.filter((a) => a.queueStatus === 'reserve_2' || a.queueStatus === 'reserve_3').map((a) => a.userId).filter(Boolean))
      );
      const userAppsMap = new Map<string, BuyerApplication[]>();
      if (ydb.isV2TablesEnabled()) {
        await Promise.all(
          reserveUserIds.map(async (uid) => {
            const uApps = await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: uid });
            userAppsMap.set(uid, uApps);
          })
        );
      }

      // Find eligible Reserve #2 (skipping buyers busy in another active deal)
      const isBusyElsewhere = (cand: BuyerApplication) => {
        if (cand.queueStatus === 'standby_in_other_deal') return true;
        const pool = ydb.isV2TablesEnabled() ? (userAppsMap.get(cand.userId) || []) : lotApps;
        return pool.some(
          (a) =>
            a.userId === cand.userId &&
            String(a.lotCode || '').toUpperCase() !== upperLotCode &&
            (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
        );
      };

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
        const reserve2Pool = ydb.isV2TablesEnabled()
          ? (userAppsMap.get(reserve2.userId) ||
            (await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: reserve2.userId })))
          : lotApps;
        const otherAppsToFreeze = reserve2Pool.filter(
          (a) =>
            a.userId === reserve2.userId &&
            String(a.lotCode || '').toUpperCase() !== upperLotCode &&
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
        await syncLotAndDealAssignment(
          ydb,
          lotCode,
          reserve2 ? { userId: reserve2.userId, userName: reserve2.userName } : null
        );
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
          let linkedDeal: any = null;
          if (ydb.isV2TablesEnabled()) {
            const lotCodeUpper = String(app.lotCode || '').trim().toUpperCase();
            const lotObj = lotCodeUpper ? await findLotByCode(ydb, lotCodeUpper) : null;
            const candidates = await Promise.all([
              ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'buyerId-createdAt-index', hashKey: 'buyerId', hashValue: app.userId }),
              lotObj?.id
                ? ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: String(lotObj.id) })
                : Promise.resolve([]),
            ]);
            linkedDeal = candidates
              .flat()
              .find((d: any) => String(d.lotCode || '').toUpperCase() === lotCodeUpper);
          } else {
            const allDeals = await ydb.scanAll<any>('deals', 300);
            linkedDeal = (allDeals || []).find(
              (d: any) => String(d.lotCode || '').toUpperCase() === String(app.lotCode || '').toUpperCase()
            );
          }
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
        const allUserApps = ydb.isV2TablesEnabled()
          ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: app.userId })
          : (await ydb.scanAll<BuyerApplication>('buyer_applications', 500)) || [];
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
  // 10c. PATCH /api/matching/applications/:id/verify (Staff: Verify Proof & Request)
  // =========================================================================
  const verifyAppMatch = subPath.match(/^\/applications\/([^/]+)\/verify$/);
  if (verifyAppMatch && method === 'PATCH') {
    if (!isStaff) {
      return json(event, 403, { error: 'Проверка заявок разрешена только сотрудникам платформы' });
    }
    const appId = decodeURIComponent(verifyAppMatch[1]);
    const body = parseBody<{
      curatorVerificationStatus?: 'pending' | 'verified' | 'needs_clarification';
      curatorVerificationNote?: string;
    }>(event) || {};

    const nextStatus = String(body.curatorVerificationStatus || '').trim();
    if (!VERIFICATION_STATUS_SET.has(nextStatus)) {
      return json(event, 400, {
        error: 'Укажите корректный статус проверки (verified, needs_clarification или pending)',
      });
    }

    try {
      const app = await ydb.getItem<BuyerApplication>('buyer_applications', appId);
      if (!app) return json(event, 404, { error: 'Заявка не найдена' });

      const lotForCheck = await findLotByCode(ydb, app.lotCode);
      if (lotForCheck && !isEmployeeAssignedToRecord(authUser, lotForCheck)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этого объекта',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      const now = new Date().toISOString();
      const note = String(body.curatorVerificationNote || '').trim().slice(0, 1000);
      app.curatorVerificationStatus = nextStatus as any;
      app.curatorVerificationNote = note;
      app.curatorVerifiedAt = nextStatus === 'verified' ? now : undefined;
      app.curatorVerifiedBy = authUser.email || authUser.name || authUser.id;
      app.updatedAt = now;
      await ydb.putItem('buyer_applications', app);

      await writeMatchingAuditLog(ydb, authUser, {
        lotCode: app.lotCode,
        actionType: 'buyer_application_verified',
        title: `Проверка заявки #${app.lotCode} (${app.userName || app.userId}): ${nextStatus}`,
        description: note || `Статус проверки изменён на «${nextStatus}»`,
        metadata: { appId: app.id, buyerId: app.userId, verificationStatus: nextStatus },
      });

      const tgMsg =
        nextStatus === 'verified'
          ? `✅ <b>Заявка и документы проверены куратором</b>\nЛот: <b>#${escapeHtml(app.lotCode)}</b>\nКуратор подтвердил ваши документы и условия сделки.` +
            (note ? `\nКомментарий: <i>${escapeHtml(note)}</i>` : '')
          : nextStatus === 'needs_clarification'
          ? `📝 <b>Куратор запросил уточнение по заявке #${escapeHtml(app.lotCode)}</b>\n` +
            (note ? `Комментарий куратора: <i>${escapeHtml(note)}</i>` : 'Свяжитесь с куратором в личном кабинете.')
          : `🔄 <b>Статус проверки заявки #${escapeHtml(app.lotCode)} обновлен на «На проверке»</b>`;
      await notifyUserTelegram(app.userId, tgMsg);

      return json(event, 200, { ok: true, application: app });
    } catch (err: any) {
      logger.error('Error verifying application', { meta: { error: err.message, appId } });
      return json(event, 500, { error: 'Не удалось обновить статус проверки заявки' });
    }
  }

  // =========================================================================
  // 10d. POST /api/matching/applications/:id/select-winner (Staff: Individual Winner)
  // =========================================================================
  const selectWinnerMatch = subPath.match(/^\/applications\/([^/]+)\/select-winner$/);
  if (selectWinnerMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Выбор победителя разрешен только сотрудникам платформы' });
    }
    const appId = decodeURIComponent(selectWinnerMatch[1]);
    const body = parseBody<{ replaceExistingWinner?: boolean }>(event) || {};

    try {
      const app = await ydb.getItem<BuyerApplication>('buyer_applications', appId);
      if (!app) return json(event, 404, { error: 'Заявка не найдена' });

      const lotCode = app.lotCode;
      const lotForCheck = await findLotByCode(ydb, lotCode);
      if (lotForCheck && !isEmployeeAssignedToRecord(authUser, lotForCheck)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этого объекта',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      if (ARCHIVED_APPLICATION_STATUSES.has(String(app.queueStatus || ''))) {
        return json(event, 400, { error: 'Нельзя выбрать победителем архивную или отклонённую заявку' });
      }

      const upperCode = String(lotCode).trim().toUpperCase();
      const [userApps, lotApps] = ydb.isV2TablesEnabled()
        ? await Promise.all([
            ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: app.userId }),
            ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: upperCode }),
          ])
        : await Promise.all([
            ydb.scanAll<BuyerApplication>('buyer_applications', 500).then((xs) => xs || []),
            Promise.resolve([] as BuyerApplication[]),
          ]);

      const otherActiveWin = userApps.find(
        (a) =>
          a.userId === app.userId &&
          String(a.lotCode || '').trim().toUpperCase() !== upperCode &&
          (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
      );
      if (app.queueStatus === 'standby_in_other_deal' || otherActiveWin) {
        const conflictCode = app.activeDealLotCode || otherActiveWin?.lotCode || 'другом лоте';
        return json(event, 400, {
          code: 'BUYER_IN_ACTIVE_DEAL',
          error: `Нельзя назначить победителем: покупатель уже участвует в активной сделке (#${conflictCode}).`,
          activeDealLotCode: conflictCode,
        });
      }

      const existingLotPool = ydb.isV2TablesEnabled() ? lotApps : userApps;
      const existingLotWinner = existingLotPool.find(
        (a) =>
          a.id !== app.id &&
          String(a.lotCode || '').trim().toUpperCase() === upperCode &&
          (a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal')
      );
      if (existingLotWinner && !body.replaceExistingWinner) {
        return json(event, 409, {
          code: 'WINNER_ALREADY_EXISTS',
          error: `По лоту #${lotCode} уже зафиксирован активный победитель (${existingLotWinner.userName || existingLotWinner.userId}). Сначала переведите его в резерв/отклоните или подтвердите замену.`,
          existingWinnerAppId: existingLotWinner.id,
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const viewingDeadlineAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
      const depositDeadlineAt = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();

      if (existingLotWinner && body.replaceExistingWinner) {
        existingLotWinner.queueStatus = 'waitlist';
        existingLotWinner.updatedAt = nowIso;
        await ydb.putItem('buyer_applications', existingLotWinner);
        await unfreezeBuyerOtherApplications(ydb, existingLotWinner.userId, existingLotWinner.id);
      }

      // IMPORTANT: Do NOT auto-reject remaining applicants in queue!
      app.queueStatus = 'priority_1';
      app.queuePosition = 1;
      app.activeDealLotCode = undefined;
      app.viewingDeadlineAt = viewingDeadlineAt;
      app.depositDeadlineAt = depositDeadlineAt;
      app.updatedAt = nowIso;
      await ydb.putItem('buyer_applications', app);

      // Freeze winning buyer's applications on OTHER lots
      let frozenAppsCount = 0;
      const otherAppsToFreeze = userApps.filter(
        (a) =>
          a.userId === app.userId &&
          String(a.lotCode || '').trim().toUpperCase() !== upperCode &&
          isActiveApplication(a) &&
          a.queueStatus !== 'priority_1' &&
          a.queueStatus !== 'in_deal'
      );
      for (const oa of otherAppsToFreeze) {
        oa.queueStatus = 'standby_in_other_deal';
        oa.activeDealLotCode = lotCode;
        oa.updatedAt = nowIso;
        await ydb.putItem('buyer_applications', oa);
        frozenAppsCount++;
      }

      await syncLotAndDealAssignment(ydb, lotCode, {
        userId: app.userId,
        userName: app.userName,
      });

      await writeMatchingAuditLog(ydb, authUser, {
        lotCode,
        actionType: 'buyer_winner_selected',
        title: `Выбран Победитель №1 по лоту #${lotCode}: ${app.userName || app.userId}`,
        description: `Покупатель переведен в приоритет №1 (дедлайны 24ч/48ч), сделка в closing_escrow. Остальные кандидаты сохранены в очереди.`,
        metadata: { appId: app.id, buyerId: app.userId, frozenAppsCount },
      });

      await notifyUserTelegram(
        app.userId,
        `👑 <b>Поздравляем! Вы выбраны Победителем №1 по лоту #${escapeHtml(lotCode)}!</b>\n` +
          `• Срок подтверждения просмотра: <b>24 часа</b>\n` +
          `• Срок обеспечения/депозита: <b>48 часов</b>\n` +
          `Откройте «Личный кабинет → Я покупатель» на платформе DomExit для подписания ПЭП (63-ФЗ) и связи с куратором.`
      );

      return json(event, 200, {
        ok: true,
        lotCode,
        application: app,
        frozenAppsCount,
        viewingDeadlineAt,
        depositDeadlineAt,
      });
    } catch (err: any) {
      logger.error('Error selecting individual winner', { meta: { error: err.message, appId } });
      return json(event, 500, { error: 'Не удалось назначить победителя' });
    }
  }

  // =========================================================================
  // 10e. POST /api/matching/applications/:id/set-waitlist (Staff: Waitlist / Reserve)
  // =========================================================================
  const setWaitlistMatch = subPath.match(/^\/applications\/([^/]+)\/set-waitlist$/);
  if (setWaitlistMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Управление списком ожидания разрешено только сотрудникам платформы' });
    }
    const appId = decodeURIComponent(setWaitlistMatch[1]);
    const body = parseBody<{
      targetStatus?: 'reserve_2' | 'reserve_3' | 'waitlist' | 'pending_review';
      note?: string;
    }>(event) || {};

    const targetStatus = String(body.targetStatus || 'waitlist').trim();
    if (!WAITLIST_TARGET_SET.has(targetStatus)) {
      return json(event, 400, {
        error: 'Допустимые статусы: reserve_2, reserve_3, waitlist, pending_review',
      });
    }

    try {
      const app = await ydb.getItem<BuyerApplication>('buyer_applications', appId);
      if (!app) return json(event, 404, { error: 'Заявка не найдена' });

      const lotForCheck = await findLotByCode(ydb, app.lotCode);
      if (lotForCheck && !isEmployeeAssignedToRecord(authUser, lotForCheck)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этого объекта',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      if (ARCHIVED_APPLICATION_STATUSES.has(String(app.queueStatus || ''))) {
        return json(event, 400, { error: 'Нельзя перевести в резерв уже закрытую или отклонённую заявку' });
      }
      if (app.queueStatus === 'standby_in_other_deal') {
        return json(event, 400, {
          code: 'BUYER_IN_ACTIVE_DEAL',
          error: 'Покупатель сейчас закреплён в другой активной сделке',
        });
      }

      const wasWinner = app.queueStatus === 'priority_1' || app.queueStatus === 'in_deal';
      const nowIso = new Date().toISOString();
      app.queueStatus = targetStatus as QueueStatus;
      if (targetStatus === 'reserve_2') app.queuePosition = 2;
      else if (targetStatus === 'reserve_3') app.queuePosition = 3;
      app.viewingDeadlineAt = undefined;
      app.depositDeadlineAt = undefined;
      if (body.note) {
        app.curatorVerificationNote = String(body.note).trim().slice(0, 1000);
      }
      app.updatedAt = nowIso;
      await ydb.putItem('buyer_applications', app);

      if (wasWinner) {
        await syncLotAndDealAssignment(ydb, app.lotCode, null);
        await unfreezeBuyerOtherApplications(ydb, app.userId, app.id);
      } else {
        await syncLotDropSeats(ydb, app.lotCode);
      }

      const STATUS_LABEL_RU: Record<string, string> = {
        reserve_2: 'Резерв №2 (приоритетный лист ожидания)',
        reserve_3: 'Резерв №3 (приоритетный лист ожидания)',
        waitlist: 'Лист ожидания',
        pending_review: 'На рассмотрении куратора',
      };

      await writeMatchingAuditLog(ydb, authUser, {
        lotCode: app.lotCode,
        actionType: 'buyer_waitlist_updated',
        title: `Заявка #${app.lotCode} (${app.userName || app.userId}): ${STATUS_LABEL_RU[targetStatus]}`,
        description: body.note || `Статус в очереди изменён на «${STATUS_LABEL_RU[targetStatus]}»`,
        metadata: { appId: app.id, buyerId: app.userId, targetStatus, wasWinner },
      });

      await notifyUserTelegram(
        app.userId,
        `⏳ <b>Обновление статуса в очереди: лот #${escapeHtml(app.lotCode)}</b>\n` +
          `Ваша заявка переведена в статус: <b>${escapeHtml(STATUS_LABEL_RU[targetStatus])}</b>.\n` +
          `Если текущая бронь по лоту освободится, куратор передаст сделку по очереди.`
      );

      return json(event, 200, { ok: true, application: app, wasWinner });
    } catch (err: any) {
      logger.error('Error setting waitlist status', { meta: { error: err.message, appId } });
      return json(event, 500, { error: 'Не удалось обновить позицию в списке ожидания' });
    }
  }

  // =========================================================================
  // 10f. POST /api/matching/applications/:id/reject (Staff: Reject Single Applicant)
  // =========================================================================
  const rejectAppMatch = subPath.match(/^\/applications\/([^/]+)\/reject$/);
  if (rejectAppMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Отклонение заявок разрешено только сотрудникам платформы' });
    }
    const appId = decodeURIComponent(rejectAppMatch[1]);
    const body = parseBody<{ rejectionReason?: string }>(event) || {};
    const rejectionReason = String(body.rejectionReason || '').trim().slice(0, 500);

    if (rejectionReason.length < 3) {
      return json(event, 400, {
        error: 'Укажите обязательную причину отклонения заявки (минимум 3 символа)',
      });
    }

    try {
      const app = await ydb.getItem<BuyerApplication>('buyer_applications', appId);
      if (!app) return json(event, 404, { error: 'Заявка не найдена' });

      const lotForCheck = await findLotByCode(ydb, app.lotCode);
      if (lotForCheck && !isEmployeeAssignedToRecord(authUser, lotForCheck)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этого объекта',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      if (String(app.queueStatus || '') === 'rejected') {
        return json(event, 400, { error: 'Эта заявка уже была отклонена ранее' });
      }

      const wasWinner = app.queueStatus === 'priority_1' || app.queueStatus === 'in_deal';
      const nowIso = new Date().toISOString();

      app.queueStatus = 'rejected';
      app.status = 'rejected';
      app.rejectionReason = rejectionReason;
      app.rejectedAt = nowIso;
      app.rejectedBy = authUser.email || authUser.name || authUser.id;
      app.viewingDeadlineAt = undefined;
      app.depositDeadlineAt = undefined;
      app.updatedAt = nowIso;
      await ydb.putItem('buyer_applications', app);

      let unfrozenCount = 0;
      if (wasWinner) {
        await syncLotAndDealAssignment(ydb, app.lotCode, null);
        unfrozenCount = await unfreezeBuyerOtherApplications(ydb, app.userId, app.id);
      }

      // Sync active seats counter & potentially reopen capped_closed -> silver_wave
      const updatedLot = await syncLotDropSeats(ydb, app.lotCode);

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'buyer_applications',
        recordId: app.id,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: { queueStatus: 'rejected', rejectionReason, wasWinner, unfrozenCount },
      });

      await writeMatchingAuditLog(ydb, authUser, {
        lotCode: app.lotCode,
        actionType: 'buyer_application_rejected',
        title: `Отклонена заявка #${app.lotCode} (${app.userName || app.userId})`,
        description: `Причина: ${rejectionReason}. Слот клиента освобожден.`,
        metadata: { appId: app.id, buyerId: app.userId, rejectionReason, wasWinner, unfrozenCount },
      });

      await notifyUserTelegram(
        app.userId,
        `❌ <b>Заявка по лоту #${escapeHtml(app.lotCode)} отклонена</b>\n` +
          `Причина: <i>${escapeHtml(rejectionReason)}</i>\n` +
          `Ваша квота активных заявок (слот из 3) автоматически освобождена.`
      );

      return json(event, 200, {
        ok: true,
        application: app,
        wasWinner,
        unfrozenCount,
        currentValidApplications: updatedLot?.dropConfig?.currentValidApplications ?? 0,
        waveStatus: updatedLot?.dropConfig?.waveStatus || 'silver_wave',
      });
    } catch (err: any) {
      logger.error('Error rejecting buyer application', { meta: { error: err.message, appId } });
      return json(event, 500, { error: 'Не удалось отклонить заявку' });
    }
  }

  // =========================================================================
  // 11. POST /api/matching/run-sla-sweep (Staff Only: Manual SLA Sweep Trigger)
  // =========================================================================
  if ((subPath === '/run-sla-sweep' || subPath === '/sla-sweep') && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Запуск SLA Sweeper разрешен только сотрудникам' });
    }

    const body = parseBody<{ dryRun?: boolean; forceDailyTasks?: boolean }>(event);
    try {
      const result = await runSlaSweep({
        dryRun: Boolean(body?.dryRun),
        forceDailyTasks: Boolean(body?.forceDailyTasks),
      });
      return json(event, 200, result);
    } catch (err: any) {
      logger.error('Error executing manual SLA sweep', { meta: { error: err.message } });
      return json(event, 500, { error: 'Не удалось выполнить проверку SLA', details: err.message });
    }
  }

  // =========================================================================
  // 12. POST /api/matching/deals/:dealId/finalize (Atomic Deal Closure & Archive Sync)
  // =========================================================================
  const finalizeMatch = subPath.match(/^\/deals\/([^/]+)\/finalize$/);
  if (finalizeMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Завершение сделки доступно только сотрудникам DomExit' });
    }

    const dealId = decodeURIComponent(finalizeMatch[1]);
    const body = parseBody<{ bankOfficerName?: string }>(event);
    const nowIso = new Date().toISOString();
    const bankOfficerName = body?.bankOfficerName || authUser.name || authUser.email || 'Куратор DomExit';

    try {
      let deal = await ydb.getItem<any>('deals', dealId).catch(() => null);
      if (!deal) {
        const allDeals = await ydb.scanAll<any>('deals', 500);
        deal = (allDeals || []).find(
          (d: any) => d.id === dealId || d.dealId === dealId
        );
      }
      if (!deal) {
        return json(event, 404, { error: `Сделка ${dealId} не найдена` });
      }

      const targetLotCode = String(deal.lotCode || '').trim();
      const targetLotId = String(deal.lotId || '').trim();
      const lot =
        (targetLotId ? await ydb.getItem<any>('lots', targetLotId).catch(() => null) : null) ||
        (targetLotCode ? await findLotByCode(ydb, targetLotCode) : null);

      if (!isEmployeeAssignedToRecord(authUser, lot || deal)) {
        return json(event, 403, {
          error: 'Вы не назначены куратором этой сделки',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }

      // 1. Update Deal
      deal.escrowWorkflow = deal.escrowWorkflow || {
        step: 'deal_finalized',
        bankName: '',
        escrowAccountNumber: '',
        depositedAmountRub: Math.round((deal.sellerReturnRub || 0) * 1.025),
        signingProofPhotos: [],
        signingProofVideos: [],
      };
      deal.escrowWorkflow.step = 'deal_finalized';
      deal.escrowWorkflow.fundsReleasedAt = deal.escrowWorkflow.fundsReleasedAt || nowIso;
      deal.escrowWorkflow.platformFeeRub = Math.round((deal.sellerReturnRub || 0) * 0.025);
      deal.stage = 'completed';
      deal.status = 'closed';
      deal.closedAt = deal.closedAt || nowIso;
      deal.daysLeft = 0;
      deal.updatedDate = nowIso.split('T')[0];
      if (deal.partnerRefCode) {
        deal.partnerPayoutStatus = 'paid';
      }
      await ydb.putItem('deals', deal);
      memoryCache.invalidate('deals');
      appCache.invalidatePrefix('deals');

      // 2. Update Lot
      if (lot) {
        lot.status = 'closed';
        lot.currentStage = 5;
        lot.closedAt = lot.closedAt || nowIso;
        await ydb.putItem('lots', lot);
        memoryCache.invalidate('lots');
        appCache.invalidatePrefix('lots');
      }

      // 3. Update Buyer Applications + Unfreeze Standby + +5 SLA & completedDealsCount
      const lotApps = ydb.isV2TablesEnabled() && targetLotCode
        ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'lotId-createdAt-index', hashKey: 'lotId', hashValue: targetLotCode.toUpperCase() })
        : (await ydb.scanAll<BuyerApplication>('buyer_applications', 1000)) || [];
      const winnerUserIds = new Set<string>();
      if (deal.buyerId) winnerUserIds.add(String(deal.buyerId));

      let closedApplicationsCount = 0;
      let unfrozenApplicationsCount = 0;

      for (const app of lotApps) {
        const sameLot =
          targetLotCode && String(app.lotCode || '').trim().toUpperCase() === targetLotCode.toUpperCase();
        if (!sameLot) continue;

        const isWinnerApp =
          (deal.buyerId && String(app.userId) === String(deal.buyerId)) ||
          app.queueStatus === 'priority_1' ||
          app.queueStatus === 'in_deal';

        if (isWinnerApp) {
          winnerUserIds.add(String(app.userId));
          app.queueStatus = 'completed';
          app.status = 'completed';
          app.completedAt = app.completedAt || nowIso;
          app.updatedAt = nowIso;
          await ydb.putItem('buyer_applications', app);
          closedApplicationsCount++;
        } else if (isActiveApplication(app)) {
          app.queueStatus = 'lot_closed';
          app.status = 'closed';
          app.updatedAt = nowIso;
          await ydb.putItem('buyer_applications', app);
          closedApplicationsCount++;
        }
      }

      for (const winnerUid of winnerUserIds) {
        const bb = await getUnifiedBuyBox(ydb, winnerUid);
        if (bb) {
          bb.reliabilityScore = Math.min(100, (bb.reliabilityScore ?? 75) + 5);
          bb.completedDealsCount = (bb.completedDealsCount || 0) + 1;
          bb.updatedAt = nowIso;
          await syncBuyBoxAndUser(ydb, winnerUid, bb);
        }

        const winnerApps = ydb.isV2TablesEnabled()
          ? await ydb.queryAllByIndex<BuyerApplication>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: winnerUid })
          : lotApps;
        const frozenApps = (winnerApps || []).filter(
          (a) =>
            String(a.userId) === winnerUid &&
            a.queueStatus === 'standby_in_other_deal' &&
            (!targetLotCode || String(a.lotCode || '').trim().toUpperCase() !== targetLotCode.toUpperCase())
        );
        for (const fa of frozenApps) {
          fa.queueStatus = 'pending_review';
          fa.activeDealLotCode = undefined;
          if (bb) {
            const linkedLot = await findLotByCode(ydb, fa.lotCode);
            if (linkedLot) {
              const rescored = computeClosingScore(fa, bb, linkedLot);
              fa.closingScore = rescored.closingScore;
              fa.scoreBreakdown = rescored.breakdown;
            }
          }
          fa.updatedAt = nowIso;
          await ydb.putItem('buyer_applications', fa);
          unfrozenApplicationsCount++;
        }
      }

      // 4. Update Seller Requests
      const sellerUidForReqs = deal.sellerUserId || deal.sellerId || lot?.sellerUserId || lot?.sellerId;
      const allRequests = ydb.isV2TablesEnabled() && sellerUidForReqs
        ? await ydb.queryAllByIndex<any>({ tableName: 'seller_requests', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: String(sellerUidForReqs) })
        : await ydb.scanAll<any>('seller_requests', 500);
      for (const reqItem of allRequests || []) {
        const matchesReq =
          (targetLotCode && String(reqItem.lotCode || '').trim().toUpperCase() === targetLotCode.toUpperCase()) ||
          String(reqItem.dealId || '').trim() === String(deal.dealId || deal.id);
        if (matchesReq && reqItem.status !== 'completed') {
          reqItem.status = 'completed';
          await ydb.putItem('seller_requests', reqItem);
        }
      }
      memoryCache.invalidate('seller_requests');
      appCache.invalidatePrefix('seller_requests');

      // 5. Audit Log + Journal
      await ydb.putItem('audit_logs', {
        id: `log-finalize-${deal.dealId || deal.id}-${Date.now()}`,
        lotCode: targetLotCode,
        dealId: deal.dealId || deal.id,
        operatorName: bankOfficerName,
        operatorRole: authUser.role === 'owner' ? 'owner' : 'curator',
        actionType: 'escrow_released',
        title: `Аккредитив раскрыт: ${(deal.sellerReturnRub || 0).toLocaleString('ru-RU')} ₽ выплачено продавцу`,
        description: `Сделка успешно завершена. Комиссия DomExit (2.5% = ${(deal.escrowWorkflow.platformFeeRub || 0).toLocaleString('ru-RU')} ₽) перечислена.`,
        timestamp: nowIso,
      });
      memoryCache.invalidate('audit_logs');

      await recordJournalEvent({
        action: 'UPDATE',
        collection: 'deals',
        recordId: String(deal.dealId || deal.id),
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: {
          stage: 'completed',
          status: 'closed',
          lotCode: targetLotCode,
          closedApplicationsCount,
          unfrozenApplicationsCount,
        },
      });

      // 6. Telegram notifications (best effort)
      const notifyTargets: Array<{ userId: string; text: string }> = [];
      if (deal.sellerUserId) {
        notifyTargets.push({
          userId: String(deal.sellerUserId),
          text:
            `🎉 <b>Сделка по лоту #${escapeHtml(targetLotCode)} успешно завершена!</b>\n` +
            `Аккредитив/СБР раскрыт, средства в размере <b>${(deal.sellerReturnRub || 0).toLocaleString('ru-RU')} ₽</b> направлены на ваш счёт.\n` +
            `Все закрывающие документы доступны в вашем Личном кабинете (раздел «Продажа лота»).`,
        });
      }
      for (const winnerUid of winnerUserIds) {
        notifyTargets.push({
          userId: winnerUid,
          text:
            `🏆 <b>Поздравляем с покупкой лота #${escapeHtml(targetLotCode)}!</b>\n` +
            `Сделка официально закрыта, право собственности перешло к вам. Вам начислено <b>+5 баллов SLA</b>, а квота заявок (3 слота) освобождена.\n` +
            `Документы закрытия доступны в Личном кабинете («Архив завершённых сделок»).`,
        });
      }

      for (const nt of notifyTargets) {
        const binding = await findTelegramBindingByUser(nt.userId).catch(() => null);
        if (binding?.chatId) {
          await callTelegramApi('sendMessage', {
            chat_id: binding.chatId,
            text: nt.text,
            parse_mode: 'HTML',
          }).catch(() => {});
        }
      }

      return json(event, 200, {
        ok: true,
        deal,
        lot,
        closedApplicationsCount,
        unfrozenApplicationsCount,
      });
    } catch (err: any) {
      logger.error('Error finalizing deal atomically', { meta: { error: err.message, dealId } });
      return json(event, 500, { error: 'Не удалось атомарно завершить сделку', details: err.message });
    }
  }

  // =========================================================================
  // 13. Deal Action Items / Interactive Tasks (Create, Submit, Approve)
  // =========================================================================
  const createTaskMatch = subPath.match(/^\/deals\/([^/]+)\/tasks$/);
  if (createTaskMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Создание задач доступно только сотрудникам DomExit' });
    }
    const dealId = decodeURIComponent(createTaskMatch[1]);
    const body = parseBody<{
      title: string;
      assignee: 'seller' | 'buyer';
      kind?: 'upload_doc' | 'sign_pep' | 'confirm';
      pepDocumentType?: 'nda_viewing_act' | 'buyer_reservation_terms' | 'seller_exclusive_consent';
    }>(event);

    if (!body?.title || !body?.assignee) {
      return json(event, 400, { error: 'Укажите title и assignee (seller|buyer)' });
    }

    let deal = await ydb.getItem<any>('deals', dealId).catch(() => null);
    if (!deal) {
      const allDeals = await ydb.scanAll<any>('deals', 500);
      deal = (allDeals || []).find((d: any) => d.id === dealId || d.dealId === dealId);
    }
    if (!deal) {
      return json(event, 404, { error: `Сделка ${dealId} не найдена` });
    }
    const taskLot = deal.lotCode ? await findLotByCode(ydb, deal.lotCode) : null;
    if (!isEmployeeAssignedToRecord(authUser, taskLot || deal)) {
      return json(event, 403, { error: 'Вы не назначены куратором этой сделки', code: 'NOT_ASSIGNED_TO_LOT' });
    }

    const nowIso = new Date().toISOString();
    const task = {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      title: body.title.trim(),
      assignee: body.assignee,
      kind: body.kind || 'upload_doc',
      pepDocumentType: body.pepDocumentType,
      status: 'pending' as const,
      createdAt: nowIso,
      createdBy: authUser.name || authUser.email || 'Куратор DomExit',
    };

    deal.actionItems = Array.isArray(deal.actionItems) ? [...deal.actionItems, task] : [task];
    await ydb.putItem('deals', deal);
    memoryCache.invalidate('deals');
    appCache.invalidatePrefix('deals');

    // Notify target party via Telegram
    const targetUserId = body.assignee === 'seller' ? deal.sellerUserId : (deal.buyerId || deal.buyerUserId);
    if (targetUserId) {
      const binding = await findTelegramBindingByUser(String(targetUserId)).catch(() => null);
      if (binding?.chatId) {
        await callTelegramApi('sendMessage', {
          chat_id: binding.chatId,
          text:
            `📋 <b>Новая задача по сделке #${escapeHtml(deal.lotCode || '')}</b>\n` +
            `${escapeHtml(task.title)}\n\n` +
            `Выполните задачу в вашем Личном кабинете на портале DomExit.`,
          parse_mode: 'HTML',
        }).catch(() => {});
      }
    }

    return json(event, 200, { ok: true, task, deal });
  }

  const submitTaskMatch = subPath.match(/^\/deals\/([^/]+)\/tasks\/([^/]+)\/submit$/);
  if (submitTaskMatch && method === 'POST') {
    const dealId = decodeURIComponent(submitTaskMatch[1]);
    const taskId = decodeURIComponent(submitTaskMatch[2]);
    const body = parseBody<{
      uploadedDocKey?: string;
      uploadedDocName?: string;
      note?: string;
    }>(event);

    let deal = await ydb.getItem<any>('deals', dealId).catch(() => null);
    if (!deal) {
      const allDeals = await ydb.scanAll<any>('deals', 500);
      deal = (allDeals || []).find((d: any) => d.id === dealId || d.dealId === dealId);
    }
    if (!deal) {
      return json(event, 404, { error: `Сделка ${dealId} не найдена` });
    }

    const isSeller = deal.sellerUserId === authUser.id || deal.sellerId === authUser.id;
    const isBuyer = deal.buyerId === authUser.id || deal.buyerUserId === authUser.id;
    if (!isStaff && !isSeller && !isBuyer) {
      return json(event, 403, { error: 'Доступ к задаче запрещён' });
    }
    if (isStaff && !isSeller && !isBuyer) {
      const taskLot = deal.lotCode ? await findLotByCode(ydb, deal.lotCode) : null;
      if (!isEmployeeAssignedToRecord(authUser, taskLot || deal)) {
        return json(event, 403, { error: 'Вы не назначены куратором этой сделки', code: 'NOT_ASSIGNED_TO_LOT' });
      }
    }

    const items: any[] = Array.isArray(deal.actionItems) ? deal.actionItems : [];
    const targetTask = items.find((t) => t.id === taskId);
    if (!targetTask) {
      return json(event, 404, { error: 'Задача не найдена' });
    }
    if (!isStaff) {
      if (targetTask.assignee === 'seller' && !isSeller) {
        return json(event, 403, { error: 'Эта задача предназначена продавцу' });
      }
      if (targetTask.assignee === 'buyer' && !isBuyer) {
        return json(event, 403, { error: 'Эта задача предназначена покупателю' });
      }
    }

    targetTask.status = 'submitted';
    targetTask.submittedAt = new Date().toISOString();
    if (body?.uploadedDocKey) targetTask.uploadedDocKey = body.uploadedDocKey;
    if (body?.uploadedDocName) targetTask.uploadedDocName = body.uploadedDocName;
    if (body?.note) targetTask.note = body.note;

    await ydb.putItem('deals', deal);
    memoryCache.invalidate('deals');
    appCache.invalidatePrefix('deals');

    await notifyStaff(
      `📥 <b>КЛИЕНТ ВЫПОЛНИЛ ЗАДАЧУ: #${escapeHtml(deal.lotCode || '')}</b>\n` +
      `Задача: <b>${escapeHtml(targetTask.title)}</b>\n` +
      `Исполнитель: <b>${escapeHtml(authUser.name || authUser.email)}</b>\n` +
      `Статус: <i>На проверке у куратора</i>`
    ).catch(() => {});

    return json(event, 200, { ok: true, task: targetTask, deal });
  }

  const approveTaskMatch = subPath.match(/^\/deals\/([^/]+)\/tasks\/([^/]+)\/approve$/);
  if (approveTaskMatch && method === 'POST') {
    if (!isStaff) {
      return json(event, 403, { error: 'Подтверждение задач доступно только сотрудникам' });
    }
    const dealId = decodeURIComponent(approveTaskMatch[1]);
    const taskId = decodeURIComponent(approveTaskMatch[2]);

    let deal = await ydb.getItem<any>('deals', dealId).catch(() => null);
    if (!deal) {
      const allDeals = await ydb.scanAll<any>('deals', 500);
      deal = (allDeals || []).find((d: any) => d.id === dealId || d.dealId === dealId);
    }
    if (!deal) {
      return json(event, 404, { error: `Сделка ${dealId} не найдена` });
    }
    const taskLot = deal.lotCode ? await findLotByCode(ydb, deal.lotCode) : null;
    if (!isEmployeeAssignedToRecord(authUser, taskLot || deal)) {
      return json(event, 403, { error: 'Вы не назначены куратором этой сделки', code: 'NOT_ASSIGNED_TO_LOT' });
    }

    const items: any[] = Array.isArray(deal.actionItems) ? deal.actionItems : [];
    const targetTask = items.find((t) => t.id === taskId);
    if (!targetTask) {
      return json(event, 404, { error: 'Задача не найдена' });
    }

    targetTask.status = 'approved';
    targetTask.approvedAt = new Date().toISOString();

    await ydb.putItem('deals', deal);
    memoryCache.invalidate('deals');
    appCache.invalidatePrefix('deals');

    const targetUserId = targetTask.assignee === 'seller' ? deal.sellerUserId : (deal.buyerId || deal.buyerUserId);
    if (targetUserId) {
      const binding = await findTelegramBindingByUser(String(targetUserId)).catch(() => null);
      if (binding?.chatId) {
        await callTelegramApi('sendMessage', {
          chat_id: binding.chatId,
          text: `✅ <b>Задача принята куратором (#${escapeHtml(deal.lotCode || '')}):</b>\n${escapeHtml(targetTask.title)}`,
          parse_mode: 'HTML',
        }).catch(() => {});
      }
    }

    return json(event, 200, { ok: true, task: targetTask, deal });
  }

  return json(event, 404, { error: `Endpoint /api/matching${subPath} не найден` });
}
