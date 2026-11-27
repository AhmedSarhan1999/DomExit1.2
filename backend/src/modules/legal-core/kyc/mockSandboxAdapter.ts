/**
 * backend/src/modules/legal-core/kyc/mockSandboxAdapter.ts
 *
 * Mock sandbox adapter for Staging / Non-production automated testing and owner experimentation.
 * Provides realistic Russian legal registry results with deterministic outcomes.
 */

import { KycProviderAdapter, KycInput, KycCheckDetails, KycSubjectType } from './types.js';

export class MockSandboxAdapter implements KycProviderAdapter {
  name = 'mock_sandbox' as const;

  isConfigured(): boolean {
    return true;
  }

  estimateCostRub(subjectType: KycSubjectType): number {
    return subjectType === 'individual' ? 18 : 25;
  }

  async runChecks(input: KycInput): Promise<{
    checks: KycCheckDetails;
    rawResponses: Record<string, any>;
    overallRiskLevel: 'clean' | 'attention' | 'critical';
    status: 'completed' | 'partial' | 'failed';
  }> {
    const rawResponses = {
      mock: true,
      timestamp: new Date().toISOString(),
      inputSummary: {
        fio: input.fio,
        inn: input.inn,
        subjectType: input.subjectType,
      },
    };

    // Determine outcome deterministically from test inputs
    const lowerFio = (input.fio || '').toLowerCase();
    const isCritical = lowerFio.includes('банкрот') || (input.inn && input.inn.endsWith('9999'));
    const isAttention = lowerFio.includes('долг') || (input.inn && input.inn.endsWith('7777'));

    let checks: KycCheckDetails;

    if (isCritical) {
      checks = {
        fssp: {
          status: 'critical',
          summaryRu: 'ФССП: Найдено 4 открытых производства на сумму 340 000 ₽ (ст. 46 ч. 1 п. 4)',
          activeProceedingsCount: 4,
          totalDebtRub: 340000,
        },
        fedresurs: {
          status: 'critical',
          summaryRu: 'ЕФРСБ: Найдена запись о признании гражданина банкротом (дело № А40-1284/2025, ст. 213.4 127-ФЗ)',
          bankruptcyCasesCount: 1,
        },
        kadArbitr: {
          status: 'attention',
          summaryRu: 'КАД: Участие в качестве ответчика в арбитражном споре о взыскании задолженности',
          casesCount: 2,
        },
        sudrf: {
          status: 'attention',
          summaryRu: 'ГАС Правосудие: 1 незавершенный судебный спор в районном суде по кредитному договору',
          casesCount: 1,
        },
        fns: {
          status: 'clean',
          summaryRu: 'ФНС: Налогоплательщик зарегистрирован, приостановлений по счетам нет',
        },
        passportOrBlacklist: {
          status: 'clean',
          summaryRu: 'МВД РФ: Паспорт действителен, не входит в список утерянных/похищенных',
        },
      };
      return { checks, rawResponses, overallRiskLevel: 'critical', status: 'completed' };
    }

    if (isAttention) {
      checks = {
        fssp: {
          status: 'attention',
          summaryRu: 'ФССП: 1 производство по штрафу ГИБДД на сумму 2 500 ₽ (требует закрытия)',
          activeProceedingsCount: 1,
          totalDebtRub: 2500,
        },
        fedresurs: {
          status: 'clean',
          summaryRu: 'ЕФРСБ: Сведений о банкротстве гражданина/организации не обнаружено (127-ФЗ чист)',
          bankruptcyCasesCount: 0,
        },
        kadArbitr: {
          status: 'clean',
          summaryRu: 'КАД Арбитраж: Арбитражных споров не зафиксировано',
          casesCount: 0,
        },
        sudrf: {
          status: 'clean',
          summaryRu: 'ГАС Правосудие: Исков и гражданских споров в судах общей юрисдикции не найдено',
          casesCount: 0,
        },
        fns: {
          status: 'clean',
          summaryRu: 'ФНС: Статус подтвержден, задолженностей перед бюджетом не зафиксировано',
        },
        passportOrBlacklist: {
          status: 'clean',
          summaryRu: 'МВД РФ: Паспорт проверен по реестру действительных документов',
        },
      };
      return { checks, rawResponses, overallRiskLevel: 'attention', status: 'completed' };
    }

    // Default clean
    checks = {
      fssp: {
        status: 'clean',
        summaryRu: 'ФССП: Исполнительных производств и арестов счетов не обнаружено',
        activeProceedingsCount: 0,
        totalDebtRub: 0,
      },
      fedresurs: {
        status: 'clean',
        summaryRu: 'ЕФРСБ: Записей о банкротстве не найдено (ст. 213.4 127-ФЗ чист)',
        bankruptcyCasesCount: 0,
      },
      kadArbitr: {
        status: 'clean',
        summaryRu: 'КАД Арбитраж: Участия в арбитражных спорах не зафиксировано',
        casesCount: 0,
      },
      sudrf: {
        status: 'clean',
        summaryRu: 'ГАС Правосудие: Гражданских исков в судах общей юрисдикции не найдено',
        casesCount: 0,
      },
      fns: {
        status: 'clean',
        summaryRu: 'ФНС / ЕГРЮЛ: Статус активен, блокировок счетов нет, налоговый статус чист',
      },
      passportOrBlacklist: {
        status: 'clean',
        summaryRu: 'МВД РФ: Паспорт действителен, среди утерянных/недействительных не значится',
      },
    };

    return { checks, rawResponses, overallRiskLevel: 'clean', status: 'completed' };
  }
}
