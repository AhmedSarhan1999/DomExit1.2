import { DealTrack } from '../../types';
import { initialDeals } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { LotsRepository } from './LotsRepository';
import { CandidatesRepository } from './CandidatesRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

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

  static async update(deal: DealTrack): Promise<DealTrack> {
    deal.updatedDate = new Date().toISOString().split('T')[0];
    await FirebaseAdapter.saveEntity(COLLECTION, deal);
    return deal;
  }

  /**
   * Step A (Mission 10.1): Curator review complete & handover to Partner Bank
   */
  static async handoverToBank(dealId: string, curatorName: string, bankName: string = 'ПАО Сбербанк'): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.stage = 'closing_escrow';
    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'bank_escrow_deposit',
      bankName,
      escrowAccountNumber: `АК-${Math.floor(10000 + Math.random() * 90000)}/2026-${bankName.includes('Сбер') ? 'СБЕР' : 'ВТБ'}`,
      depositedAmountRub: deal.sellerReturnRub + (deal.sellerReturnRub * 0.025),
      signingProofPhotos: [],
      signingProofVideos: [],
    };
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

  /**
   * Step B (Mission 10.2): Bank officer confirms escrow account and buyer deposit
   */
  static async confirmBankDeposit(dealId: string, bankOfficerName: string, escrowAccount?: string, amount?: number): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'signing_photos',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: escrowAccount || 'АК-78401/2026-СБЕР',
      depositedAmountRub: amount || 2759530,
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
      title: `Банк подтвердил депонирование средств: ${deal.escrowWorkflow.depositedAmountRub.toLocaleString()} ₽`,
      description: `Средства заблокированы на номинальном счете ${deal.escrowWorkflow.escrowAccountNumber} до регистрации Росреестра.`,
    });

    return deal;
  }

  /**
   * Step C (Mission 10.3): Curator uploads signing session photo/video proof & Rosreestr registration stamp
   */
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
      depositedAmountRub: 2759530,
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

  /**
   * Step D (Mission 10.4): Bank officer releases escrow funds to seller, pays platform fee 2.5%, closes deal
   */
  static async releaseEscrowFunds(dealId: string, bankOfficerName: string): Promise<DealTrack | null> {
    const deal = await this.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = deal.escrowWorkflow || {
      step: 'deal_finalized',
      bankName: 'ПАО Сбербанк',
      escrowAccountNumber: 'АК-78401/2026-СБЕР',
      depositedAmountRub: 2759530,
      signingProofPhotos: [],
      signingProofVideos: [],
    };
    deal.escrowWorkflow.step = 'deal_finalized';
    deal.escrowWorkflow.fundsReleasedAt = new Date().toISOString();
    deal.escrowWorkflow.platformFeeRub = Math.round(deal.sellerReturnRub * 0.025);
    deal.stage = 'closing_escrow';
    deal.daysLeft = 0;

    // Mark lot closed
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
      title: `Аккредитив раскрыт: ${deal.sellerReturnRub.toLocaleString()} ₽ выплачено продавцу`,
      description: `Сделка успешно завершена. Комиссия DomExit (2.5% = ${deal.escrowWorkflow.platformFeeRub?.toLocaleString()} ₽) списана.`,
    });

    return deal;
  }

  /**
   * Step E (Mission 10.5): Emergency cancel & relist lot with candidate auto-push
   */
  static async cancelDealAndRelist(dealId: string, curatorName: string, reason: string): Promise<DealTrack | null> {
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

    // 1. Relist lot back to catalog
    await LotsRepository.relistLot(deal.lotCode, curatorName, reason);

    // 2. Notify past candidates for this lot
    const candidates = await CandidatesRepository.getByLot(deal.lotCode);
    for (const c of candidates) {
      if (c.status === 'declined' || c.status === 'under_review') {
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
      escrowWorkflow: {
        step: 'curator_review',
        bankName: 'ПАО Сбербанк',
        escrowAccountNumber: 'АК-78401/2026-СБЕР',
        depositedAmountRub: 2759530,
        signingProofPhotos: [
          'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
        ],
        signingProofVideos: [
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        ],
        rosreestrStampDocUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80',
      },
    };
    await FirebaseAdapter.saveEntity(COLLECTION, newDeal);
    return newDeal;
  }
}

