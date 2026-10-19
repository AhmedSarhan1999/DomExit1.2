import { InvestorApplication } from '../../types';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'investor_applications';

export class InvestorClubRepository {
  static async submit(app: Omit<InvestorApplication, 'id' | 'timestamp'>): Promise<InvestorApplication> {
    const newEntry: InvestorApplication = {
      ...app,
      id: `investor-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    await FirebaseAdapter.saveEntity(COLLECTION, newEntry);
    return newEntry;
  }

  static async getAll(): Promise<InvestorApplication[]> {
    return FirebaseAdapter.getAllEntities<InvestorApplication>(COLLECTION, [
      {
        id: 'inv-seed-1',
        fullName: 'Руслан Ахмедов',
        companyOrFund: 'Capital North Fund',
        countryAndCity: 'Санкт-Петербург',
        contactTelegramOrPhone: '+7 911 888-00-11',
        entityType: 'fund',
        capitalVolume: '50-200m',
        strategy: 'flipping',
        targetRegions: ['Санкт-Петербург (Приморский, Московский)'],
        requestedServices: ['Оптовый выкуп пула ДДУ со скидкой >22%'],
        customProposal: 'Готовы выкупать от 3 до 5 квартир в месяц под чистовую отделку.',
        ndaAgreed: true,
        status: 'approved',
        timestamp: '2026-10-18T10:00:00Z',
      }
    ]);
  }

  static async approve(applicationId: string): Promise<InvestorApplication | null> {
    const list = await this.getAll();
    const app = list.find((a) => a.id === applicationId);
    if (!app) return null;
    app.status = 'approved';
    await FirebaseAdapter.saveEntity(COLLECTION, app);
    return app;
  }
}
