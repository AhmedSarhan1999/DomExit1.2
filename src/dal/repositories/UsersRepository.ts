import { UserProfile } from '../../types';
import { initialUsers } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'users';

export class UsersRepository {
  static async getAll(): Promise<UserProfile[]> {
    return DatabaseGateway.getAll<UserProfile>(COLLECTION, initialUsers);
  }

  static async getById(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const direct = await DatabaseGateway.getById<UserProfile>(COLLECTION, userId, initialUsers);
    if (direct) return direct;
    const all = await this.getAll();
    return all.find((u) => u.id === userId) || null;
  }

  static async getByClientCode(clientCode: string): Promise<UserProfile | null> {
    if (!clientCode) return null;
    const clean = clientCode.trim().toUpperCase();
    const all = await this.getAll();
    return all.find((u) => u.clientCode?.trim().toUpperCase() === clean) || null;
  }

  static async getByEmail(email: string): Promise<UserProfile | null> {
    if (!email) return null;
    const clean = email.trim().toLowerCase();
    const all = await this.getAll();
    return all.find((u) => u.email?.trim().toLowerCase() === clean) || null;
  }

  static async save(user: UserProfile): Promise<UserProfile> {
    await DatabaseGateway.save<UserProfile>(COLLECTION, user);
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
      photoURL: user.photoURL,
      role: user.role || 'buyer',
      roles: (user.roles as UserProfile['roles']) || [(user.role as any) || 'buyer'],
      activeRole: user.activeRole || user.role || 'buyer',
      isPartnerApproved: user.isPartnerApproved ?? (user.role === 'owner'),
      isInvestorApproved: user.isInvestorApproved ?? (user.role === 'owner'),
      partnerRefCode: user.partnerRefCode || `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`,
      assignedEmployeeId: user.assignedEmployeeId,
      favorites: user.favorites || [],
      registeredAt: user.registeredAt || new Date().toISOString(),
      activeDealId: user.activeDealId,
      investorPackagePreference: user.investorPackagePreference,
      bankCreditLimit: user.bankCreditLimit,
    };

    await DatabaseGateway.save<UserProfile>(COLLECTION, newUser);
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
      user.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'];
    }

    await DatabaseGateway.save<UserProfile>(COLLECTION, user);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'employee_created_modified',
      title: `Изменена роль пользователя: ${user.name} (${user.email || user.clientCode})`,
      description: `Роль изменена с [${oldRole}] на [${newRole}]. Обновлены права доступа в системе.`,
    });

    return user;
  }
}
