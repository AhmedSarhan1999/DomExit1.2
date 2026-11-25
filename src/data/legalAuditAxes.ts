import { LegalAuditAxis, LegalAuditAxisStatus, Lot } from '../types';

export function createInitialLegalAuditAxes(): LegalAuditAxis[] {
  return [
    {
      id: 'title_encumbrances',
      title: '1. Право собственности и обременения (ЕГРН и ДДУ)',
      shortLabel: 'Право собственности (ЕГРН и ДДУ)',
      status: 'unverified',
      notes: '',
      portalUrl: 'https://rosreestr.gov.ru/',
      evaluated: false,
    },
    {
      id: 'bankruptcy_debts',
      title: '2. Риски банкротства и долги продавца (ЕФРСБ, ФССП, Суды)',
      shortLabel: 'Банкротство и долги (ЕФРСБ, ФССП, Суды)',
      status: 'unverified',
      notes: '',
      portalUrl: 'https://bankrot.fedresurs.ru/',
      evaluated: false,
    },
    {
      id: 'developer_settlement',
      title: '3. Подтверждение взаиморасчётов с застройщиком',
      shortLabel: 'Взаиморасчёты с застройщиком',
      status: 'unverified',
      notes: '',
      portalUrl: 'https://наш.дом.рф/',
      evaluated: false,
    },
    {
      id: 'family_matkap',
      title: '4. Семейный статус и права несовершеннолетних',
      shortLabel: 'Семейный статус и права детей',
      status: 'unverified',
      notes: '',
      portalUrl: 'https://sfr.gov.ru/',
      evaluated: false,
    },
    {
      id: 'cession_escrow',
      title: '5. Условия уступки прав и статус эскроу-счёта',
      shortLabel: 'Условия уступки и эскроу-счёт',
      status: 'unverified',
      notes: '',
      portalUrl: 'https://cbr.ru/',
      evaluated: false,
    },
  ];
}

export const DEFAULT_LEGAL_AUDIT_AXES: LegalAuditAxis[] = createInitialLegalAuditAxes();

export const HONEST_STATUS_CONFIG: Record<
  LegalAuditAxisStatus,
  {
    labelRu: string;
    labelEn: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    badgeClass: string;
    descriptionRu: string;
  }
> = {
  unverified: {
    labelRu: 'Не проверено',
    labelEn: 'Not Verified',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    descriptionRu: 'Раздел ещё не проверен юристом комплаенс-отдела.',
  },
  verified_safe: {
    labelRu: 'Проверено — рисков нет',
    labelEn: 'Verified — No Risks',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    descriptionRu: 'Факты проверены по государственным базам, рисков не обнаружено.',
  },
  required_at_deal: {
    labelRu: 'Потребуется на сделке',
    labelEn: 'Required at Closing',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-800',
    borderClass: 'border-sky-200',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    descriptionRu: 'Стандартный регламентный шаг, выполняемый в день подписания (согласие супруга, согласие девелопера).',
  },
  condition_found: {
    labelRu: 'Выявлено условие',
    labelEn: 'Condition Identified',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-900',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
    descriptionRu: 'Договорное условие, известное покупателю заранее (комиссия девелопера за цессию или погашение остатка).',
  },
  critical_risk: {
    labelRu: 'Критический риск — блок',
    labelEn: 'Critical Risk — Blocked',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-800',
    borderClass: 'border-rose-300',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    descriptionRu: 'Обнаружены запреты, аресты, признаки банкротства или несоответствие документам. Переход к сделке заблокирован.',
  },
};

export function resolveLotLegalAxes(lot: Lot): LegalAuditAxis[] {
  if (Array.isArray(lot.legalAuditAxes) && lot.legalAuditAxes.length === 5) {
    const hasRealChecks =
      lot.isVerified === true ||
      lot.legalAuditAxes.some((ax) => ax.evaluated === true || ax.status !== 'unverified');
    if (hasRealChecks) {
      return lot.legalAuditAxes;
    }
  }
  return createInitialLegalAuditAxes();
}
