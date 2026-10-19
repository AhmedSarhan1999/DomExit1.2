import { Employee } from '../../types';
import { initialEmployees } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'employees';

export class EmployeesRepository {
  static async getAll(): Promise<Employee[]> {
    return FirebaseAdapter.getAllEntities<Employee>(COLLECTION, initialEmployees);
  }

  static async getById(employeeId: string): Promise<Employee | null> {
    const all = await this.getAll();
    return all.find(e => e.id === employeeId) || null;
  }

  static async add(employee: Partial<Employee>): Promise<Employee> {
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: employee.name || 'Специалист DomExit',
      role: employee.role || 'Брокер по переуступкам',
      phone: employee.phone || '+7 (812) 409-00-00',
      telegram: employee.telegram || '@domexit_expert',
      photoUrl: employee.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      activeLotsCount: 0,
    };
    await FirebaseAdapter.saveEntity(COLLECTION, newEmp);
    return newEmp;
  }
}
