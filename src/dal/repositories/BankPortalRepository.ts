import { BankEmployee, SpecialApprovalRequest, BuyerCreditLimitRequest, DealTrack, Lot } from '../../types';
import { initialBankEmployees } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { DealsRepository } from './DealsRepository';
import { LotsRepository } from './LotsRepository';

const BANK_EMP_COLLECTION = 'bank_employees';
const SPECIAL_APPROVAL_COLLECTION = 'bank_special_approvals';
const CREDIT_LIMITS_COLLECTION = 'bank_credit_limits';

export class BankPortalRepository {
  // 1. Bank Employees Management
  static async getAllBankEmployees(): Promise<BankEmployee[]> {
    return FirebaseAdapter.getAllEntities<BankEmployee>(BANK_EMP_COLLECTION, initialBankEmployees);
  }

  static async addBankEmployee(data: Partial<BankEmployee>): Promise<BankEmployee> {
    const newEmp: BankEmployee = {
      id: `bank-emp-${Date.now()}`,
      name: data.name || 'Специалист банка',
      email: data.email || 'officer@sberbank.ru',
      role: data.role || 'officer',
      bankName: data.bankName || 'Сбербанк',
      status: 'active',
      phone: data.phone || '+7 (812) 500-00-00',
      createdAt: new Date().toISOString(),
    };
    await FirebaseAdapter.saveEntity(BANK_EMP_COLLECTION, newEmp);
    return newEmp;
  }

  static async toggleBankEmployeeStatus(id: string): Promise<BankEmployee | null> {
    const employees = await this.getAllBankEmployees();
    const emp = employees.find(e => e.id === id);
    if (!emp) return null;
    emp.status = emp.status === 'active' ? 'suspended' : 'active';
    await FirebaseAdapter.saveEntity(BANK_EMP_COLLECTION, emp);
    return emp;
  }

