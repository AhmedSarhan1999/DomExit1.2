import { UserProfile } from '../../types';
import { initialUsers } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'users';

export class UsersRepository {
  static async getAll(): Promise<UserProfile[]> {
    return FirebaseAdapter.getAllEntities<UserProfile>(COLLECTION, initialUsers);
  }

  static async getById(userId: string): Promise<UserProfile | null> {
    const all = await this.getAll();
    return all.find(u => u.id === userId) || null;
  }

  static async getByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const all = await this.getAll();
    return all.find(u => u.email?.trim().toLowerCase() === clean) || null;
  }

  static async save(user: UserProfile): Promise<UserProfile> {
    await FirebaseAdapter.saveEntity(COLLECTION, user);
    return user;
  }

  static async add(user: Partial<UserProfile>): Promise<UserProfile> {
    const newUser: UserProfile = {
      id: user.id || `usr-${Date.now()}`,
      clientCode: user.clientCode || `DEX-${Math.floor(100000 + Math.random() * 900000)}`,
      name: user.name || 'Новый Пользователь',
      email: user.email || '',
      phone: user.phone || '+7 (911) 000-00-00',
      telegram: user.telegram || '',
      role: user.role || 'buyer',
      roles: (user.roles as any) || [user.role || 'buyer'],
      activeRole: user.activeRole || user.role || 'buyer',
      isPartnerApproved: user.isPartnerApproved ?? (user.role === 'partner' || user.role === 'owner'),
      isInvestorApproved: user.isInvestorApproved ?? (user.role === 'investor' || user.role === 'owner'),
      partnerRefCode: user.partnerRefCode || `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
      favorites: user.favorites || [],
      registeredAt: user.registeredAt || new Date().toISOString(),
    };

    await FirebaseAdapter.saveEntity(COLLECTION, newUser);
    return newUser;
  }

  static async updateRole(
    userId: string, 
    newRole: string, 
    operatorName: string = 'Виктор Сергеевич (Владелец)'
  ): Promise<UserProfile | null> {
    const user = await this.getById(userId);
    if (!user) return null;

    const oldRole = user.activeRole || user.role || 'buyer';
    user.activeRole = newRole;
    user.role = newRole === 'owner' ? 'admin' : newRole;

    if (!user.roles.includes(newRole as any)) {
      user.roles.push(newRole as any);
    }

    if (newRole === 'partner') {
      user.isPartnerApproved = true;
    }
    if (newRole === 'investor') {
      user.isInvestorApproved = true;
    }
    if (newRole === 'owner') {
      user.isPartnerApproved = true;
      user.isInvestorApproved = true;
      user.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'] as any;
    }

    await FirebaseAdapter.saveEntity(COLLECTION, user);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'employee_created_modified',
      title: `Изменена роль пользователя: ${user.name} (${user.email})`,
      description: `Роль изменена с [${oldRole}] на [${newRole}]. Обновлены права доступа в системе.`,
    });

    return user;
  }
}
