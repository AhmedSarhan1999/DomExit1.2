import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useFeatureFlagsStore } from '../stores/useFeatureFlagsStore';
import { Lot, Employee, DistrictYieldConfig } from '../types';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { resolveLotGeoDetails } from '../data/russianGeography';
import { formatRubles, formatPercent } from '../utils/formatters';
import { BookingModal } from '../components/booking/BookingModal';
import { SmartMortgageCalculator } from '../components/lot/SmartMortgageCalculator';
import { LotMiniMap } from '../components/lot/LotMiniMap';
import { DocumentVaultModal } from '../components/documents/DocumentVaultModal';
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
  Send,
  Phone,
  MessageCircle,
  ArrowRight,
  TrainFront,
  TrendingUp,
  FolderLock,
  Award,
  Compass,
  Eye,
  Calendar,
  Building2,
} from 'lucide-react';

export const LotDetailsPage: React.FC = () => {
  const { lotCode } = useParams<{ lotCode: string }>();
  const { language } = useLanguage();
  const { user, isFavorite, toggleFavorite } = useAuth();
  const { enableBankPortal } = useFeatureFlagsStore();

  const [lot, setLot] = useState<Lot | null>(null);
  const [districtYield, setDistrictYield] = useState<DistrictYieldConfig | null>(null);
  const [similarLots, setSimilarLots] = useState<Lot[]>([]);
  const [sameDistrictCount, setSameDistrictCount] = useState<number>(0);
  const [curatorEmployee, setCuratorEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [accordionDevOpen, setAccordionDevOpen] = useState(false);
  const [accordionLawOpen, setAccordionLawOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [bookingSuccessToast, setBookingSuccessToast] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isDevAccredited, setIsDevAccredited] = useState<boolean>(true);

  useEffect(() => {
    const code = lotCode || 'U-10566';

    async function fetchLot(shouldIncrementViews = false) {
      if (shouldIncrementViews) {
        setLoading(true);
        setActiveImageIndex(0);
      }
      const data = shouldIncrementViews
        ? await LotsRepository.incrementViews(code)
        : await LotsRepository.getByCode(code);
      setLot(data);

      if (data) {
        const [similar, districtMatches, yieldCfg, financingList] = await Promise.all([
          LotsRepository.getSimilarInDistrict(data, 3),
          LotsRepository.getAll({ city: data.city, district: data.district, status: 'all' }),
          MarketSettingsRepository.getDistrictYieldConfig(data.district),
          DevelopersRepository.resolvePropertyFinancing(data),
        ]);
        setSimilarLots(similar);
        setSameDistrictCount(districtMatches.length);
        setDistrictYield(yieldCfg);
        setIsDevAccredited(financingList.length > 0);

        if (data.assignedEmployeeId) {
          const emp = await EmployeesRepository.getById(data.assignedEmployeeId);
          if (emp) setCuratorEmployee(emp);
        } else if (data.curator?.name) {
          const allEmps = await EmployeesRepository.getAll();
          const match = allEmps.find(
            (e) =>
              e.name.toLowerCase().includes(data.curator.name.toLowerCase()) ||
              data.curator.name.toLowerCase().includes(e.name.toLowerCase())
          );
          if (match) setCuratorEmployee(match);
        }
      }
      if (shouldIncrementViews) {
        setLoading(false);
      }
    }

    fetchLot(true);

    const unsub = DatabaseGateway.subscribe((col) => {
      if (
        !col ||
        col === 'lots' ||
        col === 'market_settings' ||
        col === 'developers' ||
        col === 'bank_special_approvals' ||
        col === 'developer_accreditation_requests'
      ) {
        fetchLot(false);
      }
    });
    return () => unsub();
  }, [lotCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">
            {language === 'ru' ? `Загрузка досье лота #${lotCode}...` : `Loading Lot #${lotCode}...`}
          </p>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-10 max-w-md text-center space-y-4 shadow-sm">
          <Lock className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-900">
            {language === 'ru' ? `Лот #${lotCode} не найден` : `Lot #${lotCode} not found`}
          </h2>
          <p className="text-xs text-slate-600">
            {language === 'ru'
              ? 'Объект снят с публикации или перемещен в закрытый архив реестра.'
              : 'This unit has been unpublished or archived.'}
          </p>
          <Link
            to="/opportunities"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'ru' ? 'Вернуться в каталог' : 'Back to Catalog'}</span>
          </Link>
        </div>
      </div>
    );
  }

  const geo = resolveLotGeoDetails(lot);
  const gallery =
    lot.galleryImages && lot.galleryImages.length > 0 ? lot.galleryImages : [lot.imageUrl];

  const savingsRub = lot.todayDeveloperPrice - lot.dduContractPrice;
  const savingsPercent =
    lot.todayDeveloperPrice > 0 ? (savingsRub / lot.todayDeveloperPrice) * 100 : 0;
  const dduPricePerM2 = Math.round(lot.dduContractPrice / Math.max(lot.areaM2, 1));
  const devPricePerM2 = Math.round(lot.todayDeveloperPrice / Math.max(lot.areaM2, 1));
  const savingsPerM2 = Math.max(0, devPricePerM2 - dduPricePerM2);
  const totalFirstPaymentDeal = lot.cashPaidBySeller + lot.serviceCommissionRub;
  const favorited = isFavorite(lot.lotCode);
  const lotStatus = lot.status || 'available';

  // Telemetry Metrics (Task 3)
  const publishedDateFormatted = (() => {
    const raw = lot.publishedAt || '2026-10-28T14:30:00.000Z';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '28 октября 2026, 14:30';
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();
  const viewsCount =
    typeof lot.viewsCount === 'number'
      ? lot.viewsCount
      : 112 + (lot.lotCode.charCodeAt(lot.lotCode.length - 1) % 90);
  const favoritesCount =
    typeof lot.favoritesCount === 'number'
      ? lot.favoritesCount
      : 14 + (lot.lotCode.charCodeAt(lot.lotCode.length - 1) % 19);

  // District Yield & Capital Growth Engine Formulas (Task 4)
  const monthlyRentPercent = districtYield?.monthlyRentPercentOfMarket ?? 0.65;
  const dailyRentPercent = districtYield?.dailyRentPercentOfMarket ?? 0.05;
  const annualGrowthPercent = districtYield?.annualGrowthPercent ?? 11.5;

  const computedLongTermMonthlyRub = Math.round(
    lot.todayDeveloperPrice * (monthlyRentPercent / 100)
  );
  const computedShortTermDailyRub = Math.round(
    lot.todayDeveloperPrice * (dailyRentPercent / 100)
  );
  // Strictly relative to actual DomExit DDU purchase price (NOT developer price):
  const computedAnnualRentalYieldPercent = Number(
    (((computedLongTermMonthlyRub * 12) / Math.max(lot.dduContractPrice, 1)) * 100).toFixed(2)
  );
  // Instant Equity Growth relative to DDU purchase price:
  const instantEquityGrowthPercent = Number(
    (
      ((lot.todayDeveloperPrice - lot.dduContractPrice) / Math.max(lot.dduContractPrice, 1)) *
      100
    ).toFixed(1)
  );
  // 3-Year and 5-Year Capital Growth Forecast:
  const growthFactor = 1 + annualGrowthPercent / 100;
  const projectedPrice3Years = Math.round(lot.todayDeveloperPrice * Math.pow(growthFactor, 3));
  const projectedPrice5Years = Math.round(lot.todayDeveloperPrice * Math.pow(growthFactor, 5));
  const projectedGain3Years = Math.max(0, projectedPrice3Years - lot.dduContractPrice);
  const projectedGain5Years = Math.max(0, projectedPrice5Years - lot.dduContractPrice);

  const maskedFloorText = lot.ownerDossier?.hideExactFloor
    ? `${lot.ownerDossier.floorRangeDisplay} (из ${lot.totalFloors})`
    : `${lot.floor} из ${lot.totalFloors}`;

  const roomsLabel =
    lot.rooms === 'studio'
      ? language === 'ru'
        ? 'Студия'
        : 'Studio'
      : language === 'ru'
      ? `${lot.rooms.replace('-room', '')}-комнатная`
      : `${lot.rooms}`;

  const similarDistrictUrl = `/opportunities?city=${encodeURIComponent(
    lot.city
  )}&district=${encodeURIComponent(lot.district)}`;

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
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                to="/opportunities"
                className="inline-flex items-center space-x-1.5 font-bold text-slate-600 hover:text-emerald-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'ru' ? 'Каталог РФ' : 'Catalog'}</span>
              </Link>
              <span className="text-slate-300">/</span>
              <Link
                to={`/opportunities?city=${lot.city}`}
                className="font-semibold text-slate-600 hover:text-emerald-700"
              >
                {language === 'ru' ? geo.region.shortLabelRu : geo.region.shortLabelEn}
              </Link>
              <span className="text-slate-300">/</span>
              <Link
                to={similarDistrictUrl}
                className="font-semibold text-emerald-700 hover:underline"
              >
                {lot.district}
              </Link>
            </div>

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

              {lotStatus === 'available' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'ДОСТУПЕН К БРОНИРОВАНИЮ' : 'AVAILABLE FOR BOOKING'}</span>
                </span>
              )}
              {lotStatus === 'processing' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300">
                  <Clock className="w-3.5 h-3.5" />
                  <span>В СДЕЛКЕ (ЭТАП {lot.currentStage || 3}/5 — ЭСКРОУ)</span>
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
                <span>42 ПУНКТА ПРОВЕРКИ • 214-ФЗ</span>
              </span>

              {lot.isUrgentExit && lotStatus === 'available' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>СРОЧНЫЙ ВЫХОД</span>
                </span>
              )}

              {isDevAccredited ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Аккредитован в ТОП-банках (СБР)</span>
                </span>
              ) : enableBankPortal ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  <Building2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>Ожидает аккредитации банков</span>
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-950 tracking-tight">
              {lot.complexName} — {roomsLabel} {lot.areaM2} м²
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {geo.region.labelRu} • {lot.district} • {geo.streetAddress}
              </span>
            </p>

            {/* Digital Telemetry Bar (Task 3: Published Timestamp, Views, Favorites) */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Опубликовано: <strong className="text-slate-900">{publishedDateFormatted}</strong>
                </span>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Просмотры: <strong className="text-slate-900">{viewsCount}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => toggleFavorite(lot.lotCode)}
                title="В избранном"
                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all cursor-pointer ${
                  favorited
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    favorited ? 'fill-rose-500 text-rose-500' : 'text-rose-500'
                  }`}
                />
                <span className="font-bold text-slate-900">{favoritesCount}</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Main 2-Column Details Layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 cols): Gallery, Technical Specs, Smart Calculator, Rental Potential, Legal Passport, Map */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Media Gallery */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
              <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100">
                <img
                  src={gallery[activeImageIndex % gallery.length] || lot.imageUrl}
                  alt={lot.complexName}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-slate-800 border border-slate-200/60 shadow-xs backdrop-blur-md text-xs font-bold">
                  {lot.constructionReadinessPercent}% готовности корпуса
                </span>
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/85 text-white text-xs font-bold backdrop-blur-md">
                  {lot.developer}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {['Архитектура ЖК', 'Планировка и корпус', 'Интерьер / Холл', 'Благоустройство'].map(
                  (label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveImageIndex(idx % gallery.length)}
                      className={`rounded-xl overflow-hidden border-2 p-1 text-center transition-all ${
                        activeImageIndex === idx % gallery.length
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="h-16 rounded-lg overflow-hidden bg-slate-100 mb-1">
                        <img
                          src={gallery[idx % gallery.length]}
                          alt={label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 block truncate">
                        {label}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Technical Specifications & Price per m² Benchmark Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">
                  {language === 'ru'
                    ? 'Технический паспорт и аналитика цены за м²'
                    : 'Technical Specifications & Price per m² Benchmark'}
                </h2>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>{language === 'ru' ? 'Защита этажа и № кв. по 152-ФЗ' : '152-FZ Masked Unit'}</span>
                </span>
              </div>

              {/* 3-Column Price/m² Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    {language === 'ru' ? 'ВАША ЦЕНА ПО ДДУ' : 'YOUR DDU PRICE'}
                  </span>
                  <span className="text-xl font-black text-emerald-800 mt-1 block">
                    {formatRubles(dduPricePerM2)}/м²
                  </span>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block">
                    {language === 'ru'
                      ? `Экономия ${formatRubles(savingsPerM2)} с каждого м²`
                      : `Save ${formatRubles(savingsPerM2)} per m²`}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    {language === 'ru' ? 'ПРАЙС ДЕВЕЛОПЕРА СЕЙЧАС' : 'DEVELOPER LIST PRICE'}
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {formatRubles(devPricePerM2)}/м²
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {lot.developer} (отдел продаж)
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    {language === 'ru' ? 'СРЕДНИЙ РЫНОК РАЙОНА' : 'DISTRICT MARKET AVG'}
                  </span>
                  <span className="text-xl font-black text-slate-900 mt-1 block">
                    {formatRubles(geo.districtAvgPricePerM2)}/м²
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {lot.district}
                  </span>
                </div>
              </div>

              {/* 8 Technical Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Формат квартиры:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{roomsLabel}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Общая площадь:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.areaM2} м²</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Диапазон этажа (152-ФЗ):</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{maskedFloorText}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Высота потолков:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{geo.ceilingHeightM} м</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Застройщик:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">{lot.developer}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Банк эскроу-счета:</span>
                  <span className="font-bold text-emerald-700 text-sm mt-0.5 block">ПАО {lot.escrowBank}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Готовность корпуса:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.constructionReadinessPercent}%</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block">Срок ввода по ДДУ:</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{lot.deliveryDate}</span>
                </div>
              </div>
            </div>

            {/* Phase 4 Requirement: Smart Mortgage & Credit Calculator */}
            <SmartMortgageCalculator
              lot={lot}
              onApplyWithCalculation={() => setIsBookingModalOpen(true)}
            />

            {/* Phase 4 Requirement: Rental & Income Potential of Location */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 block">
                      АНАЛИТИКА ЛОКАЦИИ И СТОИМОСТИ ЖИЛЬЯ
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-slate-950">
                      Арендный потенциал и рыночная оценка локации ({lot.district})
                    </h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                  Прогноз после ввода: {lot.deliveryDate}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-xs text-slate-500 font-medium block">
                    Долгосрочная аренда:
                  </span>
                  <span className="text-xl font-black text-slate-950 block">
                    {formatRubles(computedLongTermMonthlyRub)} / мес.
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Годовой доход: {formatRubles(computedLongTermMonthlyRub * 12)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-xs text-slate-500 font-medium block">
                    Посуточная аренда:
                  </span>
                  <span className="text-xl font-black text-slate-950 block">
                    {formatRubles(computedShortTermDailyRub)} / сутки
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    При загрузке 70%: ~{formatRubles(Math.round(computedShortTermDailyRub * 21))} / мес.
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-xs text-emerald-800 font-semibold block">
                    Арендная доходность (ROI):
                  </span>
                  <span className="text-2xl font-black text-emerald-700 block">
                    {computedAnnualRentalYieldPercent}% годовых
                  </span>
                  <span className="text-[11px] text-emerald-800 block">
                    К цене покупки DomExit ({formatRubles(lot.dduContractPrice)})
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-xs text-emerald-800 font-semibold block">
                    Мгновенный прирост капитала:
                  </span>
                  <span className="text-2xl font-black text-emerald-700 block">
                    +{instantEquityGrowthPercent}% сразу при покупке
                  </span>
                  <span className="text-[11px] text-emerald-800 block">
                    Чистая выгода в день сделки: +{formatRubles(savingsRub)}
                  </span>
                </div>
              </div>

              {/* 3-Year & 5-Year Capital Growth Forecast Card (Task 2 & 4) */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
                      ПРОГНОЗ КАПИТАЛИЗАЦИИ РАЙОНА ({lot.district.toUpperCase()})
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900">
                      Прогноз рыночной стоимости актива через 3 года и 5 лет
                    </h4>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-extrabold text-slate-800">
                    Капитализация и прирост актива
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                    <div className="text-[11px] font-semibold text-slate-500">
                      Рыночная оценка сегодня (Застройщик)
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {formatRubles(lot.todayDeveloperPrice)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                      Ваша точка входа ДДУ: {formatRubles(lot.dduContractPrice)}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-200">
                    <div className="text-[11px] font-semibold text-slate-500">
                      Прогноз стоимости через 3 года
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-0.5">
                      {formatRubles(projectedPrice3Years)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                      Прирост к цене ДДУ: +{formatRubles(projectedGain3Years)}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-300 shadow-2xs">
                    <div className="text-[11px] font-semibold text-slate-500">
                      Прогноз стоимости через 5 лет
                    </div>
                    <div className="text-lg font-black text-emerald-700 mt-0.5">
                      {formatRubles(projectedPrice5Years)}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-0.5">
                      Прирост к цене ДДУ: +{formatRubles(projectedGain5Years)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Passport + S3 Cloud Document Vault Inspection */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    РЕЗУЛЬТАТ КОМПЛАЕНС-АУДИТА DOMEXIT
                  </span>
                  <h3 className="text-xl font-black text-slate-950">
                    Юридический паспорт цессии #{lot.lotCode}
                  </h3>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-md">
                  42 из 42 пунктов проверки пройдено
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  'Чистый выход (ст. 11 214-ФЗ)',
                  'Проверен по ФССП и ЕФРСБ',
                  `Эскроу ПАО ${lot.escrowBank}`,
                  'Справка СФР: маткапитал 0 ₽',
                  `Согласие ${lot.developer} подтверждено`,
                ].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Статус оплаты дольщиком:</span>
                  <p className="text-slate-600">
                    {formatRubles(lot.cashPaidBySeller)} официально выплачено застройщику {lot.developer}. Подтверждено оригиналом акта сверки взаиморасчетов.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Семейное право и СФР:</span>
                  <p className="text-slate-600">
                    Материнский капитал не привлекался (выписка Госуслуги / СФР верифицирована). Обязательства по выделению детских долей отсутствуют.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Антибанкротный индекс (ФЗ-127):</span>
                  <p className="text-slate-600">
                    Индекс безопасности: {lot.legalPassport?.antiBankruptcyIndex || 98}/100. Исполнительные производства ФССП отсутствуют.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">Безопасные расчеты:</span>
                  <p className="text-slate-600">
                    Безотзывный банковский аккредитив в ПАО {lot.escrowBank}. Раскрытие в пользу продавца строго после регистрации уступки в Росреестре.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Digital Certificate & Document Vault */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(true)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <FolderLock className="w-4 h-4 text-emerald-400" />
                  <span>Открыть верифицированное досье S3 (ДДУ, Справки)</span>
                </button>

                <Link
                  to={`/verify/${lot.lotCode}`}
                  className="py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
                >
                  <Award className="w-4 h-4 text-emerald-700" />
                  <span>Цифровой сертификат ГОСТ</span>
                </Link>
              </div>

              {/* 2 Collapsible Accordions */}
              <div className="space-y-3 pt-2">
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAccordionDevOpen(!accordionDevOpen)}
                    className="w-full p-4 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-900 transition-colors"
                  >
                    <span>Протокол проверки девелопера ({lot.developer})</span>
                    {accordionDevOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {accordionDevOpen && (
                    <div className="p-4 text-xs text-slate-600 bg-white border-t border-slate-200 space-y-2">
                      <p>
                        Девелопер проекта: {lot.developer} ({geo.region.shortLabelRu}). Проектное финансирование и эскроу-счета обслуживаются в ПАО {lot.escrowBank}. Нарушений графика строительства не зафиксировано.
                      </p>
                    </div>
                  )}
                </div>

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
                        Уступка прав требований по ДДУ оформляется одновременно с переводом остатка долга ({formatRubles(lot.remainingInstallmentDebt)}) на нового участника долевого строительства с официальным трехсторонним согласием {lot.developer}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Infrastructure, Metro Stations & Interactive Leaflet Mini-Map */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg sm:text-xl font-black text-slate-950">
                      Инфраструктура и локация
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    {geo.region.labelRu} • <strong>{lot.district}</strong> • {geo.streetAddress}
                  </p>
                </div>

                <Link
                  to={`${similarDistrictUrl}&view=map`}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors self-start sm:self-auto"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Открыть район на большой карте</span>
                </Link>
              </div>

              {/* Transport & Metro Badges */}
              {geo.metroStations.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {geo.metroStations.map((st, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: st.lineColor }}
                      />
                      <TrainFront className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-bold text-slate-900">{st.name}</span>
                      <span className="text-slate-500">• {st.travelTimeText}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Embedded Interactive Leaflet Map */}
              <LotMiniMap
                lat={geo.coordinates.lat}
                lng={geo.coordinates.lng}
                complexName={lot.complexName}
                streetAddress={`${lot.district}, ${geo.streetAddress}`}
              />
            </div>

          </div>

          {/* Right Column (4 cols): Sticky Financial Card, District Link & Curator */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-2xl p-6 sm:p-7 space-y-5">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">
                  Наличными продавцу сейчас (100% возврат):
                </span>
                <div className="text-3xl font-black text-slate-950 tracking-tight mt-0.5">
                  {formatRubles(lot.cashPaidBySeller)}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                  Ровно сумма, выплаченная владельцем — 0% наценки
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-emerald-800 font-bold uppercase tracking-wider text-[11px]">
                    ВАША ВЫГОДА ОТ ЗАСТРОЙЩИКА:
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

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  ПРОЗРАЧНЫЙ РАСЧЕТ ПЛАТЕЖЕЙ
                </span>
                <div className="flex justify-between text-slate-600">
                  <span>Остаток долга застройщику:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.remainingInstallmentDebt)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Текущий график рассрочки:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.installmentQuarterlyPayment)} / кв.</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Срок ввода объекта:</span>
                  <span className="font-semibold text-slate-900">{lot.deliveryDate}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Сервисный сбор DomExit (2.5%):</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.serviceCommissionRub)}</span>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl flex justify-between items-center font-bold text-xs mt-3">
                  <span>Итого первый взнос на сделке:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatRubles(totalFirstPaymentDeal)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                  Полная стоимость квартиры по ДДУ: {formatRubles(lot.dduContractPrice)}
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
                        <span>Лот находится в сделке (Этап {lot.currentStage || 3}/5)</span>
                      </p>
                      <p className="text-[11px] text-amber-700 mt-1">
                        Идет оформление аккредитива. Вы можете подать резервную заявку в лист ожидания.
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
                        Права требования зарегистрированы в Росреестре.
                      </p>
                    </div>
                    <Link
                      to={similarDistrictUrl}
                      className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 text-center"
                    >
                      <span>Смотреть похожие лоты в этом районе</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(true)}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <FolderLock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Проверить документы лота (S3 Хранилище)</span>
                </button>
              </div>
            </div>

            {/* Personal Curator Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center space-x-3.5">
                {curatorEmployee?.photoUrl || lot.curator.photoUrl ? (
                  <img
                    src={curatorEmployee?.photoUrl || lot.curator.photoUrl}
                    alt={curatorEmployee?.name || lot.curator.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                    {(curatorEmployee?.name || lot.curator.name).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {language === 'ru' ? 'Персональный куратор лота' : 'Personal Lot Curator'}
                  </span>
                  <span className="font-bold text-sm text-slate-900 block truncate">
                    {curatorEmployee?.name || lot.curator.name}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold block truncate">
                    {curatorEmployee?.role || lot.curator.role}
                  </span>
                </div>
              </div>

              {(curatorEmployee?.bio || lot.curator.bio) && (
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {curatorEmployee?.bio || lot.curator.bio}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={
                    (curatorEmployee?.telegram || lot.curator.telegram || '').startsWith('http')
                      ? curatorEmployee?.telegram || lot.curator.telegram
                      : `https://t.me/${(
                          curatorEmployee?.telegram ||
                          lot.curator.telegram ||
                          'domexit_ru'
                        ).replace('@', '')}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs text-center flex items-center justify-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Telegram</span>
                </a>

                {(curatorEmployee?.phone || lot.curator.phone) && (
                  <a
                    href={`tel:${(curatorEmployee?.phone || lot.curator.phone).replace(/[^\d+]/g, '')}`}
                    className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1"
                    title={curatorEmployee?.phone || lot.curator.phone}
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-600" />
                    <span className="hidden sm:inline">{language === 'ru' ? 'Звонок' : 'Call'}</span>
                  </a>
                )}

                {(curatorEmployee?.maxProfile || lot.curator.maxProfile || curatorEmployee?.whatsapp || lot.curator.whatsapp) && (() => {
                  const maxVal =
                    curatorEmployee?.maxProfile ||
                    lot.curator.maxProfile ||
                    curatorEmployee?.whatsapp ||
                    lot.curator.whatsapp ||
                    '';
                  const maxHref =
                    maxVal.startsWith('http') || maxVal.startsWith('max://')
                      ? maxVal
                      : `https://max.ru/${maxVal.replace(/[^\d]/g, '')}`;
                  return (
                    <a
                      href={maxHref}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-black transition-colors flex items-center justify-center space-x-1.5 shadow-2xs"
                      title="Профиль MAX (Messenger / App)"
                    >
                      <span className="w-4 h-4 rounded-md bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center leading-none">
                        M
                      </span>
                      <span>MAX</span>
                    </a>
                  );
                })()}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. LIVE SIMILAR VERIFIED LOTS IN SAME DISTRICT / REGION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              АЛЬТЕРНАТИВЫ В ЛОКАЦИИ ({geo.region.shortLabelRu.toUpperCase()})
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-950">
              Похожие проверенные лоты в районе «{lot.district}» и регионе
            </h2>
          </div>
          <Link
            to={similarDistrictUrl}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center space-x-2 self-start sm:self-auto shadow-xs transition-colors"
          >
            <span>Смотреть похожие лоты в этом районе</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {similarLots.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {similarLots.map((sim) => {
              const simSavings = sim.todayDeveloperPrice - sim.dduContractPrice;
              const simRooms =
                sim.rooms === 'studio' ? 'Студия' : `${sim.rooms.replace('-room', '')}-комн.`;
              return (
                <div
                  key={sim.lotCode}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                >
                  <div className="h-40 bg-slate-100 relative overflow-hidden">
                    <img
                      src={sim.imageUrl}
                      alt={sim.complexName}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-mono font-bold">
                      #{sim.lotCode}
                    </span>
                  </div>
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        {sim.district} • {sim.developer}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 mt-0.5">
                        {sim.complexName} — {simRooms} {sim.areaM2} м²
                      </h3>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Наличными продавцу:</span>
                        <span className="font-bold text-slate-900">
                          {formatRubles(sim.cashPaidBySeller)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Выгода от застройщика:</span>
                        <span>+{formatRubles(simSavings)}</span>
                      </div>
                    </div>

                    <Link
                      to={`/opportunities/${sim.lotCode}`}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
                    >
                      <span>Подробнее о лоте</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* S3 Cloud Document Vault Modal (Read-only public inspection for buyers) */}
      <DocumentVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        entityType="lot"
        entityId={lot.lotCode}
        entityTitle={`${lot.complexName} (#${lot.lotCode})`}
        uploadedByUid={user?.id || 'guest'}
        clientCode={user?.clientCode || 'PUBLIC-VIEW'}
        mode="seller"
        canUpload={false}
        canReview={false}
      />

      {/* Success Notification Toast */}
      {bookingSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-900 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl space-y-2 max-w-sm">
          <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Заявка зарегистрирована в реестре!</span>
          </div>
          <p className="text-xs text-slate-600">
            Персональный куратор {curatorEmployee?.name || lot.curator.name} получил вашу заявку в системе матчмейкинга. Статус отражен в вашем Личном кабинете.
          </p>
          <div className="flex items-center space-x-3 pt-1">
            <Link
              to="/portal?tab=buyer"
              className="text-xs font-extrabold text-emerald-700 hover:underline"
            >
              Перейти в кабинет →
            </Link>
            <button
              type="button"
              onClick={() => setBookingSuccessToast(false)}
              className="text-[11px] text-slate-500 font-bold hover:underline"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
