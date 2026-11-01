import { Lot, RussianCityCode, SellerExitRequest } from '../../types';
import { initialSellerRequests } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { getDistrictGeo, getRegionByCode } from '../../data/russianGeography';
import { LotsRepository } from './LotsRepository';
import { DealsRepository } from './DealsRepository';
import { PartnersRepository } from './PartnersRepository';
import { PartnerRequestsRepository } from './PartnerRequestsRepository';
import { AuditLogsRepository } from './AuditLogsRepository';
import { DevelopersRepository } from './DevelopersRepository';

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
  complexName: string;
  developer: string;
  developerInn?: string;
  dduNumber: string;
  areaM2: number;
  rooms: Lot['rooms'];
  floor: number;
  totalFloors: number;
  finishing?: Lot['finishing'];
  deliveryYear?: number;
  escrowBank?: Lot['escrowBank'];
  contractPriceRub: number;
  paidAmountRub: number;
  exitRoute: SellerExitRequest['exitRoute'];
  documentIds: string[];
  referredByPartnerCode?: string;
  preliminaryReferralId?: string;
}

export class SellerRequestsRepository {
  static async getAll(): Promise<SellerExitRequest[]> {
    const list = await DatabaseGateway.getAll<SellerExitRequest>(
      COLLECTION,
      initialSellerRequests
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
    const nowIso = new Date().toISOString();
    const numericSuffix =
      params.draftLotCode?.replace(/[^0-9]/g, '') ||
      String(Math.floor(12000 + Math.random() * 87000));
    const lotCode = params.draftLotCode || `U-${numericSuffix}`;
    const lotId = `lot-${Date.now()}`;
    const dealId = `DEAL-${new Date().getFullYear()}-${numericSuffix}`;

    const remainingDebtRub = Math.max(0, params.contractPriceRub - params.paidAmountRub);
    const todayDeveloperPrice = Math.round(params.contractPriceRub * 1.24);
    const serviceCommissionRub = Math.round(params.contractPriceRub * 0.025);
    const quarterlyInstallment = Math.max(95000, Math.round(remainingDebtRub / 24));

    const region = getRegionByCode(params.city);
    const districtGeo = getDistrictGeo(params.city, params.district);
    const minFloor = Math.max(1, params.floor - 1);
    const maxFloor = Math.min(Math.max(params.totalFloors, params.floor + 1), params.floor + 2);

    const isAccreditedDev = await DevelopersRepository.isDeveloperAccredited(params.developer);
    const lotTags: string[] = [
      region.shortLabelRu,
      params.exitRoute === 'fast_cash' ? 'Срочный выход' : 'Переуступка 214-ФЗ',
      `Эскроу ${params.escrowBank || 'Сбербанк'}`,
    ];
    if (!isAccreditedDev) {
      lotTags.push('Ожидает аккредитации банков');
    }

    const newLot: Lot = {
      id: lotId,
      lotCode,
      complexName: params.complexName.startsWith('ЖК')
        ? params.complexName
        : `ЖК «${params.complexName}»`,
      developer: params.developer,
      developerInn: params.developerInn,
      developerAccreditationStatus: isAccreditedDev ? 'accredited' : 'pending_bank_accreditation',
      publishedAt: nowIso,
      viewsCount: 1,
      favoritesCount: 0,
      city: params.city,
      district: params.district || districtGeo.nameRu,
      streetAddress: params.streetAddress || districtGeo.defaultStreetRu,
      areaM2: params.areaM2,
      rooms: params.rooms,
      floor: params.floor,
      totalFloors: Math.max(params.totalFloors, params.floor),
      ceilingHeightM: params.contractPriceRub / Math.max(params.areaM2, 25) > 310000 ? 3.05 : 2.78,
      districtAvgPricePerM2: districtGeo.avgMarketPricePerM2,
      coordinates: {
        lat: Number((districtGeo.coordinates.lat + (Math.random() - 0.5) * 0.008).toFixed(5)),
        lng: Number((districtGeo.coordinates.lng + (Math.random() - 0.5) * 0.01).toFixed(5)),
      },
      metroStations: districtGeo.metroStations,
      deliveryDate: `4 кв. ${params.deliveryYear || 2026} г.`,
      deliveryYear: params.deliveryYear || 2026,
      finishing: params.finishing || 'clean',
      imageUrl:
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80',
      galleryImages: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
      ],
      constructionReadinessPercent: 80,
      dduContractPrice: params.contractPriceRub,
      cashPaidBySeller: params.paidAmountRub,
      remainingInstallmentDebt: remainingDebtRub,
      todayDeveloperPrice,
      installmentQuarterlyPayment: quarterlyInstallment,
      serviceCommissionRate: 2.5,
      serviceCommissionRub,
      isVerified: false,
      isUrgentExit: params.exitRoute === 'fast_cash',
      isNegotiable: true,
      isFeatured: false,
      isEarlyAccessVIP: true,
      earlyAccessHoursLeft: 48,
      escrowBank: params.escrowBank || 'Sberbank',
      tags: lotTags,
      status: 'processing',
      currentStage: 1,
      approvalStatus: 'pending_owner_approval',
      sellerUserId: params.uid,
      sellerClientCode: params.clientCode,
      sellerInn: params.sellerInn,
      referredByPartnerCode: params.referredByPartnerCode,
      documentIds: params.documentIds,
      legalPassport: {
        passedChecksCount: params.documentIds.length >= 4 ? 38 : 28,
        totalChecksCount: 42,
        antiBankruptcyIndex: 96,
        maternalCapitalUsed: false,
        spousalConsentNotarized: true,
        fsspDebtRub: 0,
        efrsbBankruptcyStatus: 'clean',
        nbkiScore: 780,
        pdnPercent: 25,
        developerConsentObtained: false,
        rosreestrEsignSpeedHours: 48,
      },
      ownerDossier: {
        fullNameMasked: maskFullName152Fz(params.sellerName),
        phoneMasked: maskPhone152Fz(params.sellerPhone),
        dduNumber: params.dduNumber,
        apartmentNumber: 'Скрыто до аккредитива (152-ФЗ)',
        hideExactFloor: true,
        floorRangeDisplay: `${minFloor}–${maxFloor} этаж`,
      },
      curator: {
        name: 'Дежурный комплаенс-офис DomExit',
        role: 'Первичный правовой аудит 214-ФЗ',
        phone: '+7 (812) 409-32-00',
        telegram: '@domexit_legal',
      },
    };

    const request: SellerExitRequest = {
      id: `sreq-${Date.now()}`,
      uid: params.uid,
      clientCode: params.clientCode,
      lotId,
      lotCode,
      dealId,
      timestamp: nowIso,
      sellerName: params.sellerName,
      sellerPhone: params.sellerPhone,
      sellerInn: params.sellerInn,
      city: params.city,
      district: newLot.district,
      complexName: newLot.complexName,
      developer: params.developer,
      developerInn: params.developerInn,
      dduNumber: params.dduNumber,
      areaM2: params.areaM2,
      rooms: params.rooms,
      floor: params.floor,
      totalFloors: newLot.totalFloors,
      contractPriceRub: params.contractPriceRub,
      paidAmountRub: params.paidAmountRub,
      remainingDebtRub,
      exitRoute: params.exitRoute,
      documentIds: params.documentIds,
      status: 'pending_owner_review',
      referredByPartnerCode: params.referredByPartnerCode,
    };

    await DatabaseGateway.save<SellerExitRequest>(COLLECTION, request);
    await LotsRepository.add(newLot);

    if (!isAccreditedDev) {
      await DevelopersRepository.createAccreditationRequest({
        developerName: params.developer,
        developerInn: params.developerInn || '7700000000',
        lotId,
        lotCode,
        complexName: newLot.complexName,
        city: params.city,
        district: newLot.district,
        contractPriceRub: params.contractPriceRub,
        sellerName: params.sellerName,
        sellerClientCode: params.clientCode,
        documentIds: params.documentIds,
      });
    }

    await DealsRepository.addDeal({
      dealId,
      lotCode,
      lotTitle: `${newLot.complexName} — ${params.areaM2} м²`,
      complexName: newLot.complexName,
      developer: params.developer,
      city: params.city,
      district: newLot.district,
      sellerName: params.sellerName,
      sellerUserId: params.uid,
      sellerClientCode: params.clientCode,
      partnerRefCode: params.referredByPartnerCode,
      partnerRewardRub: params.referredByPartnerCode ? 35000 : undefined,
      partnerPayoutStatus: params.referredByPartnerCode ? 'pending' : undefined,
      route: params.exitRoute,
      stage: 'initial_audit',
      daysLeft: 14,
      sellerReturnRub: params.paidAmountRub,
      discountRub: Math.max(500000, todayDeveloperPrice - params.contractPriceRub),
      clientName: maskFullName152Fz(params.sellerName),
      curatorName: 'Ожидает назначения куратора',
    });

    if (params.referredByPartnerCode) {
      await PartnersRepository.recordReferral(params.referredByPartnerCode, 35000);
    }
    if (params.preliminaryReferralId) {
      await PartnerRequestsRepository.completeByClient(
        params.preliminaryReferralId,
        lotId,
        lotCode,
        dealId
      );
    }

    await AuditLogsRepository.addLog({
      lotCode,
      dealId,
      operatorId: params.uid,
      operatorName: `${params.sellerName} (${params.clientCode})`,
      operatorRole: 'client',
      actionType: 'seller_request_submitted',
      title: `Подана заявка продавца на Чистый Выход #${lotCode} (${newLot.complexName})`,
      description: `Регион: ${region.shortLabelRu}, ${newLot.district}. Возврат продавцу: ${params.paidAmountRub.toLocaleString('ru-RU')} ₽ из цены ДДУ ${params.contractPriceRub.toLocaleString('ru-RU')} ₽. Документов в сейфе: ${params.documentIds.length}.`,
    });

    return { request, lot: newLot, dealId };
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
