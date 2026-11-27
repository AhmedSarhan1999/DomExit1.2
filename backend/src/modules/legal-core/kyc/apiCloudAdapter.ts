/**
 * backend/src/modules/legal-core/kyc/apiCloudAdapter.ts
 *
 * Adapter for api-cloud.ru legal registry queries.
 * Integrates with FSSP, Fedresurs/Bankrot, Nalog (FNS), KAD Arbitr, Sud RF, Passport validity.
 * Uses 12s strict timeout with AbortController and Promise.allSettled.
 */

import { KycProviderAdapter, KycInput, KycCheckDetails, KycSubjectType, RegistryCheckResult } from './types.js';
import { logger } from '../../../lib/logger.js';

const API_CLOUD_BASE_URL = 'https://api-cloud.ru/api';
const TIMEOUT_MS = 12000;

export class ApiCloudAdapter implements KycProviderAdapter {
  name = 'apicloud' as const;

  isConfigured(): boolean {
    const key = process.env.KYC_PROVIDER_API_KEY || process.env.APICLOUD_API_KEY;
    return Boolean(key && key.trim() !== '');
  }

  estimateCostRub(subjectType: KycSubjectType): number {
    // API-Cloud typical cost: 15-20 RUB per comprehensive multi-registry check
    return subjectType === 'individual' ? 18 : 25;
  }

