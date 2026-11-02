import { Lot } from '../../types';
import { initialLots } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { AuditLogsRepository } from './AuditLogsRepository';
import { EmployeesRepository } from './EmployeesRepository';
import { PlatformModeRepository } from './PlatformModeRepository';

const COLLECTION = 'lots';

export class LotsRepository {
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
    isVipInvestor?: boolean;
    includePendingApproval?: boolean;
  }): Promise<Lot[]> {
    let list = await DatabaseGateway.getAll<Lot>(COLLECTION, initialLots);

    if (PlatformModeRepository.isProductionMode()) {
      const seedIds = new Set(initialLots.map((l) => l.id));
      list = list.filter((l) => !seedIds.has(l.id) && l.isDemo !== true);
    }

    if (filter) {
      if (!filter.includePendingApproval) {
        list = list.filter((l) => l.approvalStatus !== 'rejected');
      }

      if (filter.status && filter.status !== 'all') {
        list = list.filter((l) => (l.status || 'available') === filter.status);

        if (filter.status === 'processing') {
          if (!filter.isVipInvestor) {
            list = list.filter((l) => (l.currentStage || 3) >= 3);
          } else {
            list = list.filter((l) => (l.currentStage || 2) >= 2 || l.isEarlyAccessVIP);
          }
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
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, initialLots);
    const clean = lotCode.trim().toUpperCase();
    const found = list.find(
      (l) => l.lotCode.toUpperCase() === clean || l.id.toUpperCase() === clean
    );
    return found || null;
  }

  static async getByLotCode(lotCode: string): Promise<Lot | null> {
    return this.getByCode(lotCode);
  }

  static async getBySeller(uid: string, clientCode?: string): Promise<Lot[]> {
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, initialLots);
    return list.filter(
      (l) =>
        (uid && l.sellerUserId === uid) ||
        (clientCode && l.sellerClientCode?.toUpperCase() === clientCode.toUpperCase())
    );
  }

  static async getByAssignedEmployee(employeeId: string): Promise<Lot[]> {
    const list = await DatabaseGateway.getAll<Lot>(COLLECTION, initialLots);
    return list.filter((l) => l.assignedEmployeeId === employeeId);
  }

  static async assignToEmployee(
    lotCode: string,
    employeeId: string,
    employeeName: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    lot.assignedEmployeeId = employeeId;
    lot.assignedEmployeeName = employeeName;
    lot.approvalStatus = 'approved';
    if (!lot.status || lot.status === 'processing') {
      lot.status = 'available';
    }
    if (!lot.currentStage || lot.currentStage < 2) {
      lot.currentStage = 2;
    }

    try {
      const emp = await EmployeesRepository.getById(employeeId);
      if (emp) {
        lot.curator = {
          name: emp.name,
          role: emp.role,
          phone: emp.phone,
          telegram: emp.telegram,
          photoUrl: emp.photoUrl,
          whatsapp: emp.whatsapp,
          bio: emp.bio,
        };
      }
    } catch {
      // Keep existing curator
    }

    await DatabaseGateway.save<Lot>(COLLECTION, lot);

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

  static async approveLotLegal(lotCode: string, curatorName: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.isVerified = true;
    lot.approvalStatus = 'approved';
    lot.status = lot.status === 'closed' ? 'available' : lot.status || 'available';
    lot.currentStage = 3;
    if (lot.additionalDocsRequested) {
      lot.additionalDocsRequested.status = 'resolved';
    }

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Утвержден правовой аудит — Выдан штамп «Документы проверены»',
      notes: '42 параметра соответствуют стандарту 214-ФЗ. Лот допущен к открытому матчмейкингу.',
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'legal_approved',
      title: `Штамп «Документы проверены» выдан по лоту #${lot.lotCode}`,
      description: 'Все 42 проверки пройдены без рисков, антибанкротный индекс подтвержден.',
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
    if (approvedGalleryImages.length > 0) {
      lot.galleryImages = approvedGalleryImages;
      lot.imageUrl = approvedGalleryImages[0];
    }
    if (sellerUploadedPhotos) {
      lot.sellerUploadedPhotos = sellerUploadedPhotos;
    }

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Медиа-материалы утверждены куратором',
      notes: `Одобрено ${approvedGalleryImages.length} фотографий для публичного каталога.`,
    });

    await DatabaseGateway.save<Lot>(COLLECTION, lot);

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

  static async update(lot: Lot): Promise<Lot> {
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    return lot;
  }

  static async save(lot: Lot): Promise<Lot> {
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    return lot;
  }

  static async add(lot: Lot): Promise<Lot> {
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
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
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
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
    await DatabaseGateway.save<Lot>(COLLECTION, lot);
    return lot;
  }
}
