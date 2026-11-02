import { UserProfile } from '../../types';
import { initialUsers } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'users';

export class UsersRepository {
  private static deduplicationLock = false;

  static async getAll(): Promise<UserProfile[]> {
    const rawList = await DatabaseGateway.getAll<UserProfile>(COLLECTION, initialUsers);
    
    // In-memory identity deduplication & canonical enforcement
    const emailMap = new Map<string, UserProfile>();
    const toRemoveIds: string[] = [];
    const deduped: UserProfile[] = [];

    for (const u of rawList) {
      const email = (u.email || '').trim().toLowerCase();
      
      // Enforce canonical properties
      if (email === 'amaas9499@gmail.com') {
        u.name = 'Ahmed Abdallah - Владелец / CEO';
        u.role = 'admin';
        u.activeRole = 'owner';
        u.roles = ['owner', 'employee', 'bank', 'partner', 'investor', 'seller', 'buyer'];
        u.isPartnerApproved = true;
        u.isInvestorApproved = true;
      } else if (email === 'amaas9494@gmail.com') {
        u.name = 'Алексей Смирнов (Ведущий куратор)';
        u.role = 'employee';
        u.activeRole = 'employee';
        u.assignedEmployeeId = 'emp-1';
      } else if (email === 'bank@domexit.ru') {
        u.name = 'Игорь Соколов (Банк-партнер Сбербанк)';
        u.role = 'bank';
        u.activeRole = 'bank';
        u.roles = ['bank'];
      }

      if (email) {
        if (!emailMap.has(email)) {
          emailMap.set(email, u);
          deduped.push(u);
        } else {
          // Found duplicate with same email!
          const existing = emailMap.get(email)!;
          // Merge non-empty fields
          if (u.name && !existing.name) existing.name = u.name;
          if (u.phone && !existing.phone) existing.phone = u.phone;
          toRemoveIds.push(u.id);
        }
      } else {
        deduped.push(u);
      }
    }

    // Background asynchronous cleanup of duplicate IDs if any were found
    if (toRemoveIds.length > 0 && !this.deduplicationLock) {
      this.deduplicationLock = true;
      Promise.all(toRemoveIds.map((id) => DatabaseGateway.remove(COLLECTION, id)))
        .catch((e) => console.warn('[UsersRepository] Duplicate purge warning:', e))
        .finally(() => { this.deduplicationLock = false; });
    }

    return deduped;
  }

  static async getById(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
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
    const cleanEmail = (user.email || '').trim().toLowerCase();
    
    // Check if another user document has this email
    if (cleanEmail) {
      const all = await this.getAll();
      const duplicate = all.find((u) => u.email?.trim().toLowerCase() === cleanEmail && u.id !== user.id);
      if (duplicate) {
        await DatabaseGateway.remove(COLLECTION, duplicate.id);
      }
    }

    await DatabaseGateway.save<UserProfile>(COLLECTION, user);
    return user;
  }

  static async add(user: Partial<UserProfile>): Promise<UserProfile> {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    
    // Upsert by Unique Email: If email is already registered, update existing record!
    if (cleanEmail) {
      const existing = await this.getByEmail(cleanEmail);
      if (existing) {
        if (user.id && user.id !== existing.id) {
          existing.id = user.id;
        }
        if (user.name) existing.name = user.name;
        if (user.phone) existing.phone = user.phone;
        if (user.photoURL) existing.photoURL = user.photoURL;
        if (user.activeRole) existing.activeRole = user.activeRole;
        await DatabaseGateway.save<UserProfile>(COLLECTION, existing);
        return existing;
      }
    }

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
    operatorName: string = 'Ahmed Abdallah (Владелец)'
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

  static async deduplicateAndPurge(): Promise<UserProfile[]> {
    return this.getAll();
  }
}
