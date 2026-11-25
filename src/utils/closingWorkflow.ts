import { ClosingStepId } from '../types';

export interface ClosingStepDef {
  id: ClosingStepId;
  num: number;
  percent: number;
  shortTitle: string;
  title: string;
  description: string;
}

export const CLOSING_STEPS_6: ClosingStepDef[] = [
  {
    id: 'pep_reservation',
    num: 1,
    percent: 15,
    shortTitle: '1. ПЭП и бронь',
    title: 'Подписание ПЭП (NDA + Оферта 2.5%) и Бронирование',
    description: 'Проверка электронных подписей ПЭП 63-ФЗ покупателя (NDA и Оферта 2.5%).',
  },
  {
    id: 'developer_consent',
    num: 2,
    percent: 35,
    shortTitle: '2. Застройщик и ДДУ',
    title: 'Согласие застройщика и проект договора цессии',
    description: 'Загрузка проекта договора уступки и письма согласия застройщика в S3.',
  },
  {
    id: 'notary_and_sbr',
    num: 3,
    percent: 55,
    shortTitle: '3. Нотариус и СБР',
    title: 'Нотариальное согласие и открытие СБР / Аккредитива',
    description: 'Реквизиты счёта СБР/аккредитива, квитанция депонирования в S3 и согласие супруга.',
  },
  {
    id: 'rosreestr_filing',
    num: 4,
    percent: 75,
    shortTitle: '4. Росреестр (КУВД)',
    title: 'Подписание (УКЭП) и подача в Росреестр',
    description: 'Номер КУВД Росреестра и фото/видеофиксация подписания в S3 (без Base64).',
  },
  {
    id: 'egrn_and_payout',
    num: 5,
    percent: 90,
    shortTitle: '5. ЕГРН и СБР',
    title: 'Выписка ЕГРН и раскрытие СБР продавцу',
    description: 'Загрузка выписки ЕГРН в S3 и подтверждение перечисления средств продавцу.',
  },
  {
    id: 'platform_fee_and_close',
    num: 6,
    percent: 100,
    shortTitle: '6. Закрытие (2.5%)',
    title: 'Подтверждение сбора DomExit (2.5%) и закрытие сделки',
    description: 'Подтверждение комиссии платформы (с учётом платы застройщику) и архивация.',
  },
];

export function normalizeClosingStepNum(step?: string): number {
  switch (step) {
    case 'pep_reservation':
    case 'curator_review':
      return 1;
    case 'developer_consent':
      return 2;
    case 'notary_and_sbr':
    case 'bank_escrow_deposit':
      return 3;
    case 'rosreestr_filing':
    case 'signing_photos':
      return 4;
    case 'egrn_and_payout':
    case 'bank_funds_release':
      return 5;
    case 'platform_fee_and_close':
    case 'deal_finalized':
      return 6;
    default:
      return 1;
  }
}

export function getClosingProgressPercent(step?: string): number {
  const num = normalizeClosingStepNum(step);
  return CLOSING_STEPS_6[num - 1]?.percent || 15;
}
