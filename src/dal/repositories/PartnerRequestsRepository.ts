import { PartnerPreliminaryRequest, UserProfile } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'partner_preliminary_requests';

export class PartnerRequestsRepository {
  static async verifyClientCode(clientCode: string): Promise<UserProfile | null> {
    if (!clientCode) return null;
    return UsersRepository.getByClientCode(clientCode);
  }

  static async getAll(): Promise<PartnerPreliminaryRequest[]> {
    const all = await DatabaseGateway.getAll<PartnerPreliminaryRequest>(COLLECTION, []);

    const now = new Date().toISOString();
    for (const req of all) {
      if (req.status === 'pending_client' && req.expiresAt < now) {
        req.status = 'expired';
        await DatabaseGateway.save<PartnerPreliminaryRequest>(COLLECTION, req);
      }
    }

    return all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static async getPendingByClientCode(clientCode: string): Promise<PartnerPreliminaryRequest[]> {
    if (!clientCode) return [];
    const all = await this.getAll();
    const clean = clientCode.trim().toUpperCase();
    return all.filter((r) => r.clientCode.toUpperCase() === clean && r.status === 'pending_client');
  }

  static async getByPartner(
    partnerId: string,
    partnerRefCode?: string
  ): Promise<PartnerPreliminaryRequest[]> {
    const all = await this.getAll();
    const cleanRef = partnerRefCode?.trim().toUpperCase();
    return all.filter(
      (r) =>
        (partnerId && r.partnerId === partnerId) ||
        (cleanRef && r.partnerRefCode.trim().toUpperCase() === cleanRef)
    );
  }

  static async getByPartnerId(partnerId: string): Promise<PartnerPreliminaryRequest[]> {
    const all = await this.getAll();
    const clean = partnerId.trim().toUpperCase();
    return all.filter(
      (r) => r.partnerId === partnerId || r.partnerRefCode.toUpperCase() === clean
    );
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
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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

    await DatabaseGateway.save<PartnerPreliminaryRequest>(COLLECTION, newReq);

    await AuditLogsRepository.addLog({
      operatorId: data.partnerId,
      operatorName: data.partnerName,
      operatorRole: 'client',
      actionType: 'partner_application_submitted',
      title: `Партнер зафиксировал клиента ${newReq.clientCode} на 7 дней`,
      description: `Объект: ${newReq.complexName} (${newReq.developer}). Возврат клиенту: ${newReq.paidAmountRub.toLocaleString('ru-RU')} ₽.`,
    });

    return newReq;
  }

  static async completeByClient(
    requestId: string,
    lotId: string,
    lotCode?: string,
    dealId?: string
  ): Promise<PartnerPreliminaryRequest | null> {
    const all = await this.getAll();
    const item = all.find((r) => r.id === requestId);
    if (!item) return null;

    item.status = 'completed';
    item.activatedLotId = lotId;
    item.activatedLotCode = lotCode;
    item.activatedDealId = dealId;
    await DatabaseGateway.save<PartnerPreliminaryRequest>(COLLECTION, item);
    return item;
  }
}
