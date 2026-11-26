/**
 * Shared RBAC helper for staff assignment checks across routes.
 * Owner always passes; employees only pass when explicitly assigned to the target lot/deal.
 */
export function isEmployeeAssignedToRecord(
  authUser: { id?: string; userId?: string; role?: string; assignedEmployeeId?: string } | null | undefined,
  record: { assignedEmployeeId?: string; assignedCuratorId?: string } | null | undefined
): boolean {
  if (!authUser) return false;
  if (authUser.role === 'owner') return true;
  if (authUser.role !== 'employee') return false;

  const assignedEmp = String(record?.assignedEmployeeId || record?.assignedCuratorId || '').trim();
  if (!assignedEmp) return false;

  const staffIds = new Set(
    [authUser.id, authUser.userId, authUser.assignedEmployeeId]
      .filter(Boolean)
      .map((v) => String(v).trim())
  );
  return staffIds.has(assignedEmp);
}

/**
 * Returns role- and 152-FZ-scoped chat messages for owner, assigned employee, seller, or buyer.
 */
export async function getVisibleChatMessages(
  authUser: { id: string; userId?: string; role?: string; assignedEmployeeId?: string },
  ydb: {
    scanAll: <T = any>(table: string, limit?: number) => Promise<T[]>;
    isV2TablesEnabled?: () => boolean;
    queryAllByIndex?: <T = any>(params: any, maxPages?: number) => Promise<T[]>;
  }
): Promise<any[]> {
  const useV2 = Boolean(ydb.isV2TablesEnabled?.() && ydb.queryAllByIndex);

  const normalizeMsgs = (dealMsgs: any[], legacyMsgs: any[]) => {
    const byId = new Map<string, any>();
    for (const m of [...(legacyMsgs || []), ...(dealMsgs || [])]) {
      if (m?.id) {
        byId.set(m.id, {
          ...m,
          threadChannel:
            m.threadChannel ||
            (m.senderRole === 'seller' || m.role === 'seller' ? 'seller_curator' : 'buyer_curator'),
        });
      }
    }
    return Array.from(byId.values());
  };

  if (authUser.role === 'owner') {
    const [dealMsgs, legacyMsgs] = await Promise.all([
      ydb.scanAll<any>('deal_messages', 500),
      ydb.scanAll<any>('curator_messages', 300),
    ]);
    return normalizeMsgs(dealMsgs, legacyMsgs);
  }

  if (authUser.role === 'employee') {
    let lots: any[] = [];
    let deals: any[] = [];
    if (useV2 && ydb.queryAllByIndex) {
      const staffIds = Array.from(new Set([authUser.id, authUser.assignedEmployeeId].filter(Boolean) as string[]));
      const [lotLists, dealLists] = await Promise.all([
        Promise.all(
          staffIds.map((sid) =>
            ydb.queryAllByIndex!<any>({
              tableName: 'lots',
              indexName: 'assignedCuratorId-createdAt-index',
              hashKey: 'assignedCuratorId',
              hashValue: sid,
            })
          )
        ),
        Promise.all(
          staffIds.map((sid) =>
            ydb.queryAllByIndex!<any>({
              tableName: 'deals',
              indexName: 'assignedCuratorId-createdAt-index',
              hashKey: 'assignedCuratorId',
              hashValue: sid,
            })
          )
        ),
      ]);
      lots = lotLists.flat();
      deals = dealLists.flat();
    } else {
      [lots, deals] = await Promise.all([
        ydb.scanAll<any>('lots', 500),
        ydb.scanAll<any>('deals', 500),
      ]);
    }

    const assignedLotCodes = new Set<string>();
    const rawKeysForMsgs = new Set<string>();
    for (const l of lots || []) {
      if (isEmployeeAssignedToRecord(authUser, l)) {
        const lc = String(l.lotCode || l.id || '').toUpperCase();
        if (lc) assignedLotCodes.add(lc);
        if (l.lotCode) rawKeysForMsgs.add(String(l.lotCode));
        if (l.id) rawKeysForMsgs.add(String(l.id));
      }
    }
    const assignedDealIds = new Set<string>();
    for (const d of deals || []) {
      const lc = String(d.lotCode || d.lotId || '').toUpperCase();
      if (isEmployeeAssignedToRecord(authUser, d) || (lc && assignedLotCodes.has(lc))) {
        if (d.id) {
          assignedDealIds.add(String(d.id).toUpperCase());
          rawKeysForMsgs.add(String(d.id));
        }
        if (d.dealId) {
          assignedDealIds.add(String(d.dealId).toUpperCase());
          rawKeysForMsgs.add(String(d.dealId));
        }
        if (lc) assignedLotCodes.add(lc);
        if (d.lotCode) rawKeysForMsgs.add(String(d.lotCode));
      }
    }

    let merged: any[] = [];
    if (useV2 && ydb.queryAllByIndex) {
      const msgKeys = Array.from(rawKeysForMsgs).slice(0, 30);
      const [dealMsgsByKey, legacyByDeal, legacyByCurator] = await Promise.all([
        Promise.all(
          msgKeys.map((k) =>
            ydb.queryAllByIndex!<any>({
              tableName: 'deal_messages',
              indexName: 'dealId-createdAt-index',
              hashKey: 'dealId',
              hashValue: k,
            })
          )
        ),
        Promise.all(
          msgKeys.map((k) =>
            ydb.queryAllByIndex!<any>({
              tableName: 'curator_messages',
              indexName: 'dealId-createdAt-index',
              hashKey: 'dealId',
              hashValue: k,
            })
          )
        ),
        ydb.queryAllByIndex<any>({
          tableName: 'curator_messages',
          indexName: 'curatorId-createdAt-index',
          hashKey: 'curatorId',
          hashValue: authUser.id,
        }),
      ]);
      merged = normalizeMsgs(dealMsgsByKey.flat(), [...legacyByDeal.flat(), ...legacyByCurator]);
    } else {
      const [dealMsgs, legacyMsgs] = await Promise.all([
        ydb.scanAll<any>('deal_messages', 500),
        ydb.scanAll<any>('curator_messages', 300),
      ]);
      merged = normalizeMsgs(dealMsgs, legacyMsgs);
    }

    return merged.filter((m: any) => {
      const lc = String(m.lotCode || m.lotId || '').toUpperCase();
      const did = String(m.dealId || '').toUpperCase();
      return (lc && assignedLotCodes.has(lc)) || (did && assignedDealIds.has(did));
    });
  }

  let lots: any[] = [];
  let deals: any[] = [];
  let apps: any[] = [];
  let dealMsgs: any[] = [];
  let legacyMsgs: any[] = [];

  if (useV2 && ydb.queryAllByIndex) {
    const [ownerLots, buyerDeals, sellerDeals, userApps, sentMsgs, myCuratorMsgs] = await Promise.all([
      ydb.queryAllByIndex<any>({ tableName: 'lots', indexName: 'ownerId-createdAt-index', hashKey: 'ownerId', hashValue: authUser.id }),
      ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'buyerId-createdAt-index', hashKey: 'buyerId', hashValue: authUser.id }),
      ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'sellerId-createdAt-index', hashKey: 'sellerId', hashValue: authUser.id }),
      ydb.queryAllByIndex<any>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: authUser.id }),
      ydb.queryAllByIndex<any>({ tableName: 'deal_messages', indexName: 'senderId-createdAt-index', hashKey: 'senderId', hashValue: authUser.id }),
      ydb.queryAllByIndex<any>({ tableName: 'curator_messages', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: authUser.id }),
    ]);
    lots = ownerLots;
    deals = [...buyerDeals, ...sellerDeals];
    apps = userApps;

    const dealKeys = new Set<string>();
    for (const l of lots) {
      if (l.lotCode) dealKeys.add(String(l.lotCode));
      if (l.id) dealKeys.add(String(l.id));
    }
    for (const d of deals) {
      if (d.id) dealKeys.add(String(d.id));
      if (d.dealId) dealKeys.add(String(d.dealId));
      if (d.lotCode) dealKeys.add(String(d.lotCode));
    }
    for (const a of apps) {
      if (a.lotCode) dealKeys.add(String(a.lotCode));
    }
    const keysArr = Array.from(dealKeys).slice(0, 25);
    const [dealMsgsByDeal, curatorMsgsByDeal] = await Promise.all([
      Promise.all(keysArr.map((k) => ydb.queryAllByIndex!<any>({ tableName: 'deal_messages', indexName: 'dealId-createdAt-index', hashKey: 'dealId', hashValue: k }))),
      Promise.all(keysArr.map((k) => ydb.queryAllByIndex!<any>({ tableName: 'curator_messages', indexName: 'dealId-createdAt-index', hashKey: 'dealId', hashValue: k }))),
    ]);
    dealMsgs = [...sentMsgs, ...dealMsgsByDeal.flat()];
    legacyMsgs = [...myCuratorMsgs, ...curatorMsgsByDeal.flat()];
  } else {
    [lots, deals, apps, dealMsgs, legacyMsgs] = await Promise.all([
      ydb.scanAll<any>('lots', 500),
      ydb.scanAll<any>('deals', 500),
      ydb.scanAll<any>('buyer_applications', 500),
      ydb.scanAll<any>('deal_messages', 500),
      ydb.scanAll<any>('curator_messages', 300),
    ]);
  }

  const merged = normalizeMsgs(dealMsgs, legacyMsgs);
  const sellerLots = new Set<string>();
  const buyerLots = new Set<string>();

  for (const l of lots || []) {
    const lc = String(l.lotCode || l.id || '').toUpperCase();
    if (!lc) continue;
    if (l.sellerUserId === authUser.id || l.sellerId === authUser.id) sellerLots.add(lc);
    if (l.buyerUserId === authUser.id || l.buyerId === authUser.id) buyerLots.add(lc);
  }
  for (const d of deals || []) {
    const lc = String(d.lotCode || d.lotId || '').toUpperCase();
    if (!lc) continue;
    if (d.sellerUserId === authUser.id || d.sellerId === authUser.id) sellerLots.add(lc);
    if (d.buyerUserId === authUser.id || d.buyerId === authUser.id) buyerLots.add(lc);
  }
  for (const a of apps || []) {
    const lc = String(a.lotCode || '').toUpperCase();
    if (lc && a.userId === authUser.id) buyerLots.add(lc);
  }

  return merged.filter((m: any) => {
    const lc = String(m.lotCode || m.lotId || '').toUpperCase();
    const ch = m.threadChannel;
    if (ch === 'seller_curator') {
      return lc && sellerLots.has(lc) && m.senderRole !== 'buyer' && m.role !== 'buyer';
    }
    if (ch === 'buyer_curator') {
      return (
        (m.senderId === authUser.id || (lc && buyerLots.has(lc))) &&
        m.senderRole !== 'seller' &&
        m.role !== 'seller'
      );
    }
    return false;
  });
}
