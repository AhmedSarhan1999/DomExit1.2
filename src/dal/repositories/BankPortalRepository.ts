import {
  BankEmployee,
  SpecialApprovalRequest,
  BuyerCreditLimitRequest,
  DealTrack,
  PartnerBankEntity,
  BankTabPermission,
} from '../../types';
import { initialBankEmployees, initialPartnerBanks } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { DealsRepository } from './DealsRepository';
import { LotsRepository } from './LotsRepository';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';
import { DevelopersRepository } from './DevelopersRepository';

const PARTNER_BANKS_COLLECTION = 'partner_banks';
const BANK_EMP_COLLECTION = 'bank_employees';
const SPECIAL_APPROVAL_COLLECTION = 'bank_special_approvals';
const CREDIT_LIMITS_COLLECTION = 'bank_credit_limits';

export class BankPortalRepository {
  // 0. Partner Banks Management (Task 7)
  static async getAllPartnerBanks(): Promise<PartnerBankEntity[]> {
    return DatabaseGateway.getAll<PartnerBankEntity>(PARTNER_BANKS_COLLECTION, initialPartnerBanks);
  }

  static async addPartnerBank(data: {
    name: string;
    masterAdminEmail: string;
    logoUrl?: string;
    contactPhone?: string;
    contactPerson?: string;
    tempPassword?: string;
  }): Promise<PartnerBankEntity> {
    const newBank: PartnerBankEntity = {
      id: `bank-${Date.now()}`,
      name: data.name.trim(),
      masterAdminEmail: data.masterAdminEmail.trim(),
      logoUrl:
        data.logoUrl ||
        'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?auto=format&fit=crop&w=120&q=80',
      status: 'active',
      contactPhone: data.contactPhone || '+7 (800) 500-00-00',
      contactPerson: data.contactPerson || 'Руководитель департамента эскроу',
      createdAt: new Date().toISOString(),
      kpis: {
        escrowAccountsCount: 0,
        totalEscrowRub: 0,
        avgApprovalDays: 1.5,
        devApprovalRatePercent: 100,
        devRejectionRatePercent: 0,
      },
    };

    await DatabaseGateway.save<PartnerBankEntity>(PARTNER_BANKS_COLLECTION, newBank);

    // Also create the Master Bank Admin user in bank_employees
    await this.addBankEmployee({
      name: `${data.contactPerson || 'Мастер-Администратор'} (${data.name})`,
      email: data.masterAdminEmail,
      role: 'chief_manager',
      bankName: data.name,
      phone: data.contactPhone || '+7 (800) 500-00-00',
      isMasterAdmin: true,
      permissions: ['escrow', 'developer_accreditation', 'special', 'credit_limits', 'staff'],
    });

    await AuditLogsRepository.addLog({
      operatorName: 'Виктор Сергеевич (Владелец / CEO)',
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: `Подключен новый банк-партнер: ${newBank.name}`,
      description: `Мастер-аккаунт: ${newBank.masterAdminEmail}. Создан личный шлюз банка в контуре DomExit.`,
    });

    return newBank;
  }

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
      isMasterAdmin: data.isMasterAdmin ?? false,
      permissions: data.permissions || ['escrow', 'developer_accreditation', 'special', 'credit_limits', 'staff'],
    };
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, newEmp);
    return newEmp;
  }

  static async updateBankEmployeePermissions(
    id: string,
    permissions: BankTabPermission[]
  ): Promise<BankEmployee | null> {
    const employees = await this.getAllBankEmployees();
    const emp = employees.find((e) => e.id === id);
    if (!emp) return null;
    emp.permissions = permissions;
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, emp);
    return emp;
  }

  static async updateBankEmployee(
    id: string,
    updates: Partial<BankEmployee>
  ): Promise<BankEmployee | null> {
    const employees = await this.getAllBankEmployees();
    const emp = employees.find((e) => e.id === id);
    if (!emp) return null;
    Object.assign(emp, updates);
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, emp);
    return emp;
  }

  static async deleteBankEmployee(id: string): Promise<boolean> {
    return DatabaseGateway.remove(BANK_EMP_COLLECTION, id);
  }

  static async toggleBankEmployeeStatus(id: string): Promise<BankEmployee | null> {
    const employees = await this.getAllBankEmployees();
    const emp = employees.find((e) => e.id === id);
    if (!emp) return null;
    emp.status = emp.status === 'active' ? 'suspended' : 'active';
    await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, emp);
    return emp;
  }

  // 2. Special Property & Small Contractor Approval Requests (Task 5)
  static async getAllSpecialApprovals(): Promise<SpecialApprovalRequest[]> {
    return DatabaseGateway.getAll<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, [
      {
        id: 'spec-contractor-1',
        lotId: 'lot-contractor-1',
        lotCode: 'U-CONTRACTOR-1',
        complexName: 'ЖК «Хвойный Квартал» (Корпус 1)',
        projectTitle: 'Индивидуальный проект «Хвойный Квартал»',
        developer: 'ООО «СтройИнвест-Северо-Запад»',
        developerInn: '7814892011',
        contractorName: 'ООО «СтройИнвест-Северо-Запад»',
        contractorInn: '7814892011',
        location: 'Санкт-Петербург, Приморский район',
        costPriceRub: 7200000,
        contractPriceRub: 9850000,
        requestedByEmployeeId: 'emp-1',
        requestedByEmployeeName: 'Алексей Смирнов',
        bankName: 'Сбербанк',
        reason:
          'Запрос проектного финансирования и согласования эскроу-аккредитации для независимого подрядчика.',
        requestedAt: '2026-10-25T11:00:00Z',
        status: 'pending',
        documentIds: ['DOC-CONTRACTOR-DDU-01', 'DOC-CONTRACTOR-PLAN-01'],
      },
      {
        id: 'spec-contractor-2',
        lotId: 'lot-contractor-2',
        lotCode: 'U-CONTRACTOR-2',
        complexName: 'Коттеджный поселок «Озерный Край»',
        projectTitle: 'Вилла «Озерный Край» (Секция 4Б)',
        developer: 'ООО «СтройИнвест-Северо-Запад»',
        developerInn: '7814892011',
        contractorName: 'ООО «СтройИнвест-Северо-Запад»',
        contractorInn: '7814892011',
        location: 'Ленинградская область, Всеволожский район',
        costPriceRub: 10500000,
        contractPriceRub: 14200000,
        requestedByEmployeeId: 'emp-1',
        requestedByEmployeeName: 'Алексей Смирнов',
        bankName: 'Сбербанк',
        reason:
          'Проектная документация индивидуального строительства по эскроу-счетам.',
        requestedAt: '2026-10-26T14:20:00Z',
        status: 'pending',
        documentIds: ['DOC-CONTRACTOR-DDU-02', 'DOC-CONTRACTOR-PLAN-02'],
      },
      {
        id: 'spec-contractor-3',
        lotId: 'lot-contractor-3',
        lotCode: 'U-CONTRACTOR-3',
        complexName: 'Вилла «Финский Залив»',
        projectTitle: 'Частная резиденция «Финский Залив»',
        developer: 'ИП «Васильев Частный Проект»',
        developerInn: '781198451203',
        contractorName: 'ИП «Васильев Частный Проект»',
        contractorInn: '781198451203',
        location: 'Санкт-Петербург, Курортный район, Сестрорецк',
        costPriceRub: 13800000,
        contractPriceRub: 18500000,
        requestedByEmployeeId: 'emp-3',
        requestedByEmployeeName: 'Дмитрий Васильев',
        bankName: 'Сбербанк',
        reason:
          'Индивидуальный проект премиум-класса с отделкой под ключ.',
        requestedAt: '2026-10-27T16:00:00Z',
        status: 'pending',
        documentIds: ['DOC-CONTRACTOR-DDU-03', 'DOC-CONTRACTOR-PLAN-03'],
      },
      {
        id: 'spec-1',
        lotId: 'lot-3',
        lotCode: 'U-10580',
        complexName: 'ЖК «Морская Набережная»',
        projectTitle: 'ЖК «Морская Набережная» (Корпус 8)',
        developer: 'Группа ЛСР',
        developerInn: '7838001457',
        contractorName: 'Группа ЛСР',
        contractorInn: '7838001457',
        location: 'Санкт-Петербург, Василеостровский район',
        costPriceRub: 5900000,
        contractPriceRub: 7900000,
        requestedByEmployeeId: 'emp-1',
        requestedByEmployeeName: 'Алексей Смирнов',
        bankName: 'ВТБ',
        reason:
          'Нестандартный график квартальных платежей рассрочки. Запрос специальной аккредитации для эскроу-переуступки.',
        requestedAt: '2026-10-18T14:30:00Z',
        status: 'approved',
        approvedRatePercent: 19.8,
        maxPdnPercent: 50,
      },
    ]);
  }

  static async addSpecialApproval(
    data: Partial<SpecialApprovalRequest>
  ): Promise<SpecialApprovalRequest> {
    const newReq: SpecialApprovalRequest = {
      id: data.id || `spec-${Date.now()}`,
      lotId: data.lotId || `lot-${Date.now()}`,
      lotCode: data.lotCode || 'U-00000',
      complexName: data.complexName || 'Объект строительства',
      developer: data.developer || 'Не указан',
      developerInn: data.developerInn,
      contractorName: data.contractorName || data.developer,
      contractorInn: data.contractorInn || data.developerInn,
      projectTitle: data.projectTitle || data.complexName,
      location: data.location || 'Санкт-Петербург и ЛО',
      costPriceRub: data.costPriceRub || data.contractPriceRub || 5000000,
      contractPriceRub: data.contractPriceRub || 6000000,
      requestedByEmployeeId: data.requestedByEmployeeId || 'system',
      requestedByEmployeeName: data.requestedByEmployeeName || 'Система DomExit',
      bankName: data.bankName || 'Сбербанк',
      reason: data.reason || 'Запрос проектного финансирования независимого подрядчика.',
      requestedAt: data.requestedAt || new Date().toISOString(),
      status: data.status || 'pending',
      documentIds: data.documentIds || [],
    };
    await DatabaseGateway.save<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, newReq);
    return newReq;
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
    decidedBy: string,
    approvedRatePercent?: number,
    maxPdnPercent?: 40 | 50 | 60
  ): Promise<SpecialApprovalRequest | null> {
    const all = await this.getAllSpecialApprovals();
    const req = all.find((r) => r.id === requestId);
    if (!req) return null;

    req.status = decision;
    req.decisionNotes = notes;
    req.decidedAt = new Date().toISOString();
    req.decidedBy = decidedBy;
    if (approvedRatePercent !== undefined) req.approvedRatePercent = approvedRatePercent;
    if (maxPdnPercent !== undefined) req.maxPdnPercent = maxPdnPercent;

    await DatabaseGateway.save<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, req);

    const lot = await LotsRepository.getByCode(req.lotCode);
    if (lot) {
      if (decision === 'approved') {
        lot.specialApprovalStatus = 'approved';
        lot.developerAccreditationStatus = 'project_approved';
        lot.approvedBankFinancing = {
          bankName: req.bankName,
          approvedRatePercent: approvedRatePercent || 19.9,
          maxPdnPercent: maxPdnPercent || 50,
          approvedAt: new Date().toISOString(),
          decidedBy,
        };
        const cleanTags = (lot.tags || []).filter((t) => t !== 'Ожидает аккредитации банков');
        const finTag = `Финансирование: ${req.bankName} (${approvedRatePercent || 19.9}%)`;
        if (!cleanTags.includes(finTag)) {
          cleanTags.push(finTag);
        }
        lot.tags = cleanTags;
      } else {
        lot.specialApprovalStatus = 'rejected';
      }
      await LotsRepository.update(lot);
    }

    // Auto-register developer in Central Platform Directory (Section 3 Requirement)
    if (decision === 'approved') {
      const devName = req.contractorName || req.developer;
      const devInn = req.contractorInn || req.developerInn || '7814892011';
      await DevelopersRepository.registerDeveloperFromProject({
        name: devName,
        inn: devInn,
        lotCode: req.lotCode,
      });
    }

    await AuditLogsRepository.addLog({
      lotCode: req.lotCode,
      operatorName: decidedBy,
      operatorRole: 'bank_officer',
      actionType: 'special_bank_approval_decided',
      title: `Банк ${req.bankName}: проектное финансирование лота #${req.lotCode} — ${
        decision === 'approved' ? 'ОДОБРЕНО' : 'ОТКЛОНЕНО'
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
