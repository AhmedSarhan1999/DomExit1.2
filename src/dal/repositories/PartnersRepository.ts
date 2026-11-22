import { PartnerEntry } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'partner_applications';
const LEGACY_COLLECTION = 'partners';

export class PartnersRepository {
  static async getAll(): Promise<PartnerEntry[]> {
    const [canonical, legacy] = await Promise.all([
      DatabaseGateway.getAll<PartnerEntry>(COLLECTION, []),
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
    const generatedRef = `PART-${Math.floor(1000 + Math.random() * 9000)}`;

    const newPartner: PartnerEntry = {
      id: partner.id || `partner-${Date.now()}`,
      userId: uid,
      uid,
      clientCode: partner.clientCode || 'DEX-000000',
      timestamp: nowIso,
      name: partner.name || 'Новый партнер',
      role: partner.role || 'Ипотечный брокер',
      organization: partner.organization || 'Независимый эксперт',
      inn: partner.inn,
      email: partner.email?.trim().toLowerCase(),
      city: partner.city,
      category: partner.category || 'mortgage_broker',
      leadsCountMonthly: 0,
      paidBonusesRub: 0,
      pendingBonusesRub: 0,
      fixedRewardPerDealRub: 30000,
      referralCode: partner.referralCode || generatedRef,
      phone: partner.phone || '+7 (999) 000-00-00',
      documentIds: partner.documentIds || [],
      status: partner.status || 'pending',
      isApproved: partner.status === 'approved',
    };

    // Save to both collections for guaranteed consistency
    await Promise.all([
      DatabaseGateway.save<PartnerEntry>(COLLECTION, newPartner),
      DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, newPartner),
    ]);

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

    const nowIso = new Date().toISOString();
    const cleanRef = partner.referralCode && partner.referralCode.startsWith('PART-')
      ? partner.referralCode
      : `PART-${Math.floor(1000 + Math.random() * 9000)}`;

    partner.status = 'approved';
    partner.isApproved = true;
    partner.referralCode = cleanRef;
    partner.fixedRewardPerDealRub = 30000;
    partner.approvedAt = nowIso;
    partner.approvedBy = operatorName;
    partner.rejectionReason = undefined;

    // Dual-write to keep both tables in sync
    await Promise.all([
      DatabaseGateway.save<PartnerEntry>(COLLECTION, partner),
      DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, partner),
    ]);

    // Atomic User Role Upgrade while strictly preserving passwordHash
    const targetUid = partner.uid || partner.userId;
    let targetUser = targetUid ? await UsersRepository.getById(targetUid) : null;

    if (!targetUser && partner.clientCode) {
      targetUser = await UsersRepository.getByClientCode(partner.clientCode);
    }
    if (!targetUser && partner.email) {
      targetUser = await UsersRepository.getByEmail(partner.email);
    }

    if (targetUser) {
      targetUser.isPartnerApproved = true;
      targetUser.partnerId = partner.id;
      targetUser.partnerRefCode = cleanRef;
      targetUser.referralCode = cleanRef;
      if (!targetUser.roles.includes('partner')) {
        targetUser.roles.push('partner');
      }
      await UsersRepository.save(targetUser);
    }

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'partner_application_decided',
      title: `Одобрена аккредитация партнера: ${partner.name} (${partner.organization})`,
      description: `Партнеру активирован реферальный код ${cleanRef} и предоставлен доступ к кабинету B2B. Вознаграждение: 30 000 ₽ / сделка.`,
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
    partner.isApproved = false;
    partner.rejectionReason = reason;

    await Promise.all([
      DatabaseGateway.save<PartnerEntry>(COLLECTION, partner),
      DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, partner),
    ]);

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

    await Promise.all([
      DatabaseGateway.save<PartnerEntry>(COLLECTION, partner),
      DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, partner),
    ]);

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
      partner.leadsCountMonthly = (partner.leadsCountMonthly || 0) + 1;
      partner.pendingBonusesRub = (partner.pendingBonusesRub || 0) + leadReward;
      await Promise.all([
        DatabaseGateway.save<PartnerEntry>(COLLECTION, partner),
        DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, partner),
      ]);
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

    await Promise.all([
      DatabaseGateway.save<PartnerEntry>(COLLECTION, partner),
      DatabaseGateway.save<PartnerEntry>(LEGACY_COLLECTION, partner),
    ]);

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
