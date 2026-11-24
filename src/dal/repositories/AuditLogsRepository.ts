import { AuditLogEntry } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';
import { PaginatedResult } from '../../services/apiClient';

const COLLECTION = 'audit_logs';

const initialLogs: AuditLogEntry[] = [];

export class AuditLogsRepository {
  static async getPaginated(params: {
    page?: number;
    limit?: number;
    search?: string;
    actionType?: string;
    lotCode?: string;
  } = {}): Promise<PaginatedResult<AuditLogEntry>> {
    return DatabaseGateway.getPaginated<AuditLogEntry>(COLLECTION, {
      ...params,
      limit: params.limit || 25,
    });
  }

  static async getAllLogs(filter?: {
    operatorName?: string;
    lotCode?: string;
    actionType?: string;
    dateFrom?: string;
  }): Promise<AuditLogEntry[]> {
    let logs = await DatabaseGateway.getAll<AuditLogEntry>(COLLECTION, initialLogs);

    logs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter) {
      if (filter.operatorName && filter.operatorName !== 'all') {
        const q = filter.operatorName.toLowerCase();
        logs = logs.filter((l) => l.operatorName.toLowerCase().includes(q));
      }
      if (filter.lotCode && filter.lotCode !== 'all') {
        const q = filter.lotCode.toLowerCase();
        logs = logs.filter((l) => l.lotCode?.toLowerCase().includes(q));
      }
      if (filter.actionType && filter.actionType !== 'all') {
        logs = logs.filter((l) => l.actionType === filter.actionType);
      }
      if (filter.dateFrom) {
        logs = logs.filter((l) => l.timestamp >= filter.dateFrom!);
      }
    }

    return logs;
  }

  static async addLog(entry: Partial<AuditLogEntry>): Promise<AuditLogEntry> {
    const newLog: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
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

    await DatabaseGateway.save<AuditLogEntry>(COLLECTION, newLog);
    return newLog;
  }
}
