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
  ydb: { scanAll: <T = any>(table: string, limit?: number) => Promise<T[]> }
): Promise<any[]> {
  const [dealMsgs, legacyMsgs] = await Promise.all([
    ydb.scanAll<any>('deal_messages', 500),
    ydb.scanAll<any>('curator_messages', 300),
  ]);
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
  const merged = Array.from(byId.values());

  if (authUser.role === 'owner') {
    return merged;
  }

  if (authUser.role === 'employee') {
    const [lots, deals] = await Promise.all([
      ydb.scanAll<any>('lots', 500),
      ydb.scanAll<any>('deals', 500),
    ]);
    const assignedLotCodes = new Set<string>();
    for (const l of lots || []) {
      if (isEmployeeAssignedToRecord(authUser, l)) {
        const lc = String(l.lotCode || l.id || '').toUpperCase();
        if (lc) assignedLotCodes.add(lc);
      }
    }
    const assignedDealIds = new Set<string>();
    for (const d of deals || []) {
      const lc = String(d.lotCode || d.lotId || '').toUpperCase();
      if (isEmployeeAssignedToRecord(authUser, d) || (lc && assignedLotCodes.has(lc))) {
        if (d.id) assignedDealIds.add(String(d.id).toUpperCase());
        if (d.dealId) assignedDealIds.add(String(d.dealId).toUpperCase());
        if (lc) assignedLotCodes.add(lc);
      }
    }
    return merged.filter((m: any) => {
      const lc = String(m.lotCode || m.lotId || '').toUpperCase();
      const did = String(m.dealId || '').toUpperCase();
      return (lc && assignedLotCodes.has(lc)) || (did && assignedDealIds.has(did));
    });
  }

  const [lots, deals, apps] = await Promise.all([
    ydb.scanAll<any>('lots', 500),
    ydb.scanAll<any>('deals', 500),
    ydb.scanAll<any>('buyer_applications', 500),
  ]);
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
