import { InvestorApplication } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { UsersRepository } from './UsersRepository';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'investor_applications';

export class InvestorClubRepository {
  static async submit(
    app: Omit<InvestorApplication, 'id' | 'timestamp'>
  ): Promise<InvestorApplication> {
    const nowIso = new Date().toISOString();
    const uid = app.uid || app.userId;
    const newEntry: InvestorApplication = {
      ...app,
      uid,
      userId: uid,
      clientCode: app.clientCode || 'DEX-000000',
      id: `investor-${Date.now()}`,
      timestamp: nowIso,
      status: app.status || 'pending',
    };
    await DatabaseGateway.save<InvestorApplication>(COLLECTION, newEntry);

    await AuditLogsRepository.addLog({
      operatorId: uid || newEntry.id,
      operatorName: `${newEntry.fullName} (${newEntry.clientCode})`,
      operatorRole: 'client',
      actionType: 'investor_application_submitted',
      title: `Подана заявка в VIP-Клуб Инвесторов: ${newEntry.fullName}`,
      description: `Объем капитала: ${newEntry.capitalVolume}. Стратегия: ${newEntry.strategy}. Регионы: ${newEntry.targetRegions.join(', ')}.`,
    });

    return newEntry;
  }

  static async getAll(): Promise<InvestorApplication[]> {
    const all = await DatabaseGateway.getAll<InvestorApplication>(COLLECTION, [
      {
        id: 'inv-seed-1',
        uid: 'usr-investor-001',
        userId: 'usr-investor-001',
        clientCode: 'DEX-990088',
        fullName: 'Сергей Николаевич (Capital North Fund)',
        companyOrFund: 'Capital North Fund',
        countryAndCity: 'Санкт-Петербург / Москва',
        contactTelegramOrPhone: '+7 (921) 777-99-00',
        entityType: 'fund',
        capitalVolume: '50-200m',
        strategy: 'flipping',
        targetRegions: ['Санкт-Петербург', 'Москва', 'Сочи'],
        requestedServices: ['Оптовый выкуп пула ДДУ со скидкой >22%'],
        customProposal: 'Готовы выкупать от 3 до 5 квартир в месяц под чистовую отделку.',
        ndaAgreed: true,
        selectedBudgetMillions: 35,
        selectedPackage: 'flipping',
        status: 'approved',
        timestamp: '2026-10-18T10:00:00Z',
      },
      {
        id: 'inv-seed-2',
        clientCode: 'DEX-812405',
        fullName: 'Руслан Ахмедов',
        companyOrFund: 'Neva PropTech Capital',
        countryAndCity: 'Казань / Москва',
        contactTelegramOrPhone: '+7 (917) 888-00-11',
        entityType: 'fund',
        capitalVolume: '15-50m',
        strategy: 'rental_fitout',
        targetRegions: ['Москва', 'Казань', 'Сочи'],
        requestedServices: ['Ранний доступ 48 часов', 'Юридический Due Diligence 214-ФЗ'],
        customProposal: 'Интересуют лоты бизнес-класса со сроком сдачи до 4 кв. 2026 г.',
        ndaAgreed: true,
        status: 'pending',
        timestamp: '2026-10-19T15:30:00Z',
      },
    ]);

    return [...all].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  static async getByUser(uid: string, clientCode?: string): Promise<InvestorApplication | null> {
    const all = await this.getAll();
    return (
      all.find(
        (a) =>
          (uid && (a.uid === uid || a.userId === uid)) ||
          (clientCode && a.clientCode?.toUpperCase() === clientCode.toUpperCase())
      ) || null
    );
  }

  static async approve(
    applicationId: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<InvestorApplication | null> {
    const list = await this.getAll();
    const app = list.find((a) => a.id === applicationId);
    if (!app) return null;

    app.status = 'approved';
    app.rejectionReason = undefined;
    await DatabaseGateway.save<InvestorApplication>(COLLECTION, app);

    const targetUid = app.uid || app.userId;
    const user = targetUid
      ? await UsersRepository.getById(targetUid)
      : app.clientCode
      ? await UsersRepository.getByClientCode(app.clientCode)
      : null;

    if (user) {
      user.isInvestorApproved = true;
      if (!user.roles.includes('investor')) {
        user.roles.push('investor');
      }
      await UsersRepository.save(user);
    }

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'investor_application_decided',
      title: `Одобрен статус VIP-Инвестора: ${app.fullName}`,
      description: `Открыт приоритетный ранний доступ (48 часов) к закрытому пулу лотов.`,
    });

    return app;
  }

  static async reject(
    applicationId: string,
    reason: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<InvestorApplication | null> {
    const list = await this.getAll();
    const app = list.find((a) => a.id === applicationId);
    if (!app) return null;

    app.status = 'rejected';
    app.rejectionReason = reason;
    await DatabaseGateway.save<InvestorApplication>(COLLECTION, app);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'investor_application_decided',
      title: `Отклонена заявка в VIP-Клуб Инвесторов: ${app.fullName}`,
      description: `Причина отклонения: ${reason}`,
    });

    return app;
  }

  static async requestDocs(
    applicationId: string,
    notes: string,
    operatorName: string = 'Виктор Сергеевич (Владелец / CEO)'
  ): Promise<InvestorApplication | null> {
    const list = await this.getAll();
    const app = list.find((a) => a.id === applicationId);
    if (!app) return null;

    app.status = 'docs_requested';
    app.requestedDocsNotes = notes;
    await DatabaseGateway.save<InvestorApplication>(COLLECTION, app);

    await AuditLogsRepository.addLog({
      operatorName,
      operatorRole: 'owner',
      actionType: 'doc_requested',
      title: `Запрошено подтверждение капитала у инвестора: ${app.fullName}`,
      description: `Комментарий: ${notes}`,
    });

    return app;
  }

  static async savePackagePreference(
    userId: string,
    clientCode: string,
    budgetMillions: number,
    selectedPackage: 'flipping' | 'turnkey' | 'syndicate'
  ): Promise<void> {
    const user = await UsersRepository.getById(userId);
    if (user) {
      user.investorPackagePreference = {
        budgetMillions,
        selectedPackage,
        updatedAt: new Date().toISOString(),
      };
      await UsersRepository.save(user);
    }

    const existingApp = await this.getByUser(userId, clientCode);
    if (existingApp) {
      existingApp.selectedBudgetMillions = budgetMillions;
      existingApp.selectedPackage = selectedPackage;
      await DatabaseGateway.save<InvestorApplication>(COLLECTION, existingApp);
    }
  }
}
