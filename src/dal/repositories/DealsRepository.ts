import { DealTrack } from '../../types';
import { initialDeals } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { LotsRepository } from './LotsRepository';
import { CandidatesRepository } from './CandidatesRepository';
import { AuditLogsRepository } from './AuditLogsRepository';
import { PlatformModeRepository } from './PlatformModeRepository';

const COLLECTION = 'deals';

export class DealsRepository {
  static async getAll(): Promise<DealTrack[]> {
    let list = await DatabaseGateway.getAll<DealTrack>(COLLECTION, []);
    if (PlatformModeRepository.isProductionMode()) {
      const seedIds = new Set(initialDeals.map((d) => d.id));
      list = list.filter((d) => !seedIds.has(d.id) && (d as any).isDemo !== true);
    }
    return list;
  }

  static async getById(dealId: string): Promise<DealTrack | null> {
    if (!dealId) return null;
    const deals = await this.getAll();
    const cleanId = dealId.trim().toUpperCase();
    const found = deals.find(
      (d) =>
        d.dealId.toUpperCase() === cleanId ||
        d.lotCode.toUpperCase() === cleanId ||
        d.id.toUpperCase() === cleanId
    );
    return found || null;
  }

  static async getByEmployee(employeeId: string): Promise<DealTrack[]> {
    const [deals, assignedLots] = await Promise.all([
      this.getAll(),
      LotsRepository.getByAssignedEmployee(employeeId),
    ]);
    const assignedLotCodes = new Set(assignedLots.map((l) => l.lotCode.toUpperCase()));
    return deals.filter(
      (d) =>
        d.assignedEmployeeId === employeeId ||
        assignedLotCodes.has(d.lotCode.toUpperCase())
    );
  }

  static async getBySeller(uid: string, clientCode?: string): Promise<DealTrack[]> {
    const deals = await this.getAll();
    return deals.filter(
      (d) =>
        (uid && d.sellerUserId === uid) ||
        (clientCode && d.sellerClientCode?.toUpperCase() === clientCode.toUpperCase())
    );
  }

  static async getByPartner(partnerRefCode: string): Promise<DealTrack[]> {
    if (!partnerRefCode) return [];
    const clean = partnerRefCode.trim().toUpperCase();
    const deals = await this.getAll();
    return deals.filter((d) => d.partnerRefCode?.trim().toUpperCase() === clean);
  }

  static async updateStage(dealId: string, stage: DealTrack['stage']): Promise<DealTrack | null> {
    const deals = await this.getAll();
    const clean = dealId.trim().toUpperCase();
    const deal = deals.find(
      (d) =>
        d.dealId.toUpperCase() === clean ||
        d.id.toUpperCase() === clean ||
        d.lotCode.toUpperCase() === clean
    );
    if (!deal) return null;
    deal.stage = stage;
    deal.updatedDate = new Date().toISOString().split('T')[0];
    await DatabaseGateway.save<DealTrack>(COLLECTION, deal);
    return deal;
  }

  static async update(deal: DealTrack): Promise<DealTrack> {
    deal.updatedDate = new Date().toISOString().split('T')[0];
    await DatabaseGateway.save<DealTrack>(COLLECTION, deal);
    return deal;
  }

  static async handoverToBank(
    dealId: string,
    curatorName: string,
    bankName: string = 'ПАО Сбербанк'
  ): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.stage = 'closing_escrow';
    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'bank_escrow_deposit',
      bankName,
      escrowAccountNumber: `АК-${Math.floor(10000 + Math.random() * 90000)}/2026-${
        bankName.includes('Сбер') ? 'СБЕР' : bankName.includes('Альфа') ? 'АЛЬФА' : 'ВТБ'
      }`,
      depositedAmountRub: Math.round(deal.sellerReturnRub + deal.sellerReturnRub * 0.025),
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.bankName = bankName;
    deal.escrowWorkflow.step = 'bank_escrow_deposit';
    deal.escrowWorkflow.curatorHandoverAt = new Date().toISOString();

