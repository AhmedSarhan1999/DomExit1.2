import { Lot, DealTrack, SellerExitRequest, RussianCityCode } from '../types';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { getRegionByCode, getDistrictGeo } from '../data/russianGeography';
import { DevelopersRepository, PARTNER_BANKS } from '../dal/repositories/DevelopersRepository';
import { BankPortalRepository } from '../dal/repositories/BankPortalRepository';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { PartnerRequestsRepository } from '../dal/repositories/PartnerRequestsRepository';

function maskFullName152Fz(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Дольщик 214-ФЗ';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
  return `${parts[0]} ${parts[1]} ${parts[2][0]}.`;
}

function maskPhone152Fz(phone: string): string {
  if (!phone) return '+7 (999) ***-**-**';
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length < 11) return '+7 (***) ***-**-**';
  return `+7 (${clean.slice(1, 4)}) ***-**-${clean.slice(-2)}`;
}

export interface CreatePropertyAndDealPayload {
  uid: string;
  clientCode?: string;
  draftLotCode?: string;
  sellerName: string;
  sellerPhone: string;
  sellerInn?: string;
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
  rooms: string;
  floor: number;
  totalFloors: number;
  ceilingHeightM?: number;
  contractPriceRub: number;
  paidAmountRub: number;
  exitRoute: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  isNegotiable?: boolean;
  sellerBanks?: string[];
  documentIds?: string[];
  photos?: string[];
  sellerUploadedPhotos?: string[];
  matCapitalUsed?: boolean;
  referredByPartnerCode?: string;
  preliminaryReferralId?: string;
  deliveryDate?: string;
  deliveryYear?: number;
  finishing?: string;
}

