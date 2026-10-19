import { Lot } from '../../types';
import { initialLots } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

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
  }): Promise<Lot[]> {
    let list = await FirebaseAdapter.getAllEntities<Lot>(COLLECTION, initialLots);

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        list = list.filter((l) => (l.status || 'available') === filter.status);
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
    const list = await this.getAll();
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
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
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

  static async update(lot: Lot): Promise<Lot> {
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
  }

  static async add(lot: Lot): Promise<Lot> {
    await FirebaseAdapter.saveEntity(COLLECTION, lot);
    return lot;
  }
}
