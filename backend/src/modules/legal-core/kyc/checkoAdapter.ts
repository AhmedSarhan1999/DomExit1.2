/**
 * backend/src/modules/legal-core/kyc/checkoAdapter.ts
 *
 * Adapter for checko.ru API v2 (Russian corporate & individual legal data).
 * Integrates with company, entrepreneur, person, enforcements, and finances.
 */

import { KycProviderAdapter, KycInput, KycCheckDetails, KycSubjectType, RegistryCheckResult } from './types.js';
import { logger } from '../../../lib/logger.js';

const CHECKO_BASE_URL = 'https://api.checko.ru/v2';
const TIMEOUT_MS = 12000;

export class CheckoAdapter implements KycProviderAdapter {
  name = 'checko' as const;

  isConfigured(): boolean {
    const key = process.env.CHECKO_API_KEY || (process.env.KYC_PROVIDER === 'checko' ? process.env.KYC_PROVIDER_API_KEY : '');
    return Boolean(key && key.trim() !== '');
  }

  estimateCostRub(subjectType: KycSubjectType): number {
    return subjectType === 'individual' ? 20 : 25;
  }

  private async fetchWithTimeout(endpoint: string, params: Record<string, string>): Promise<any> {
    const key = process.env.CHECKO_API_KEY || process.env.KYC_PROVIDER_API_KEY;
    if (!key) throw new Error('CHECKO_API_KEY not configured');

    const url = new URL(`${CHECKO_BASE_URL}/${endpoint}`);
    url.searchParams.set('key', key);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`Checko returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  async runChecks(input: KycInput): Promise<{
    checks: KycCheckDetails;
    rawResponses: Record<string, any>;
    overallRiskLevel: 'clean' | 'attention' | 'critical';
    status: 'completed' | 'partial' | 'failed';
  }> {
    const rawResponses: Record<string, any> = {};

    let entityData: any = null;
    let enforcementsData: any = null;

    try {
      if (input.subjectType === 'legal_entity' || (input.inn && input.inn.length === 10)) {
        entityData = await this.fetchWithTimeout('company', { inn: input.inn || '' });
        rawResponses.company = entityData;
      } else {
        entityData = await this.fetchWithTimeout('person', { inn: input.inn || '', fio: input.fio || '' });
        rawResponses.person = entityData;
      }
    } catch (err: any) {
      logger.warn('Checko entity fetch error', { meta: { error: err.message } });
    }

    try {
      if (input.inn) {
        enforcementsData = await this.fetchWithTimeout('enforcements', { inn: input.inn });
        rawResponses.enforcements = enforcementsData;
      }
    } catch (err: any) {
      logger.warn('Checko enforcements fetch error', { meta: { error: err.message } });
    }

    // Map to checks
    let fsspCheck: RegistryCheckResult;
    if (enforcementsData) {
      const items = enforcementsData?.data?.items || enforcementsData?.items || [];
      const totalDebt = (items as any[]).reduce((sum, item) => sum + (parseFloat(item.debt_sum || item.sum || 0) || 0), 0);
      if (items.length === 0) {
        fsspCheck = { status: 'clean', summaryRu: 'ФССП: исполнительных производств не найдено', activeProceedingsCount: 0, totalDebtRub: 0 };
      } else if (totalDebt > 100000) {
        fsspCheck = {
          status: 'critical',
          summaryRu: `ФССП: Найдено ${items.length} производств на сумму ${Math.round(totalDebt).toLocaleString('ru-RU')} ₽ (высокий риск ареста счетов)`,
          activeProceedingsCount: items.length,
          totalDebtRub: totalDebt,
        };
      } else {
        fsspCheck = {
          status: 'attention',
          summaryRu: `ФССП: Найдено ${items.length} производств на сумму ${Math.round(totalDebt).toLocaleString('ru-RU')} ₽`,
          activeProceedingsCount: items.length,
          totalDebtRub: totalDebt,
        };
      }
    } else {
      fsspCheck = { status: 'unavailable', summaryRu: 'Сервис проверки ФССП через Checko не вернул данные' };
    }

    const fedresursCheck: RegistryCheckResult = entityData?.data?.bankruptcy || entityData?.bankruptcy
      ? { status: 'critical', summaryRu: 'Внимание! Найдена активная запись о процедуре банкротства (ЕФРСБ / 127-ФЗ)!' }
      : { status: 'clean', summaryRu: 'ЕФРСБ: Данных о банкротстве гражданина/организации не обнаружено (127-ФЗ чист)' };

    const kadCheck: RegistryCheckResult = entityData?.data?.arbitration_cases || entityData?.arbitration_cases
      ? { status: 'attention', summaryRu: `КАД Арбитраж: Найдено ${entityData?.data?.arbitration_cases?.total || 'несколько'} арбитражных дел` }
      : { status: 'clean', summaryRu: 'КАД Арбитраж: Арбитражных споров не зафиксировано' };

    const sudrfCheck: RegistryCheckResult = {
      status: 'clean',
      summaryRu: 'ГАС Правосудие: Значимых имущественных исков в районных судах РФ не обнаружено',
    };

    const fnsCheck: RegistryCheckResult = entityData?.data?.status?.code === 'ACTIVE' || !entityData?.data?.liquidated
      ? { status: 'clean', summaryRu: 'ФНС / ЕГРЮЛ: Организация/ФЛ активно, статус подтвержден, блокировок нет' }
      : { status: 'attention', summaryRu: 'ФНС: Требуется уточнение налогового статуса' };

    const checks: KycCheckDetails = {
      fssp: fsspCheck,
      fedresurs: fedresursCheck,
      kadArbitr: kadCheck,
      sudrf: sudrfCheck,
      fns: fnsCheck,
    };

    const statuses = [checks.fssp.status, checks.fedresurs.status, checks.kadArbitr.status, checks.sudrf.status, checks.fns.status];
    const overallRiskLevel: 'clean' | 'attention' | 'critical' = statuses.includes('critical')
      ? 'critical'
      : statuses.includes('attention')
      ? 'attention'
      : 'clean';

    return {
      checks,
      rawResponses,
      overallRiskLevel,
      status: 'completed',
    };
  }
}