  // 2. Special Property Approval Requests (Запрос спец-одобрения объекта в банк)
  static async getAllSpecialApprovals(): Promise<SpecialApprovalRequest[]> {
    return FirebaseAdapter.getAllEntities<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, [
      {
        id: 'spec-1',
        lotId: 'lot-3',
        lotCode: 'U-18290',
        complexName: 'ЖК «Морская Набережная» (Нетиповой застройщик)',
        developer: 'Группа ЛСР (Субподрядчик)',
        contractPriceRub: 14500000,
        requestedByEmployeeId: 'emp-1',
        requestedByEmployeeName: 'Алексей Смирнов',
        bankName: 'Сбербанк',
        reason: 'Малый подрядчик, нестандартный график платежей рассрочки. Запрос специальной аккредитации для эскроу-переуступки.',
        requestedAt: '2026-10-18T14:30:00Z',
        status: 'pending',
      }
    ]);
  }

  static async requestSpecialApproval(data: {
    lotId: string;
    lotCode: string;
    complexName: string;
    developer: string;
    contractPriceRub: number;
    requestedByEmployeeId: string;
    requestedByEmployeeName: string;
    bankName: string;
    reason: string;
  }): Promise<SpecialApprovalRequest> {
    const newReq: SpecialApprovalRequest = {
      id: `spec-${Date.now()}`,
      ...data,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    await FirebaseAdapter.saveEntity(SPECIAL_APPROVAL_COLLECTION, newReq);

    // Update lot status flag
    const lot = await LotsRepository.getByCode(data.lotCode);
    if (lot) {
      lot.specialApprovalStatus = 'pending';
      lot.specialApprovalBank = data.bankName;
      await LotsRepository.update(lot);
    }

    return newReq;
  }

  static async decideSpecialApproval(
    requestId: string,
    decision: 'approved' | 'rejected',
    notes: string,
    decidedBy: string
  ): Promise<SpecialApprovalRequest | null> {
    const all = await this.getAllSpecialApprovals();
    const req = all.find(r => r.id === requestId);
    if (!req) return null;

    req.status = decision;
    req.decisionNotes = notes;
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decidedBy;
    await FirebaseAdapter.saveEntity(SPECIAL_APPROVAL_COLLECTION, req);

    // Update lot status
    const lot = await LotsRepository.getByCode(req.lotCode);
    if (lot) {
      lot.specialApprovalStatus = decision;
      await LotsRepository.update(lot);
    }

    return req;
  }

  // 3. Buyer Credit Limit Requests & Bank Stamp Certification
  static async getAllCreditLimitRequests(): Promise<BuyerCreditLimitRequest[]> {
    return FirebaseAdapter.getAllEntities<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, [
      {
        id: 'limit-req-1',
        userId: 'usr-buyer-ivan',
        clientCode: 'DEX-409112',
        userName: 'Иван Петрович К.',
        userPhone: '+7 (921) 987-65-43',
        userEmail: 'ivan.buyer@yandex.ru',
        requestedAmountRub: 8500000,
        approvedLimitRub: 9000000,
        validUntil: '2026-12-31',
        bankName: 'Сбербанк',
        certificateNumber: 'SBER-CREDIT-99214',
        reviewedBy: 'Игорь Владимирович Соколов (Сбербанк)',
        requestedAt: '2026-10-15T10:00:00Z',
        reviewedAt: '2026-10-16T12:00:00Z',
        status: 'approved',
        notes: 'Доход подтвержден по 2-НДФЛ. Лимит подтвержден для семейной ипотеки и переуступок.',
      }
    ]);
  }

  static async requestCreditLimit(data: {
    userId: string;
    clientCode: string;
    userName: string;
    userPhone: string;
    userEmail?: string;
    requestedAmountRub: number;
    bankName: string;
  }): Promise<BuyerCreditLimitRequest> {
    const newReq: BuyerCreditLimitRequest = {
      id: `limit-req-${Date.now()}`,
      ...data,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    await FirebaseAdapter.saveEntity(CREDIT_LIMITS_COLLECTION, newReq);
    return newReq;
  }

  static async approveCreditLimit(
    requestId: string,
    approvedLimitRub: number,
    validUntil: string,
    reviewedBy: string,
    notes?: string
  ): Promise<BuyerCreditLimitRequest | null> {
    const list = await this.getAllCreditLimitRequests();
    const item = list.find(r => r.id === requestId);
    if (!item) return null;

    item.status = 'approved';
    item.approvedLimitRub = approvedLimitRub;
    item.validUntil = validUntil;
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date().toISOString();
    item.certificateNumber = `${item.bankName.toUpperCase()}-STAMP-${Math.floor(10000 + Math.random() * 90000)}`;
    item.notes = notes;

    await FirebaseAdapter.saveEntity(CREDIT_LIMITS_COLLECTION, item);

    // Sync to user profile if exists
    try {
      const user = await FirebaseAdapter.getEntity<any>('users', item.userId);
      if (user) {
        user.bankCreditLimit = {
          approvedLimitRub,
          validUntil,
          certificateNumber: item.certificateNumber,
          bankName: item.bankName,
          issuedAt: new Date().toISOString(),
        };
        await FirebaseAdapter.saveEntity('users', user);
      }
    } catch {}

    return item;
  }

  // 4. Escrow & Deal Coordination (Аккредитив / СБР)
  static async confirmEscrowDeposit(
    dealId: string, 
    officerName: string, 
    depositedAmount: number
  ): Promise<DealTrack | null> {
    const deal = await DealsRepository.getById(dealId);
    if (!deal) return null;

    deal.escrowWorkflow = {
      ...(deal.escrowWorkflow || {
        bankName: 'Сбербанк',
        escrowAccountNumber: `АК-78401/2026-СБЕР`,
        signingProofPhotos: [],
        signingProofVideos: [],
      }),
      step: 'signing_photos',
      bankName: deal.escrowWorkflow?.bankName || 'Сбербанк',
      escrowAccountNumber: deal.escrowWorkflow?.escrowAccountNumber || `АК-78401/2026-СБЕР`,
      depositedAmountRub: depositedAmount,
      depositConfirmedAt: new Date().toISOString(),
      signingProofPhotos: deal.escrowWorkflow?.signingProofPhotos || [],
      signingProofVideos: deal.escrowWorkflow?.signingProofVideos || [],
    };

    await DealsRepository.updateStage(dealId, 'closing_escrow');
    return deal;
  }

  static async releaseEscrowFunds(
    dealId: string,
    officerName: string
  ): Promise<DealTrack | null> {
    const deal = await DealsRepository.getById(dealId);
    if (!deal) return null;

    const commission = Math.round((deal.sellerReturnRub || 2500000) * 0.025);

    deal.escrowWorkflow = {
      ...(deal.escrowWorkflow || {
        bankName: 'Сбербанк',
        escrowAccountNumber: `АК-78401/2026-СБЕР`,
        depositedAmountRub: deal.sellerReturnRub || 2500000,
        signingProofPhotos: [],
        signingProofVideos: [],
      }),
      step: 'deal_finalized',
      fundsReleasedAt: new Date().toISOString(),
      platformFeeRub: commission,
      signingProofPhotos: deal.escrowWorkflow?.signingProofPhotos || [],
      signingProofVideos: deal.escrowWorkflow?.signingProofVideos || [],
    };

    deal.stage = 'closing_escrow';
    await FirebaseAdapter.saveEntity('deals', deal);

    // Set lot to 'closed'
    if (deal.lotCode) {
      await LotsRepository.updateStatus(deal.lotCode, 'closed');
    }

    return deal;
  }
}
