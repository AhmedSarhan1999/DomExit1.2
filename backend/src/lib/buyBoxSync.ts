import { BuyerBuyBox, QueueStatus, TierVerificationRequest, UserProfile } from '../types.js';
import { appCache, memoryCache } from './memoryCache.js';
import { invalidateAuthUserCache } from './cryptoAuth.js';

export const ACTIVE_APPLICATION_STATUSES = new Set<string>([
  'pending_review',
  'priority_1',
  'in_deal',
  'reserve_2',
  'reserve_3',
  'waitlist',
  'standby_in_other_deal',
]);

export const ARCHIVED_APPLICATION_STATUSES = new Set<string>([
  'withdrawn',
  'withdrawn_from_queue',
  'withdrawn_from_deal',
  'rejected',
  'completed',
  'lot_closed',
  'expired',
]);

export function isSelfOwnedLot(lot: any, authUser: { id?: string; email?: string }): boolean {
  if (!lot || !authUser) return false;
  const uid = (authUser.id || '').trim();
  const cleanEmail = (authUser.email || '').trim().toLowerCase();
  if (uid && (lot.sellerUserId === uid || lot.sellerId === uid)) {
    return true;
  }
  if (cleanEmail && lot.sellerEmail && String(lot.sellerEmail).trim().toLowerCase() === cleanEmail) {
    return true;
  }
  return false;
}

/**
 * Resolves a single canonical Buy-Box record (id = `bb:${userId}`),
 * merges any duplicate records for the same userId, and reconciles approved Gold status.
 */
export async function getUnifiedBuyBox(ydb: any, userId: string): Promise<BuyerBuyBox | null> {
  if (!userId) return null;
  const canonicalId = `bb:${userId}`;
  let primary = (await ydb.getItem('buy_boxes', canonicalId)) as BuyerBuyBox | null;

  // Check for duplicates or legacy IDs (e.g. bb-${userId} or random ids)
  const allBoxes = ((await ydb.scanAll('buy_boxes', 500)) || []) as BuyerBuyBox[];
  const matching = allBoxes.filter((b: BuyerBuyBox) => b.userId === userId);

  if (matching.length > 1 || (!primary && matching.length > 0)) {
    // Prefer gold tier, then most recently updated
    matching.sort((a: BuyerBuyBox, b: BuyerBuyBox) => {
      if (a.tier === 'gold' && b.tier !== 'gold') return -1;
      if (b.tier === 'gold' && a.tier !== 'gold') return 1;
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });

    const winner = matching[0];
    const minScore = matching.reduce((min: number, b: BuyerBuyBox) => Math.min(min, b.reliabilityScore ?? 100), 100);
    const maxNoShow = matching.reduce((max: number, b: BuyerBuyBox) => Math.max(max, b.noShowCount ?? 0), 0);
    const maxViewings = matching.reduce((max: number, b: BuyerBuyBox) => Math.max(max, b.completedViewingsCount ?? 0), 0);

    primary = {
      ...winner,
      id: canonicalId,
      userId,
      reliabilityScore: Math.min(winner.reliabilityScore ?? 100, minScore),
      noShowCount: maxNoShow,
      completedViewingsCount: maxViewings,
      updatedAt: new Date().toISOString(),
    };

    await ydb.putItem('buy_boxes', primary);

    for (const dup of matching) {
      if (dup.id && dup.id !== canonicalId) {
        await ydb.deleteItem('buy_boxes', dup.id).catch(() => {});
      }
    }
  }

  // Reconcile approved Gold tier from users or tier_verification_requests
  let hasApprovedGold = primary?.tier === 'gold';
  let userRecord: UserProfile | null = null;
  if (!hasApprovedGold) {
    userRecord = (await ydb.getItem('users', userId)) as UserProfile | null;
    if ((userRecord as any)?.buyerTier === 'gold') {
      hasApprovedGold = true;
    } else {
      const allReqs = ((await ydb.scanAll('tier_verification_requests', 200)) || []) as TierVerificationRequest[];
      const approvedReq = allReqs.find((r: TierVerificationRequest) => r.userId === userId && r.status === 'approved');
      if (approvedReq) {
        hasApprovedGold = true;
      }
    }
  }

  if (hasApprovedGold && (!primary || primary.tier !== 'gold')) {
    const now = new Date().toISOString();
    primary = {
      ...(primary || {
        id: canonicalId,
        userId,
        active: true,
        cities: ['spb'],
        districts: [],
        complexNames: [],
        dealTracks: ['ddu_cession'],
        rooms: [],
        maxBudgetRub: 50000000,
        minDiscountPercent: 0,
        paymentMethod: 'cash_100',
        preferredBanks: [],
        goal: 'living',
        readinessHours: 24,
        reliabilityScore: 100,
        noShowCount: 0,
        completedViewingsCount: 0,
        createdAt: now,
      }),
      id: canonicalId,
      userId,
      tier: 'gold',
      tierVerifiedAt: primary?.tierVerifiedAt || now,
      updatedAt: now,
    } as BuyerBuyBox;

    await ydb.putItem('buy_boxes', primary);
  }

  // Sync user.buyerTier if needed
  if (primary?.tier) {
    if (!userRecord) userRecord = (await ydb.getItem('users', userId)) as UserProfile | null;
    if (userRecord && (userRecord as any).buyerTier !== primary.tier) {
      (userRecord as any).buyerTier = primary.tier;
      (userRecord as any).reliabilityScore = primary.reliabilityScore ?? 100;
      await ydb.putItem('users', userRecord).catch(() => {});
      appCache.invalidatePrefix('users');
      invalidateAuthUserCache(userId);
    }
  }

  return primary || null;
}

export async function syncBuyBoxAndUser(
  ydb: any,
  userId: string,
  buyBox: BuyerBuyBox
): Promise<BuyerBuyBox> {
  const canonicalId = `bb:${userId}`;
  const toSave: BuyerBuyBox = {
    ...buyBox,
    id: canonicalId,
    userId,
    updatedAt: new Date().toISOString(),
  };

  await ydb.putItem('buy_boxes', toSave);

  try {
    const userRecord = (await ydb.getItem('users', userId)) as any;
    if (userRecord) {
      userRecord.buyerTier = toSave.tier;
      userRecord.reliabilityScore = toSave.reliabilityScore ?? 100;
      userRecord.updatedAt = toSave.updatedAt;
      await ydb.putItem('users', userRecord);
    }
  } catch {
    // Non-fatal
  }

  memoryCache.invalidate('demand_radar_summary');
  appCache.invalidatePrefix('buy_boxes');
  appCache.invalidatePrefix('users');
  invalidateAuthUserCache(userId);
  return toSave;
}

export function isActiveApplication(app: { queueStatus?: QueueStatus | string }): boolean {
  const status = String(app?.queueStatus || 'pending_review');
  return ACTIVE_APPLICATION_STATUSES.has(status);
}
