import { PartnerEntry } from '../../types';
import { initialPartners } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'partner_applications';
const LEGACY_COLLECTION = 'partners';

export class PartnersRepository {
  static async getAll(): Promise<PartnerEntry[]> {
    const [canonical, legacy] = await Promise.all([
      DatabaseGateway.getAll<PartnerEntry>(COLLECTION, initialPartners),
      DatabaseGateway.getAll<PartnerEntry>(LEGACY_COLLECTION, []),
    ]);

    const merged = new Map<string, PartnerEntry>();
    for (const item of [...legacy, ...canonical]) {
      merged.set(item.id, item);
    }

    return Array.from(merged.values()).sort(
      (a, b) =>
        new Date(b.timestamp || '2026-10-01').getTime() -
        new Date(a.timestamp || '2026-10-01').getTime()
    );
  }

  static async getById(partnerId: string): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    return (
      list.find(
        (p) =>
          p.id === partnerId ||
          p.referralCode === partnerId ||
          p.uid === partnerId ||
          p.userId === partnerId ||
          (p.clientCode && p.clientCode.toUpperCase() === partnerId.toUpperCase())
      ) || null
    );
  }

  static async add(partner: Partial<PartnerEntry>): Promise<PartnerEntry> {
    const nowIso = new Date().toISOString();
    const uid = partner.uid || partner.userId;
    const newPartner: PartnerEntry = {
      id: `partner-${Date.now()}`,
      userId: uid,
      uid,
      clientCode: partner.clientCode || 'DEX-000000',
      timestamp: nowIso,
      name: partner.name || 'Новый партнер',
      role: partner.role || 'Ипотечный брокер',
      organization: partner.organization || 'Независимый эксперт',
      inn: partner.inn,
      email: partner.email,
      city: partner.city,
      category: partner.category || 'mortgage_broker',
      leadsCountMonthly: 0,
      paidBonusesRub: 0,
      pendingBonusesRub: 0,
      fixedRewardPerDealRub: 30000,
      referralCode:
        partner.referralCode || `DOMEXIT-REF-${Math.floor(1000 + Math.random() * 9000)}`,
      phone: partner.phone || '+7 (999) 000-00-00',
      documentIds: partner.documentIds || [],
      status: partner.status || 'pending',
    };

    await DatabaseGateway.save<PartnerEntry>(COLLECTION, newPartner);

    await AuditLogsRepository.addLog({
      operatorId: uid || newPartner.id,
      operatorName: `${newPartner.name} (${newPartner.clientCode})`,
      operatorRole: 'client',
      actionType: 'partner_application_submitted',
      title: `Подана заявка на аккредитацию партнера: ${newPartner.name}`,
      description: `Организация: ${newPartner.organization}. Категория: ${newPartner.category}. Реф-код: ${newPartner.referralCode}.`,
    });

    return newPartner;
  }

  static async approve(
    partnerId: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    const partner = list.find((p) => p.id === partnerId);
    if (!partner) return null;

    partner.status = 'approved';
    partner.rejectionReason = undefined;
    await DatabaseGateway.save<PartnerEntry>(COLLECTION, partner);

    const targetUid = partner.uid || partner.userId;
    if (targetUid) {
      const user = await UsersRepository.getById(targetUid);
      if (user) {
        user.isPartnerApproved = true;
        user.partnerRefCode = partner.referralCode || user.partnerRefCode;
        if (!user.roles.includes('partner')) {
          user.roles.push('partner');
        }
        await UsersRepository.save(user);
      }
    } else if (partner.clientCode) {
      const user = await UsersRepository.getByClientCode(partner.clientCode);
      if (user) {
        user.isPartnerApproved = true;
        user.partnerRefCode = partner.referralCode || user.partnerRefCode;
        if (!user.roles.includes('partner')) {
          user.roles.push('partner');
        }
        await UsersRepository.save(user);
      }
    }

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'partner_application_decided',
      title: `Одобрена аккредитация партнера: ${partner.name} (${partner.organization})`,
      description: `Партнеру активирован реферальный код ${partner.referralCode} и доступ к кабинету B2B.`,
    });

    return partner;
  }

  static async reject(
    partnerId: string,
    reason: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    const partner = list.find((p) => p.id === partnerId);
    if (!partner) return null;

    partner.status = 'rejected';
    partner.rejectionReason = reason;
    await DatabaseGateway.save<PartnerEntry>(COLLECTION, partner);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'partner_application_decided',
      title: `Отклонена заявка партнера: ${partner.name}`,
      description: `Причина отклонения: ${reason}`,
    });

    return partner;
  }

  static async requestDocs(
    partnerId: string,
    notes: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    const partner = list.find((p) => p.id === partnerId);
    if (!partner) return null;

    partner.status = 'docs_requested';
    partner.requestedDocsNotes = notes;
    await DatabaseGateway.save<PartnerEntry>(COLLECTION, partner);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'doc_requested',
      title: `Запрошены дополнительные документы у партнера: ${partner.name}`,
      description: `Комментарий комплаенса: ${notes}`,
    });

    return partner;
  }

  static async recordReferral(refCode: string, leadReward: number = 30000): Promise<void> {
    const list = await this.getAll();
    const clean = refCode.trim().toUpperCase();
    const partner = list.find(
      (p) =>
        p.referralCode.toUpperCase() === clean ||
        p.id.toUpperCase() === clean ||
        p.clientCode?.toUpperCase() === clean
    );
    if (partner) {
      partner.leadsCountMonthly += 1;
      partner.pendingBonusesRub += leadReward;
      await DatabaseGateway.save<PartnerEntry>(COLLECTION, partner);
    }
  }

  static async confirmPayout(
    partnerId: string,
    payoutAmountRub: number,
    transactionNumber: string,
    bankName: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<PartnerEntry | null> {
    const list = await this.getAll();
    const partner = list.find((p) => p.id === partnerId);
    if (!partner) return null;

    const actualAmount = payoutAmountRub > 0 ? payoutAmountRub : partner.pendingBonusesRub || 30000;
    partner.pendingBonusesRub = Math.max(0, (partner.pendingBonusesRub || 0) - actualAmount);
    partner.paidBonusesRub = (partner.paidBonusesRub || 0) + actualAmount;
    partner.lastPayoutAmountRub = actualAmount;
    partner.lastPayoutDate = new Date().toISOString();
    partner.lastPayoutTransactionNumber = transactionNumber;
    partner.lastPayoutBankName = bankName;

    await DatabaseGateway.save<PartnerEntry>(COLLECTION, partner);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'partner_payout_confirmed',
      title: `Подтверждена выплата комиссии партнеру: ${partner.name}`,
      description: `Сумма: ${actualAmount.toLocaleString('ru-RU')} ₽. ПП № ${transactionNumber} (${bankName}). Выплачено на реквизиты партнера.`,
    });

    return partner;
  }
}
