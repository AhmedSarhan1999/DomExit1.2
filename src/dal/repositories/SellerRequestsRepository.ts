import { Lot, RussianCityCode, SellerExitRequest } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { LotsRepository } from './LotsRepository';
import { DealsRepository } from './DealsRepository';
import { AuditLogsRepository } from './AuditLogsRepository';
import { DevelopersRepository, PARTNER_BANKS } from './DevelopersRepository';
import { BankPortalRepository } from './BankPortalRepository';
import { PropertyLifecycleService } from '../../services/propertyLifecycleService';

const COLLECTION = 'seller_requests';

function maskFullName152Fz(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Дольщик 214-ФЗ';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
  return `${parts[0]} ${parts[1]} ${parts[2][0]}.`;
}

function maskPhone152Fz(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const tail = digits.slice(-4);
  const code = digits.slice(1, 4) || '911';
  return `+7 ${code} ***-${tail.slice(0, 2) || '00'}-${tail.slice(2, 4) || '00'}`;
}

export interface SubmitSellerExitParams {
  uid: string;
  clientCode: string;
  draftLotCode?: string;
  sellerName: string;
  sellerPhone: string;
  sellerInn: string;
  city: RussianCityCode;
  district: string;
  streetAddress?: string;
  metroName?: string;
  metroTime?: number | string;
  metroTransport?: 'walk' | 'transport';
  coordinates?: { lat: number; lng: number };
  todayDeveloperPrice?: number;
  complexName: string;
  developer: string;
  developerInn?: string;
  dduNumber: string;
  areaM2: number;
  rooms: Lot['rooms'];
  floor: number;
  totalFloors: number;
  ceilingHeightM?: number;
  finishing?: Lot['finishing'];
  deliveryYear?: number;
  deliveryDate?: string;
  escrowBank?: Lot['escrowBank'];
  contractPriceRub: number;
  paidAmountRub: number;
  exitRoute: SellerExitRequest['exitRoute'];
  isNegotiable?: boolean;
  is_negotiable?: boolean;
  sellerBanks?: string[];
  seller_banks?: string[];
  documentIds: string[];
  photos?: string[];
  sellerUploadedPhotos?: string[];
  matCapitalUsed?: boolean;
  dealTrack?: 'ddu_cession' | 'secondary_dkp';
  referredByPartnerCode?: string;
  preliminaryReferralId?: string;
}

export class SellerRequestsRepository {
  static async getAll(): Promise<SellerExitRequest[]> {
    const list = await DatabaseGateway.getAll<SellerExitRequest>(
      COLLECTION,
      []
    );
    return [...list].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  static async getByUser(uid: string, clientCode?: string): Promise<SellerExitRequest[]> {
    const all = await this.getAll();
    return all.filter(
      (r) =>
        (uid && r.uid === uid) ||
        (clientCode && r.clientCode.toUpperCase() === clientCode.toUpperCase())
    );
  }

  static async getByLotCode(lotCode: string): Promise<SellerExitRequest | null> {
    if (!lotCode) return null;
    const all = await this.getAll();
    const clean = lotCode.trim().toUpperCase();
    return (
      all.find(
        (r) => r.lotCode.toUpperCase() === clean || r.id.toUpperCase() === clean
      ) || null
    );
  }

  static async submitSellerRequest(
    params: SubmitSellerExitParams
  ): Promise<{ request: SellerExitRequest; lot: Lot; dealId: string }> {
    const res = await PropertyLifecycleService.createPropertyAndDeal({
      ...params,
      exitRoute: params.exitRoute || 'ddu_assignment',
    });
    return { request: res.request, lot: res.lot, dealId: res.deal.dealId };
  }

  static async approveAndAssign(
    requestIdOrLotCode: string,
    employeeId: string,
    employeeName: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<SellerExitRequest | null> {
    const req = await this.getByLotCode(requestIdOrLotCode);
    const targetLotCode = req ? req.lotCode : requestIdOrLotCode;

    if (req) {
      req.status = 'approved_assigned';
      req.assignedEmployeeId = employeeId;
      req.assignedEmployeeName = employeeName;
      req.rejectionReason = undefined;
      await DatabaseGateway.save<SellerExitRequest>(COLLECTION, req);
    }

    await LotsRepository.assignToEmployee(targetLotCode, employeeId, employeeName, operatorName);

    const deal = await DealsRepository.getById(targetLotCode);
    if (deal) {
      deal.assignedEmployeeId = employeeId;
      deal.curatorName = employeeName;
      if (deal.stage === 'initial_audit') {
        deal.stage = 'document_check';
      }
      await DealsRepository.update(deal);
    }

    await AuditLogsRepository.addLog({
      lotCode: targetLotCode,
      dealId: deal?.dealId || req?.dealId,
      operatorName,
      operatorRole: 'owner',
      actionType: 'seller_request_decided',
      title: `Заявка продавца #${targetLotCode} одобрена и передана куратору ${employeeName}`,
      description: `Объект опубликован в рабочем контуре и закреплен за сотрудником ${employeeName}.`,
    });

    return req;
  }

  static async rejectRequest(
    requestIdOrLotCode: string,
    reason: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<SellerExitRequest | null> {
    const req = await this.getByLotCode(requestIdOrLotCode);
    const targetLotCode = req ? req.lotCode : requestIdOrLotCode;

    if (req) {
      req.status = 'rejected';
      req.rejectionReason = reason;
      await DatabaseGateway.save<SellerExitRequest>(COLLECTION, req);
    }

    await LotsRepository.rejectLotLegal(targetLotCode, reason, operatorName);

    await AuditLogsRepository.addLog({
      lotCode: targetLotCode,
      dealId: req?.dealId,
      operatorName,
      operatorRole: 'owner',
      actionType: 'seller_request_decided',
      title: `Отклонена заявка продавца по объекту #${targetLotCode}`,
      description: `Причина отказа: ${reason}`,
    });

    return req;
  }

  static async requestAdditionalDocs(
    requestIdOrLotCode: string,
    requestedList: string[],
    notes: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<SellerExitRequest | null> {
    const req = await this.getByLotCode(requestIdOrLotCode);
    const targetLotCode = req ? req.lotCode : requestIdOrLotCode;

    if (req) {
      req.status = 'docs_requested';
      req.requestedDocsList = requestedList;
      req.requestedDocsNotes = notes;
      await DatabaseGateway.save<SellerExitRequest>(COLLECTION, req);
    }

    await LotsRepository.requestAdditionalDocs(
      targetLotCode,
      requestedList,
      notes,
      operatorName
    );

    return req;
  }
}
