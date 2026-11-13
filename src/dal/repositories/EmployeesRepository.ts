import { Employee } from '../../types';
import { initialEmployees } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { useEnvironmentStore } from '../../stores/useEnvironmentStore';

const COLLECTION = 'employees';

export const PROD_SYSTEM_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Алексей Смирнов',
    email: 'amaas9494@gmail.com',
    role: 'Ведущий куратор отдела выходов',
    phone: '+7 (921) 888-11-22',
    telegram: '@domexit_smirnov',
    whatsapp: '+7 (921) 888-11-22',
    maxProfile: '+7 (921) 888-11-22',
    bio: '12 лет в сфере уступки прав по 214-ФЗ и аккредитивов. Экс-руководитель юридического блока строительного холдинга.',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    activeLotsCount: 0,
    closedDealsCount: 0,
    avgSpeedDays: 8.5,
    status: 'active',
    permissions: ['legal_audit', 'packaging', 'matchmaker', 'closing'],
  },
];

export class EmployeesRepository {
  static async getAll(): Promise<Employee[]> {
    const isProd = useEnvironmentStore.getState().isProduction;
    const seed = isProd ? PROD_SYSTEM_EMPLOYEES : initialEmployees;
    const raw = await DatabaseGateway.getAll<Employee>(COLLECTION, seed);
    if (isProd) {
      const valid = raw.filter((e) => {
        const email = (e.email || '').toLowerCase().trim();
        return email === 'amaas9494@gmail.com' || (!email.includes('@domexit.ru') && !email.includes('test'));
      });
      return valid.length > 0 ? valid : PROD_SYSTEM_EMPLOYEES;
    }
    return raw;
  }

  static async getById(employeeId: string): Promise<Employee | null> {
    const all = await this.getAll();
    return all.find((e) => e.id === employeeId) || null;
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
      phone: employee.phone || '+7 (812) 409-00-00',
      telegram: employee.telegram || '@domexit_curator',
      whatsapp: employee.whatsapp || employee.phone || '+7 (812) 409-00-00',
      photoUrl:
        employee.photoUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      bio:
        employee.bio ||
        'Сертифицированный специалист по сделкам с уступкой прав по 214-ФЗ и аккредитивным расчетам.',
      activeLotsCount: employee.activeLotsCount || 0,
      closedDealsCount: employee.closedDealsCount || 0,
      avgSpeedDays: employee.avgSpeedDays || 8.0,
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
