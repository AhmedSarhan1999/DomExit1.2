import { AuditLogEntry } from '../../types';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'audit_logs';

const initialLogs: AuditLogEntry[] = [
  {
    id: 'log-101',
    timestamp: '2026-10-18T10:14:22Z',
    lotCode: 'U-10566',
    dealId: 'DEAL-2025-10566',
    operatorId: 'emp-1',
    operatorName: 'Алексей Смирнов',
    operatorRole: 'curator',
    actionType: 'legal_approved',
    title: 'Выдан штамп «Документы проверены (42/42)»',
    description: 'Завершен аудит по 42 параметрам. Проверены базы ЕФРСБ, ФССП, получено согласие девелопера Setl Group.',
    attachments: [
      { name: 'Протокол_скоринга_LA-9921.pdf', url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=200&q=80' }
    ],
    metadata: { antiBankruptcyIndex: 98, nbkiScore: 785 }
  },
  {
    id: 'log-102',
    timestamp: '2026-10-18T14:45:00Z',
    lotCode: 'U-10566',
    dealId: 'DEAL-2025-10566',
    operatorId: 'emp-1',
    operatorName: 'Алексей Смирнов',
    operatorRole: 'curator',
    actionType: 'packaging_published',
    title: 'Лот упакован по стандарту 152-ФЗ и опубликован',
    description: 'Персональные данные скрыты, маскирован этаж («7-10 этаж»), подтверждена формула 0% наценки.',
    metadata: { dduPrice: 10972000, cashPaid: 2485230 }
  },
  {
    id: 'log-103',
    timestamp: '2026-10-19T09:30:15Z',
    lotCode: 'U-10566',
    dealId: 'DEAL-2025-10566',
    operatorId: 'emp-1',
    operatorName: 'Алексей Смирнов',
    operatorRole: 'curator',
    actionType: 'buyer_matched',
    title: 'Отобран покупатель #B-409 (Дмитрий К.)',
    description: 'Проверена выписка со счета Сбера на 3 000 000 ₽. Предоставлен приоритетный статус бронирования.',
    metadata: { buyerTrack: 'full_cash', availableLiquidity: 3000000 }
  },
  {
    id: 'log-104',
    timestamp: '2026-10-19T11:20:44Z',
    lotCode: 'U-10566',
    dealId: 'DEAL-2025-10566',
    operatorId: 'emp-1',
    operatorName: 'Алексей Смирнов',
    operatorRole: 'curator',
    actionType: 'escrow_transferred_to_bank',
    title: 'Пакет документов передан в банк Сбербанк на открытие аккредитива',
    description: 'Согласие застройщика, проект договора цессии и паспортные данные переданы в шлюз СБР Сбербанка.',
  },
  {
    id: 'log-105',
    timestamp: '2026-10-19T15:05:10Z',
    lotCode: 'U-10566',
    dealId: 'DEAL-2025-10566',
    operatorId: 'bank-emp-1',
    operatorName: 'Игорь Владимирович Соколов',
    operatorRole: 'bank_officer',
    actionType: 'escrow_funds_deposited',
    title: 'Сбербанк: Средства по аккредитиву № АК-78401 задепонированы',
    description: 'Покупатель внес 2 759 530 ₽ на счет СБР. Банк подтвердил блокировку до регистрации Росреестра.',
    metadata: { depositedRub: 2759530, bank: 'Сбербанк' }
  },
  {
    id: 'log-106',
    timestamp: '2026-10-20T08:12:30Z',
    lotCode: 'U-14102',
    dealId: 'DEAL-2025-14102',
    operatorId: 'emp-2',
    operatorName: 'Ольга Романова',
    operatorRole: 'curator',
    actionType: 'doc_requested',
    title: 'Запрошены дополнительные документы у продавца',
    description: 'Запрошена справка об остатке ссудной задолженности и нотариальное согласие супруги на переуступку.',
    metadata: { requestedItems: ['Справка об остатке задолженности', 'Нотариальное согласие супруги'] }
  }
];

export class AuditLogsRepository {
  static async getAllLogs(filter?: {
    operatorName?: string;
    lotCode?: string;
    actionType?: string;
    dateFrom?: string;
  }): Promise<AuditLogEntry[]> {
    let logs = await FirebaseAdapter.getAllEntities<AuditLogEntry>(COLLECTION, initialLogs);

    // Sort by timestamp descending
    logs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter) {
      if (filter.operatorName && filter.operatorName !== 'all') {
        const q = filter.operatorName.toLowerCase();
        logs = logs.filter(l => l.operatorName.toLowerCase().includes(q));
      }
      if (filter.lotCode && filter.lotCode !== 'all') {
        const q = filter.lotCode.toLowerCase();
        logs = logs.filter(l => l.lotCode?.toLowerCase().includes(q));
      }
      if (filter.actionType && filter.actionType !== 'all') {
        logs = logs.filter(l => l.actionType === filter.actionType);
      }
      if (filter.dateFrom) {
        logs = logs.filter(l => l.timestamp >= filter.dateFrom!);
      }
    }

    return logs;
  }

  static async addLog(entry: Partial<AuditLogEntry>): Promise<AuditLogEntry> {
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      lotCode: entry.lotCode,
      dealId: entry.dealId,
      operatorId: entry.operatorId || 'curator-default',
      operatorName: entry.operatorName || 'Куратор DomExit',
      operatorRole: entry.operatorRole || 'curator',
      actionType: entry.actionType || 'doc_requested',
      title: entry.title || 'Операция зафиксирована в журнале решений',
      description: entry.description || '',
      attachments: entry.attachments || [],
      metadata: entry.metadata || {},
    };

    await FirebaseAdapter.saveEntity(COLLECTION, newLog);
    return newLog;
  }
}
