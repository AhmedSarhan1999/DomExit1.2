import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lot } from '../types';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { formatRubles, formatPercent } from '../utils/formatters';
import { BookingModal } from '../components/booking/BookingModal';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Flame,
  Share2,
  Heart,
  Clock,
  Sparkles,
  Building,
  User,
  Send,
  ArrowRight,
  Maximize2,
} from 'lucide-react';

export const LotDetailsPage: React.FC = () => {
  const { lotCode } = useParams<{ lotCode: string }>();
  const { language } = useLanguage();
  const { isFavorite, toggleFavorite } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [accordionDevOpen, setAccordionDevOpen] = useState(false);
  const [accordionLawOpen, setAccordionLawOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingSuccessToast, setBookingSuccessToast] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  useEffect(() => {
    async function fetchLot() {
      setLoading(true);
      const code = lotCode || 'U-10566';
      const data = await LotsRepository.getByCode(code);
      setLot(data);
      setLoading(false);
    }
    fetchLot();
  }, [lotCode]);

  if (loading || !lot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Загрузка досье лота #{lotCode}...</p>
        </div>
      </div>
    );
  }

  const savingsRub = lot.todayDeveloperPrice - lot.dduContractPrice;
  const savingsPercent = (savingsRub / lot.todayDeveloperPrice) * 100;
  const pricePerM2 = Math.round(lot.dduContractPrice / lot.areaM2);
  const savingsPerM2 = Math.round(savingsRub / lot.areaM2);
  const totalFirstPaymentDeal = lot.cashPaidBySeller + lot.serviceCommissionRub;
  const favorited = isFavorite(lot.lotCode);
  const lotStatus = lot.status || 'available';

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* 1. Top Breadcrumbs & Header Bar */}
      <section className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/opportunities"
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'ru' ? 'Назад в каталог проверенных лотов' : 'Back to Catalog'}</span>
            </Link>

            <div className="flex items-center space-x-2">
              {copiedToast && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {language === 'ru' ? 'Ссылка скопирована!' : 'Link copied!'}
                </span>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                title="Поделиться"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => toggleFavorite(lot.lotCode)}
                className={`p-2 rounded-xl border transition-all ${
                  favorited
                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title="В избранное"
              >
                <Heart className={`w-4 h-4 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Badges & Main Title */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300">
                ЛОТ #{lot.lotCode}
              </span>

              {/* Status Badge */}
              {lotStatus === 'available' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ДОСТУПЕН К БРОНИРОВАНИЮ</span>
                </span>
              )}
              {lotStatus === 'processing' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>В СДЕЛКЕ (ЭТАП {lot.currentStage || 2}/5 — БАНК/ЭСКРОУ)</span>
                </span>
              )}
              {lotStatus === 'closed' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>СДЕЛКА ЗАКРЫТА (ВНЕСЕН В РЕЕСТР)</span>
                </span>
              )}

              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ДОКУМЕНТЫ ПРОВЕРЕНЫ ЮРИСТАМИ DOMEXIT</span>
              </span>
              {lot.isUrgentExit && lotStatus === 'available' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>СПЕЦПРЕДЛОЖЕНИЕ — СРОЧНЫЙ ВЫХОД</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 tracking-tight">
              {lot.complexName} — {lot.district} — Квартира {lot.areaM2} м²
            </h1>
          </div>

        </div>
      </section>

      {/* 2. Main 2-Column Details Layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 cols): Media, Specs, Legal Passport, Map */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Media Gallery */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
              <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100">
                <img
                  src={lot.galleryImages[activeImageIndex] || lot.imageUrl}
                  alt={lot.complexName}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-slate-800 border border-slate-200/60 shadow-xs backdrop-blur-md text-xs font-bold">
                  {lot.constructionReadinessPercent}% готовности корпуса
                </span>
              </div>

              {/* Labeled Thumbnails */}
              <div className="grid grid-cols-4 gap-3">
                {['Фасад', 'Планировка', 'Вид из окна', 'Генплан'].map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveImageIndex(idx % lot.galleryImages.length)}
                    className={`rounded-xl overflow-hidden border-2 p-1 text-center transition-all ${
                      activeImageIndex === idx % lot.galleryImages.length
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-16 rounded-lg overflow-hidden bg-slate-100 mb-1">
                      <img
                        src={lot.galleryImages[idx % lot.galleryImages.length]}
                        alt={label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 block truncate">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 8 Specs Grid */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                Параметры лота и характеристики
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Тип жилья:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">Квартира</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Площадь:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.areaM2} м²</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Этаж:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.floor} из {lot.totalFloors}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Комнатность:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">2 спальни</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Санузлы:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">2 санузла</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Отделка:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">Чистовая «Nord Line»</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Статус объекта:</span>
                  <span className="font-bold text-emerald-700 text-sm mt-0.5 block">Строится</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Срок сдачи:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.deliveryDate}</span>
                </div>
              </div>

              {/* Green Price per m² Comparison Bar */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-emerald-900 font-bold block">
                    Фиксированная цена за м² в договоре ДДУ: {formatRubles(pricePerM2)}/м²
                  </span>
                  <span className="text-emerald-700 text-[11px]">
                    Цена застройщика сейчас: {formatRubles(Math.round(lot.todayDeveloperPrice / lot.areaM2))}/м²
                  </span>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs shrink-0 shadow-sm">
                  Экономия: {formatRubles(savingsPerM2)}/м²
                </span>
              </div>
            </div>

            {/* Legal Passport (Юридический паспорт цессии #U-10566) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    РЕЗУЛЬТАТ ПРОВЕРКИ ЮРИСТАМИ DOMEXIT
                  </span>
                  <h3 className="text-xl font-black text-slate-950">
                    Юридический паспорт цессии #{lot.lotCode}
                  </h3>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-md">
                  42 из 42 пунктов проверки пройдено
                </span>
              </div>

              {/* Row of verification tags */}
              <div className="flex flex-wrap gap-2 text-xs">
                {['Чистый выход', 'Проверен по ФССП / Федресурс', 'Эскроу Сбербанк', 'Без обременений третьих лиц', 'Согласие девелопера получено'].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              {/* 4 Detail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Статус оплаты дольщиком:</span>
                  <p className="text-slate-600">
                    {formatRubles(lot.cashPaidBySeller)} оплачено застройщику Setl Group. Подтверждено официальной справкой № СГ-78401.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Семейное и налоговое право:</span>
                  <p className="text-slate-600">
                    Нотариальное согласие супруги получено. Материнский капитал не использовался (справка СФР чистая).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Эскроу-счет девелопера:</span>
                  <p className="text-slate-600">
                    ПАО Сбербанк. Аресты, претензии и судебные споры отсутствуют. Блокировок нет.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Формат регистрации сделки:</span>
                  <p className="text-slate-600">
                    Электронная регистрация Росреестра 48 часов с усиленной ЭЦП. Полная защита покупателя.
                  </p>
                </div>
              </div>

              {/* 2 Collapsible Accordions */}
              <div className="space-y-3 pt-2">
                
                {/* Accordion 1: Developer Protocol */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAccordionDevOpen(!accordionDevOpen)}
                    className="w-full p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 transition-colors"
                  >
                    <span>Протокол проверки девелопера (Setl Group)</span>
                    {accordionDevOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {accordionDevOpen && (
                    <div className="p-4 text-xs text-slate-600 bg-white border-t border-slate-200 space-y-2">
                      <p>
                        Застройщик: ООО «Сэтл Сити» (Setl Group). Надежность по рейтингу ЕРЗ: 5 из 5.
                        Проектное финансирование: ПАО Сбербанк. Задержек по срокам ввода корпуса нет.
                      </p>
                    </div>
                  )}
                </div>

                {/* Accordion 2: Law 214-FZ Article 11 */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAccordionLawOpen(!accordionLawOpen)}
                    className="w-full p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 transition-colors"
                  >
                    <span>Анализ договора ДДУ по ст. 11 214-ФЗ</span>
                    {accordionLawOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {accordionLawOpen && (
                    <div className="p-4 text-xs text-slate-600 bg-white border-t border-slate-200 space-y-2">
                      <p>
                        Уступка прав требований по договору участия в долевом строительстве допускается с момента уплаты цены договора или одновременно с переводом долга на нового участника. Данная сделка структурирована строго по процедуре перевода остатка долга с одобрением девелопера.
                      </p>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Map & Infrastructure */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-slate-950">
                  Инфраструктура и локация ({lot.district})
                </h3>
              </div>
              <div className="h-64 rounded-2xl bg-slate-200 relative overflow-hidden flex items-center justify-center">
                <div className="text-center space-y-2 p-4">
                  <MapPin className="w-8 h-8 text-emerald-600 mx-auto animate-bounce" />
                  <span className="font-bold text-sm text-slate-800 block">{lot.complexName}</span>
                  <span className="text-xs text-slate-500 block">
                    Санкт-Петербург, Приморский район • Метро Комендантский пр. (12 мин)
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column (4 cols): Sticky Financial Card & Curator */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* The Financial Card */}
            <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-2xl p-6 sm:p-7 space-y-5">
              
              <div>
                <span className="text-xs font-semibold text-slate-500 block">
                  Наличными продавцу сейчас (100% возврат):
                </span>
                <div className="text-3xl font-black text-slate-950 tracking-tight mt-0.5">
                  {formatRubles(lot.cashPaidBySeller)}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                  Ровно сумма, выплаченная владельцем — 0% оверпрайса
                </span>
              </div>

              {/* Green Savings Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-bold uppercase tracking-wider text-[11px]">
                    ВАША ВЫГОДА ОТ ЦЕНЫ РЫНКА:
                  </span>
                  <span className="text-emerald-700 font-black">
                    -{formatPercent(savingsPercent)}
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-700 tracking-tight">
                  +{formatRubles(savingsRub)}
                </div>
                <div className="text-[11px] text-emerald-800/80 pt-1 border-t border-emerald-200/80 flex justify-between">
                  <span>Цена у застройщика сегодня:</span>
                  <span className="font-bold">{formatRubles(lot.todayDeveloperPrice)}</span>
                </div>
              </div>

              {/* Transparent Calculation Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  ПРОЗРАЧНЫЙ РАСЧЕТ ПЛАТЕЖЕЙ
                </span>
                <div className="flex justify-between text-slate-600">
                  <span>Остаток застройщику:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.remainingInstallmentDebt)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>График платежей:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.installmentQuarterlyPayment)} / квартал</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Остаток срока рассрочки:</span>
                  <span className="font-semibold text-slate-900">до конца 2026 г.</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Комиссия DomExit (2.5%):</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.serviceCommissionRub)}</span>
                </div>
                
                {/* Highlighted Total Line */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl flex justify-between items-center font-bold text-xs mt-3">
                  <span>Итого первый взнос на сделке:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatRubles(totalFirstPaymentDeal)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Общая стоимость квартиры по договору: {formatRubles(lot.dduContractPrice)}
                </p>
              </div>

              {/* Actions based on lot status */}
              <div className="space-y-3 pt-2">
                {lotStatus === 'available' && (
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Подать заявку на покупку (Кэш / Ипотека)</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                )}

                {lotStatus === 'processing' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                      <p className="font-bold flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Лот находится в сделке (Этап {lot.currentStage || 2}/5)</span>
                      </p>
                      <p className="text-[11px] text-amber-700 mt-1">
                        Отобран покупатель, идет оформление аккредитива. Вы можете подать заявку в лист ожидания на случай форс-мажора.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(true)}
                      className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Подать заявку в резервный список</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {lotStatus === 'closed' && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800">
                      <p className="font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Сделка успешно завершена</span>
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Квартира переуступлена и зарегистрирована в Росреестре.
                      </p>
                    </div>
                    <Link
                      to="/opportunities"
                      className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 text-center"
                    >
                      <span>Смотреть другие доступные лоты</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>Получить презентацию и выписку в Telegram</span>
                </a>
              </div>

            </div>

            {/* Other lots in this complex */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs space-y-1 shadow-sm">
              <span className="font-bold text-slate-900 block">В этом ЖК еще 14 проверенных лотов</span>
              <p className="text-slate-500 text-[11px]">
                Доступны 1-к, 2-к и студии со сдачей в 2025–2026 гг.
              </p>
              <Link to="/opportunities" className="text-emerald-700 font-bold hover:underline block pt-1">
                Смотреть все варианты в ЖК →
              </Link>
            </div>

            {/* Personal Curator Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                  АС
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block">{lot.curator.name}</span>
                  <span className="text-[11px] text-slate-500 block">{lot.curator.role}</span>
                </div>
              </div>
              <a
                href="https://t.me/domexit_ru"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors shadow-xs"
              >
                Написать
              </a>
            </div>

          </div>

        </div>
      </section>

      {/* 3. SIMILAR VERIFIED LOTS (Interface 9 - matches screen_3.jpg) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              АЛЬТЕРНАТИВЫ В ТОЙ ЖЕ ЦЕНЕ
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">
              Похожие проверенные лоты в этой же локации и бюджете
            </h2>
          </div>
          <Link to="/opportunities" className="text-xs font-bold text-emerald-700 hover:underline">
            Все лоты в локации →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Similar 1 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <span className="text-[11px] font-bold text-slate-400">Приморский р-н • Setl Group</span>
            <h3 className="font-bold text-base text-slate-900">ЖК «Чистое Небо» — 3-комн. 84 м²</h3>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Наличными продавцу:</span>
                <span className="font-bold text-slate-900">3 100 000 ₽</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Выгода от застройщика:</span>
                <span>+2 850 000 ₽</span>
              </div>
            </div>
            <Link
              to="/opportunities/U-10566"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
            >
              <span>Подробнее о лоте</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Similar 2 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <span className="text-[11px] font-bold text-slate-400">Невский р-н • Setl Group</span>
            <h3 className="font-bold text-base text-slate-900">ЖК Pulse Premier — 2-комн. 62.4 м²</h3>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Наличными продавцу:</span>
                <span className="font-bold text-slate-900">2 150 000 ₽</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Выгода от застройщика:</span>
                <span>+3 050 000 ₽</span>
              </div>
            </div>
            <Link
              to="/opportunities/U-14102"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
            >
              <span>Подробнее о лоте</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Similar 3 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <span className="text-[11px] font-bold text-slate-400">Васильевский о-в • Группа ЛСР</span>
            <h3 className="font-bold text-base text-slate-900">ЖК Морская Наб. — 1-комн. 41.8 м²</h3>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Наличными продавцу:</span>
                <span className="font-bold text-slate-900">1 750 000 ₽</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Выгода от застройщика:</span>
                <span>+2 500 000 ₽</span>
              </div>
            </div>
            <Link
              to="/opportunities/U-10580"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
            >
              <span>Подробнее о лоте</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </section>

      {/* Booking Modal */}
      <BookingModal
        lot={lot}
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={() => {
          setIsBookingModalOpen(false);
          setBookingSuccessToast(true);
        }}
      />

      {/* Success Notification Toast */}
      {bookingSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-900 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl space-y-2 max-w-sm animate-bounce">
          <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Бронь зафиксирована!</span>
          </div>
          <p className="text-xs text-slate-600">
            Персональный куратор Алексей Смирнов свяжется с вами в течение 15 минут для согласования сделки.
          </p>
          <button
            type="button"
            onClick={() => setBookingSuccessToast(false)}
            className="text-[11px] text-emerald-600 font-bold hover:underline"
          >
            Закрыть
          </button>
        </div>
      )}

    </div>
  );
};
