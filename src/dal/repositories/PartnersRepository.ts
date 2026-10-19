import { PartnerEntry } from '../../types';
import { initialPartners } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'partners';

export class PartnersRepository {
  static async getAll(): Promise<PartnerEntry[]> {
    return FirebaseAdapter.getAllEntities<PartnerEntry>(COLLECTION, initialPartners);
  }

  static async getById(partnerId: string): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    return list.find((p) => p.id === partnerId || p.referralCode === partnerId) || null;
  }

  static async add(partner: Partial<PartnerEntry>): Promise<PartnerEntry> {
    const newPartner: PartnerEntry = {
      id: `partner-${Date.now()}`,
      userId: partner.userId,
      name: partner.name || 'Новый партнер',
      role: partner.role || 'Ипотечный брокер',
      organization: partner.organization || 'Независимый эксперт',
      category: partner.category || 'mortgage_broker',
      leadsCountMonthly: 0,
      paidBonusesRub: 0,
      pendingBonusesRub: 0,
      fixedRewardPerDealRub: 30000,
      referralCode: partner.referralCode || `DOMEXIT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: partner.phone || '+7 (999) 000-00-00',
      status: partner.status || 'pending',
    };
    await FirebaseAdapter.saveEntity(COLLECTION, newPartner);
    return newPartner;
  }

  static async approve(partnerId: string): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    const partner = list.find((p) => p.id === partnerId);
    if (!partner) return null;
    partner.status = 'approved';
    await FirebaseAdapter.saveEntity(COLLECTION, partner);
    return partner;
  }

  static async recordReferral(refCode: string, leadReward: number = 30000): Promise<void> {
    const list = await this.getAll();
    const partner = list.find((p) => p.referralCode === refCode || p.id === refCode);
    if (partner) {
      partner.leadsCountMonthly += 1;
      partner.pendingBonusesRub += leadReward;
      await FirebaseAdapter.saveEntity(COLLECTION, partner);
    }
  }
}
