import { Lot } from '../../types';
import { initialLots } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { AuditLogsRepository } from './AuditLogsRepository';
import { EmployeesRepository } from './EmployeesRepository';

const COLLECTION = 'lots';

export class LotsRepository {
  static async getAll(filter?: {
    city?: string;
    maxCash?: number;
    rooms?: string;
    developer?: string;
    searchQuery?: string;
    urgentOnly?: boolean;
    readyYear?: number;
    status?: 'all' | 'available' | 'processing' | 'closed';
    isVipInvestor?: boolean;
  }): Promise<Lot[]> {
    let list = await FirebaseAdapter.getAllEntities<Lot>(COLLECTION, initialLots);

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        list = list.filter((l) => (l.status || 'available') === filter.status);

        // Mission 5: Separate processing stages between regular users and VIP investors
        if (filter.status === 'processing') {
          if (!filter.isVipInvestor) {
            // For regular users & public visitors: HIDE stage 1 (audit) and stage 2 (legal verification)
            // Show only advanced stages: 3 (matching buyers), 4 (bank transfer), 5 (closing)
            list = list.filter((l) => (l.currentStage || 3) >= 3);
          } else {
            // For VIP accredited investors: show early stage 2 (under audit / pre-market opportunities)
            list = list.filter((l) => (l.currentStage || 2) >= 2);
          }
        }
      }

      if (filter.city && filter.city !== 'all') {
        list = list.filter((l) => l.city === filter.city);
      }
      if (filter.maxCash && filter.maxCash > 0) {
        list = list.filter((l) => l.cashPaidBySeller <= filter.maxCash!);
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
            l.lotCode.toLowerCase().includes(q)
        );
      }
    }

    return list;
  }

  static async getByCode(lotCode: string): Promise<Lot | null> {
    const list = await FirebaseAdapter.getAllEntities<Lot>(COLLECTION, initialLots);
    const found = list.find((l) => l.lotCode.toUpperCase() === lotCode.toUpperCase());
    return found || null;
  }

  static async getByLotCode(lotCode: string): Promise<Lot | null> {
    return this.getByCode(lotCode);
  }

  static async getByAssignedEmployee(employeeId: string): Promise<Lot[]> {
    const list = await this.getAll();
    return list.filter(l => l.assignedEmployeeId === employeeId);
  }

  static async assignToEmployee(
    lotCode: string, 
    employeeId: string, 
    employeeName: string
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    lot.assignedEmployeeId = employeeId;
    lot.assignedEmployeeName = employeeName;
    lot.approvalStatus = 'approved';

    // Synchronize curator profile data onto lot (Mission 14)
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

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: 'Владелец платформы (CEO)',
      operatorRole: 'owner',
      actionType: 'employee_created_modified',
      title: `Объект #${lot.lotCode} закреплен за куратором: ${employeeName}`,
      description: `Назначен персональный куратор ${employeeName} для ведения сделки и связи с покупателем.`,
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
    bio?: string;
  }): Promise<void> {
    const list = await this.getAll();
    const matched = list.filter(l => l.assignedEmployeeId === employee.id);
    for (const lot of matched) {
      lot.assignedEmployeeName = employee.name;
      lot.curator = {
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        telegram: employee.telegram,
        photoUrl: employee.photoUrl,
        whatsapp: employee.whatsapp,
        bio: employee.bio,
      };
      await FirebaseAdapter.saveEntity(COLLECTION, lot);
    }
  }

  static async updateStatus(
    lotCode: string, 
    status: 'available' | 'processing' | 'closed'
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;
    lot.status = status;
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
  }

  /**
   * Request additional docs from seller (Mission 7.1)
   */
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

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'doc_requested',
      title: `Запрошены доп. документы по лоту #${lot.lotCode}`,
      description: `Запрошено: ${requestedList.join(', ')}. Примечание: ${notes}`,
      metadata: { requestedList }
    });

    return lot;
  }

  /**
   * Approve legal status with stamp (Mission 7.2)
   */
  static async approveLotLegal(lotCode: string, curatorName: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.isVerified = true;
    lot.approvalStatus = 'approved';
    lot.currentStage = 3; // Advance to Matchmaking & Packaging
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

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

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

  /**
   * Reject lot with high risk (Mission 7.2)
   */
  static async rejectLotLegal(lotCode: string, curatorName: string, reason: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.approvalStatus = 'rejected';
    lot.status = 'closed';

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Отклонен по юридическим комплаенс-рискам',
      notes: reason,
    });

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

    await AuditLogsRepository.addLog({
      lotCode: lot.lotCode,
      operatorName: curatorName,
      operatorRole: 'curator',
      actionType: 'legal_rejected',
      title: `Лот #${lot.lotCode} отклонен куратором`,
      description: `Причина отклонения: ${reason}`,
    });

    return lot;
  }

  /**
   * Emergency relist of lot (Mission 10.5)
   */
  static async relistLot(lotCode: string, curatorName: string, reason?: string): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.status = 'available';
    lot.currentStage = 3; // Open for bids again

    lot.curatorOperationsLog = lot.curatorOperationsLog || [];
    lot.curatorOperationsLog.unshift({
      timestamp: new Date().toISOString(),
      curatorName,
      action: 'Срыв сделки — Возврат лота в каталог и уведомление кандидатов',
      notes: reason || 'Прежний покупатель не выполнил депонирование средств. Лот возвращен в каталог.',
    });

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

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

  /**
   * Update packaging photos and gallery approval (Mission 8.1)
   */
  static async updatePackagingPhotos(
    lotCode: string,
    curatorName: string,
    approvedGalleryImages: string[],
    sellerUploadedPhotos?: string[]
  ): Promise<Lot | null> {
    const lot = await this.getByCode(lotCode);
    if (!lot) return null;

    lot.approvedGalleryImages = approvedGalleryImages;
    lot.galleryImages = approvedGalleryImages.length > 0 ? approvedGalleryImages : lot.galleryImages;
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

    await FirebaseAdapter.saveEntity(COLLECTION, lot);

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
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
  }

  static async add(lot: Lot): Promise<Lot> {
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
  }
}

