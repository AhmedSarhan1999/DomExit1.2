import { BuyerCandidate } from '../../types';
import { initialCandidates } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { LotsRepository } from './LotsRepository';
import { DealsRepository } from './DealsRepository';

const COLLECTION = 'candidates';
const MAX_ACTIVE_BIDS_PER_USER = 3;

export class CandidatesRepository {
  static async getAll(): Promise<BuyerCandidate[]> {
    return FirebaseAdapter.getAllEntities<BuyerCandidate>(COLLECTION, initialCandidates);
  }

  static async getByLotCode(lotCode: string): Promise<BuyerCandidate[]> {
    const all = await this.getAll();
    return all.filter((c) => !c.lotCode || c.lotCode.toUpperCase() === lotCode.toUpperCase());
  }

  static async getByUserId(userId: string): Promise<BuyerCandidate[]> {
    const all = await this.getAll();
    return all.filter((c) => c.userId === userId);
  }

  /**
   * Count user's active applications (Mission 9)
   */
  static async getActiveBidsCount(userId: string): Promise<number> {
    const userBids = await this.getByUserId(userId);
    return userBids.filter(
      (b) => b.status === 'pending' || b.status === 'under_review' || b.status === 'priority_reserved'
    ).length;
  }

  static async submitBid(data: Partial<BuyerCandidate>): Promise<BuyerCandidate> {
    const userId = data.userId || 'current-user';

    // Mission 9.1: Enforce maximum 3 active purchase applications
    const activeCount = await this.getActiveBidsCount(userId);
    if (activeCount >= MAX_ACTIVE_BIDS_PER_USER) {
      throw new Error(
        'Вы достигли лимита активных заявок (максимум 3). Подача новой заявки станет доступна после завершения отбора по одной из текущих заявок.'
      );
    }

    const newBid: BuyerCandidate = {
      id: `cand-${Date.now()}`,
      code: `B-${Math.floor(400 + Math.random() * 599)}`,
      lotCode: data.lotCode || 'U-10566',
      userId: userId,
      name: data.name || 'Анонимный покупатель',
      location: data.location || 'Санкт-Петербург',
      matchScore: data.buyerTrack === 'full_cash' ? 98 : 94,
      fundingType: data.fundingType || (data.buyerTrack === 'full_cash' ? 'cash' : 'family-mortgage'),
      buyerTrack: data.buyerTrack || 'full_cash',
      creditLimitRub: data.creditLimitRub || 0,
      bankApprovalDocUrl: data.bankApprovalDocUrl,
      bankApprovalDocName: data.bankApprovalDocName,
      bankStatementUrl: data.bankStatementUrl,
      bankStatementName: data.bankStatementName,
      curatorVerified: false,
      readinessTimeline: data.buyerTrack === 'full_cash' 
        ? '100% Кэш через СБР Сбера — 48ч' 
        : `Ипотека одобрена: лимит ${data.creditLimitRub?.toLocaleString('ru-RU')} ₽`,
      availableLiquidity: data.availableLiquidity || (data.buyerTrack === 'full_cash' ? 3000000 : 2500000),
      priorityBadge: data.buyerTrack === 'full_cash' ? 'Кэш 100% + Выписка' : 'Ипотека с документами',
      status: 'pending',
      requestedTimestamp: new Date().toISOString(),
    };

    await FirebaseAdapter.saveEntity(COLLECTION, newBid);
    return newBid;
  }

  /**
   * Verify candidate by curator (Mission 8.2)
   */
  static async verifyCandidate(candidateId: string, curatorName: string): Promise<BuyerCandidate | null> {
    const list = await this.getAll();
    const candidate = list.find((c) => c.id === candidateId || c.code === candidateId);
    if (!candidate) return null;

    candidate.curatorVerified = true;
    candidate.curatorVerifiedAt = new Date().toISOString();
    candidate.curatorVerifiedBy = curatorName;
    candidate.status = 'under_review';

    await FirebaseAdapter.saveEntity(COLLECTION, candidate);
    return candidate;
  }

  /**
   * Accept Winning Candidate with Auto-Exclusion from other lots (Mission 9.2)
   */
  static async acceptCandidate(candidateId: string, lotCode: string): Promise<BuyerCandidate | null> {
    const all = await this.getAll();
    let winner: BuyerCandidate | null = null;

    // 1. Find winner and mark on this lot
    for (const c of all) {
      if ((!c.lotCode || c.lotCode.toUpperCase() === lotCode.toUpperCase()) && (c.id === candidateId || c.code === candidateId)) {
        c.status = 'priority_reserved';
        winner = c;
        await FirebaseAdapter.saveEntity(COLLECTION, c);
      } else if (c.lotCode?.toUpperCase() === lotCode.toUpperCase() && c.id !== candidateId && c.code !== candidateId) {
        c.status = 'declined';
        await FirebaseAdapter.saveEntity(COLLECTION, c);
      }
    }

    // 2. Mission 9.2: Automatically cancel winner's active applications on ALL OTHER lots
    if (winner && winner.userId) {
      for (const otherBid of all) {
        if (
          otherBid.userId === winner.userId &&
          otherBid.lotCode?.toUpperCase() !== lotCode.toUpperCase() &&
          (otherBid.status === 'pending' || otherBid.status === 'under_review')
        ) {
          otherBid.status = 'withdrawn_accepted_elsewhere';
          await FirebaseAdapter.saveEntity(COLLECTION, otherBid);
        }
      }
    }

    // Update Lot status to 'processing'
    await LotsRepository.updateStatus(lotCode, 'processing');

    // Update Deal stage
    await DealsRepository.updateStage(lotCode, 'closing_escrow');

    return winner;
  }

  /**
   * Emergency relist: notify previous candidates when deal is cancelled (Mission 10.5)
   */
  static async notifyCandidatesForRelisting(lotCode: string): Promise<number> {
    const all = await this.getAll();
    const lotCandidates = all.filter(c => c.lotCode?.toUpperCase() === lotCode.toUpperCase());
    
    // Reset declined candidates to 'pending' if they want to re-compete
    let count = 0;
    for (const c of lotCandidates) {
      if (c.status === 'declined' || c.status === 'priority_reserved') {
        c.status = 'pending';
        await FirebaseAdapter.saveEntity(COLLECTION, c);
        count++;
      }
    }
    return count;
  }

  static async updateStatus(candidateId: string, status: BuyerCandidate['status']): Promise<BuyerCandidate | null> {
    const list = await this.getAll();
    const item = list.find((c) => c.id === candidateId || c.code === candidateId);
    if (!item) return null;
    item.status = status;
    await FirebaseAdapter.saveEntity(COLLECTION, item);
    return item;
  }

  static async update(candidate: BuyerCandidate): Promise<BuyerCandidate> {
    await FirebaseAdapter.saveEntity(COLLECTION, candidate);
    return candidate;
  }

  static async getByLot(lotCode: string): Promise<BuyerCandidate[]> {
    return this.getByLotCode(lotCode);
  }
}

