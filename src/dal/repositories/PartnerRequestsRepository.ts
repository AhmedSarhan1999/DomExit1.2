import { PartnerPreliminaryRequest, UserProfile } from '../../types';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'partner_preliminary_requests';

export class PartnerRequestsRepository {
  /**
   * Verify if a client account with given DEX-XXXXXX exists
   */
  static async verifyClientCode(clientCode: string): Promise<UserProfile | null> {
    if (!clientCode) return null;
    const cleanCode = clientCode.trim().toUpperCase();

    // Check users collection in LocalStorage / Firestore
    const users = await FirebaseAdapter.getAllEntities<UserProfile>('users', []);
    const found = users.find(u => u.clientCode?.toUpperCase() === cleanCode);
    if (found) return found;

    // Check demo profiles
    const demoProfiles: Array<Partial<UserProfile>> = [
      { id: 'usr-seller-alex', clientCode: 'DEX-784105', name: 'Александр Владимирович Б.', phone: '+7 (911) 234-56-78' },
      { id: 'usr-buyer-ivan', clientCode: 'DEX-409112', name: 'Иван Петрович К.', phone: '+7 (921) 987-65-43' },
      { id: 'usr-investor-sergey', clientCode: 'DEX-990088', name: 'Сергей Николаевич К.', phone: '+7 (921) 777-99-00' },
      { id: 'usr-partner-elena', clientCode: 'DEX-110022', name: 'Елена Смирнова', phone: '+7 (911) 456-78-90' },
    ];
    const demo = demoProfiles.find(d => d.clientCode === cleanCode);
    if (demo) {
      return demo as UserProfile;
    }

    return null;
  }

  static async getAll(): Promise<PartnerPreliminaryRequest[]> {
    const all = await FirebaseAdapter.getAllEntities<PartnerPreliminaryRequest>(COLLECTION, [
      {
        id: 'pref-seed-1',
        partnerId: 'partner-1',
        partnerName: 'Елена Смирнова (Агентство Недвижимости)',
        partnerRefCode: 'PARTNER-SPB-12',
        clientCode: 'DEX-784105',
        clientUserId: 'usr-seller-alex',
        clientName: 'Александр Владимирович Б.',
        clientPhone: '+7 (911) 234-56-78',
        complexName: 'ЖК Чистое Небо (Корпус 12)',
        developer: 'Setl Group',
        paidAmountRub: 2485230,
        contractPriceRub: 10972000,
        remainingDebtRub: 8486770,
        notes: 'Дольщик не справляется с квартальным платежом 210 000 ₽. Требуется срочный чистый выход 100%.',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending_client',
      }
    ]);

    // Check for expirations automatically
    const now = new Date().toISOString();
    let updated = false;
    for (const req of all) {
      if (req.status === 'pending_client' && req.expiresAt < now) {
        req.status = 'expired';
        updated = true;
        await FirebaseAdapter.saveEntity(COLLECTION, req);
      }
    }

    return all;
  }

  static async getPendingByClientCode(clientCode: string): Promise<PartnerPreliminaryRequest[]> {
    const all = await this.getAll();
    const clean = clientCode.trim().toUpperCase();
    return all.filter(r => r.clientCode.toUpperCase() === clean && r.status === 'pending_client');
  }

  static async getByPartnerId(partnerId: string): Promise<PartnerPreliminaryRequest[]> {
    const all = await this.getAll();
    return all.filter(r => r.partnerId === partnerId || r.partnerRefCode === partnerId);
  }

  static async createPreliminaryRequest(data: {
    partnerId: string;
    partnerName: string;
    partnerRefCode: string;
    clientCode: string;
    clientName: string;
    clientPhone: string;
    complexName: string;
    developer: string;
    paidAmountRub: number;
    contractPriceRub: number;
    notes?: string;
  }): Promise<PartnerPreliminaryRequest> {
    const clientUser = await this.verifyClientCode(data.clientCode);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 full days

    const newReq: PartnerPreliminaryRequest = {
      id: `pref-${Date.now()}`,
      partnerId: data.partnerId,
      partnerName: data.partnerName,
      partnerRefCode: data.partnerRefCode,
      clientCode: data.clientCode.trim().toUpperCase(),
      clientUserId: clientUser?.id,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      complexName: data.complexName,
      developer: data.developer,
      paidAmountRub: data.paidAmountRub,
      contractPriceRub: data.contractPriceRub,
      remainingDebtRub: Math.max(0, data.contractPriceRub - data.paidAmountRub),
      notes: data.notes,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending_client',
    };

    await FirebaseAdapter.saveEntity(COLLECTION, newReq);
    return newReq;
  }

  static async completeByClient(requestId: string, lotId: string): Promise<PartnerPreliminaryRequest | null> {
    const all = await this.getAll();
    const item = all.find(r => r.id === requestId);
    if (!item) return null;

    item.status = 'completed';
    item.activatedLotId = lotId;
    await FirebaseAdapter.saveEntity(COLLECTION, item);
    return item;
  }
}
