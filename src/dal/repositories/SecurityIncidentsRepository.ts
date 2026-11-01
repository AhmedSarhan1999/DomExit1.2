import { SecurityIncidentRecord } from '../../types';
import { DatabaseGateway } from '../DatabaseGateway';

const COLLECTION = 'security_incident_logs';

export class SecurityIncidentsRepository {
  static async getAll(): Promise<SecurityIncidentRecord[]> {
    return DatabaseGateway.getAll<SecurityIncidentRecord>(COLLECTION, []);
  }

  static async reportIncident(params: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedRecordsCount: number;
    companyInn?: string;
    companyName?: string;
  }): Promise<SecurityIncidentRecord> {
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours strict deadline

    const draft = `В Федеральную службу по надзору в сфере связи, информационных технологий и массовых коммуникаций (Роскомнадзор)
От: ${params.companyName || 'ООО «ДОМЭКЗИТ»'} (ИНН: ${params.companyInn || '7814892015'})

УВЕДОМЛЕНИЕ ОБ ИНЦИДЕНТЕ В ОТНОШЕНИИ ПЕРСОНАЛЬНЫХ ДАННЫХ
(в соответствии с ч. 3.1 ст. 21 Федерального закона № 152-ФЗ)

Дата и время фиксации: ${now.toLocaleString('ru-RU')}
Срок направления первичного отчета: 24 часа (до ${deadline.toLocaleString('ru-RU')})
Уровень критичности: ${params.severity.toUpperCase()}
Количество потенциально затронутых субъектов ПД: ${params.affectedRecordsCount}

Описание инцидента:
${params.description}

Принятые меры локализации:
1. Сегмент инфраструктуры изолирован.
2. Сессии пользователей отозваны.
3. Доступ ограничен по IP-белому списку.
4. Проводится внутреннее расследование силами DPO.`;

    const incident: SecurityIncidentRecord = {
      id: `incident-${Date.now()}`,
      timestamp: now.toISOString(),
      deadline24h: deadline.toISOString(),
      severity: params.severity,
      title: params.title,
      description: params.description,
      affectedRecordsCount: params.affectedRecordsCount,
      reportedToRoskomnadzor: false,
      roskomnadzorDraft: draft,
      status: 'investigating',
    };

    await DatabaseGateway.save<SecurityIncidentRecord>(COLLECTION, incident);
    return incident;
  }

  static async updateIncident(incident: SecurityIncidentRecord): Promise<void> {
    await DatabaseGateway.save<SecurityIncidentRecord>(COLLECTION, incident);
  }
}
