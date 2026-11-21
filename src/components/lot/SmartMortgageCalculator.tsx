import React, { useEffect, useMemo, useState } from 'react';
import { Lot } from '../../types';
import { MarketSettingsRepository } from '../../dal/repositories/MarketSettingsRepository';
import { DatabaseGateway } from '../../dal/DatabaseGateway';
import { formatRubles } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  Calculator,
  Landmark,
  Percent,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

interface SmartMortgageCalculatorProps {
  lot: Lot;
  onApplyWithCalculation?: () => void;
}

export const SmartMortgageCalculator: React.FC<SmartMortgageCalculatorProps> = ({
  lot,
}) => {
  const { language } = useLanguage();

  const [cbrRate, setCbrRate] = useState<number>(21);
  const [interestRate, setInterestRate] = useState<number>(21);
  const [ratePreset, setRatePreset] = useState<'base' | 'family' | 'it' | 'custom'>('base');
  const [pdnPercent, setPdnPercent] = useState<40 | 50 | 60>(50);
  const [extraDownpayment, setExtraDownpayment] = useState<number>(0);
  const [termYears, setTermYears] = useState<number>(20);

  const loadRatesAndBankTerms = async () => {
    const settings = await MarketSettingsRepository.getSettings();
    const keyRate = settings?.cbrKeyRatePercent || 21;
    setCbrRate(keyRate);
    setInterestRate(keyRate);
    setPdnPercent(50);
    setRatePreset('base');
  };

  useEffect(() => {
    loadRatesAndBankTerms();
    const unsub = DatabaseGateway.subscribe((col) => {
      if (!col || col === 'lots' || col === 'market_settings') {
        loadRatesAndBankTerms();
      }
    });
    return () => unsub();
  }, [lot.lotCode]);

  // Reset extraDownpayment when switching between lots
  useEffect(() => {
    setExtraDownpayment(0);
  }, [lot.lotCode]);

  const maxExtraCash = Math.max(0, lot.remainingInstallmentDebt);

  const calculation = useMemo(() => {
    const clampedExtra = Math.min(extraDownpayment, maxExtraCash);
    const loanPrincipal = Math.max(0, lot.remainingInstallmentDebt - clampedExtra);
    const months = Math.max(12, termYears * 12);
    const monthlyRate = Math.max(0, interestRate) / 100 / 12;

    let monthlyPayment = 0;
    if (loanPrincipal > 0) {
      if (monthlyRate === 0) {
        monthlyPayment = Math.round(loanPrincipal / months);
      } else {
        const factor = Math.pow(1 + monthlyRate, months);
        monthlyPayment = Math.round(loanPrincipal * ((monthlyRate * factor) / (factor - 1)));
      }
    }

    // Exact Formula: Минимальный подтвержденный доход = Ежемесячный платеж / (ПДН / 100)
    const minRequiredIncome =
      monthlyPayment > 0 ? Math.round(monthlyPayment / (pdnPercent / 100)) : 0;
    const totalCashRequiredToday = lot.cashPaidBySeller + clampedExtra + lot.serviceCommissionRub;
    const totalPaymentsOverTerm = monthlyPayment * months;
    const totalInterestOverpayment = Math.max(0, totalPaymentsOverTerm - loanPrincipal);

    return {
      loanPrincipal,
      monthlyPayment,
      minRequiredIncome,
      totalCashRequiredToday,
      totalInterestOverpayment,
    };
  }, [lot, extraDownpayment, maxExtraCash, termYears, interestRate, pdnPercent]);

  const handleSelectPreset = (preset: 'base' | 'family' | 'it', rateVal: number) => {
    setRatePreset(preset);
    setInterestRate(rateVal);
  };

  const handleCustomRateChange = (raw: string) => {
    const parsed = parseFloat(raw.replace(',', '.'));
    setRatePreset('custom');
    if (Number.isNaN(parsed)) {
      setInterestRate(0);
      return;
    }
    setInterestRate(Math.min(45, Math.max(0.1, parsed)));
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
              {language === 'ru' ? 'Ипотечный калькулятор' : 'Mortgage Calculator'}
            </h3>
          </div>
        </div>
        <div className="inline-flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700">
          <Landmark className="w-3.5 h-3.5 text-emerald-600" />
          <span>{`Ориентир ЦБ: ${cbrRate}%`}</span>
        </div>
      </div>

      {/* Main Grid: Controls (Left) + Pure Light Institutional Summary Card (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Fixed Seller Cash Return + Optional Extra Principal Reduction */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {language === 'ru'
                  ? '1. Первоначальный взнос (Возврат продавцу + доплата)'
                  : '1. Downpayment (Seller Cash Return + Extra)'}
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                {language === 'ru' ? 'Минимум = возврат продавцу' : 'Min = Seller Return'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-400">
                  {language === 'ru'
                    ? 'Фиксированный возврат продавцу (кэш)'
                    : 'Fixed Seller Cash Return'}
                </div>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {formatRubles(lot.cashPaidBySeller)}
                </div>
              </div>

              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-400">
                  {language === 'ru'
                    ? 'Доп. взнос в счёт тела долга'
                    : 'Extra Principal Downpayment'}
                </div>
                <div className="text-base font-black text-emerald-700 mt-0.5">
                  + {formatRubles(extraDownpayment)}
                </div>
              </div>
            </div>

            {maxExtraCash > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
                  <span>
                    {language === 'ru'
                      ? 'Увеличить первый взнос для снижения кредита:'
                      : 'Increase downpayment to reduce loan:'}
                  </span>
                  <span className="text-slate-900 font-bold">
                    {formatRubles(lot.cashPaidBySeller + extraDownpayment)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxExtraCash}
                  step={100000}
                  value={extraDownpayment}
                  onChange={(e) => setExtraDownpayment(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                  <span>0 ₽ (Только кэш продавцу)</span>
                  <span>Макс: {formatRubles(maxExtraCash)} (Без ипотеки)</span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Interest Rate Presets + Custom Input */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {language === 'ru'
                  ? '2. Программа и годовая ставка (%)'
                  : '2. Program & Annual Rate (%)'}
              </span>
              <span className="text-xs font-black text-slate-900">{interestRate}% годовых</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('family', 6)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                  interestRate === 6 && ratePreset === 'family'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] opacity-80">
                  {language === 'ru' ? 'Семейная' : 'Family'}
                </div>
                <div className="text-sm font-black mt-0.5">6.0%</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('it', 6)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                  interestRate === 6 && ratePreset === 'it'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] opacity-80">IT-ипотека</div>
                <div className="text-sm font-black mt-0.5">6.0%</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('base', cbrRate || 21)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                  interestRate === (cbrRate || 21) && ratePreset === 'base'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-[10px] opacity-80">
                  {language === 'ru' ? 'Базовая ставка рынка' : 'Market Standard Rate'}
                </div>
                <div className="text-sm font-black mt-0.5">{cbrRate || 21}%</div>
              </button>

              <div
                className={`px-3 py-1.5 rounded-xl border bg-white flex flex-col justify-center ${
                  ratePreset === 'custom' || (interestRate !== 6 && interestRate !== (cbrRate || 21))
                    ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                    : 'border-slate-200'
                }`}
              >
                <label className="text-[10px] font-bold text-slate-400 block">
                  {language === 'ru' ? 'Своя ставка, %' : 'Custom rate, %'}
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="45"
                    value={interestRate}
                    onChange={(e) => handleCustomRateChange(e.target.value)}
                    className="w-full text-sm font-black text-slate-900 bg-transparent focus:outline-none"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Loan Term + Interactive PDN (DTI) Selector [ 40% | 50% | 60% ] */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Term Slider */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {language === 'ru' ? '3. Срок кредита' : '3. Loan Term'}
                </span>
                <span className="text-sm font-black text-slate-900">
                  {termYears} {language === 'ru' ? 'лет' : 'yrs'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={termYears}
                onChange={(e) => setTermYears(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                {[5, 10, 15, 20, 25, 30].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setTermYears(yr)}
                    className={`hover:text-emerald-700 transition-colors ${
                      termYears === yr ? 'text-emerald-700 font-black underline' : ''
                    }`}
                  >
                    {yr} л.
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive PDN (DTI) Selector */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {language === 'ru' ? '4. Норматив ПДН банка' : '4. Bank DTI (ПДН) Limit'}
                </span>
                <span className="text-xs font-black text-emerald-700">{pdnPercent}% от дохода</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-0.5">
                {([40, 50, 60] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPdnPercent(val)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      pdnPercent === val
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    ПДН {val}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {language === 'ru'
                  ? 'Доля ежемесячного платежа в официальном подтвержденном доходе заёмщика'
                  : 'Share of monthly payment in official verified household income'}
              </p>
            </div>
          </div>
        </div>

        {/* Output Summary Column — 100% Pure Light Mode Institutional Card (Zero Dark/Phone Frame) */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-slate-900 flex flex-col justify-between h-full shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {language === 'ru'
                    ? 'Расчётный ежемесячный платёж'
                    : 'Estimated Monthly Payment'}
                </div>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {formatRubles(calculation.monthlyPayment)}
                  <span className="text-sm font-semibold text-slate-500"> / мес.</span>
                </div>
              </div>
            </div>

            {/* Breakdown Rows */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/80">
                <span className="text-slate-600 font-medium">
                  {language === 'ru'
                    ? 'Возврат наличных продавцу (Фикс.):'
                    : 'Fixed Seller Cash Return:'}
                </span>
                <span className="font-black text-slate-900">
                  {formatRubles(lot.cashPaidBySeller)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/80">
                <span className="text-slate-600 font-medium">
                  {language === 'ru'
                    ? 'Сумма ипотечного кредита (долг ДДУ):'
                    : 'Mortgage Loan Principal:'}
                </span>
                <span className="font-bold text-slate-900">
                  {formatRubles(calculation.loanPrincipal)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/80">
                <span className="text-slate-600 font-medium">
                  {language === 'ru'
                    ? 'Комиссия оператора (после Росреестра):'
                    : 'Platform Fee (post-Rosreestr):'}
                </span>
                <span className="font-bold text-slate-700">
                  {formatRubles(lot.serviceCommissionRub)} (2.5%)
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200/80">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {language === 'ru'
                      ? 'Итого наличных для старта сделки:'
                      : 'Total Cash Needed Today:'}
                  </span>
                </span>
                <span className="font-black text-emerald-700">
                  {formatRubles(calculation.totalCashRequiredToday)}
                </span>
              </div>
            </div>

            {/* Required Official Income Card based on selected PDN */}
            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {language === 'ru'
                      ? `Требования банка (при ПДН ${pdnPercent}%)`
                      : `Bank Requirement (at ${pdnPercent}% DTI)`}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">2-НДФЛ / СФР</span>
              </div>
              <div className="text-xs text-slate-600">
                {language === 'ru'
                  ? 'Требуемый официальный доход семьи:'
                  : 'Required official household income:'}
              </div>
              <div className="text-lg font-black text-slate-900">
                от {formatRubles(calculation.minRequiredIncome)}{' '}
                <span className="text-xs font-semibold text-slate-500">/ мес.</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Формула: {formatRubles(calculation.monthlyPayment)} ÷ ({pdnPercent}% / 100)
              </div>
            </div>
          </div>

          {/* Institutional Banking Disclaimer Notice */}
          <div className="mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-[11px] leading-relaxed text-slate-500">
            {language === 'ru'
              ? 'Расчёт носит предварительный информационный характер. Итоговые условия кредитования зависят от выбранной программы банка, размера первоначального взноса и официального подтверждения дохода (2-НДФЛ / выписка СФР).'
              : 'Calculation is for informational purposes only. Final loan terms depend on the selected bank program, downpayment amount, and verified official income (2-NDFL / SFR statement).'}
          </div>
        </div>
      </div>
    </div>
  );
};
