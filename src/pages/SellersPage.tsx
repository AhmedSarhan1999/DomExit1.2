import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Upload,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  Building,
  Check,
  Send,
} from 'lucide-react';

export const SellersPage: React.FC = () => {
  const { language } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();

  // Wizard Step (1 to 4)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Inputs
  const [complexName, setComplexName] = useState('Setl Group — Чистое Небо');
  const [locationRegion, setLocationRegion] = useState<'spb' | 'msk'>('spb');
  const [contractPrice, setContractPrice] = useState<number>(8500000);
  const [paidAmount, setPaidAmount] = useState<number>(2500000);
  const [todayMarketPrice, setTodayMarketPrice] = useState<number>(11200000);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);

  // Step 2 & 3 Inputs
  const [sellerName, setSellerName] = useState('Александр Владимирович');
  const [sellerPhone, setSellerPhone] = useState('+7 (911) 409-44-12');
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([
    'Договор_ДДУ_скан.pdf',
    'Справка_о_расчетах_девелопера.pdf',
  ]);

  // Created deal ID after step 4
  const [createdDealId, setCreatedDealId] = useState<string>('');

  // Live Calculations
  const devPenalty = contractPrice * 0.15; // 15% penalty on contract price = 1 275 000 ₽
  const cleanReturnDomExit = paidAmount; // 100% of money paid
  const netFamilyBenefit = devPenalty; // +1 275 000 ₽ saved

  const handleGoToStep2 = () => {
    if (!agreeTerms) {
      alert(language === 'ru' ? 'Пожалуйста, подтвердите согласие на продажу по цене ДДУ' : 'Please agree to DDU price sale');
      return;
    }
    setCurrentStep(2);
  };

  const handleGoToStep3 = () => {
    setCurrentStep(3);
  };

  const handleSubmitFinal = async () => {
    const newDeal = await DealsRepository.addDeal({
      lotTitle: `${complexName} — Выход 100%`,
      developer: complexName.split('—')[0]?.trim() || 'Девелопер СПб',
      sellerReturnRub: cleanReturnDomExit,
      discountRub: todayMarketPrice - contractPrice,
      clientName: sellerName,
      stage: 'initial_audit',
      daysLeft: 12,
    });
    setCreatedDealId(newDeal.dealId);
    try {
      await login({
        name: sellerName,
        phone: sellerPhone,
        role: 'seller',
        activeDealId: newDeal.dealId,
      });
    } catch {}
    setCurrentStep(4);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Header & 4 Guarantee Badges */}
      <section className="bg-white text-slate-900 pt-10 pb-12 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="space-y-2 max-w-3xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ru' ? 'Экспресс-аудит договоров цессии по 214-ФЗ' : '214-FZ Express Assignment Audit'}</span>
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {language === 'ru'
                ? 'Хотите выйти из договора ДДУ? Рассчитаем всё с точностью до рубля'
                : 'Want to Exit DDU Contract? We Calculate Everything to the Exact Ruble'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {language === 'ru'
                ? 'Верните 100% внесенных денег наличными при сделке без удержания штрафа девелопера (10%–15%) и без уплаты НДФЛ.'
                : 'Recover 100% of deposited cash without 10%-15% developer penalty and 0% personal income tax.'}
            </p>
          </div>

          {/* 4 Guarantees Bar (4th highlighted in emerald) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">100% ВОЗВРАТ</span>
              <span className="text-[11px] text-slate-500">Без скрытых комиссий</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">0 ₽ НДФЛ</span>
              <span className="text-[11px] text-slate-500">Нет налога с продажи</span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <span className="font-bold text-slate-900 block">7–14 ДНЕЙ</span>
              <span className="text-[11px] text-slate-500">Средний срок закрытия</span>
            </div>
            <div className="bg-emerald-50 text-emerald-950 p-3.5 rounded-xl font-bold border border-emerald-300 shadow-xs">
              <span className="font-black text-emerald-800 block">ГАРАНТИЯ 0%:</span>
              <span className="text-[11px] text-emerald-700 leading-tight block">100% бесплатно продавцу — комиссию 2.5% платит покупатель</span>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Interactive Wizard Container */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Progress Bar (4 steps) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-8">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>{language === 'ru' ? `Шаг ${currentStep} из 4: ${
                currentStep === 1
                  ? 'Базовые параметры ДДУ и расчет возврата'
                  : currentStep === 2
                  ? 'Подтверждение условий и аудит'
                  : currentStep === 3
                  ? 'Загрузка документов в шлюз'
                  : 'Заявка принята в работу'
              }` : `Step ${currentStep} of 4`}</span>
              <span className="text-emerald-600 font-extrabold">{currentStep * 25}%</span>
            </div>

            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${currentStep * 25}%` }}
              />
            </div>

            {/* Privacy Alert */}
            <div className="flex items-center space-x-2 p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900">
              <Lock className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                {language === 'ru'
                  ? 'Конфиденциальный закрытый шлюз по ГОСТ Р 57580. Номер квартиры и ФИО не передаются девелоперу до подписания цессии.'
                  : 'Encrypted gateway per GOST R 57580. Data is never shared with developer before assignment signing.'}
              </span>
            </div>
          </div>

          {/* STEP 1: Basic Parameters & Live Comparison */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Input Fields */}
              <div className="lg:col-span-7 space-y-5">
                
                {/* Complex Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {language === 'ru' ? 'Название ЖК и Девелопер *' : 'Complex & Developer *'}
                  </label>
                  <input
                    type="text"
                    value={complexName}
                    onChange={(e) => setComplexName(e.target.value)}
                    placeholder="Setl Group — Чистое Небо"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Region Buttons */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {language === 'ru' ? 'Регион объекта:' : 'Region:'}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocationRegion('spb')}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        locationRegion === 'spb'
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      СПб и Ленинградская область
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationRegion('msk')}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        locationRegion === 'msk'
                          ? 'bg-emerald-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Москва и Московская область
                    </button>
                  </div>
                </div>

                {/* Contract Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {language === 'ru' ? 'Цена в договоре ДДУ (₽) *' : 'Price in DDU Contract (₽) *'}
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={contractPrice}
                    onChange={(e) => setContractPrice(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Actually Paid */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      {language === 'ru' ? 'Фактически выплачено застройщику (₽) *' : 'Actually Paid to Developer (₽) *'}
                    </label>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      100% возврат + 0 ₽ НДФЛ
                    </span>
                  </div>
                  <input
                    type="number"
                    step="50000"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-emerald-500/80 text-sm font-bold focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {language === 'ru'
                      ? 'Сумма, которую вы получаете на руки наличными при подписании переуступки.'
                      : 'Amount you receive in cash at assignment deal closing.'}
                  </p>
                </div>

                {/* Today Developer Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {language === 'ru' ? 'Текущая цена такой же квартиры у застройщика сегодня (₽)' : 'Current Developer Price (₽)'}
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={todayMarketPrice}
                    onChange={(e) => setTodayMarketPrice(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Agreement Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <span className="leading-snug">
                      {language === 'ru'
                        ? 'Согласен на реализацию лота по цене старого договора ДДУ без наценки в срок 7–14 рабочих дней.'
                        : 'I agree to sell the lot at original DDU contract price with 0% markup within 7–14 business days.'}
                    </span>
                  </label>
                </div>

                {/* Action CTA */}
                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleGoToStep2}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <span>{language === 'ru' ? 'Рассчитать и перейти к загрузке ДДУ ->' : 'Calculate & Proceed to Upload ->'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-slate-400 mt-2">
                    {language === 'ru' ? 'Шифрование ГОСТ Р 57580 • Без спама • 0 ₽ комиссии продавцу' : 'Encrypted • Zero seller fee'}
                  </p>
                </div>

              </div>

              {/* Right Column: Comparative Financial Audit (LIVE CALCULATION) */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {language === 'ru' ? 'СРАВНИТЕЛЬНЫЙ ФИНАНСОВЫЙ АУДИТ — LIVE РАСЧЕТ' : 'COMPARATIVE AUDIT — LIVE CALC'}
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                {/* Box 1: Developer Penalty (Light Red) */}
                <div className="bg-[#FEF2F2] border border-rose-200 rounded-2xl p-4 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-rose-950">
                      {language === 'ru' ? 'Односторонний разрыв с девелопером' : 'Direct Cancellation with Developer'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold">
                      штраф до 15%
                    </span>
                  </div>
                  <div className="text-2xl font-black text-rose-600 tracking-tight">
                    -{formatRubles(devPenalty)}
                  </div>
                  <p className="text-[11px] text-rose-800/80">
                    {language === 'ru'
                      ? 'Прямая безвозвратная потеря из внесенных средств'
                      : 'Direct non-refundable loss from deposited capital'}
                  </p>
                </div>

                {/* Box 2: DomExit Clean Return (Light Green) */}
                <div className="bg-[#ECFDF5] border border-emerald-300 rounded-2xl p-4 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-950">
                      {language === 'ru' ? 'Чистый возврат через DomExit' : 'Clean Return via DomExit'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold">
                      100% средств
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 tracking-tight">
                    {formatRubles(cleanReturnDomExit)}
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    {language === 'ru'
                      ? 'Полная выплата на аккредитив в день регистрации'
                      : 'Full payout into letter of credit at registration day'}
                  </p>
                </div>

                {/* Box 3: Net Family Benefit (Vibrant Emerald Gradient) */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 space-y-3 shadow-lg">
                  <span className="text-xs text-emerald-100 font-semibold block uppercase tracking-wider">
                    {language === 'ru'
                      ? 'ВАША ЧИСТАЯ ВЫГОДА (Сохранение семейного капитала)'
                      : 'YOUR NET BENEFIT (Capital Preserved)'}
                  </span>
                  <div className="text-3xl font-black text-white tracking-tight">
                    +{formatRubles(netFamilyBenefit)}
                  </div>
                  
                  {/* Capital Preservation Bar */}
                  <div className="space-y-1 pt-2 border-t border-emerald-500/50 text-[11px]">
                    <div className="flex justify-between text-emerald-100">
                      <span>Сохранение капитала:</span>
                      <span className="font-bold text-white">100% против 49% при судах</span>
                    </div>
                    <div className="w-full bg-emerald-800/60 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-white h-full w-full" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{language === 'ru' ? 'Средний срок закрытия:' : 'Avg. closing time:'}</span>
                    </span>
                    <span className="font-bold text-white">9 дней</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* STEP 2: Express Terms Confirmation */}
          {currentStep === 2 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {language === 'ru' ? 'Подтверждение контактных данных для связи' : 'Confirm Contact Details'}
                </h3>
                <p className="text-xs text-slate-500">
                  Юрист DomExit проверит договор и подготовит форму согласования с девелопером
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ваше ФИО:</label>
                  <input
                    type="text"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Номер телефона для связи:</label>
                  <input
                    type="text"
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Назад к параметрам
                </button>
                <button
                  type="button"
                  onClick={handleGoToStep3}
                  className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center space-x-2 shadow-xs"
                >
                  <span>Перейти к загрузке ДДУ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Secure Document Upload */}
          {currentStep === 3 && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">
                  {language === 'ru' ? 'Загрузка документов в защищенное хранилище' : 'Secure Document Upload'}
                </h3>
                <p className="text-xs text-slate-500">
                  Файлы шифруются по стандарту ГОСТ Р 57580. Доступ только у сертифицированных юристов 214-ФЗ
                </p>
              </div>

              <div className="border-2 border-dashed border-emerald-400 bg-emerald-50/40 rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">
                  Перетащите файлы сюда или выберите на устройстве
                </h4>
                <p className="text-xs text-slate-500">
                  Поддерживаются форматы PDF, JPG, PNG до 50 МБ (Скан ДДУ, Справка о расчетах, Согласие супруги)
                </p>
                <button
                  type="button"
                  onClick={() => alert('Окно выбора файла открыто')}
                  className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  Выбрать файлы
                </button>
              </div>

              {/* Uploaded Files List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Загруженные документы (2):
                </span>
                {uploadedFiles.map((file) => (
                  <div
                    key={file}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="font-medium text-slate-800">{file}</span>
                    </div>
                    <span className="text-emerald-700 font-bold flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Проверен шлюзом</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  onClick={handleSubmitFinal}
                  className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Отправить заявку на аудит (0% комиссии)</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Success & Tracking Activation */}
          {currentStep === 4 && (
            <div className="max-w-xl mx-auto py-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-bold">
                  Заявка #{createdDealId || 'DEAL-2025-10566'} успешно зарегистрирована
                </span>
                <h3 className="text-2xl font-black text-slate-950">
                  {language === 'ru' ? 'Аудит запущен! Ваш трекер активирован' : 'Audit Launched! Deal Tracker Active'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Мы зафиксировали сумму возврата <strong>{formatRubles(cleanReturnDomExit)}</strong>. Дежурный юрист свяжется с вами в течение 2 часов. Вы можете отслеживать статус выхода и предложения покупателей в реальном времени.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Объект:</span>
                  <span className="font-bold text-slate-900">{complexName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Выплата на руки (100%):</span>
                  <span className="font-black text-emerald-700">{formatRubles(cleanReturnDomExit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Предотвращенный штраф:</span>
                  <span className="font-bold text-slate-900">+{formatRubles(netFamilyBenefit)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/portal')}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
                >
                  <span>Открыть мой единый кабинет дольщика</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-3.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Создать еще расчет
                </button>
              </div>
            </div>
          )}

        </div>

      </section>

      {/* 3. Bottom 3 Guarantee Cards & Telegram Banner */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">214-ФЗ регламентирован</h4>
            <p className="text-xs text-slate-600">
              Сделка регистрируется государством в Росреестре строго по ст. 11 Федерального закона № 214-ФЗ.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">Сбербанк & ВТБ аккредитив</h4>
            <p className="text-xs text-slate-600">
              Деньги депонируются покупателем до подписания договора и выплачиваются продавцу автоматически.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <Lock className="w-6 h-6 text-emerald-600" />
            <h4 className="font-bold text-sm text-slate-900">0 ₽ комиссий с продавца</h4>
            <p className="text-xs text-slate-600">
              Все расходы по юридическому оформлению и вознаграждению сервиса несет покупатель.
            </p>
          </div>
        </div>

        {/* Telegram consultation banner */}
        <div className="bg-gradient-to-r from-sky-50 via-teal-50 to-emerald-50 border border-sky-200 text-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-slate-900">Сложная ситуация с ДДУ?</h3>
            <p className="text-xs text-slate-600 max-w-lg">
              Использован материнский капитал, есть просроченный платеж или застройщик отказывает в уступке? Дежурный юрист решит вопрос индивидуально.
            </p>
          </div>
          <a
            href="https://t.me/domexit_ru"
            target="_blank"
            rel="noreferrer"
            className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Консультация в Telegram</span>
          </a>
        </div>
      </section>

    </div>
  );
};
