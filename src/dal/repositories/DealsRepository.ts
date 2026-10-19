import { DealTrack } from '../../types';
import { initialDeals } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'deals';

export class DealsRepository {
  static async getAll(): Promise<DealTrack[]> {
    return FirebaseAdapter.getAllEntities<DealTrack>(COLLECTION, initialDeals);
  }

  static async getById(dealId: string): Promise<DealTrack | null> {
    const deals = await this.getAll();
    const cleanId = dealId.toUpperCase();
    const found = deals.find(
      (d) => d.dealId.toUpperCase() === cleanId || d.lotCode.toUpperCase() === cleanId || d.id === dealId
    );
    return found || null;
  }

  static async updateStage(dealId: string, stage: DealTrack['stage']): Promise<DealTrack | null> {
    const deals = await this.getAll();
    const deal = deals.find((d) => d.dealId === dealId || d.id === dealId || d.lotCode === dealId);
    if (!deal) return null;
    deal.stage = stage;
    deal.updatedDate = new Date().toISOString().split('T')[0];
    await FirebaseAdapter.saveEntity(COLLECTION, deal);
    return deal;
  }

  static async addDeal(deal: Partial<DealTrack>): Promise<DealTrack> {
    const newDeal: DealTrack = {
      id: `deal-${Date.now()}`,
      dealId: `DEAL-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      lotCode: deal.lotCode || `U-${Math.floor(10000 + Math.random() * 90000)}`,
      lotTitle: deal.lotTitle || 'Новый выход ДДУ',
      developer: deal.developer || 'Застройщик СПб',
      route: deal.route || 'ddu_assignment',
      stage: deal.stage || 'initial_audit',
      daysLeft: deal.daysLeft || 14,
      sellerReturnRub: deal.sellerReturnRub || 2500000,
      discountRub: deal.discountRub || 1500000,
      fsspClear: true,
      efrsbClear: true,
      matchingCandidatesCount: 1,
      clientName: deal.clientName || 'Новый клиент',
      curatorName: 'Алексей Смирнов',
      createdDate: new Date().toISOString().split('T')[0],
      updatedDate: new Date().toISOString().split('T')[0],
    };
    await FirebaseAdapter.saveEntity(COLLECTION, newDeal);
    return newDeal;
  }
}
