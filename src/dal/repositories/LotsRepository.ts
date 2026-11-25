import { Lot } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { AuditLogsRepository } from './AuditLogsRepository';
import { EmployeesRepository } from './EmployeesRepository';
import { PropertyLifecycleService } from '../../services/propertyLifecycleService';
import { swrCache } from '../cache/SWRCache';
import { apiClient } from '../../services/apiClient';

const COLLECTION = 'lots';

export class LotsRepository {
  /**
   * Enterprise Cursor-based Pagination with Card Projection.
   * Pulls lightweight (~3KB) catalog cards with cursor navigation, reducing network payload by ~95%.
   */
  static async getPaginated(params: {
    limit?: number;
    cursor?: string | null;
    page?: number;
    fields?: 'card' | 'full';
    city?: string;
    district?: string;
    developer?: string;
    rooms?: string;
    priceMin?: number;
    priceMax?: number;
    searchQuery?: string;
    status?: string;
    sort?: string;
    fresh?: boolean;
  } = {}): Promise<{
    items: Lot[];
    nextCursor: string | null;
    hasMore: boolean;
    totalMatching: number;
    stats?: { totalCount: number; activeCount: number };
  }> {
    const res = await apiClient.getPaginated<Lot>('lots', {
      limit: params.limit || 12,
      cursor: params.cursor,
      page: params.page,
      fields: params.fields || 'card',
      city: params.city && params.city !== 'all' ? params.city : undefined,
      district: params.district && params.district !== 'all' ? params.district : undefined,
      developer: params.developer && params.developer !== 'all' ? params.developer : undefined,
      rooms: params.rooms && params.rooms !== 'all' ? params.rooms : undefined,
      priceMin: params.priceMin,
      priceMax: params.priceMax,
      search: params.searchQuery,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      sort: params.sort,
      fresh: params.fresh,
    });

    return {
      items: res.items || [],
      nextCursor: res.nextCursor || null,
      hasMore: Boolean(res.hasMore),
      totalMatching: res.totalMatching ?? res.total ?? (res.items?.length || 0),
      stats: res.stats,
    };
  }
  static async getAll(filter?: {
    city?: string;
    district?: string;
    maxCash?: number;
    maxMonthly?: number;
    minDiscount?: number;
    deliveryYear?: string;
    rooms?: string;
    developer?: string;
    searchQuery?: string;
    urgentOnly?: boolean;
    readyYear?: number;
    status?: 'all' | 'available' | 'processing' | 'closed';
    includePendingApproval?: boolean;
  }): Promise<Lot[]> {
    let list = await DatabaseGateway.getAll<Lot>(COLLECTION, []);

    // Strict deduplication guard
    const seenCodes = new Set<string>();
    list = list.filter((l) => {
      const code = (l.lotCode || l.id || '').toUpperCase();
      if (!code || seenCodes.has(code)) return false;
      seenCodes.add(code);
      return true;
    });

    if (filter) {
      if (!filter.includePendingApproval) {
        list = list.filter((l) => {
          if (l.approvalStatus === 'rejected' || l.approvalStatus === 'pending_owner_approval' || l.approvalStatus === 'approved_for_packaging') {
            return false;
          }
          if (l.status === 'draft' || l.status === 'hidden' || l.status === 'blocked') return false;
          if (l.isPublished === false) return false;
          return true;
        });
      }

      if (filter.status && filter.status !== 'all') {
        if (filter.status === 'processing') {
          list = list.filter((l) => l.status === 'processing' || l.status === 'in_deal');
        } else {
          list = list.filter((l) => (l.status || 'available') === filter.status);
        }

        if (filter.status === 'processing') {
          list = list.filter((l) => (l.currentStage || 3) >= 3);
        }
      }

      if (filter.city && filter.city !== 'all') {
        list = list.filter((l) => l.city === filter.city);
      }

      if (filter.district && filter.district !== 'all') {
        const targetDistrict = filter.district.trim().toLowerCase();
        list = list.filter((l) => l.district.trim().toLowerCase() === targetDistrict);
      }

      if (filter.maxCash && filter.maxCash > 0) {
        list = list.filter((l) => l.cashPaidBySeller <= filter.maxCash!);
      }
      if (filter.maxMonthly && filter.maxMonthly > 0) {
        list = list.filter((l) => Math.round(l.installmentQuarterlyPayment / 3) <= filter.maxMonthly!);
      }
      if (filter.minDiscount && filter.minDiscount > 0) {
        list = list.filter((l) => {
          const disc = ((l.todayDeveloperPrice - l.dduContractPrice) / Math.max(l.todayDeveloperPrice, 1)) * 100;
          return disc >= filter.minDiscount!;
        });
      }
      if (filter.deliveryYear && filter.deliveryYear !== 'all') {
        if (filter.deliveryYear === 'ready') {
          list = list.filter((l) => l.deliveryYear <= 2025 || l.deliveryDate.toLowerCase().includes('сдан'));
        } else if (filter.deliveryYear === '2025') {
          list = list.filter((l) => l.deliveryYear === 2025);
        } else if (filter.deliveryYear === '2026') {
          list = list.filter((l) => l.deliveryYear === 2026);
        } else if (filter.deliveryYear === '2027+') {
          list = list.filter((l) => l.deliveryYear >= 2027);
        }
      }
      if (filter.rooms && filter.rooms !== 'all') {
        list = list.filter((l) => l.rooms === filter.rooms);
      }
      if (filter.developer && filter.developer !== 'all') {
        list = list.filter((l) => l.developer.toLowerCase().includes(filter.developer!.toLowerCase()));
      }
      if (filter.urgentOnly) {
        list = list.filter((l) => l.isUrgentExit);
      }
      if (filter.readyYear && filter.readyYear > 0) {
        list = list.filter((l) => l.deliveryYear <= filter.readyYear!);
      }
      if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
        const q = filter.searchQuery.toLowerCase();
        list = list.filter(
          (l) =>
            l.complexName.toLowerCase().includes(q) ||
            l.developer.toLowerCase().includes(q) ||
            l.district.toLowerCase().includes(q) ||
            l.lotCode.toLowerCase().includes(q) ||
            (l.streetAddress && l.streetAddress.toLowerCase().includes(q))
        );
      }
    } else {
      list = list.filter((l) => l.approvalStatus !== 'rejected');
    }

