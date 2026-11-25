import { Employee } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { apiClient } from '../../services/apiClient';

const COLLECTION = 'employees';

export const PROD_SYSTEM_EMPLOYEES: Employee[] = [];

export class EmployeesRepository {
  static async getAll(): Promise<Employee[]> {
    const raw = await DatabaseGateway.getAll<Employee>(COLLECTION, PROD_SYSTEM_EMPLOYEES);
    return raw.filter((e) => {
      const email = (e.email || '').toLowerCase().trim();
      return !email.includes('test');
    });
  }

  static async getAssignableCurators(): Promise<Employee[]> {
    try {
      const res = await apiClient.get<{ items: Employee[] }>('/api/data/curators');
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        const seen = new Set<string>();
        return res.items.filter((e) => {
          const email = (e.email || '').toLowerCase().trim();
          if (email.includes('test')) return false;
          const key = (e.id || email).toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch {
      // Fallback to employees table when unauthenticated or offline
    }
    return this.getAll();
  }

  static async getById(employeeId: string): Promise<Employee | null> {
    if (!employeeId) return null;
    const curators = await this.getAssignableCurators();
    const curatorMatch = curators.find((e) => e.id === employeeId);
    if (curatorMatch) return curatorMatch;

    try {
      const all = await this.getAll();
      return all.find((e) => e.id === employeeId) || null;
    } catch {
      return null;
    }
  }

  static async getByEmail(email: string): Promise<Employee | null> {
    if (!email) return null;
    const all = await this.getAll();
    const clean = email.trim().toLowerCase();
    return all.find((e) => e.email.trim().toLowerCase() === clean) || null;
  }

  static async isEmployeeEmail(email?: string): Promise<boolean> {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    if (
      clean === 'amaas9499@gmail.com' ||
      clean === 'amaas9494@gmail.com' ||
      clean === 'ceo@domexit.ru' ||
      clean.includes('domexit.ru')
    ) {
      return true;
    }
    const emp = await this.getByEmail(clean);
    return !!(emp && emp.status !== 'suspended');
  }

  static async add(employee: Partial<Employee>): Promise<Employee> {
    const newEmp: Employee = {
      id: employee.id || `emp-${Date.now()}`,
      name: employee.name || 'Специалист DomExit',
      email: employee.email || `curator${Math.floor(100 + Math.random() * 900)}@domexit.ru`,
      role: employee.role || 'Ведущий куратор отдела выходов',
      phone: employee.phone || '',
      telegram: employee.telegram || '',
      whatsapp: employee.whatsapp || '',
      photoUrl: employee.photoUrl || '',
      bio:
        employee.bio ||
        'Сертифицированный специалист по сделкам с уступкой прав по 214-ФЗ и аккредитивным расчетам.',
      activeLotsCount: employee.activeLotsCount || 0,
      closedDealsCount: employee.closedDealsCount || 0,
      avgSpeedDays: employee.avgSpeedDays || 0,
      status: employee.status || 'active',
      permissions: employee.permissions || ['legal_audit', 'packaging', 'matchmaker', 'closing'],
    };
    await DatabaseGateway.save<Employee>(COLLECTION, newEmp);
    return newEmp;
  }

  static async update(employee: Employee): Promise<Employee> {
    await DatabaseGateway.save<Employee>(COLLECTION, employee);
    return employee;
  }

  static async toggleStatus(employeeId: string): Promise<Employee | null> {
    const emp = await this.getById(employeeId);
    if (!emp) return null;
    emp.status = emp.status === 'active' ? 'suspended' : 'active';
    await DatabaseGateway.save<Employee>(COLLECTION, emp);
    return emp;
  }

  static async delete(employeeId: string): Promise<boolean> {
    return DatabaseGateway.remove(COLLECTION, employeeId);
  }
}