    await this.update(deal);

    await AuditLogsRepository.addLog({
      lotCode: deal.lotCode,
      dealId: deal.dealId,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'escrow_transferred_to_bank',
      title: `Сделка передана в ${bankName} на открытие аккредитива`,
      description: `Куратор проверил пакет цессии и передал реквизиты в банковский шлюз.`,
    });

    return deal;
  }

  static async confirmBankDeposit(
    dealId: string,
    bankOfficerName: string,
    escrowAccount?: string,
    amount?: number
  ): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'signing_photos',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: escrowAccount || 'АК-78401/2026-СБЕР',
      depositedAmountRub: amount || Math.round(deal.sellerReturnRub * 1.025),
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.step = 'signing_photos';
    deal.escrowWorkflow.depositConfirmedAt = new Date().toISOString();
    if (escrowAccount) deal.escrowWorkflow.escrowAccountNumber = escrowAccount;
    if (amount) deal.escrowWorkflow.depositedAmountRub = amount;

    await this.update(deal);

    await AuditLogsRepository.addLog({
      lotCode: deal.lotCode,
      dealId: deal.dealId,
      operatorName: bankOfficerName,
      operatorRole: 'bank_officer',
      actionType: 'escrow_funds_deposited',
      title: `Банк подтвердил депонирование средств: ${deal.escrowWorkflow.depositedAmountRub.toLocaleString('ru-RU')} ₽`,
      description: `Средства заблокированы на номинальном счете ${deal.escrowWorkflow.escrowAccountNumber} до регистрации Росреестра.`,
    });

    return deal;
  }

  static async submitSigningProof(
    dealId: string,
    curatorName: string,
    photos: string[],
    videos: string[],
    rosreestrStampDocUrl: string
  ): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'bank_funds_release',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: 'АК-78401/2026-СБЕР',
      depositedAmountRub: Math.round(deal.sellerReturnRub * 1.025),
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.step = 'bank_funds_release';
    deal.escrowWorkflow.signingProofPhotos = photos;
    deal.escrowWorkflow.signingProofVideos = videos;
    deal.escrowWorkflow.rosreestrStampDocUrl = rosreestrStampDocUrl;

    await this.update(deal);

    await AuditLogsRepository.addLog({
      lotCode: deal.lotCode,
      dealId: deal.dealId,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'signing_proof_uploaded',
      title: 'Фото/видеофиксация подписания и штамп Росреестра загружены',
      description: `Загружено ${photos.length} фото подписания, ${videos.length} видеозаписей и скан выписки ЕГРН с ЭЦП регистратора.`,
    });

    return deal;
  }

  static async releaseEscrowFunds(dealId: string, bankOfficerName: string): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'deal_finalized',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: 'АК-78401/2026-СБЕР',
      depositedAmountRub: Math.round(deal.sellerReturnRub * 1.025),
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.step = 'deal_finalized';
    deal.escrowWorkflow.fundsReleasedAt = new Date().toISOString();
    deal.escrowWorkflow.platformFeeRub = Math.round(deal.sellerReturnRub * 0.025);
    deal.stage = 'completed';
    deal.daysLeft = 0;
    if (deal.partnerRefCode) {
      deal.partnerPayoutStatus = 'paid';
    }

    const lot = await LotsRepository.getByCode(deal.lotCode);
    if (lot) {
      lot.status = 'closed';
      lot.currentStage = 5;
      await LotsRepository.update(lot);
    }

    await this.update(deal);

    await AuditLogsRepository.addLog({
      lotCode: deal.lotCode,
      dealId: deal.dealId,
      operatorName: bankOfficerName,
      operatorRole: 'bank_officer',
      actionType: 'escrow_released',
      title: `Аккредитив раскрыт: ${deal.sellerReturnRub.toLocaleString('ru-RU')} ₽ выплачено продавцу`,
      description: `Сделка успешно завершена. Комиссия DomExit (2.5% = ${deal.escrowWorkflow.platformFeeRub?.toLocaleString('ru-RU')} ₽) перечислена.`,
    });

    return deal;
  }

  static async cancelDealAndRelist(
    dealId: string,
    curatorName: string,
    reason: string
  ): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'deal_cancelled',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: '',
      depositedAmountRub: 0,
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.step = 'deal_cancelled';
    deal.stage = 'buyer_matching';

    await LotsRepository.relistLot(deal.lotCode, curatorName, reason);

    const candidates = await CandidatesRepository.getByLot(deal.lotCode);
    for (const c of candidates) {
      if (c.status === 'declined' || c.status === 'under_review' || c.status === 'priority_reserved') {
        c.status = 'pending';
        c.priorityBadge = 'Лот снова доступен (Спец-уведомление)';
        await CandidatesRepository.update(c);
      }
    }

    await this.update(deal);

    await AuditLogsRepository.addLog({
      lotCode: deal.lotCode,
      dealId: deal.dealId,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'deal_cancelled_relisted',
      title: `Срыв сделки: Лот #${deal.lotCode} возвращен в открытый каталог`,
      description: `Причина: ${reason}. Всем ${candidates.length} прежним кандидатам направлен пуш о повторной доступности лота.`,
    });

    return deal;
  }

  static async addDeal(deal: Partial<DealTrack>): Promise<DealTrack> {
    const generatedLotCode = deal.lotCode || `U-${Math.floor(10000 + Math.random() * 90000)}`;
    const newDeal: DealTrack = {
      id: deal.id || `deal-${Date.now()}`,
      dealId:
        deal.dealId ||
        `DEAL-${new Date().getFullYear()}-${generatedLotCode.replace(/[^0-9]/g, '') || Math.floor(10000 + Math.random() * 90000)}`,
      lotCode: generatedLotCode,
      lotTitle: deal.lotTitle || 'Новый выход ДДУ',
      complexName: deal.complexName,
      developer: deal.developer || 'Застройщик РФ',
      city: deal.city,
      district: deal.district,
      sellerName: deal.sellerName,
      sellerUserId: deal.sellerUserId,
      sellerClientCode: deal.sellerClientCode,
      buyerName: deal.buyerName,
      buyerUserId: deal.buyerUserId,
      buyerClientCode: deal.buyerClientCode,
      partnerRefCode: deal.partnerRefCode,
      partnerRewardRub: deal.partnerRewardRub,
      partnerPayoutStatus: deal.partnerPayoutStatus,
      route: deal.route || 'ddu_assignment',
      stage: deal.stage || 'initial_audit',
      daysLeft: deal.daysLeft ?? 14,
      sellerReturnRub: deal.sellerReturnRub || 2500000,
      discountRub: deal.discountRub || 1500000,
      fsspClear: deal.fsspClear ?? true,
      efrsbClear: deal.efrsbClear ?? true,
      matchingCandidatesCount: deal.matchingCandidatesCount ?? 0,
      clientName: deal.clientName || deal.sellerName || 'Новый клиент',
      curatorName: deal.curatorName || 'Ожидает назначения куратора',
      assignedEmployeeId: deal.assignedEmployeeId,
      createdDate: deal.createdDate || new Date().toISOString().split('T')[0],
      updatedDate: new Date().toISOString().split('T')[0],
      escrowWorkflow: deal.escrowWorkflow || {
        step: 'curator_review',
        bankName: 'ПАО Сбербанк',
        escrowAccountNumber: `АК-${Math.floor(10000 + Math.random() * 90000)}/2026-СБЕР`,
        depositedAmountRub: Math.round((deal.sellerReturnRub || 2500000) * 1.025),
        signingProofPhotos: [],
        signingProofVideos: [],
      },
    };
    await DatabaseGateway.save<DealTrack>(COLLECTION, newDeal);
    return newDeal;
  }
}
