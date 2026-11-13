import { BuyerCandidate } from '../../types';
import { initialCandidates } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { LotsRepository } from './LotsRepository';
import { DealsRepository } from './DealsRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'buyer_applications';
const LEGACY_COLLECTION = 'candidates';
const MAX_ACTIVE_BIDS_PER_USER = 3;

export class CandidatesRepository {
  static async getAll(): Promise<BuyerCandidate[]> {
    const [canonical, legacy] = await Promise.all([
      DatabaseGateway.getAll<BuyerCandidate>(COLLECTION, initialCandidates),
      DatabaseGateway.getAll<BuyerCandidate>(LEGACY_COLLECTION, []),
    ]);

    const merged = new Map<string, BuyerCandidate>();
    for (const item of [...legacy, ...canonical]) {
      merged.set(item.id, item);
    }

    return Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.timestamp || b.requestedTimestamp).getTime() -
        new Date(a.timestamp || a.requestedTimestamp).getTime()
    );
  }

  static async getByLotCode(lotCode: string): Promise<BuyerCandidate[]> {
    const all = await this.getAll();
    const clean = lotCode.trim().toUpperCase();
    return all.filter((c) => c.lotCode && c.lotCode.toUpperCase() === clean);
  }

  static async getByUserId(userId: string, clientCode?: string): Promise<BuyerCandidate[]> {
    const all = await this.getAll();
    return all.filter(
      (c) =>
        (userId && (c.uid === userId || c.userId === userId)) ||
        (clientCode && c.clientCode?.toUpperCase() === clientCode.toUpperCase())
    );
  }

  static async getActiveBidsCount(userId: string, clientCode?: string): Promise<number> {
    const userBids = await this.getByUserId(userId, clientCode);
    return userBids.filter(
      (b) =>
        b.status === 'pending' ||
        b.status === 'under_review' ||
        b.status === 'priority_reserved'
    ).length;
  }

  static async submitBid(data: Partial<BuyerCandidate>): Promise<BuyerCandidate> {
    const uid = data.uid || data.userId || 'current-user';
    const clientCode = data.clientCode || 'DEX-000000';
    const nowIso = new Date().toISOString();

    const activeCount = await this.getActiveBidsCount(uid, clientCode);
    if (activeCount >= MAX_ACTIVE_BIDS_PER_USER) {
      throw new Error(
        'Вы достигли лимита активных заявок (максимум 3). Подача новой заявки станет доступна после завершения отбора по одной из текущих заявок.'
      );
    }

    const newBid: BuyerCandidate = {
      id: `cand-${Date.now()}`,
      code: `B-${Math.floor(400 + Math.random() * 599)}`,
      lotCode: data.lotCode || 'U-10566',
      userId: uid,
      uid,
      clientCode,
      phone: data.phone,
      email: data.email,
      name: data.name || 'Покупатель DomExit',
      selectedBank: data.selectedBank || 'Сбербанк',
      location: data.location || 'Российская Федерация',
      matchScore: data.buyerTrack === 'full_cash' ? 98 : 94,
      fundingType:
        data.fundingType || (data.buyerTrack === 'full_cash' ? 'cash' : 'family-mortgage'),
      buyerTrack: data.buyerTrack || 'full_cash',
      creditLimitRub: data.creditLimitRub || 0,
      bankApprovalDocUrl: data.bankApprovalDocUrl,
      bankApprovalDocName: data.bankApprovalDocName,
      bankStatementUrl: data.bankStatementUrl,
      bankStatementName: data.bankStatementName,
      documentId: data.documentId,
      curatorVerified: false,
      isVerifiedByCurator: false,
      readinessTimeline:
        data.readinessTimeline ||
        (data.buyerTrack === 'full_cash'
          ? '100% Кэш через СБР / Аккредитив — 48ч'
          : `Ипотека одобрена: лимит ${(data.creditLimitRub || 0).toLocaleString('ru-RU')} ₽`),
      availableLiquidity:
        data.availableLiquidity || (data.buyerTrack === 'full_cash' ? 3000000 : 2500000),
      priorityBadge:
        data.buyerTrack === 'full_cash'
          ? 'Кэш 100% + Выписка'
          : 'Ипотека с банковским одобрением',
      status: 'pending',
      requestedTimestamp: nowIso,
      timestamp: nowIso,
    };

    await DatabaseGateway.save<BuyerCandidate>(COLLECTION, newBid);

    await AuditLogsRepository.addLog({
      lotCode: newBid.lotCode,
      operatorId: uid,
      operatorName: `${newBid.name} (${clientCode})`,
      operatorRole: 'client',
      actionType: 'buyer_bid_submitted',
      title: `Подана заявка на покупку лота #${newBid.lotCode} (${newBid.code})`,
      description: `Трек: ${
        newBid.buyerTrack === 'full_cash' ? '100% собственные средства' : 'Кэш продавцу + Ипотека'
      }. Доступный кэш: ${newBid.availableLiquidity.toLocaleString('ru-RU')} ₽.`,
    });

    return newBid;
  }

  static async verifyCandidate(
    candidateId: string,
    curatorName: string
  ): Promise<BuyerCandidate | null> {
    const list = await this.getAll();
    const candidate = list.find((c) => c.id === candidateId || c.code === candidateId);
    if (!candidate) return null;

    candidate.curatorVerified = true;
    candidate.isVerifiedByCurator = true;
    candidate.curatorVerifiedAt = new Date().toISOString();
    candidate.curatorVerifiedBy = curatorName;
    candidate.status = 'under_review';

    await DatabaseGateway.save<BuyerCandidate>(COLLECTION, candidate);

    await AuditLogsRepository.addLog({
      lotCode: candidate.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'buyer_matched',
      title: `Подтверждена ликвидность покупателя ${candidate.code} (${candidate.name})`,
      description: `Куратор верифицировал банковские документы кандидата по лоту #${candidate.lotCode}.`,
    });

    return candidate;
  }

  /**
   * Accepts winning candidate for a lot and automatically withdraws their competing bids on other lots.
   * Accepts `(lotCode, candidateId)` (and defensively detects reversed arguments if passed).
   */
  static async acceptCandidate(
    lotCodeOrCandId: string,
    candidateIdOrLotCode: string,
    curatorName: string = 'Куратор DomExit'
  ): Promise<BuyerCandidate | null> {
    const looksLikeCandFirst =
      lotCodeOrCandId.startsWith('cand-') ||
      lotCodeOrCandId.startsWith('c-') ||
      lotCodeOrCandId.startsWith('B-');

    const lotCode = looksLikeCandFirst ? candidateIdOrLotCode : lotCodeOrCandId;
    const candidateId = looksLikeCandFirst ? lotCodeOrCandId : candidateIdOrLotCode;

    const all = await this.getAll();
    let winner: BuyerCandidate | null = null;

    for (const c of all) {
      if (
        c.lotCode?.toUpperCase() === lotCode.toUpperCase() &&
        (c.id === candidateId || c.code === candidateId)
      ) {
        c.status = 'priority_reserved';
        winner = c;
        await DatabaseGateway.save<BuyerCandidate>(COLLECTION, c);
      } else if (
        c.lotCode?.toUpperCase() === lotCode.toUpperCase() &&
        c.id !== candidateId &&
        c.code !== candidateId
      ) {
        c.status = 'declined';
        await DatabaseGateway.save<BuyerCandidate>(COLLECTION, c);
      }
    }

    const winnerUid = winner?.uid || winner?.userId;
    if (winner && winnerUid) {
      for (const otherBid of all) {
        const otherUid = otherBid.uid || otherBid.userId;
        if (
          otherUid === winnerUid &&
          otherBid.lotCode?.toUpperCase() !== lotCode.toUpperCase() &&
          (otherBid.status === 'pending' || otherBid.status === 'under_review')
        ) {
          otherBid.status = 'withdrawn_accepted_elsewhere';
          await DatabaseGateway.save<BuyerCandidate>(COLLECTION, otherBid);
        }
      }
    }

    const lot = await LotsRepository.getByCode(lotCode);
    if (lot && winner) {
      lot.status = 'in_deal';
      lot.buyerUserId = winner.uid || winner.userId;
      lot.buyerName = winner.name;
      lot.buyerPhone = winner.phone;
      lot.buyerEmail = winner.email;
      await LotsRepository.update(lot);
    } else {
      await LotsRepository.updateStatus(lotCode, 'processing');
    }

    const deal = await DealsRepository.getById(lotCode);
    if (deal && winner) {
      deal.stage = 'closing_escrow';
      deal.status = 'in_deal';
      deal.buyerName = winner.name;
      deal.buyerUserId = winner.uid || winner.userId;
      deal.buyerClientCode = winner.clientCode;
      deal.buyerPhone = winner.phone;
      deal.buyerEmail = winner.email;
      const chosenBank = winner.selectedBank || deal.escrowWorkflow?.bankName || 'Сбербанк';
      deal.bankName = chosenBank;
      if (!deal.escrowWorkflow) {
        deal.escrowWorkflow = {
          step: 'curator_review',
          bankName: chosenBank,
          escrowAccountNumber: `40817810${Math.floor(100000000000 + Math.random() * 900000000000)}`,
          depositedAmountRub: deal.sellerReturnRub || 2500000,
          signingProofPhotos: [],
          signingProofVideos: [],
        };
      } else {
        deal.escrowWorkflow.bankName = chosenBank;
      }
      await DealsRepository.update(deal);
    } else {
      await DealsRepository.updateStage(lotCode, 'closing_escrow');
    }

    if (winner) {
      await AuditLogsRepository.addLog({
        lotCode,
        dealId: deal?.dealId,
        operatorName: curatorName,
        operatorRole: 'curator',
        actionType: 'buyer_matched',
        title: `Победителем отбора по лоту #${lotCode} утвержден ${winner.name} (${winner.code})`,
        description: `Сделка переведена на этап эскроу/аккредитива. Прочие активные заявки покупателя автоматически отозваны.`,
      });
    }

    return winner;
  }

  static async notifyCandidatesForRelisting(lotCode: string): Promise<number> {
    const all = await this.getAll();
    const lotCandidates = all.filter((c) => c.lotCode?.toUpperCase() === lotCode.toUpperCase());

    let count = 0;
    for (const c of lotCandidates) {
      if (c.status === 'declined' || c.status === 'priority_reserved') {
        c.status = 'pending';
        await DatabaseGateway.save<BuyerCandidate>(COLLECTION, c);
        count++;
      }
    }
    return count;
  }

  static async updateStatus(
    candidateId: string,
    status: BuyerCandidate['status']
  ): Promise<BuyerCandidate | null> {
    const list = await this.getAll();
    const item = list.find((c) => c.id === candidateId || c.code === candidateId);
    if (!item) return null;
    item.status = status;
    await DatabaseGateway.save<BuyerCandidate>(COLLECTION, item);
    return item;
  }

  static async update(candidate: BuyerCandidate): Promise<BuyerCandidate> {
    await DatabaseGateway.save<BuyerCandidate>(COLLECTION, candidate);
    return candidate;
  }

  static async getByLot(lotCode: string): Promise<BuyerCandidate[]> {
    return this.getByLotCode(lotCode);
  }
}
