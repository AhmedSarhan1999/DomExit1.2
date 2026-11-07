import {
  BankEmployee,
  SpecialApprovalRequest,
  DealTrack,
  PartnerBankEntity,
  BankTabPermission,
} from '../../types';
import { initialBankEmployees, initialPartnerBanks, initialSpecialApprovals } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { DealsRepository } from './DealsRepository';
import { LotsRepository } from './LotsRepository';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';
import { DevelopersRepository } from './DevelopersRepository';

const PARTNER_BANKS_COLLECTION = 'partner_banks';
const BANK_EMP_COLLECTION = 'bank_employees';
const SPECIAL_APPROVAL_COLLECTION = 'bank_special_approvals';

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
      permissions: ['escrow', 'developer_accreditation', 'special', 'staff'],
    });

    await AuditLogsRepository.addLog({
      operatorName: 'Ahmed Abdallah (Владелец / CEO)',
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: `Подключен новый банк-партнер: ${newBank.name}`,
      description: `Мастер-аккаунт: ${newBank.masterAdminEmail}. Создан личный шлюз банка в контуре DomExit.`,
    });

    return newBank;
  }

  static async updatePartnerBank(
    id: string,
    updates: Partial<PartnerBankEntity>,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<PartnerBankEntity | null> {
    const bank = await DatabaseGateway.getById<PartnerBankEntity>(PARTNER_BANKS_COLLECTION, id, initialPartnerBanks);
    if (!bank) return null;
    const updated: PartnerBankEntity = {
      ...bank,
      ...updates,
      name: updates.name ? updates.name.trim() : bank.name,
      masterAdminEmail: updates.masterAdminEmail ? updates.masterAdminEmail.trim() : bank.masterAdminEmail,
    };
    await DatabaseGateway.save<PartnerBankEntity>(PARTNER_BANKS_COLLECTION, updated);

    // If masterAdminEmail or name changed, update bank employees
    const staff = await this.getAllBankEmployees();
    const matchingChief = staff.find((s) => s.bankName === bank.name || s.email.toLowerCase() === bank.masterAdminEmail.toLowerCase());
    if (matchingChief) {
      if (updates.name) matchingChief.bankName = updates.name.trim();
      if (updates.masterAdminEmail) matchingChief.email = updates.masterAdminEmail.trim();
      if (updates.contactPhone) matchingChief.phone = updates.contactPhone;
      if (updates.contactPerson) matchingChief.name = `${updates.contactPerson} (${updated.name})`;
      await DatabaseGateway.save<BankEmployee>(BANK_EMP_COLLECTION, matchingChief);
    }

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: `Обновлены параметры банка-партнера: ${updated.name}`,
      description: `Изменены реквизиты и параметры доступа для ${updated.masterAdminEmail}.`,
    });
    return updated;
  }

  static async deletePartnerBank(
    id: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<boolean> {
    const bank = await DatabaseGateway.getById<PartnerBankEntity>(PARTNER_BANKS_COLLECTION, id, initialPartnerBanks);
    if (!bank) return false;

    // Remove bank entity
    await DatabaseGateway.remove(PARTNER_BANKS_COLLECTION, id);

    // Deactivate/remove associated bank employees
    const staff = await this.getAllBankEmployees();
    for (const emp of staff) {
      if (emp.bankName === bank.name || emp.email.toLowerCase() === bank.masterAdminEmail.toLowerCase()) {
        await DatabaseGateway.remove(BANK_EMP_COLLECTION, emp.id);
      }
    }

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'security_incident_reported',
      title: `Банк-партнер «${bank.name}» удален из контура платформы`,
      description: `Удалены права доступа для ${bank.masterAdminEmail} и всех привязанных офицеров.`,
    });
    return true;
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
      permissions: data.permissions || ['escrow', 'developer_accreditation', 'special', 'staff'],
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
    return DatabaseGateway.getAll<SpecialApprovalRequest>(SPECIAL_APPROVAL_COLLECTION, initialSpecialApprovals);
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
        const approvedRate = approvedRatePercent || 19.9;
        const approvedPdn = maxPdnPercent || 50;
        lot.specialApprovalStatus = 'approved';
        lot.developerAccreditationStatus = 'project_approved';
        lot.approvedBankFinancing = {
          bankName: req.bankName,
          approvedRatePercent: approvedRate,
          maxPdnPercent: approvedPdn,
          approvedAt: new Date().toISOString(),
          decidedBy,
          notes,
        };

        const existingApprovals = (lot.approvedFinancingBanks || []).filter(
          (b) => b.bankName !== req.bankName
        );
        existingApprovals.push({
          bankName: req.bankName,
          approvedRatePercent: approvedRate,
          maxPdnPercent: approvedPdn,
          approvedAt: new Date().toISOString(),
          decidedBy,
          notes,
        });
        lot.approvedFinancingBanks = existingApprovals;

        const cleanTags = (lot.tags || []).filter((t) => t !== 'Ожидает аккредитации банков');
        const finTag = `Финансирование: ${req.bankName} (${approvedRate}%)`;
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
        bankName: req.bankName,
        ratePercent: approvedRatePercent,
        pdnPercent: maxPdnPercent,
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

  // 3. Escrow & Deal Coordination (delegating strictly to DealsRepository for 100% synchronization)
  static async confirmEscrowDeposit(
    dealId: string,
    officerName: string,
    depositedAmount: number,
    bankName?: string
  ): Promise<DealTrack | null> {
    return DealsRepository.confirmBankDeposit(dealId, officerName, undefined, depositedAmount, bankName);
  }

  static async releaseEscrowFunds(
    dealId: string,
    officerName: string
  ): Promise<DealTrack | null> {
    return DealsRepository.releaseEscrowFunds(dealId, officerName);
  }
}