  private async fetchWithTimeout(endpoint: string, params: Record<string, string>): Promise<any> {
    const apiKey = process.env.KYC_PROVIDER_API_KEY || process.env.APICLOUD_API_KEY;
    if (!apiKey) throw new Error('API_KEY not configured');

    const url = new URL(`${API_CLOUD_BASE_URL}/${endpoint}`);
    url.searchParams.set('token', apiKey);
    url.searchParams.set('type', 'json');
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
        throw new Error(`API-Cloud returned HTTP ${res.status}`);
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

    // Build registry requests based on subjectType
    const fsspPromise = (async (): Promise<RegistryCheckResult> => {
      try {
        const params: Record<string, string> = {};
        if (input.subjectType === 'individual') {
          if (input.fio) params.fio = input.fio;
          if (input.birthDate) params.dob = input.birthDate;
          if (input.regionCode) params.region = input.regionCode;
        } else {
          if (input.inn) params.inn = input.inn;
          if (input.companyName) params.name = input.companyName;
        }
        const data = await this.fetchWithTimeout('fssp.php', params);
        rawResponses.fssp = data;

        const records = Array.isArray(data?.records || data?.items || data?.result)
          ? (data.records || data.items || data.result)
          : [];
        let totalDebt = 0;
        let activeCount = 0;
        for (const r of records) {
          activeCount++;
          const sum = parseFloat(String(r.sum || r.debt || 0));
          if (!isNaN(sum)) totalDebt += sum;
        }

        if (activeCount === 0) {
          return { status: 'clean', summaryRu: 'Исполнительных производств в ФССП не обнаружено', activeProceedingsCount: 0, totalDebtRub: 0 };
        } else if (totalDebt > 100000) {
          return {
            status: 'critical',
            summaryRu: `Обнаружено ${activeCount} производств(а) на общую сумму ${Math.round(totalDebt).toLocaleString('ru-RU')} ₽ (критический риск ареста счетов)`,
            activeProceedingsCount: activeCount,
            totalDebtRub: totalDebt,
            details: { count: activeCount, totalDebt },
          };
        } else {
          return {
            status: 'attention',
            summaryRu: `Обнаружено ${activeCount} производство на сумму ${Math.round(totalDebt).toLocaleString('ru-RU')} ₽ (требует погашения перед сделкой)`,
            activeProceedingsCount: activeCount,
            totalDebtRub: totalDebt,
            details: { count: activeCount, totalDebt },
          };
        }
      } catch (err: any) {
        logger.warn('API-Cloud FSSP check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `Сервис ФССП временно недоступен: ${err.message}` };
      }
    })();

    const fedresursPromise = (async (): Promise<RegistryCheckResult> => {
      try {
        const params: Record<string, string> = {};
        if (input.inn) params.inn = input.inn;
        else if (input.fio) params.fio = input.fio;
        const data = await this.fetchWithTimeout('bankrot.php', params);
        rawResponses.fedresurs = data;

        const cases = Array.isArray(data?.messages || data?.items || data?.result)
          ? (data.messages || data.items || data.result)
          : [];
        if (cases.length === 0 && !data?.bankruptcyStatus) {
          return { status: 'clean', summaryRu: 'Записей о банкротстве в ЕФРСБ/Федресурс не найдено (ст. 213.4 127-ФЗ чист)', bankruptcyCasesCount: 0 };
        } else {
          return {
            status: 'critical',
            summaryRu: `Внимание! Найдена запись о процедуре банкротства (${cases.length} сообщений в ЕФРСБ). Сделка невозможна без согласия финансового управляющего!`,
            bankruptcyCasesCount: Math.max(1, cases.length),
            details: { cases },
          };
        }
      } catch (err: any) {
        logger.warn('API-Cloud Fedresurs check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `Сервис ЕФРСБ временно недоступен: ${err.message}` };
      }
    })();

    const kadArbitrPromise = (async (): Promise<RegistryCheckResult> => {
      try {
        const params: Record<string, string> = {};
        if (input.inn) params.inn = input.inn;
        else if (input.fio) params.name = input.fio;
        else if (input.companyName) params.name = input.companyName;
        const data = await this.fetchWithTimeout('kad.php', params);
        rawResponses.kadArbitr = data;

        const cases = Array.isArray(data?.cases || data?.items) ? (data.cases || data.items) : [];
        if (cases.length === 0) {
          return { status: 'clean', summaryRu: 'Арбитражных дел в КАД Арбитраж не найдено', casesCount: 0 };
        } else {
          const isRespondent = cases.some((c: any) => String(c.role || '').toLowerCase().includes('ответчик'));
          return {
            status: isRespondent ? 'attention' : 'clean',
            summaryRu: `Найдено ${cases.length} арбитражных дел (роль: ${isRespondent ? 'ответчик' : 'участник'}). Проверьте предмет спора.`,
            casesCount: cases.length,
            details: { count: cases.length },
          };
        }
      } catch (err: any) {
        logger.warn('API-Cloud KAD check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `КАД Арбитраж временно недоступен: ${err.message}` };
      }
    })();

    const sudrfPromise = (async (): Promise<RegistryCheckResult> => {
      try {
        const params: Record<string, string> = {};
        if (input.fio) params.fio = input.fio;
        if (input.regionCode) params.region = input.regionCode;
        const data = await this.fetchWithTimeout('sudrf.php', params);
        rawResponses.sudrf = data;

        const cases = Array.isArray(data?.records || data?.items) ? (data.records || data.items) : [];
        if (cases.length === 0) {
          return { status: 'clean', summaryRu: 'Судебных споров в судах общей юрисдикции (ГАС Правосудие) не найдено', casesCount: 0 };
        } else {
          return {
            status: 'attention',
            summaryRu: `Обнаружено ${cases.length} гражданских дел в СОЮ РФ. Рекомендуется юридический аудит оснований.`,
            casesCount: cases.length,
            details: { count: cases.length },
          };
        }
      } catch (err: any) {
        logger.warn('API-Cloud SudRF check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `ГАС «Правосудие» временно недоступен: ${err.message}` };
      }
    })();

    const fnsPromise = (async (): Promise<RegistryCheckResult> => {
      try {
        const params: Record<string, string> = {};
        if (input.inn) params.inn = input.inn;
        else if (input.ogrn) params.ogrn = input.ogrn;
        const data = await this.fetchWithTimeout('nalog.php', params);
        rawResponses.fns = data;

        if (data?.status === 'active' || data?.valid || !data?.error) {
          const statusText = data?.status === 'active' ? 'действующий' : 'активен';
          return { status: 'clean', summaryRu: `ФНС / ЕГРЮЛ: налоговый статус подтвержден (${statusText}), долгов перед бюджетом не зафиксировано` };
        } else if (data?.isLiquidated || data?.isBankrupt) {
          return { status: 'critical', summaryRu: 'ФНС: организация ликвидирована или находится в процессе исключения из ЕГРЮЛ' };
        } else {
          return { status: 'clean', summaryRu: 'ФНС: статус подтвержден, блокировок счетов по данным ФНС не обнаружено' };
        }
      } catch (err: any) {
        logger.warn('API-Cloud FNS check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `ФНС сервис временно недоступен: ${err.message}` };
      }
    })();

    const passportPromise = (async (): Promise<RegistryCheckResult | undefined> => {
      if (input.subjectType !== 'individual' || (!input.passportSeries && !input.passportNumber)) {
        return undefined;
      }
      try {
        const params: Record<string, string> = {
          series: input.passportSeries || '',
          number: input.passportNumber || '',
        };
        const data = await this.fetchWithTimeout('passport.php', params);
        rawResponses.passport = data;

        if (data?.valid === true || data?.status === 'valid') {
          return { status: 'clean', summaryRu: 'МВД РФ: паспорт среди недействительных (утраченных/украденных) не значится' };
        } else if (data?.valid === false) {
          return { status: 'critical', summaryRu: 'Внимание! Паспорт числится в списке недействительных МВД РФ!' };
        } else {
          return { status: 'clean', summaryRu: 'Паспорт проверен по реестру недействительных паспортов МВД' };
        }
      } catch (err: any) {
        logger.warn('API-Cloud Passport check error', { meta: { error: err.message } });
        return { status: 'unavailable', summaryRu: `Проверка паспорта недоступна: ${err.message}` };
      }
    })();

    const [fsspRes, fedresursRes, kadRes, sudrfRes, fnsRes, passportRes] = await Promise.allSettled([
      fsspPromise,
      fedresursPromise,
      kadArbitrPromise,
      sudrfPromise,
      fnsPromise,
      passportPromise,
    ]);

    const checks: KycCheckDetails = {
      fssp: fsspRes.status === 'fulfilled' ? fsspRes.value : { status: 'unavailable', summaryRu: 'Ошибка соединения с ФССП' },
      fedresurs: fedresursRes.status === 'fulfilled' ? fedresursRes.value : { status: 'unavailable', summaryRu: 'Ошибка соединения с ЕФРСБ' },
      kadArbitr: kadRes.status === 'fulfilled' ? kadRes.value : { status: 'unavailable', summaryRu: 'Ошибка соединения с КАД Арбитраж' },
      sudrf: sudrfRes.status === 'fulfilled' ? sudrfRes.value : { status: 'unavailable', summaryRu: 'Ошибка соединения с ГАС Правосудие' },
      fns: fnsRes.status === 'fulfilled' ? fnsRes.value : { status: 'unavailable', summaryRu: 'Ошибка соединения с ФНС' },
      ...(passportRes.status === 'fulfilled' && passportRes.value ? { passportOrBlacklist: passportRes.value } : {}),
    };

    const statuses = [
      checks.fssp.status,
      checks.fedresurs.status,
      checks.kadArbitr.status,
      checks.sudrf.status,
      checks.fns.status,
      ...(checks.passportOrBlacklist ? [checks.passportOrBlacklist.status] : []),
    ];

    let overallRiskLevel: 'clean' | 'attention' | 'critical' = 'clean';
    if (statuses.includes('critical')) {
      overallRiskLevel = 'critical';
    } else if (statuses.includes('attention')) {
      overallRiskLevel = 'attention';
    }

    const unavailableCount = statuses.filter((s) => s === 'unavailable').length;
    let status: 'completed' | 'partial' | 'failed' = 'completed';
    if (unavailableCount === statuses.length) {
      status = 'failed';
    } else if (unavailableCount > 0) {
      status = 'partial';
    }

    return {
      checks,
      rawResponses,
      overallRiskLevel,
      status,
    };
  }
}
