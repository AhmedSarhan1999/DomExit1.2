import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import {
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Building,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Flame,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { language, t } = useLanguage();

  // Bottom 2-minute calculator states
  const [calcTab, setCalcTab] = useState<'seller' | 'buyer'>('seller');
  const [paidAmount, setPaidAmount] = useState<number>(3500000);
  const [calcPhone, setCalcPhone] = useState<string>('');
  const [calcSubmitted, setCalcSubmitted] = useState<boolean>(false);

  // Financial calculations
  const devPenalty = paidAmount * 0.15; // 15% developer penalty
  const cashToHand = paidAmount; // 100% back via DomExit

  const { login } = useAuth();

  const handleCalcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await DealsRepository.addDeal({
        lotTitle: `Заявка с калькулятора (${formatRubles(paidAmount)})`,
        developer: 'Девелопер СПб / МСК',
        sellerReturnRub: cashToHand,
        discountRub: devPenalty,
        clientName: `Клиент ${calcPhone}`,
        route: 'ddu_assignment',
        stage: 'initial_audit',
        daysLeft: 14,
      });

      await login({
        name: `Клиент ${calcPhone.slice(-4) || '78'}`,
        phone: calcPhone,
        role: calcTab === 'seller' ? 'seller' : 'buyer',
        activeDealId: 'DEAL-2025-10566',
      });
    } catch (err) {
      console.warn('Calc submission fallback:', err);
    }
    setCalcSubmitted(true);
  };

  const scrollToComparison = () => {
    const el = document.getElementById('comparison-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* 1. HERO SECTION (Bright Modern Light Aesthetic) */}
      <section className="bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 pt-12 pb-20 relative overflow-hidden border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column (Headline, Badges, CTAs) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Dual Top Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  <span>{t.hero.badgeLocations}</span>
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  {t.hero.badgePlatform}
                </span>
              </div>

              {/* Huge Impact Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {t.hero.headline}
              </h1>

              {/* Subheadline */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl">
                {t.hero.subheadline}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  to="/sellers"
                  className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center space-x-2"
                >
                  <span>{t.hero.ctaSell}</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </Link>

                <button
                  type="button"
                  onClick={scrollToComparison}
                  className="px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm shadow-xs transition-colors flex items-center justify-center space-x-2"
                >
                  <span>{t.hero.ctaCompare}</span>
                </button>
              </div>

            </div>

            {/* Right Column: Stacked Comparison Cards (Red vs Emerald) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Card A: Developer Cancellation (Light Red #FEF2F2) */}
              <div className="bg-[#FEF2F2] text-slate-900 rounded-3xl p-6 border border-rose-200 shadow-xl space-y-4 relative">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-rose-950 flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>{t.hero.cardDevTitle}</span>
                  </h3>
                  <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold uppercase">
                    {t.hero.cardDevBadge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs text-rose-800/80 block">{t.hero.cardDevPenaltyLabel}</span>
                    <span className="text-sm font-bold text-rose-700">{t.hero.cardDevPenaltyValue}</span>
                  </div>
                  <div>
                    <span className="text-xs text-rose-800/80 block">{t.hero.cardDevPayoutLabel}</span>
                    <span className="text-sm font-bold text-slate-900">{t.hero.cardDevPayoutValue}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-rose-200/80 flex items-center justify-between text-xs text-rose-900">
                  <span className="text-rose-700 font-medium">{t.hero.cardDevWaitLabel}</span>
                  <span className="font-bold">{t.hero.cardDevWaitValue}</span>
                </div>
              </div>

              {/* Card B: DomExit Assignment (White with Emerald Border & Glow) */}
              <div className="bg-white text-slate-900 rounded-3xl p-6 border-2 border-emerald-500 shadow-2xl space-y-4 relative">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-950 flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>{t.hero.cardDomExitTitle}</span>
                  </h3>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase shadow-xs">
                    {t.hero.cardDomExitBadge}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-xs text-slate-500 block">{t.hero.cardDomExitPayoutLabel}</span>
                    <span className="text-base font-black text-emerald-700">{t.hero.cardDomExitPayoutValue}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{t.hero.cardDomExitFeeLabel}</span>
                    <span className="text-base font-black text-slate-950">{t.hero.cardDomExitFeeValue}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-700">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>{t.hero.cardDomExitWaitLabel} <strong>{t.hero.cardDomExitWaitValue}</strong></span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {t.hero.cardDomExitBuyerBadge}
                  </span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 2. STATS BAR & 3 PARALLEL STAGES (Light Clean Design) */}
      <section className="bg-white text-slate-900 py-10 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Top Stats & Bank Endorsements */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="flex items-center space-x-8">
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{t.statsBar.lotsCount}</div>
                <div className="text-xs text-slate-500 font-medium">{language === 'ru' ? 'Активные переуступки ДДУ' : 'Active DDU assignments'}</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">{t.statsBar.assetsVolume}</div>
                <div className="text-xs text-slate-500 font-medium">{language === 'ru' ? 'Общий объем реестра' : 'Total portfolio volume'}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t.statsBar.bankAccreditation}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t.statsBar.escrowEndorsement}</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{t.statsBar.rosreestrEndorsement}</span>
              </span>
            </div>
          </div>

          {/* 3 Horizontal Stage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center shrink-0">
                01
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase">{t.statsBar.stage1}</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {language === 'ru' ? '42 пункта проверки: ЕФРСБ, ФССП, застройщик' : '42 verification points: EFRSB, FSSP, Developer'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
              <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 font-black flex items-center justify-center shrink-0">
                02
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase">{t.statsBar.stage2}</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {language === 'ru' ? 'Закрытый VIP Telegram-клуб и смарт-матчмейкинг' : 'Closed VIP TG club & AI matching'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center space-x-3 shadow-xs">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center shrink-0">
                03
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase">{t.statsBar.stage3}</h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {language === 'ru' ? 'Аккредитив Сбера / ВТБ с раскрытием после Росреестра' : 'Sber/VTB letter of credit released after Rosreestr'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. COMPARISON TABLE: DomExit vs Avito / Regular Resale */}
      <section id="comparison-section" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {language === 'ru' ? 'Прозрачность и факты' : 'Transparency & Facts'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              {language === 'ru'
                ? 'Чем DomExit отличается от обычного ресейла и Авито?'
                : 'How DomExit Differs from Traditional Resale & Avito'}
            </h2>
            <p className="text-sm text-slate-600">
              {language === 'ru'
                ? 'Прямое сравнение ключевых параметров безопасности и финансовой выгоды'
                : 'Direct comparison of legal security and financial benefits'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-6 font-bold w-1/4 text-slate-700">
                    {language === 'ru' ? 'КРИТЕРИЙ ОЦЕНКИ' : 'EVALUATION CRITERIA'}
                  </th>
                  <th className="py-4 px-6 font-bold w-3/8 text-rose-800 bg-rose-50/80 border-x border-rose-100">
                    {language === 'ru' ? 'Обычный ресейл / Авито / Агентства' : 'Traditional Resale / Avito'}
                  </th>
                  <th className="py-4 px-6 font-bold w-3/8 text-emerald-900 bg-emerald-100/60">
                    {language === 'ru' ? 'DomExit (Чистый Выход)' : 'DomExit (Clean Exit)'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                
                {/* Row 1 */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {language === 'ru' ? 'Цена квартиры' : 'Apartment Price'}
                  </td>
                  <td className="py-4 px-6 text-rose-900 bg-rose-50/40">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{language === 'ru' ? 'Завышена на 15–25% комиссиями риелторов и «ожиданиями» рынка' : 'Overpriced by 15–25% through broker commissions'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-emerald-950 bg-[#ECFDF5]">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{language === 'ru' ? '100% цена старого договора ДДУ (2023–2024 гг.) без наценки' : '100% original DDU contract price with 0% markup'}</span>
                    </div>
                  </td>
                </tr>

                {/* Row 2 */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {language === 'ru' ? 'Подтверждение цифр' : 'Document Proof'}
                  </td>
                  <td className="py-4 px-6 text-rose-900 bg-rose-50/40">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{language === 'ru' ? 'Со слов собственника; частые скрытые долги перед девелопером' : 'Owner verbal claims; hidden arrears to developer'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-emerald-950 bg-[#ECFDF5]">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{language === 'ru' ? 'Официальная справка девелопера и верификация остатка по эскроу' : 'Official developer certificate & verified escrow balance'}</span>
                    </div>
                  </td>
                </tr>

                {/* Row 3 */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {language === 'ru' ? 'Процесс сделки' : 'Transaction Process'}
                  </td>
                  <td className="py-4 px-6 text-rose-900 bg-rose-50/40">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{language === 'ru' ? 'Хаотичный поиск, постоянный риск отказа девелопера в согласовании' : 'Chaotic search, developer approval denial risks'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-emerald-950 bg-[#ECFDF5]">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{language === 'ru' ? 'Институциональный регламент уступки по ст. 11 214-ФЗ' : 'Institutional protocol under Art. 11 Law 214-FZ'}</span>
                    </div>
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {language === 'ru' ? 'Комиссии и платежи' : 'Commissions & Fees'}
                  </td>
                  <td className="py-4 px-6 text-rose-900 bg-rose-50/40">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{language === 'ru' ? 'Скрытые 3–5% с продавца + комиссии агентства покупателя' : 'Hidden 3–5% from seller + buyer agency fees'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-emerald-950 bg-[#ECFDF5]">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-bold text-emerald-800">{language === 'ru' ? '0% с продавца! Покупатель платит 2.5% строго ПОСЛЕ Росреестра' : '0% seller fee! Buyer pays 2.5% strictly AFTER Rosreestr'}</span>
                    </div>
                  </td>
                </tr>

                {/* Row 5 */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {language === 'ru' ? 'Сроки реализации' : 'Closing Timeframe'}
                  </td>
                  <td className="py-4 px-6 text-rose-900 bg-rose-50/40">
                    <div className="flex items-start space-x-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{language === 'ru' ? '3–9 месяцев с риском начисления пени и расторжения договора' : '3–9 months with risk of developer default penalty'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-emerald-950 bg-[#ECFDF5]">
                    <div className="flex items-start space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-semibold">{language === 'ru' ? '7–14 рабочих дней через аккредитованный пул инвесторов' : '7–14 business days via accredited investor pool'}</span>
                    </div>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

        </div>
      </section>

      {/* 4. HOT OPPORTUNITIES SECTION */}
      <section className="py-16 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-700 text-xs font-bold mb-2">
                <Flame className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Срочный выход из рассрочек' : 'Urgent Installment Exits'}</span>
              </span>
              <h2 className="text-2xl font-black text-slate-950 tracking-tight">
                {language === 'ru' ? 'Горячие объекты по старым ценам ДДУ' : 'Hot Units at Historical DDU Prices'}
              </h2>
            </div>

            <Link
              to="/opportunities"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
            >
              <span>{language === 'ru' ? 'Все 9,227 лотов в каталоге' : 'All 9,227 units in catalog'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 3 Hot Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Hot 1: Primorsky Kvartal */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">СПб • Приморский р-н</span>
                  <h3 className="font-bold text-base text-slate-900 mt-0.5">ЖК «Приморский Квартал»</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                  -24%
                </span>
              </div>
              <div className="space-y-1.5 py-2 border-y border-slate-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Кэш владельцу:</span>
                  <span className="font-bold text-slate-900">1 950 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена в ДДУ 2023 г.:</span>
                  <span className="font-semibold text-slate-700">8 400 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена застройщика сейчас:</span>
                  <span className="font-semibold text-rose-600 line-through">11 100 000 ₽</span>
                </div>
              </div>
              <Link
                to="/opportunities/U-10492"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
              >
                <span>{language === 'ru' ? 'Запросить аудит лота' : 'Request Lot Audit'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Hot 2: Krylya Premium */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Москва • Раменки</span>
                  <h3 className="font-bold text-base text-slate-900 mt-0.5">ЖК «Крылья Премиум»</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                  -25.4%
                </span>
              </div>
              <div className="space-y-1.5 py-2 border-y border-slate-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Кэш владельцу:</span>
                  <span className="font-bold text-slate-900">4 200 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена в ДДУ 2023 г.:</span>
                  <span className="font-semibold text-slate-700">18 500 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена застройщика сейчас:</span>
                  <span className="font-semibold text-rose-600 line-through">24 800 000 ₽</span>
                </div>
              </div>
              <Link
                to="/opportunities/U-10601"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
              >
                <span>{language === 'ru' ? 'Запросить аудит лота' : 'Request Lot Audit'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Hot 3: Morskaya Naberezhnaya */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">СПб • Васильевский о-в</span>
                  <h3 className="font-bold text-base text-slate-900 mt-0.5">ЖК «Морская Набережная»</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                  -24.0%
                </span>
              </div>
              <div className="space-y-1.5 py-2 border-y border-slate-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Кэш владельцу:</span>
                  <span className="font-bold text-slate-900">1 750 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена в ДДУ 2023 г.:</span>
                  <span className="font-semibold text-slate-700">7 900 000 ₽</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Цена застройщика сейчас:</span>
                  <span className="font-semibold text-rose-600 line-through">10 400 000 ₽</span>
                </div>
              </div>
              <Link
                to="/opportunities/U-10580"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
              >
                <span>{language === 'ru' ? 'Запросить аудит лота' : 'Request Lot Audit'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

          </div>

        </div>
      </section>

      {/* 5. INTERACTIVE 2-MINUTE CALCULATOR SECTION (Clean Bright Design) */}
      <section className="py-20 bg-slate-50 text-slate-900 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left description */}
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'ru' ? 'Онлайн экспресс-оценка' : 'Instant Online Evaluation'}</span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {t.calc2Min.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t.calc2Min.subtitle}. Введите сумму, которую вы уже перечислили девелоперу по договору ДДУ или рассрочки, и мгновенно узнайте сумму сохранения капитала.
              </p>
              <div className="space-y-3 pt-2 text-xs text-slate-600">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ru' ? '0% комиссии с продавца (оплачивает покупатель 2.5%)' : '0% seller commission (buyer pays 2.5%)'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ru' ? 'Официальный аккредитив Сбербанка / ВТБ' : 'Official Sberbank / VTB Letter of Credit'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'ru' ? 'Сохранение 100% внесенных денег без 15% штрафа' : 'Save 100% of deposited cash without 15% penalty'}</span>
                </div>
              </div>
            </div>

            {/* Right White Card */}
            <div className="lg:col-span-7 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
              
              {/* Calculator Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl mb-6">
                <button
                  type="button"
                  onClick={() => setCalcTab('seller')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    calcTab === 'seller'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.calc2Min.tabSeller}
                </button>
                <button
                  type="button"
                  onClick={() => setCalcTab('buyer')}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                    calcTab === 'buyer'
                      ? 'bg-white text-slate-900 border border-slate-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.calc2Min.tabBuyer}
                </button>
              </div>

              {calcSubmitted ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {language === 'ru' ? 'Расчет успешно сформирован!' : 'Calculation Completed!'}
                  </h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    {language === 'ru'
                      ? `Юрист DomExit уже подготовил справку по сохранению ${formatRubles(cashToHand)} без штрафа. Мы свяжемся с вами в течение 15 минут.`
                      : `DomExit legal counsel prepared calculation for ${formatRubles(cashToHand)}. We will contact you within 15 minutes.`}
                  </p>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      to="/portal"
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2"
                    >
                      <span>Открыть мой кабинет дольщика</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setCalcSubmitted(false)}
                      className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700"
                    >
                      {language === 'ru' ? 'Рассчитать другой лот' : 'Calculate another lot'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCalcSubmit} className="space-y-6">
                  
                  {/* Slider: Paid to Developer */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{t.calc2Min.paidAmountLabel}</span>
                      <span className="text-lg font-black text-slate-950 font-mono">
                        {formatRubles(paidAmount)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="500000"
                      max="15000000"
                      step="100000"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>500 000 ₽</span>
                      <span>5 000 000 ₽</span>
                      <span>15 000 000 ₽</span>
                    </div>
                  </div>

                  {/* Live Outputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                      <span className="text-xs text-emerald-800 font-semibold block">
                        {t.calc2Min.cashToHandLabel}
                      </span>
                      <span className="text-2xl font-black text-emerald-700 tracking-tight">
                        {formatRubles(cashToHand)}
                      </span>
                      <span className="text-[11px] text-emerald-800/80 block mt-1">
                        {language === 'ru' ? '100% возврат наличными при сделке' : '100% cash refund at closing'}
                      </span>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      <span className="text-xs text-amber-800 font-semibold block">
                        {t.calc2Min.penaltySavedLabel}
                      </span>
                      <span className="text-2xl font-black text-amber-700 tracking-tight">
                        +{formatRubles(devPenalty)}
                      </span>
                      <span className="text-[11px] text-amber-800/80 block mt-1">
                        {language === 'ru' ? 'Предотвращен штраф застройщика (15%)' : 'Saved from 15% dev penalty'}
                      </span>
                    </div>
                  </div>

                  {/* Phone input and submit */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="tel"
                        required
                        placeholder={t.calc2Min.phonePlaceholder}
                        value={calcPhone}
                        onChange={(e) => setCalcPhone(e.target.value)}
                        className="flex-1 px-4 py-3.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all shrink-0"
                      >
                        {t.calc2Min.submitBtn}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center">
                      {language === 'ru'
                        ? 'Нажимая кнопку, вы подтверждаете конфиденциальность по 152-ФЗ. Никакого спама.'
                        : 'By clicking submit, you confirm confidentiality per 152-FZ. No spam.'}
                    </p>
                  </div>

                </form>
              )}

            </div>

          </div>

        </div>
      </section>

    </div>
  );
};
