import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles, formatPercent } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { Lot } from '../types';
import {
  PackageCheck,
  Lock,
  Eye,
  QrCode,
  ShieldCheck,
  Check,
  Send,
  ArrowLeft,
  Building,
  Sparkles,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export const AdminPackagingPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const { language } = useLanguage();

  const [lot, setLot] = useState<Lot | null>(null);
  const [hideFloor, setHideFloor] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<'web' | 'telegram'>('web');

  // Financial Truth Engine numeric inputs
  const [oldDduPrice, setOldDduPrice] = useState<number>(10972000);
  const [cashToSeller, setCashToSeller] = useState<number>(2485230);
  const [debtToDev, setDebtToDev] = useState<number>(8486770);
  const [todayDevPrice, setTodayDevPrice] = useState<number>(14200000);

  useEffect(() => {
    async function load() {
      const code = lotId || 'U-10566';
      const data = await LotsRepository.getByCode(code);
      if (data) {
        setLot(data);
        setOldDduPrice(data.dduContractPrice);
        setCashToSeller(data.cashPaidBySeller);
        setDebtToDev(data.remainingInstallmentDebt);
        setTodayDevPrice(data.todayDeveloperPrice);
      }
    }
    load();
  }, [lotId]);

  const buyerNetSavings = todayDevPrice - oldDduPrice;
  const buyerDiscountPercent = (buyerNetSavings / todayDevPrice) * 100;
  const buyerFee = Math.round(oldDduPrice * 0.025);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title={`Упаковка и публикация лота #${lot?.lotCode || 'U-10566'}`}
          subtitle="Студия анонимизации данных по 152-ФЗ и расчетный движок Financial Truth Engine"
        />

        <div className="p-6 space-y-6 max-w-[1600px] w-full">
          
          {/* Top Bar with Readiness and Publish CTAs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center space-x-4">
              <Link
                to="/opportunities"
                className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>В каталог</span>
              </Link>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-600">Готовность лота к публикации:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-xs">
                  85%
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => alert('Черновик сохранен локально')}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs transition-colors"
              >
                Сохранить черновик
              </button>
              <button
                type="button"
                onClick={() => alert('Лот опубликован в открытом каталоге DomExit')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Опубликовать на сайте
              </button>
              <button
                type="button"
                onClick={() => alert('Оффер отправлен в закрытый VIP Telegram-клуб (420 инвесторов)')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить в VIP TG-клуб (за 48ч)</span>
              </button>
            </div>
          </div>

          {/* 2-Column Packaging Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column (7 cols): 3 Editing Cards */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Card 1: 152-ФЗ Protected Owner Dossier */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs relative">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2 text-rose-600">
                    <Lock className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Закрытое досье собственника (152-ФЗ Защищено)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                    Скрыто от публики
                  </span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  ⚠️ Данные ниже видны только штатным юристам DomExit для подготовки цессии. Покупатель видит только номер лота #{lot?.lotCode || 'U-10566'}.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">ФИО Собственника:</label>
                    <input
                      type="text"
                      disabled
                      value={lot?.ownerDossier.fullNameMasked || 'Александр Владимирович Б.'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Контактный телефон:</label>
                    <input
                      type="text"
                      disabled
                      value={lot?.ownerDossier.phoneMasked || '+7 911 ***-44-12'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Номер договора ДДУ:</label>
                    <input
                      type="text"
                      disabled
                      value={lot?.ownerDossier.dduNumber || '№ ЧН-12/2-10566'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Точный номер квартиры:</label>
                    <input
                      type="text"
                      disabled
                      value={lot?.ownerDossier.apartmentNumber || 'Квартира № 418'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold"
                    />
                  </div>
                </div>

                {/* Floor Hiding Toggle */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={hideFloor}
                      onChange={(e) => setHideFloor(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        Скрыть точный этаж от застройщика (отображать диапазон «7–10 этаж»)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Исключает риск санкций и досрочного расторжения со стороны службы мониторинга девелопера.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Card 2: Public Characteristics & Media Materials */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-3 border-b border-slate-100">
                  Публичные характеристики и медиаматериалы
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Жилой комплекс:</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{lot?.complexName || 'ЖК Чистое Небо'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Площадь:</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{lot?.areaM2 || 112.0} м²</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Публичный этаж:</span>
                    <span className="font-bold text-emerald-700 mt-0.5 block">
                      {hideFloor ? '7–10 этаж' : `${lot?.floor} из ${lot?.totalFloors}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Срок сдачи:</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">{lot?.deliveryDate || '4 кв. 2026 г.'}</span>
                  </div>
                </div>

                {/* AI Masking Floorplan Notice */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      План квартиры с авто-размытием персональных печатей
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      AI MASKED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Алгоритм машинного зрения DomExit автоматически распознал и закрасил штампы БТИ и личные подписи дольщика на планировке.
                  </p>
                </div>
              </div>

              {/* Card 3: The Financial Truth Engine (Formula DomExit v2.4) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      The Financial Truth Engine (Движок финансовой правды)
                    </h3>
                    <span className="text-[11px] text-slate-500">Формула: DomExit v2.4 • 0% наценки</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">1. Цена в старом договоре ДДУ (₽):</label>
                    <input
                      type="number"
                      step="50000"
                      value={oldDduPrice}
                      onChange={(e) => setOldDduPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">2. Выплачено продавцом (Кэш на руки ₽):</label>
                    <input
                      type="number"
                      step="50000"
                      value={cashToSeller}
                      onChange={(e) => setCashToSeller(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-emerald-500 text-emerald-700 font-mono font-bold focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">3. Остаток долга застройщику (₽):</label>
                    <input
                      type="number"
                      step="50000"
                      value={debtToDev}
                      onChange={(e) => setDebtToDev(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">4. Официальная цена застройщика сегодня (₽):</label>
                    <input
                      type="number"
                      step="50000"
                      value={todayDevPrice}
                      onChange={(e) => setTodayDevPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:bg-white"
                    />
                  </div>
                </div>

                {/* Big Green Output Box */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-emerald-800 uppercase tracking-wider">
                      РАСЧЕТНАЯ ЧИСТАЯ ВЫГОДА ПОКУПАТЕЛЯ:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-xs shadow-xs">
                      Дисконт -{formatPercent(buyerDiscountPercent)}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-emerald-700 tracking-tight font-mono">
                    +{formatRubles(buyerNetSavings)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-emerald-200 text-xs text-slate-600">
                    <span>Комиссия покупателя (2.5% по факту): <strong className="text-slate-900">{formatRubles(buyerFee)}</strong></span>
                    <span className="text-emerald-700 font-bold">Комиссия с продавца: 0 ₽ (100% возврат)</span>
                  </div>
                </div>

              </div>

            </div>

            {/* Right Column (5 cols): Live Preview, Smart QR Code, Checklist */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Live Preview Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Живое превью лота
                  </h3>
                  <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('web')}
                      className={`px-2.5 py-1 rounded transition-colors ${previewTab === 'web' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'}`}
                    >
                      Веб-витрина
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('telegram')}
                      className={`px-2.5 py-1 rounded transition-colors ${previewTab === 'telegram' ? 'bg-white text-sky-600 shadow-xs' : 'text-slate-500'}`}
                    >
                      Telegram VIP
                    </button>
                  </div>
                </div>

                {/* Card Preview Box */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="h-36 rounded-xl bg-slate-200 overflow-hidden relative">
                    <img
                      src={lot?.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80'}
                      alt="Превью"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                      Документы проверены
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{lot?.complexName || 'ЖК Чистое Небо'}</h4>
                    <span className="text-[11px] text-slate-500">
                      {lot?.areaM2 || 112.0} м² • {hideFloor ? '7–10 этаж' : `${lot?.floor} этаж`} • {lot?.deliveryDate || '4 кв. 2026 г.'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Кэш продавцу:</span>
                      <span className="font-bold text-slate-900">{formatRubles(cashToSeller)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Выгода покупателя:</span>
                      <span>+{formatRubles(buyerNetSavings)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protected Smart QR Code Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Защищенный QR-код лота — Смарт-редирект
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 font-mono text-[10px] font-bold">
                    ГОСТ ЭЦП
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 bg-slate-50 border border-slate-200 p-2 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                    <QrCode className="w-20 h-20 text-slate-800" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-slate-900 block">
                      Верификационный паспорт
                    </span>
                    <p className="text-[11px] text-slate-500">
                      При сканировании открывает официальный штамп проверки по 214-ФЗ.
                    </p>
                    <Link
                      to={`/verify/${lot?.lotCode || 'U-10566'}`}
                      className="text-emerald-700 hover:text-emerald-800 hover:underline font-bold text-xs inline-flex items-center space-x-1"
                    >
                      <span>Открыть сертификат /verify/{lot?.lotCode || 'U-10566'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Launch Checklist Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100">
                  Чек-лист готовности к выходу
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Справка о взаиморасчетах сверена с Setl Group</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Персональные данные скрыты по 152-ФЗ</span>
                  </div>
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Финансовый баланс проверен (0% оверпрайса)</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => alert('Опубликовано в VIP TG-клуб!')}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Опубликовать в закрытый VIP TG-клуб (420 инвесторов)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => alert('Опубликовано в открытом каталоге!')}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition-colors shadow-xs"
                  >
                    Опубликовать в открытом каталоге DomExit
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