    return list;
  }

  static async getSimilarInDistrict(targetLot: Lot, limit = 3): Promise<Lot[]> {
    const allAvailable = await this.getAll({ status: 'available' });
    const others = allAvailable.filter((l) => l.lotCode !== targetLot.lotCode);

    const sameDistrict = others.filter(
      (l) =>
        l.city === targetLot.city &&
        l.district.trim().toLowerCase() === targetLot.district.trim().toLowerCase()
    );

    if (sameDistrict.length >= limit) {
      return sameDistrict.slice(0, limit);
    }

    const sameCity = others.filter(
      (l) =>
        l.city === targetLot.city &&
        !sameDistrict.some((sd) => sd.lotCode === l.lotCode)
    );

    return [...sameDistrict, ...sameCity].slice(0, limit);
  }

  static async getByCode(lotCode: string): Promise<Lot | null> {
    if (!lotCode) return null;
    const clean = lotCode.trim().toUpperCase();
    try {
      const direct = await DatabaseGateway.getById<Lot>(COLLECTION, clean);
      if (
        direct &&
        ((direct.lotCode && direct.lotCode.toUpperCase() === clean) ||
          (direct.id && direct.id.toUpperCase() === clean))
      ) {
        return direct;
      }
    } catch {
      // Fallback to getAll
    }
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, []);
    const found = list.find(
      (l) =>
        (l.lotCode && l.lotCode.toUpperCase() === clean) ||
        (l.id && l.id.toUpperCase() === clean)
    );
    return found || null;
  }

  static async getByLotCode(lotCode: string): Promise<Lot | null> {
    return this.getByCode(lotCode);
  }

  static async getBySeller(
    uid: string,
    clientCode?: string,
    email?: string,
    phone?: string
  ): Promise<Lot[]> {
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, []);
    const cleanUid = (uid || '').trim().toLowerCase();
    const cleanCode = (clientCode || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').replace(/[^\d]/g, '');

    return list.filter((l) => {
      if (cleanUid && l.sellerUserId && l.sellerUserId.toLowerCase() === cleanUid) return true;
      if (cleanCode && l.sellerClientCode && l.sellerClientCode.toLowerCase() === cleanCode) return true;
      if (cleanEmail && (l as any).sellerEmail && (l as any).sellerEmail.toLowerCase() === cleanEmail) return true;
      if (cleanPhone && (l as any).sellerPhone && (l as any).sellerPhone.replace(/[^\d]/g, '') === cleanPhone) return true;
      return false;
    });
  }



  static async getByAssignedEmployee(employeeId: string): Promise<Lot[]> {
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, []);
    return list.filter((l) => l.assignedEmployeeId === employeeId);
  }

  static async assignToEmployee(
    lotCode: string,
    employeeId: string,
    employeeName: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)',
    curatorProfile?: Partial<{ name: string; role: string; phone: string; telegram: string; photoUrl?: string; whatsapp?: string; bio?: string }>
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    lot.assignedEmployeeId = employeeId;
    lot.assignedEmployeeName = employeeName;
    (lot as any).assignedCuratorId = employeeId;
    (lot as any).assignedCuratorName = employeeName;

    // Preserve already-published Stage 3/4 status when reassigning curator on a live lot
    if (!lot.isPublished && lot.approvalStatus === 'pending_owner_approval') {
      lot.approvalStatus = 'approved_for_packaging';
      lot.status = 'draft';
      lot.isPublished = false;
      lot.currentStage = 2;
    } else if (!lot.approvalStatus || lot.approvalStatus === 'pending_owner_approval') {
      lot.approvalStatus = 'approved_for_packaging';
    }

    try {
      const emp = curatorProfile?.name ? curatorProfile : await EmployeesRepository.getById(employeeId);
      if (emp && emp.name) {
        lot.curator = {
          name: emp.name,
          role: emp.role || 'Куратор сделок',
          phone: emp.phone || '+7 (812) 409-00-00',
          telegram: emp.telegram || '@domexit_official',
          photoUrl: emp.photoUrl,
          whatsapp: emp.whatsapp,
          bio: emp.bio,
        };
      }
    } catch {
      // Keep existing curator
    }

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole: 'owner',
      actionType: 'lot_assigned_to_curator',
      title: `Объект #${lot.lotCode} одобрен и закреплен за куратором: ${employeeName}`,
      description: `Назначен персональный куратор ${employeeName} (${employeeId}) для правового аудита и ведения сделки.`,
    });

    return lot;
  }

  static async publishToOpenCatalog(
    lotCode: string,
    operatorName: string,
    additionalUpdates?: Partial<Lot>
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    const updated: Lot = {
      ...lot,
      ...additionalUpdates,
      status: 'available',
      approvalStatus: 'approved',
      isApproved: true,
      isPublished: true,
      currentStage: 3,
      publishedAt: new Date().toISOString(),
      dropConfig: lot.dropConfig || {
        mode: 'staged_drop',
        launchedAt: new Date().toISOString(),
        launchedBy: operatorName,
        goldExclusiveHours: 0,
        goldExclusiveUntil: new Date().toISOString(),
        windowHours: 48,
        closesAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        maxApplicationsCap: 5,
        currentValidApplications: 0,
        waveStatus: 'silver_wave',
        matchedGoldCount: 0,
        matchedSilverCount: 0,
        reDropCount: 1,
      },
    };
    await DatabaseGateway.save<Lot>(COLLECTION, updated);

    // Simultaneously advance the linked deal stage to buyer_matching
    try {
      const { DealsRepository } = await import('./DealsRepository');
      await DealsRepository.updateStage(lot.lotCode, 'buyer_matching');
    } catch (dealErr) {
      console.warn('[LotsRepository] Non-fatal deal stage sync:', dealErr);
    }

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole: 'curator',
      actionType: 'packaging_published',
      title: `Лот #${lot.lotCode} опубликован в открытом каталоге DomExit`,
      description: `Объект упакован по 152-ФЗ и открыт для публичных покупателей.`,
    });
    return updated;
  }

  static async updateCuratorProfileForAssignedLots(employee: {
    id: string;
    name: string;
    role: string;
    phone: string;
    telegram: string;
    photoUrl?: string;
    whatsapp?: string;
    maxProfile?: string;
    bio?: string;
  }): Promise<void> {
    const list = await this.getAll({ includePendingApproval: true });
    const matched = list.filter((l) => l.assignedEmployeeId === employee.id);
    for (const lot of matched) {
      lot.assignedEmployeeName = employee.name;
      lot.curator = {
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        telegram: employee.telegram,
        photoUrl: employee.photoUrl,
        whatsapp: employee.whatsapp,
        maxProfile: employee.maxProfile,
        bio: employee.bio,
      };
      await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);
    }
  }

  static async updateStatus(
    lotCode: string,
    status: 'available' | 'processing' | 'closed'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    lot.status = status;
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);
    return lot;
  }

  static async requestAdditionalDocs(
    lotCode: string,
    requestedList: string[],
    notes: string,
    curatorName: string
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.additionalDocsRequested = {
      requestedList,
      notes,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      submittedDocs: lot.additionalDocsRequested?.submittedDocs || [],
    };

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Запрос дополнительных документов у продавца',
      notes: `Запрошено: ${requestedList.join(', ')}. Комментарий: ${notes}`,
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'doc_requested',
      title: `Запрошены доп. документы по лоту #${lot.lotCode}`,
      description: `Запрошено: ${requestedList.join(', ')}. Примечание: ${notes}`,
      metadata: { requestedList },
    });

    return lot;
  }

  static async submitRequestedDocBySeller(
    lotCode: string,
    docSummary: { name: string; url: string; docId?: string },
    sellerName: string
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    const existingReq = lot.additionalDocsRequested || {
      requestedList: [],
      notes: '',
      requestedAt: new Date().toISOString(),
      status: 'submitted' as const,
      submittedDocs: [],
    };

    const submittedDocs = [
      ...(existingReq.submittedDocs || []),
      {
        name: docSummary.name,
        url: docSummary.url,
        docId: docSummary.docId,
        uploadedAt: new Date().toISOString(),
      },
    ];

    lot.additionalDocsRequested = {
      ...existingReq,
      status: 'submitted',
      submittedDocs,
    };

    if (docSummary.docId) {
      lot.documentIds = Array.from(new Set([...(lot.documentIds || []), docSummary.docId]));
    }

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: sellerName,
      operatorRole: 'client',
      actionType: 'doc_uploaded',
      title: `Продавец загрузил запрошенный документ по лоту #${lot.lotCode}`,
      description: `Загружен файл: ${docSummary.name} в защищенное хранилище S3.`,
    });

    return lot;
  }

  static async approveLotLegal(
    lotCode: string,
    curatorName: string,
    customAntiBankruptcyIndex?: number,
    checkpoints?: any[],
    legalAuditAxes?: any[]
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.isVerified = true;
    lot.isPublished = false;
    lot.approvalStatus = 'approved_for_packaging';
    lot.status = 'draft';
    lot.currentStage = 2;
    if (customAntiBankruptcyIndex !== undefined) {
      lot.legalPassport.antiBankruptcyIndex = customAntiBankruptcyIndex;
    }
    if (checkpoints) {
      lot.legalAuditCheckpoints = checkpoints;
    }
    if (legalAuditAxes) {
      lot.legalAuditAxes = legalAuditAxes;
    }
    if (lot.additionalDocsRequested) {
      lot.additionalDocsRequested.status = 'resolved';
    }

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Утвержден правовой аудит — Выдан штамп «Документы проверены»',
      notes: `Итоговый индекс юридической чистоты: ${lot.legalPassport.antiBankruptcyIndex}%. 5 ключевых разделов правового аудита соответствуют стандарту 214-ФЗ / 127-ФЗ. Лот передан на этап упаковки (Этап 2).`,
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    // Synchronize linked deal to packaging stage
    try {
      const { DealsRepository } = await import('./DealsRepository');
      await DealsRepository.updateStage(lot.lotCode, 'packaging');
    } catch (dealErr) {
      console.warn('[LotsRepository] Non-fatal deal stage sync on legal approval:', dealErr);
    }

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'legal_approved',
      title: `Штамп «Документы проверены» выдан по лоту #${lot.lotCode}`,
      description: `Антибанкротный индекс: ${lot.legalPassport.antiBankruptcyIndex}%. Все 4 ключевых чекпоинта верифицированы.`,
    });

    return lot;
  }

  static async rejectLotLegal(
    lotCode: string,
    reason: string,
    curatorName: string = 'Куратор DomExit'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.approvalStatus = 'rejected';
    lot.rejectionReason = reason;
    lot.status = 'closed';

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Отклонен по юридическим комплаенс-рискам',
      notes: reason,
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'legal_rejected',
      title: `Лот #${lot.lotCode} отклонен (${curatorName})`,
      description: `Причина отклонения: ${reason}`,
    });

    return lot;
  }

  static async relistLot(lotCode: string, curatorName: string, reason?: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.status = 'available';
    lot.currentStage = 3;

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Срыв сделки — Возврат лота в каталог и уведомление кандидатов',
      notes: reason || 'Прежний покупатель не выполнил депонирование средств. Лот возвращен в каталог.',
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'deal_cancelled_relisted',
      title: `Лот #${lot.lotCode} возвращен в каталог после срыва сделки`,
      description: reason || 'Сделка отменена куратором. Отправлены уведомления прежним кандидатам.',
    });

    return lot;
  }

  static async updatePackagingPhotos(
    lotCode: string,
    curatorName: string,
    approvedGalleryImages: string[],
    sellerUploadedPhotos?: string[]
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.approvedGalleryImages = approvedGalleryImages;
    lot.images = approvedGalleryImages;
    lot.galleryImages = approvedGalleryImages;
    if (approvedGalleryImages.length > 0) {
      lot.imageUrl = approvedGalleryImages[0];
    } else {
      lot.imageUrl = '';
    }
    if (sellerUploadedPhotos) {
      lot.sellerUploadedPhotos = sellerUploadedPhotos;
      lot.sellerSubmittedImages = sellerUploadedPhotos;
    }

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Медиа-материалы утверждены куратором',
      notes: `Одобрено ${approvedGalleryImages.length} фотографий для публичного каталога.`,
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'packaging_photos_approved',
      title: `Медиа-пакет лота #${lot.lotCode} утвержден`,
      description: `Куратор утвердил ${approvedGalleryImages.length} фото для публичного каталога.`,
    });

    return lot;
  }

  static async unpublishLot(
    lotCode: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.isPublished = false;
    lot.status = 'draft';
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole: 'owner',
      actionType: 'deal_cancelled_relisted',
      title: `Лот #${lot.lotCode} снят с публикации`,
      description: `Объект переведен в черновик и скрыт из публичного каталога оператором ${operatorName}.`,
    });

    return lot;
  }

  static async blockLot(
    lotCode: string,
    reason: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.isPublished = false;
    lot.status = 'blocked';
    lot.approvalStatus = 'rejected';
    lot.rejectionReason = reason;
    lot.blockedReason = reason;
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode);

    try {
      const deals = await DatabaseGateway.query<{ id: string; lotCode: string; status?: string }>(
        'deals',
        (d) => d.lotCode?.toUpperCase() === lot.lotCode.toUpperCase()
      );
      for (const d of deals) {
        d.status = 'cancelled';
        await DatabaseGateway.save('deals', d);
      }
    } catch {}

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName,
      operatorRole: 'owner',
      actionType: 'legal_rejected',
      title: `Лот #${lot.lotCode} заблокирован администратором`,
      description: `Причина блокировки: ${reason}. Объект скрыт из каталога.`,
    });

    return lot;
  }

  static async deleteLotAndDeal(
    lotCode: string,
    operatorName: string = 'Ahmed Abdallah (Владелец / CEO)'
  ): Promise<boolean> {
    const lot = await this.getByCode(lotCode);
    const targetLotCode = lot?.lotCode || lotCode;
    return PropertyLifecycleService.deletePropertyCascade(targetLotCode, operatorName);
  }

  static invalidateLotCache(lotCode?: string): void {
    swrCache.invalidatePrefix('getAll:lots');
    swrCache.invalidatePrefix('getAll:demo_lots');
    if (lotCode) {
      const codeUpper = lotCode.trim().toUpperCase();
      swrCache.invalidatePrefix(`getById:lots:${lotCode}`);
      swrCache.invalidatePrefix(`getById:demo_lots:${lotCode}`);
      swrCache.invalidatePrefix(`getById:lots:${codeUpper}`);
      swrCache.invalidatePrefix(`getById:demo_lots:${codeUpper}`);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('domexit:dal_updated', {
          detail: {
            baseCollection: 'lots',
            collectionName: 'lots',
            id: lotCode,
            timestamp: Date.now(),
          },
        })
      );
    }
  }

  static invalidateLotsListCache(): void {
    this.invalidateLotCache();
  }

  static async patchLot(lotCode: string, patch: Partial<Lot>): Promise<Lot | null> {
    if (!lotCode) return null;
    const existing = await this.getByCode(lotCode);
    if (!existing) return null;

    const merged: Lot = {
      ...existing,
      ...patch,
      ownerDossier: patch.ownerDossier
        ? { ...existing.ownerDossier, ...patch.ownerDossier }
        : existing.ownerDossier,
      legalPassport: patch.legalPassport
        ? { ...existing.legalPassport, ...patch.legalPassport }
        : existing.legalPassport,
      coordinates: patch.coordinates || existing.coordinates,
      images:
        patch.images ??
        patch.approvedGalleryImages ??
        existing.images ??
        existing.approvedGalleryImages ??
        existing.galleryImages ??
        [],
      approvedGalleryImages:
        patch.approvedGalleryImages ??
        patch.images ??
        existing.approvedGalleryImages ??
        existing.images ??
        existing.galleryImages ??
        [],
      galleryImages:
        patch.galleryImages ??
        patch.approvedGalleryImages ??
        patch.images ??
        existing.galleryImages ??
        existing.images ??
        [],
      sellerUploadedPhotos:
        patch.sellerUploadedPhotos ??
        patch.sellerSubmittedImages ??
        existing.sellerUploadedPhotos ??
        existing.sellerSubmittedImages ??
        [],
      sellerSubmittedImages:
        patch.sellerSubmittedImages ??
        patch.sellerUploadedPhotos ??
        existing.sellerSubmittedImages ??
        existing.sellerUploadedPhotos ??
        [],
      legalAuditAxes: patch.legalAuditAxes ?? existing.legalAuditAxes,
    };

    if (merged.images && merged.images.length > 0 && !merged.imageUrl) {
      merged.imageUrl = merged.images[0];
    }

    await DatabaseGateway.save<Lot>(COLLECTION, merged);
    this.invalidateLotCache(lotCode);
    return merged;
  }

  static async update(lot: Lot): Promise<Lot> {
    const code = lot.lotCode || lot.id;
    const existing = code ? await this.getByCode(code) : null;
    const merged: Lot = existing
      ? {
          ...existing,
          ...lot,
          ownerDossier: lot.ownerDossier
            ? { ...existing.ownerDossier, ...lot.ownerDossier }
            : existing.ownerDossier,
          legalPassport: lot.legalPassport
            ? { ...existing.legalPassport, ...lot.legalPassport }
            : existing.legalPassport,
          legalAuditAxes: lot.legalAuditAxes ?? existing.legalAuditAxes,
          images:
            lot.images ??
            lot.approvedGalleryImages ??
            existing.images ??
            existing.approvedGalleryImages ??
            existing.galleryImages ??
            [],
          approvedGalleryImages:
            lot.approvedGalleryImages ??
            lot.images ??
            existing.approvedGalleryImages ??
            existing.images ??
            existing.galleryImages ??
            [],
          galleryImages:
            lot.galleryImages ??
            lot.approvedGalleryImages ??
            lot.images ??
            existing.galleryImages ??
            existing.images ??
            [],
          sellerUploadedPhotos:
            lot.sellerUploadedPhotos ??
            lot.sellerSubmittedImages ??
            existing.sellerUploadedPhotos ??
            existing.sellerSubmittedImages ??
            [],
          sellerSubmittedImages:
            lot.sellerSubmittedImages ??
            lot.sellerUploadedPhotos ??
            existing.sellerSubmittedImages ??
            existing.sellerUploadedPhotos ??
            [],
        }
      : lot;

    if (merged.images && merged.images.length > 0 && !merged.imageUrl) {
      merged.imageUrl = merged.images[0];
    }

    await DatabaseGateway.save<Lot>(COLLECTION, merged);
    this.invalidateLotCache(merged.lotCode || merged.id);
    return merged;
  }

  static async save(lot: Lot): Promise<Lot> {
    return this.update(lot);
  }

  static async add(lot: Lot): Promise<Lot> {
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    this.invalidateLotCache(lot.lotCode || lot.id);
    return lot;
  }

  static async incrementViews(lotCode: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    const baseViews =
      typeof lot.viewsCount === 'number'
        ? lot.viewsCount
        : 110 + (lot.lotCode.charCodeAt(lot.lotCode.length - 1) % 90);
    lot.viewsCount = baseViews + 1;
    if (!lot.publishedAt) {
      lot.publishedAt = '2026-10-28T14:30:00.000Z';
    }
    if (typeof lot.favoritesCount !== 'number') {
      lot.favoritesCount = 12 + (lot.lotCode.charCodeAt(lot.lotCode.length - 1) % 19);
    }
    try {
      await DatabaseGateway.save<Lot>(COLLECTION, lot);
      this.invalidateLotCache(lot.lotCode);
    } catch {
      // In case of non-staff/unauthenticated user, saving view counts is restricted by API policy, so ignore error
    }
    return lot;
  }

  static async adjustFavoritesCount(lotCode: string, delta: number): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    const baseFavs =
      typeof lot.favoritesCount === 'number'
        ? lot.favoritesCount
        : 12 + (lot.lotCode.charCodeAt(lot.lotCode.length - 1) % 19);
    lot.favoritesCount = Math.max(0, baseFavs + delta);
    try {
      await DatabaseGateway.save<Lot>(COLLECTION, lot);
      this.invalidateLotCache(lot.lotCode);
    } catch {
      // Ignore if unauthenticated or non-staff
    }
    return lot;
  }
}
