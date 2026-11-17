/**
 * Top 20 Russian Commercial & Mortgage Banks for Accreditive Settlements (867-873 GK RF & 214-FZ)
 * Ordered strictly by retail & mortgage settlement popularity in the Russian Federation.
 */
export interface RussianBankInfo {
  id: string;
  name: string;
  shortName: string;
  isTop?: boolean;
}

export const RUSSIAN_BANKS: readonly RussianBankInfo[] = [
  { id: 'sber', name: 'ПАО «Сбербанк»', shortName: 'Сбербанк', isTop: true },
  { id: 'vtb', name: 'Банк ВТБ (ПАО)', shortName: 'ВТБ', isTop: true },
  { id: 'alfa', name: 'АО «АЛЬФА-БАНК»', shortName: 'Альфа-Банк', isTop: true },
  { id: 'tbank', name: 'АО «ТБанк» (Тинькофф)', shortName: 'Т-Банк', isTop: true },
  { id: 'domrf', name: 'АО «Банк ДОМ.РФ»', shortName: 'Банк ДОМ.РФ', isTop: true },
  { id: 'gpb', name: 'Банк ГПБ (АО) (Газпромбанк)', shortName: 'Газпромбанк' },
  { id: 'sovcom', name: 'ПАО «Совкомбанк»', shortName: 'Совкомбанк' },
  { id: 'psb', name: 'ПАО «Промсвязьбанк» (ПСБ)', shortName: 'ПСБ' },
  { id: 'raiffeisen', name: 'АО «Райффайзенбанк»', shortName: 'Райффайзенбанк' },
  { id: 'rshb', name: 'АО «Россельхозбанк»', shortName: 'Россельхозбанк' },
  { id: 'bspb', name: 'ПАО «Банк «Санкт-Петербург» (БСПБ)', shortName: 'Банк Санкт-Петербург' },
  { id: 'mkb', name: 'ПАО «МКБ» (Московский кредитный банк)', shortName: 'МКБ' },
  { id: 'uralsib', name: 'ПАО «Банк Уралсиб»', shortName: 'Уралсиб' },
  { id: 'mts', name: 'ПАО «МТС-Банк»', shortName: 'МТС-Банк' },
  { id: 'rsb', name: 'АО «Банк Русский Стандарт»', shortName: 'Русский Стандарт' },
  { id: 'otp', name: 'АО «ОТП Банк»', shortName: 'ОТП Банк' },
  { id: 'unicredit', name: 'АО «ЮниКредит Банк»', shortName: 'ЮниКредит Банк' },
  { id: 'akbars', name: 'ПАО «АК БАРС» БАНК', shortName: 'АК БАРС' },
  { id: 'zenit', name: 'ПАО «Банк Зенит»', shortName: 'Банк Зенит' },
  { id: 'kubankredit', name: 'КБ «Кубань Кредит» ООО', shortName: 'Кубань Кредит' },
];

export const DEFAULT_SETTLEMENT_BANKS: string[] = [
  'ПАО «Сбербанк»',
  'Банк ВТБ (ПАО)',
  'АО «АЛЬФА-БАНК»',
  'АО «Банк ДОМ.РФ»',
];
