import { BuyerCandidate } from '../../types';
import { initialCandidates } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { LotsRepository } from './LotsRepository';
import { DealsRepository } from './DealsRepository';

const COLLECTION = 'candidates';

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

  static async submitBid(data: Partial<BuyerCandidate>): Promise<BuyerCandidate> {
    const newBid: BuyerCandidate = {
      id: `cand-${Date.now()}`,
      code: `B-${Math.floor(400 + Math.random() * 599)}`,
      lotCode: data.lotCode || 'U-10566',
      userId: data.userId || 'current-user',
      name: data.name || 'Анонимный покупатель',
      location: data.location || 'Санкт-Петербург',
      matchScore: data.buyerTrack === 'full_cash' ? 98 : 94,
      fundingType: data.fundingType || (data.buyerTrack === 'full_cash' ? 'cash' : 'family-mortgage'),
      buyerTrack: data.buyerTrack || 'full_cash',
      creditLimitRub: data.creditLimitRub || 0,
      bankApprovalDocUrl: data.bankApprovalDocUrl,
      bankApprovalDocName: data.bankApprovalDocName,
      readinessTimeline: data.buyerTrack === 'full_cash' 
        ? '100% Кэш через СБР Сбера — 48ч' 
        : `Ипотека одобрена: лимит ${data.creditLimitRub?.toLocaleString('ru-RU')} ₽`,
      availableLiquidity: data.availableLiquidity || (data.buyerTrack === 'full_cash' ? 3000000 : 2500000),
      priorityBadge: data.buyerTrack === 'full_cash' ? 'Кэш 100%' : 'Ипотека с документами',
      status: 'pending',
      requestedTimestamp: new Date().toISOString(),
    };

    await FirebaseAdapter.saveEntity(COLLECTION, newBid);
    return newBid;
  }

  static async acceptCandidate(candidateId: string, lotCode: string): Promise<BuyerCandidate | null> {
    const all = await this.getAll();
    let winner: BuyerCandidate | null = null;

    for (const c of all) {
      if ((!c.lotCode || c.lotCode === lotCode) && (c.id === candidateId || c.code === candidateId)) {
        c.status = 'priority_reserved';
        winner = c;
        await FirebaseAdapter.saveEntity(COLLECTION, c);
      } else if (c.lotCode === lotCode && c.id !== candidateId) {
        c.status = 'declined';
        await FirebaseAdapter.saveEntity(COLLECTION, c);
      }
    }

    // Update Lot status to 'processing'
    await LotsRepository.updateStatus(lotCode, 'processing');

    // Update Deal stage
    await DealsRepository.updateStage(lotCode, 'closing_escrow');

    return winner;
  }

  static async updateStatus(candidateId: string, status: BuyerCandidate['status']): Promise<BuyerCandidate | null> {
    const list = await this.getAll();
    const item = list.find((c) => c.id === candidateId || c.code === candidateId);
    if (!item) return null;
    item.status = status;
    await FirebaseAdapter.saveEntity(COLLECTION, item);
    return item;
  }
}
