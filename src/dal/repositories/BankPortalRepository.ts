import {
  BankEmployee,
  SpecialApprovalRequest,
  BuyerCreditLimitRequest,
  DealTrack,
} from '../../types';
import { initialBankEmployees } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { DealsRepository } from './DealsRepository';
import { LotsRepository } from './LotsRepository';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const BANK_EMP_COLLECTION = 'bank_employees';
const SPECIAL_APPROVAL_COLLECTION = 'bank_special_approvals';
const CREDIT_LIMITS_COLLECTION = 'bank_credit_limits';

export class BankPortalRepository {
  // 1. Bank Employees Management
  static async getAllBankEmployees(): Promise<BankEmployee[]> {
    return DatabaseGateway.getAll<BankEmployee>(BANK_EMP_COLLECTION, initialBankEmployees);
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
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, newEmp);
    return newEmp;
  }

  static async toggleBankEmployeeStatus(id: string): Promise<BankEmployee | null> {
    const employees = await this.getAllBankEmployees();
    const emp = employees.find((e) => e.id === id);
    if (!emp) return null;
    emp.status = emp.status === 'active' ? 'suspended' : 'active';
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, emp);
    return emp;
  }

  // 2. Special Property Approval Requests
  static async getAllSpecialApprovals(): Promise<SpecialApprovalRequest[]> {
    return DatabaseGateway.getAll<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, [
      {
        id: 'spec-1',
        lotId: 'lot-3',
        lotCode: 'U-10580',
        complexName: 'ЖК «Морская Набережная»',
        developer: 'Группа ЛСР',
        contractPriceRub: 7900000,
        requestedByEmployeeId: 'emp-1',
        requestedByEmployeeName: 'Алексей Смирнов',
        bankName: 'ВТБ',
        reason:
          'Нестандартный график квартальных платежей рассрочки. Запрос специальной аккредитации для эскроу-переуступки.',
        requestedAt: '2026-10-18T14:30:00Z',
        status: 'pending',
      },
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
    await DatabaseGateway.save<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, newReq);

    const lot = await LotsRepository.getByCode(data.lotCode);
    if (lot) {
      lot.specialApprovalStatus = 'pending';
      lot.specialApprovalBank = data.bankName;
      await LotsRepository.update(lot);
    }

    await AuditLogsRepository.addLog({
      lotCode: data.lotCode,
      operatorId: data.requestedByEmployeeId,
      operatorName: data.requestedByEmployeeName,
      operatorRole: 'curator',
      actionType: 'special_bank_approval_requested',
      title: `Направлен запрос спец-аккредитации лота #${data.lotCode} в ${data.bankName}`,
      description: data.reason,
    });

    return newReq;
  }

  static async decideSpecialApproval(
    requestId: string,
    decision: 'approved' | 'rejected',
    notes: string,
    decidedBy: string
  ): Promise<SpecialApprovalRequest | null> {
    const all = await this.getAllSpecialApprovals();
    const req = all.find((r) => r.id === requestId);
    if (!req) return null;

    req.status = decision;
    req.decisionNotes = notes;
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decidedBy;
    await DatabaseGateway.save<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, req);

    const lot = await LotsRepository.getByCode(req.lotCode);
    if (lot) {
      lot.specialApprovalStatus = decision;
      await LotsRepository.update(lot);
    }

    await AuditLogsRepository.addLog({
      lotCode: req.lotCode,
      operatorName: decidedBy,
      operatorRole: 'bank_officer',
      actionType: 'special_bank_approval_decided',
      title: `Банк ${req.bankName}: спец-аккредитация лота #${req.lotCode} — ${
        decision === 'approved' ? 'ОДОБРЕНА' : 'ОТКЛОНЕНА'
      }`,
      description: notes || 'Решение зафиксировано в банковском шлюзе.',
    });

    return req;
  }

  // 3. Buyer Credit Limit Requests & Bank Stamp Certification
  static async getAllCreditLimitRequests(): Promise<BuyerCreditLimitRequest[]> {
    const list = await DatabaseGateway.getAll<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, [
      {
        id: 'limit-req-1',
        userId: 'usr-buyer-001',
        uid: 'usr-buyer-001',
        clientCode: 'DEX-409112',
        userName: 'Иван Петрович (Покупатель)',
        userPhone: '+7 (921) 987-65-43',
        userEmail: 'client@domexit.ru',
        requestedAmountRub: 8500000,
        approvedLimitRub: 9000000,
        validUntil: '2026-12-31',
        bankName: 'Сбербанк',
        certificateNumber: 'SBER-CREDIT-99214',
        reviewedBy: 'Игорь Владимирович Соколов (Сбербанк)',
        requestedAt: '2026-10-15T10:00:00Z',
        timestamp: '2026-10-15T10:00:00Z',
        reviewedAt: '2026-10-16T12:00:00Z',
        status: 'approved',
        notes: 'Доход подтвержден по 2-НДФЛ. Лимит подтвержден для семейной ипотеки и переуступок.',
      },
    ]);

    return [...list].sort(
      (a, b) =>
        new Date(b.timestamp || b.requestedAt).getTime() -
        new Date(a.timestamp || a.requestedAt).getTime()
    );
  }

  static async getCreditLimitsByUser(
    userId: string,
    clientCode?: string
  ): Promise<BuyerCreditLimitRequest[]> {
    const all = await this.getAllCreditLimitRequests();
    return all.filter(
      (r) =>
        (userId && (r.uid === userId || r.userId === userId)) ||
        (clientCode && r.clientCode?.toUpperCase() === clientCode.toUpperCase())
    );
  }

  static async requestCreditLimit(data: {
    userId: string;
    uid?: string;
    clientCode: string;
    userName: string;
    userPhone: string;
    userEmail?: string;
    monthlyIncomeRub?: number;
    requestedAmountRub: number;
    bankName: string;
  }): Promise<BuyerCreditLimitRequest> {
    const nowIso = new Date().toISOString();
    const uid = data.uid || data.userId;
    const newReq: BuyerCreditLimitRequest = {
      id: `limit-req-${Date.now()}`,
      ...data,
      userId: uid,
      uid,
      requestedAt: nowIso,
      timestamp: nowIso,
      status: 'pending',
    };
    await DatabaseGateway.save<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, newReq);

    await AuditLogsRepository.addLog({
      operatorId: uid,
      operatorName: `${data.userName} (${data.clientCode})`,
      operatorRole: 'client',
      actionType: 'credit_limit_granted',
      title: `Подан запрос на ипотечный лимит в ${data.bankName}: ${data.requestedAmountRub.toLocaleString('ru-RU')} ₽`,
      description: `Клиент запросил предварительное банковское одобрение в контуре DomExit.`,
    });

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
    const item = list.find((r) => r.id === requestId);
    if (!item) return null;

    item.status = 'approved';
    item.approvedLimitRub = approvedLimitRub;
    item.validUntil = validUntil;
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date().toISOString();
    item.certificateNumber = `${item.bankName.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '')}-STAMP-${Math.floor(
      10000 + Math.random() * 90000
    )}`;
    item.notes = notes;

    await DatabaseGateway.save<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, item);

    try {
      const user =
        (await UsersRepository.getById(item.uid || item.userId)) ||
        (await UsersRepository.getByClientCode(item.clientCode));
      if (user) {
        user.bankCreditLimit = {
          approvedLimitRub,
          validUntil,
          certificateNumber: item.certificateNumber,
          bankName: item.bankName,
          issuedAt: new Date().toISOString(),
        };
        await UsersRepository.save(user);
      }
    } catch {
      // Non-fatal
    }

    await AuditLogsRepository.addLog({
      operatorName: reviewedBy,
      operatorRole: 'bank_officer',
      actionType: 'credit_limit_granted',
      title: `Утвержден кредитный лимит ${approvedLimitRub.toLocaleString('ru-RU')} ₽ для ${item.userName} (${item.clientCode})`,
      description: `Сертификат № ${item.certificateNumber} действителен до ${validUntil}.`,
    });

    return item;
  }

  static async rejectCreditLimit(
    requestId: string,
    reviewedBy: string,
    notes?: string
  ): Promise<BuyerCreditLimitRequest | null> {
    const list = await this.getAllCreditLimitRequests();
    const item = list.find((r) => r.id === requestId);
    if (!item) return null;

    item.status = 'rejected';
    item.reviewedBy = reviewedBy;
    item.reviewedAt = new Date().toISOString();
    item.notes = notes || 'Отказ по нормативу долговой нагрузки ПДН > 50%';
    item.rejectionReason = item.notes;
    await DatabaseGateway.save<BuyerCreditLimitRequest>(CREDIT_LIMITS_COLLECTION, item);

    await AuditLogsRepository.addLog({
      operatorName: reviewedBy,
      operatorRole: 'bank_officer',
      actionType: 'credit_limit_granted',
      title: `Отклонен запрос кредитного лимита (${item.userName})`,
      description: item.notes,
    });

    return item;
  }

  // 4. Escrow & Deal Coordination (delegating strictly to DealsRepository for 100% synchronization)
  static async confirmEscrowDeposit(
    dealId: string,
    officerName: string,
    depositedAmount: number
  ): Promise<DealTrack | null> {
    return DealsRepository.confirmBankDeposit(dealId, officerName, undefined, depositedAmount);
  }

  static async releaseEscrowFunds(
    dealId: string,
    officerName: string
  ): Promise<DealTrack | null> {
    return DealsRepository.releaseEscrowFunds(dealId, officerName);
  }
}