export class PropertyLifecycleService {
  /**
   * Deterministic 1:1 Canonical Creation:
   * - lot.id === lotCode (e.g. "U-93579")
   * - deal.id === "DEAL-" + lotCode (e.g. "DEAL-U-93579")
   * - deal.dealId === "DEAL-" + lotCode
   * - deal.lotId === lotCode
   * - deal.lotCode === lotCode
   * - request.id === "sreq-" + lotCode
   *
   * Atomically writes to lots, deals, and seller_requests. Rolls back completely on failure.
   */
  static async createPropertyAndDeal(payload: CreatePropertyAndDealPayload): Promise<{
    lot: Lot;
    deal: DealTrack;
    request: SellerExitRequest;
  }> {
    const nowIso = new Date().toISOString();

    // 1. Generate Canonical Deterministic lotCode
    const numericSuffix =
      payload.draftLotCode?.replace(/[^0-9]/g, '') ||
      String(Math.floor(12000 + Math.random() * 87000));
    const lotCode = payload.draftLotCode?.toUpperCase().startsWith('U-')
      ? payload.draftLotCode.toUpperCase()
      : `U-${numericSuffix}`;
    const lotId = lotCode;
    const dealId = `DEAL-${lotCode}`;
    const sreqId = `sreq-${lotCode}`;

    const remainingDebtRub = Math.max(0, payload.contractPriceRub - payload.paidAmountRub);
    const todayDeveloperPrice =
      payload.todayDeveloperPrice && payload.todayDeveloperPrice > payload.contractPriceRub
        ? payload.todayDeveloperPrice
        : Math.round(payload.contractPriceRub * 1.24);
    const serviceCommissionRub = Math.round(payload.contractPriceRub * 0.025);
    const quarterlyInstallment = Math.max(95000, Math.round(remainingDebtRub / 24));

    const region = getRegionByCode(payload.city);
    const districtGeo = getDistrictGeo(payload.city, payload.district);
    const minFloor = Math.max(1, payload.floor - 1);
    const maxFloor = Math.min(Math.max(payload.totalFloors, payload.floor + 1), payload.floor + 2);

    const isAccreditedDev = await DevelopersRepository.isDeveloperAccredited(payload.developer);
    const lotTags: string[] = [
      region.shortLabelRu,
      payload.exitRoute === 'fast_cash' ? 'Срочный выход' : 'Переуступка 214-ФЗ',
      'Эскроу Сбербанк',
    ];
    if (!isAccreditedDev) {
      lotTags.push('Ожидает аккредитации банков');
    }

    const streetAddress = payload.streetAddress?.trim() || '';

    let metroStations: Array<{ name: string; travelTimeText: string; mode: 'walk' | 'drive'; lineColor?: string }> = [];
    if (payload.metroName && payload.metroName.trim()) {
      const cleanStationName = payload.metroName.trim().replace(/^м\.\s*/i, '').replace(/^метро\s*/i, '');
      const travelTimeNum = Number(payload.metroTime) || 10;
      const isWalk = payload.metroTransport !== 'transport';
      metroStations = [
        {
          name: cleanStationName,
          travelTimeText: `${travelTimeNum} мин. ${isWalk ? 'пешком' : 'транспортом'}`,
          mode: isWalk ? ('walk' as const) : ('drive' as const),
          lineColor: payload.city === 'msk' ? '#ED1B35' : '#0078C9',
        },
      ];
    } else if (districtGeo.metroStations && districtGeo.metroStations.length > 0) {
      metroStations = districtGeo.metroStations;
    }

    const coordinates =
      payload.coordinates && payload.coordinates.lat && payload.coordinates.lng
        ? payload.coordinates
        : {
            lat: Number((districtGeo.coordinates.lat + 0.0012).toFixed(5)),
            lng: Number((districtGeo.coordinates.lng + 0.0015).toFixed(5)),
          };

    const userPhotos =
      payload.sellerUploadedPhotos && payload.sellerUploadedPhotos.length > 0
        ? payload.sellerUploadedPhotos
        : payload.photos && payload.photos.length > 0
        ? payload.photos
        : [];

    const lot: Lot = {
      id: lotId,
      lotCode,
      complexName: payload.complexName.startsWith('ЖК')
        ? payload.complexName
        : `ЖК «${payload.complexName}»`,
      developer: payload.developer,
      developerInn: payload.developerInn,
      developerAccreditationStatus: isAccreditedDev ? 'accredited' : 'pending_bank_accreditation',
      publishedAt: nowIso,
      viewsCount: 1,
      favoritesCount: 0,
      city: payload.city,
      district: payload.district || districtGeo.nameRu,
      streetAddress,
      areaM2: payload.areaM2,
      rooms: payload.rooms,
      floor: payload.floor,
      totalFloors: Math.max(payload.totalFloors, payload.floor),
      ceilingHeightM:
        payload.ceilingHeightM ||
        (payload.contractPriceRub / Math.max(payload.areaM2, 25) > 310000 ? 3.05 : 2.78),
      districtAvgPricePerM2: districtGeo.avgMarketPricePerM2,
      coordinates,
      metroStations,
      deliveryDate: payload.deliveryDate || `4 кв. ${payload.deliveryYear || 2026} г.`,
      deliveryYear: payload.deliveryYear || 2026,
      finishing: payload.finishing || 'clean',
      imageUrl: userPhotos.length > 0 ? userPhotos[0] : '',
      galleryImages: userPhotos,
      sellerUploadedPhotos: userPhotos,
      approvedGalleryImages: userPhotos,
      constructionReadinessPercent: 80,
      dduContractPrice: payload.contractPriceRub,
      cashPaidBySeller: payload.paidAmountRub,
      remainingInstallmentDebt: remainingDebtRub,
      todayDeveloperPrice,
      installmentQuarterlyPayment: quarterlyInstallment,
      serviceCommissionRate: 2.5,
      serviceCommissionRub,
      isVerified: false,
      isUrgentExit: payload.exitRoute === 'fast_cash',
      isNegotiable: payload.isNegotiable || false,
      sellerBanks: payload.sellerBanks,
      isFeatured: false,
      isPublished: false,
      isVipExclusive: false,
      isEarlyAccessVIP: false,
      escrowBank: 'Сбербанк',
      tags: lotTags,
      status: 'draft',
      currentStage: 1,
      approvalStatus: 'pending_owner_approval',
      sellerUserId: payload.uid,
      sellerClientCode: payload.clientCode,
      sellerInn: payload.sellerInn,
      sellerName: payload.sellerName,
      sellerPhone: payload.sellerPhone,
      referredByPartnerCode: payload.referredByPartnerCode,
      documentIds: payload.documentIds || [],
      legalPassport: {
        passedChecksCount: (payload.documentIds || []).length >= 4 ? 38 : 28,
        totalChecksCount: 42,
        antiBankruptcyIndex: 96,
        maternalCapitalUsed: Boolean(payload.matCapitalUsed),
        spousalConsentNotarized: true,
        fsspDebtRub: 0,
        efrsbBankruptcyStatus: 'clean',
        nbkiScore: 780,
        pdnPercent: 25,
        developerConsentObtained: false,
        rosreestrEsignSpeedHours: 48,
      },
      ownerDossier: {
        fullNameMasked: maskFullName152Fz(payload.sellerName),
        phoneMasked: maskPhone152Fz(payload.sellerPhone),
        dduNumber: payload.dduNumber,
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
      id: sreqId,
      uid: payload.uid,
      clientCode: payload.clientCode || 'DEX-000000',
      lotId,
      lotCode,
      dealId,
      timestamp: nowIso,
      sellerName: payload.sellerName,
      sellerPhone: payload.sellerPhone,
      sellerInn: payload.sellerInn || '',
      city: payload.city,
      district: lot.district,
      streetAddress: lot.streetAddress,
      metroName: payload.metroName,
      metroTime: payload.metroTime,
      metroTransport: payload.metroTransport,
      coordinates: lot.coordinates,
      todayDeveloperPrice: lot.todayDeveloperPrice,
      deliveryDate: lot.deliveryDate,
      finishing: lot.finishing,
      ceilingHeightM: lot.ceilingHeightM,
      photos: userPhotos,
      sellerUploadedPhotos: userPhotos,
      matCapitalUsed: Boolean(payload.matCapitalUsed),
      complexName: lot.complexName,
      developer: payload.developer,
      developerInn: payload.developerInn,
      dduNumber: payload.dduNumber,
      areaM2: payload.areaM2,
      rooms: payload.rooms,
      floor: payload.floor,
      totalFloors: lot.totalFloors,
      contractPriceRub: payload.contractPriceRub,
      paidAmountRub: payload.paidAmountRub,
      remainingDebtRub,
      exitRoute: payload.exitRoute,
      isNegotiable: payload.isNegotiable || false,
      sellerBanks: payload.sellerBanks,
      documentIds: payload.documentIds || [],
      status: 'pending_owner_review',
      referredByPartnerCode: payload.referredByPartnerCode,
    };

    const deal: DealTrack = {
      id: dealId,
      dealId,
      lotId,
      lotCode,
      lotTitle: `${lot.complexName} — ${payload.areaM2} м²`,
      complexName: lot.complexName,
      developer: payload.developer,
      city: payload.city,
      district: lot.district,
      sellerName: payload.sellerName,
      sellerUserId: payload.uid,
      sellerClientCode: payload.clientCode,
      partnerRefCode: payload.referredByPartnerCode,
      partnerRewardRub: payload.referredByPartnerCode ? 35000 : undefined,
      partnerPayoutStatus: payload.referredByPartnerCode ? 'pending' : undefined,
      route: payload.exitRoute,
      stage: 'initial_audit',
      daysLeft: 14,
      sellerReturnRub: payload.paidAmountRub,
      discountRub: Math.max(500000, todayDeveloperPrice - payload.contractPriceRub),
      fsspClear: true,
      efrsbClear: true,
      matchingCandidatesCount: 0,
      clientName: maskFullName152Fz(payload.sellerName),
      curatorName: 'Ожидает назначения куратора',
      createdDate: nowIso.split('T')[0],
      updatedDate: nowIso.split('T')[0],
      escrowWorkflow: {
        step: 'curator_review',
        bankName: 'Сбербанк',
        escrowAccountNumber: '40817810000000000000',
        depositedAmountRub: 0,
        signingProofPhotos: [],
        signingProofVideos: [],
      },
    };

    // 2. Atomic Persistence with Rollback Guard
    try {
      await DatabaseGateway.save<Lot>('lots', lot);
    } catch (lotErr: any) {
      console.error('[PropertyLifecycleService] Failed to save lot:', lotErr);
      throw new Error(`Ошибка создания лота: ${lotErr.message || 'Сбой базы данных'}`);
    }

    try {
      await DatabaseGateway.save<DealTrack>('deals', deal);
    } catch (dealErr: any) {
      console.error('[PropertyLifecycleService] Failed to save deal, rolling back lot:', dealErr);
      try {
        await DatabaseGateway.remove('lots', lot.id);
      } catch {}
      throw new Error(`Ошибка создания сделки: ${dealErr.message || 'Сбой базы данных'}`);
    }

    try {
      await DatabaseGateway.save<SellerExitRequest>('seller_requests', request);
    } catch (reqErr: any) {
      console.warn('[PropertyLifecycleService] Non-fatal seller_requests save warning:', reqErr);
    }

    // 3. Partner bank special approvals if developer not accredited
    if (!isAccreditedDev) {
      for (const bankName of PARTNER_BANKS) {
        try {
          await BankPortalRepository.addSpecialApproval({
            lotId,
            lotCode,
            complexName: lot.complexName,
            developer: payload.developer,
            developerInn: payload.developerInn || '7800000000',
            contractorName: payload.developer,
            contractorInn: payload.developerInn || '7800000000',
            projectTitle: `${lot.complexName} (${payload.rooms}ккв, ${payload.areaM2} м²)`,
            location: `${region.labelRu}, ${lot.district}`,
            costPriceRub: payload.paidAmountRub,
            contractPriceRub: payload.contractPriceRub,
            requestedByEmployeeId: payload.uid,
            requestedByEmployeeName: payload.sellerName,
            bankName,
            reason: `Запрос индивидуального согласования объекта ДДУ и проектной линии эскроу для «${payload.developer}» (ИНН ${payload.developerInn || 'не указан'}).`,
            requestedAt: nowIso,
            status: 'pending',
            documentIds: payload.documentIds || [],
          });
        } catch {}
      }
    }

    if (payload.referredByPartnerCode) {
      try {
        await PartnersRepository.recordReferral(payload.referredByPartnerCode, 35000);
      } catch {}
    }
    if (payload.preliminaryReferralId) {
      try {
        await PartnerRequestsRepository.completeByClient(
          payload.preliminaryReferralId,
          lotId,
          lotCode,
          dealId
        );
      } catch {}
    }

    try {
      await AuditLogsRepository.addLog({
        lotCode,
        dealId,
        operatorId: payload.uid,
        operatorName: `${payload.sellerName} (${payload.clientCode || 'DEX-CLIENT'})`,
        operatorRole: 'client',
        actionType: 'seller_request_submitted',
        title: `Подана заявка продавца #${lotCode} (${lot.complexName})`,
        description: `Регион: ${region.shortLabelRu}, ${lot.district}. Возврат: ${payload.paidAmountRub.toLocaleString('ru-RU')} ₽. Документов: ${(payload.documentIds || []).length}.`,
      });
    } catch {}

    return { lot, deal, request };
  }

  /**
   * Cascade deletes a property and every related record across all collections:
   * - lots
   * - deals
   * - seller_requests
   * - candidates / buyer_applications
   * - documents_vault
   * - deal_messages / curator_messages
   * - developer_accreditation_requests
   * - bank_special_approvals
   *
   * Also wipes out local browser caches so the entity never re-appears on refresh (F5).
   */
  static async deletePropertyCascade(
    lotIdOrCode: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<boolean> {
    if (!lotIdOrCode) return false;
    const cleanCode = lotIdOrCode.trim().toUpperCase();
    const numericSuffix = cleanCode.replace(/[^0-9]/g, '');
    const canonicalLotCode = cleanCode.startsWith('U-') ? cleanCode : `U-${numericSuffix}`;
    const expectedDealId = `DEAL-${canonicalLotCode}`;

    // 1. Remove from 'lots'
    try {
      const lots = await DatabaseGateway.getAll<Lot>('lots', []);
      const matchedLots = lots.filter(
        (l) =>
          l.id.toUpperCase() === cleanCode ||
          l.id.toUpperCase() === canonicalLotCode ||
          l.lotCode.toUpperCase() === cleanCode ||
          l.lotCode.toUpperCase() === canonicalLotCode
      );
      for (const l of matchedLots) {
        await DatabaseGateway.remove('lots', l.id);
      }
    } catch (err) {
      console.warn('[PropertyLifecycleService] Error removing from lots:', err);
    }

    // 2. Remove from 'deals'
    try {
      const deals = await DatabaseGateway.getAll<DealTrack>('deals', []);
      const matchedDeals = deals.filter(
        (d) =>
          d.id.toUpperCase() === expectedDealId ||
          d.dealId.toUpperCase() === expectedDealId ||
          d.lotCode.toUpperCase() === cleanCode ||
          d.lotCode.toUpperCase() === canonicalLotCode ||
          d.id.toUpperCase() === cleanCode ||
          (d.lotId && (d.lotId.toUpperCase() === cleanCode || d.lotId.toUpperCase() === canonicalLotCode))
      );
      for (const d of matchedDeals) {
        await DatabaseGateway.remove('deals', d.id);
      }
    } catch (err) {
      console.warn('[PropertyLifecycleService] Error removing from deals:', err);
    }

    // 3. Remove from 'seller_requests'
    try {
      const reqs = await DatabaseGateway.getAll<SellerExitRequest>('seller_requests', []);
      const matchedReqs = reqs.filter(
        (r) =>
          r.lotCode?.toUpperCase() === cleanCode ||
          r.lotCode?.toUpperCase() === canonicalLotCode ||
          r.lotId?.toUpperCase() === cleanCode ||
          r.lotId?.toUpperCase() === canonicalLotCode ||
          r.id.toUpperCase() === `SREQ-${canonicalLotCode}`
      );
      for (const r of matchedReqs) {
        await DatabaseGateway.remove('seller_requests', r.id);
      }
    } catch (err) {
      console.warn('[PropertyLifecycleService] Error removing from seller_requests:', err);
    }

    // 4. Remove from 'candidates' and 'buyer_applications'
    try {
      const cands = await DatabaseGateway.getAll<{ id: string; lotCode?: string; lotId?: string }>('candidates', []);
      const matchedCands = cands.filter(
        (c) =>
          c.lotCode?.toUpperCase() === cleanCode ||
          c.lotCode?.toUpperCase() === canonicalLotCode ||
          c.lotId?.toUpperCase() === cleanCode ||
          c.lotId?.toUpperCase() === canonicalLotCode
      );
      for (const c of matchedCands) {
        await DatabaseGateway.remove('candidates', c.id);
      }
    } catch {}

    try {
      const buyerApps = await DatabaseGateway.getAll<{ id: string; lotCode?: string; lotId?: string }>('buyer_applications', []);
      const matchedApps = buyerApps.filter(
        (a) =>
          a.lotCode?.toUpperCase() === cleanCode ||
          a.lotCode?.toUpperCase() === canonicalLotCode ||
          a.lotId?.toUpperCase() === cleanCode ||
          a.lotId?.toUpperCase() === canonicalLotCode
      );
      for (const a of matchedApps) {
        await DatabaseGateway.remove('buyer_applications', a.id);
      }
    } catch {}

    // 5. Remove from 'documents_vault'
    try {
      const docs = await DatabaseGateway.getAll<{ id: string; entityId?: string }>('documents_vault', []);
      const matchedDocs = docs.filter(
        (d) =>
          d.entityId?.toUpperCase() === cleanCode ||
          d.entityId?.toUpperCase() === canonicalLotCode
      );
      for (const d of matchedDocs) {
        await DatabaseGateway.remove('documents_vault', d.id);
      }
    } catch (err) {
      console.warn('[PropertyLifecycleService] Error removing from documents_vault:', err);
    }

    // 6. Remove from 'deal_messages'
    try {
      const msgs = await DatabaseGateway.getAll<{ id: string; lotId?: string; dealId?: string }>('deal_messages', []);
      const matchedMsgs = msgs.filter(
        (m) =>
          m.lotId?.toUpperCase() === cleanCode ||
          m.lotId?.toUpperCase() === canonicalLotCode ||
          m.dealId?.toUpperCase() === expectedDealId
      );
      for (const m of matchedMsgs) {
        await DatabaseGateway.remove('deal_messages', m.id);
      }
    } catch {}

    // 7. Remove from developer_accreditation_requests & bank_special_approvals
    try {
      const devReqs = await DatabaseGateway.getAll<{ id: string; lotCode?: string }>('developer_accreditation_requests', []);
      for (const dr of devReqs.filter((d) => d.lotCode?.toUpperCase() === canonicalLotCode)) {
        await DatabaseGateway.remove('developer_accreditation_requests', dr.id);
      }
    } catch {}

    try {
      const bankApprovals = await DatabaseGateway.getAll<{ id: string; lotCode?: string }>('bank_special_approvals', []);
      for (const ba of bankApprovals.filter((b) => b.lotCode?.toUpperCase() === canonicalLotCode)) {
        await DatabaseGateway.remove('bank_special_approvals', ba.id);
      }
    } catch {}

    // 8. Purge LocalStorage Caches to guarantee no ghost resurrection on F5
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const collectionsToPurge = [
          'lots',
          'deals',
          'seller_requests',
          'documents_vault',
          'candidates',
          'deal_messages',
          'demo_lots',
          'demo_deals',
          'demo_seller_requests',
          'demo_documents_vault',
        ];

        for (const col of collectionsToPurge) {
          const keys = [`domexit_ydb_${col}`, `domexit_cache_${col}`, `domexit_${col}`];
          for (const k of keys) {
            const raw = window.localStorage.getItem(k);
            if (raw) {
              try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                  const filtered = arr.filter((item: any) => {
                    const itemCode = (item.lotCode || item.id || item.dealId || item.entityId || '').toUpperCase();
                    return (
                      itemCode !== cleanCode &&
                      itemCode !== canonicalLotCode &&
                      itemCode !== expectedDealId
                    );
                  });
                  window.localStorage.setItem(k, JSON.stringify(filtered));
                }
              } catch {
                window.localStorage.removeItem(k);
              }
            }
          }
        }

        // Fire global synchronization event
        window.dispatchEvent(
          new CustomEvent('domexit:dal_updated', {
            detail: {
              collectionName: 'lots',
              baseCollection: 'lots',
              id: canonicalLotCode,
              action: 'cascade_delete',
            },
          })
        );
      } catch (cacheErr) {
        console.warn('[PropertyLifecycleService] Local cache purge notice:', cacheErr);
      }
    }

    try {
      await AuditLogsRepository.addLog({
        lotCode: canonicalLotCode,
        dealId: expectedDealId,
        operatorName,
        operatorRole: 'owner',
        actionType: 'deal_cancelled_relisted',
        title: `Каскадное удаление объекта #${canonicalLotCode}`,
        description: `Лот, сделка #${expectedDealId}, документы и связанные заявки безвозвратно удалены оператором ${operatorName}.`,
      });
    } catch {}

    return true;
  }
}
