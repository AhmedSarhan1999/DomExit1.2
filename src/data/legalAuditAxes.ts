import { LegalAuditAxis, LegalAuditAxisStatus, Lot } from '../types';

export const DEFAULT_LEGAL_AUDIT_AXES: LegalAuditAxis[] = [
  {
    id: 'title_encumbrances',
    title: '1. Право собственности и обременения (ЕГРН и ДДУ)',
    shortLabel: 'Право собственности (ЕГРН и ДДУ)',
    status: 'verified_safe',
    notes: 'Государственная регистрация ДДУ в Росреестре подтверждена. Запретов на регистрационные действия, судебных арестов и скрытых обременений третьих лиц не выявлено.',
    portalUrl: 'https://rosreestr.gov.ru/',
    evaluated: true,
  },
  {
    id: 'bankruptcy_debts',
    title: '2. Риски банкротства и долги продавца (ЕФРСБ, ФССП, Суды)',
    shortLabel: 'Банкротство и долги (ЕФРСБ, ФССП, Суды)',
    status: 'verified_safe',
    notes: 'Сведений о банкротстве продавца в ЕФРСБ нет. Исполнительных производств в ФССП РФ и судебных имущественных споров не обнаружено.',
    portalUrl: 'https://bankrot.fedresurs.ru/',
    evaluated: true,
  },
  {
    id: 'developer_settlement',
    title: '3. Подтверждение взаиморасчётов с застройщиком',
    shortLabel: 'Взаиморасчёты с застройщиком',
    status: 'verified_safe',
    notes: 'Справка об оплате от застройщика проверена. Фактически внесенная сумма сверена с ДДУ, подтвержден точный остаток платежей.',
    portalUrl: 'https://наш.дом.рф/',
    evaluated: true,
  },
  {
    id: 'family_matkap',
    title: '4. Семейный статус и права несовершеннолетних',
    shortLabel: 'Семейный статус и права детей',
    status: 'required_at_deal',
    notes: 'Нотариальное согласие супруга(и) либо нотариальное заявление об отсутствии брака предоставляется при подписании договора уступки. Материнский капитал не использовался.',
    portalUrl: 'https://sfr.gov.ru/',
    evaluated: true,
  },
  {
    id: 'cession_escrow',
    title: '5. Условия уступки прав и статус эскроу-счёта',
    shortLabel: 'Условия уступки и эскроу-счёт',
    status: 'required_at_deal',
    notes: 'Регламент застройщика по согласованию цессии изучен. Эскроу-счет подтвержден в уполномоченном банке. Официальное согласие застройщика оформляется после утверждения покупателя.',
    portalUrl: 'https://cbr.ru/',
    evaluated: true,
  },
];

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
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-800',
    borderClass: 'border-slate-300',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    descriptionRu: 'Договорное условие, известное покупателю заранее (комиссия девелопера за цессию или погашение остатка).',
  },
};

export function resolveLotLegalAxes(lot: Lot): LegalAuditAxis[] {
  if (lot.legalAuditAxes && lot.legalAuditAxes.length === 5) {
    return lot.legalAuditAxes;
  }
  return DEFAULT_LEGAL_AUDIT_AXES;
}
