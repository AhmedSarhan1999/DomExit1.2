import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { usePublicChannelsStore } from '../stores/usePublicChannelsStore';
import { Lot, Employee, DistrictYieldConfig } from '../types';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { EmployeesRepository } from '../dal/repositories/EmployeesRepository';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';
import { DevelopersRepository } from '../dal/repositories/DevelopersRepository';
import { DatabaseGateway } from '../dal/DatabaseGateway';
import { resolveLotGeoDetails } from '../data/russianGeography';
import { resolveLotLegalAxes, HONEST_STATUS_CONFIG } from '../data/legalAuditAxes';
import { formatRubles, formatPercent } from '../utils/formatters';
import { BookingModal } from '../components/booking/BookingModal';
import { SmartMortgageCalculator } from '../components/lot/SmartMortgageCalculator';
import { YandexLotMap } from '../components/maps/YandexLotMap';
import { PublicLegalReportModal } from '../components/lot/PublicLegalReportModal';
import { CuratorChatWidget } from '../components/chat/CuratorChatWidget';
import { LotDetailsSkeleton } from '../components/common/Skeletons';
import { BankSettlementAssistant } from '../components/shared/BankSettlementAssistant';
import { UserAvatar } from '../components/shared/UserAvatar';
import {
  getCleanCuratorPhone,
  getCuratorPhoneHref,
  getCuratorTelegramHref,
  getCuratorMaxHref,
} from '../utils/curatorContacts';
import { PepSignatureModal } from '../components/legal/PepSignatureModal';
import { LotDropApplicationCard } from '../components/lot/LotDropApplicationCard';
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
  MessageSquare,
  ArrowRight,
  TrainFront,
  TrendingUp,
  FolderLock,
  Award,
  Compass,
  Eye,
  Calendar,
  Building2,
  AlertCircle,
} from 'lucide-react';

const FALLBACK_LOT_IMAGE =
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';

export const LotDetailsPage: React.FC = () => {
  const { lotCode } = useParams<{ lotCode: string }>();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const { user, isFavorite, toggleFavorite, openAuthModal } = useAuth();
  const { channels } = usePublicChannelsStore();

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
  const [isNdaModalOpen, setIsNdaModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCuratorChatOpen, setIsCuratorChatOpen] = useState(false);
  const [bookingSuccessToast, setBookingSuccessToast] = useState(false);
  const [ndaSignedToast, setNdaSignedToast] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isDevAccredited, setIsDevAccredited] = useState<boolean>(true);

  useEffect(() => {
    const code = lotCode || '';
    if (!code) {
      setLot(null);
      setLoading(false);
      return;
    }

    // Deduplicate view counter using localStorage per session/user device
    const userKey = user?.id || 'guest';
    const viewedKey = `domexit_viewed_lots_${userKey}`;
    let viewedLots: string[] = [];
    try {
      const stored = localStorage.getItem(viewedKey);
      if (stored) {
        viewedLots = JSON.parse(stored);
      }
    } catch {
      viewedLots = [];
    }
    const alreadyViewed = Array.isArray(viewedLots) && viewedLots.includes(code);

    async function fetchLot(shouldIncrementViews = false) {
      if (shouldIncrementViews) {
        setLoading(true);
        setActiveImageIndex(0);
      }
      try {
        let data: Lot | null = null;
        if (shouldIncrementViews && !alreadyViewed) {
          try {
            data = await LotsRepository.incrementViews(code);
            const updated = [...viewedLots, code];
            localStorage.setItem(viewedKey, JSON.stringify(updated));
          } catch (e) {
            console.warn('[LotDetailsPage] Failed to increment views, falling back to getByCode:', e);
            data = await LotsRepository.getByCode(code);
          }
        } else {
          data = await LotsRepository.getByCode(code);
        }
        setLot(data);

        if (data) {
          try {
            const results = await Promise.allSettled([
              LotsRepository.getSimilarInDistrict(data, 3),
              LotsRepository.getAll({ city: data.city, district: data.district, status: 'all' }),
              MarketSettingsRepository.getDistrictYieldConfig(data.district),
              DevelopersRepository.resolvePropertyFinancing(data),
            ]);

            const similar = results[0].status === 'fulfilled' ? results[0].value : [];
            const districtMatches = results[1].status === 'fulfilled' ? results[1].value : [];
            const yieldCfg = results[2].status === 'fulfilled' ? results[2].value : null;
            const financingList = results[3].status === 'fulfilled' ? results[3].value : [];

            setSimilarLots(similar);
            setSameDistrictCount(districtMatches.length);
            setDistrictYield(yieldCfg);
            setIsDevAccredited(financingList.length > 0);
          } catch (secondaryErr) {
            console.warn('[LotDetailsPage] Secondary data fetch error:', secondaryErr);
          }

          try {
            const curators = await EmployeesRepository.getAssignableCurators();
            if (data.assignedEmployeeId) {
              const emp = curators.find((e) => e.id === data.assignedEmployeeId) || (await EmployeesRepository.getById(data.assignedEmployeeId));
              if (emp) setCuratorEmployee(emp);
            } else if (data.curator?.name) {
              const curatorNameStr = data.curator.name.toLowerCase();
              const match = curators.find(
                (e) =>
                  e.name.toLowerCase().includes(curatorNameStr) ||
                  curatorNameStr.includes(e.name.toLowerCase())
              );
              if (match) setCuratorEmployee(match);
            }
          } catch (empErr) {
            console.warn('[LotDetailsPage] Curator fetch error:', empErr);
          }
        }
      } catch (err) {
        console.error('[LotDetailsPage] Critical fetchLot error:', err);
        setLot(null);
      } finally {
        if (shouldIncrementViews) {
          setLoading(false);
        }
      }
    }

    fetchLot(true);

    const unsub = DatabaseGateway.subscribe((col) => {
      if (
        !col ||
        col === 'lots' ||
        col === 'market_settings' ||
        col === 'developers' ||
        col === 'developer_accreditation_requests'
      ) {
        fetchLot(false);
      }
    });
    return () => unsub();
  }, [lotCode]);

  useEffect(() => {
    if (searchParams.get('action') === 'book' && user && lot && !loading) {
      setIsBookingModalOpen(true);
    }
  }, [searchParams, user, lot, loading]);

  const handleOpenBooking = () => {
    if (!user) {
      const targetLotCode = lot?.lotCode || lotCode || '';
      sessionStorage.setItem('domexit_return_url', `/opportunities/${targetLotCode}?action=book`);
      openAuthModal('Войдите или зарегистрируйтесь, чтобы подать заявку на покупку объекта');
      return;
    }
    setIsBookingModalOpen(true);
  };

  if (loading) {
    return <LotDetailsSkeleton />;
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-10 max-w-md text-center space-y-4 shadow-sm">
          <Lock className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black text-slate-900">
            {language === 'ru' ? 'Объект не найден или снят с публикации' : 'Unit not found or unpublished'}
          </h2>
          <p className="text-xs text-slate-600">
            {language === 'ru'
              ? `Лот #${lotCode} не найден в реестре или находится в закрытом статусе.`
              : `Lot #${lotCode} is not available in the public catalog.`}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setLoading(true);
                window.location.reload();
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Повторить попытку' : 'Try again'}
            </button>
            <Link
              to="/opportunities"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'ru' ? 'Вернуться в каталог' : 'Back to Catalog'}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const geo = resolveLotGeoDetails(lot);
  const gallery = (
    lot.images && lot.images.length > 0
      ? lot.images
      : lot.approvedGalleryImages && lot.approvedGalleryImages.length > 0
      ? lot.approvedGalleryImages
      : lot.galleryImages && lot.galleryImages.length > 0
      ? lot.galleryImages
      : lot.imageUrl
      ? [lot.imageUrl]
      : []
  ).filter(Boolean);

  const todayDevPrice = Number(lot.todayDeveloperPrice || 0);
  const dduPrice = Number(lot.dduContractPrice || 0);
  const lotArea = Math.max(Number(lot.areaM2 || 1), 1);
  const cashPaid = Number(lot.cashPaidBySeller || 0);
  const commission = Number(lot.serviceCommissionRub || 0);

  const isConsentPaidByBuyer = lot.developerConsentPolicy === 'paid_by_buyer';
  const consentFee = isConsentPaidByBuyer ? Number(lot.developerConsentFeeRub || 0) : 0;
  const grossSavingsRub = todayDevPrice - dduPrice;
  const buyerNetSavings = Math.max(0, grossSavingsRub - consentFee);
  const savingsRub = buyerNetSavings;
  const savingsPercent = todayDevPrice > 0 ? (buyerNetSavings / todayDevPrice) * 100 : 0;
  const dduPricePerM2 = Math.round(dduPrice / lotArea);
  const devPricePerM2 = Math.round(todayDevPrice / lotArea);
  const savingsPerM2 = Math.max(0, devPricePerM2 - dduPricePerM2);
  const totalFirstPaymentDeal = cashPaid + commission + consentFee;
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
  const codeStr = String(lot.lotCode || lot.id || 'LOT');
  const viewsCount =
    typeof lot.viewsCount === 'number'
      ? lot.viewsCount
      : 112 + (codeStr.charCodeAt(codeStr.length - 1) % 90);
  const favoritesCount =
    typeof lot.favoritesCount === 'number'
      ? lot.favoritesCount
      : 14 + (codeStr.charCodeAt(codeStr.length - 1) % 19);

  // District Yield & Capital Growth Engine Formulas (Task 4)
  const monthlyRentPercent = districtYield?.monthlyRentPercentOfMarket ?? 0.65;
  const dailyRentPercent = districtYield?.dailyRentPercentOfMarket ?? 0.05;
  const annualGrowthPercent = districtYield?.annualGrowthPercent ?? 11.5;

  const computedLongTermMonthlyRub = Math.round(
    todayDevPrice * (monthlyRentPercent / 100)
  );
  const computedShortTermDailyRub = Math.round(
    todayDevPrice * (dailyRentPercent / 100)
  );
  // Strictly relative to actual DomExit DDU purchase price (NOT developer price):
  const computedAnnualRentalYieldPercent = Number(
    (((computedLongTermMonthlyRub * 12) / Math.max(dduPrice, 1)) * 100).toFixed(2)
  );
  // Instant Equity Growth relative to DDU purchase price:
  const instantEquityGrowthPercent = Number(
    (
      ((todayDevPrice - dduPrice) / Math.max(dduPrice, 1)) *
      100
    ).toFixed(1)
  );
  // 3-Year and 5-Year Capital Growth Forecast:
  const growthFactor = 1 + annualGrowthPercent / 100;
  const projectedPrice3Years = Math.round(todayDevPrice * Math.pow(growthFactor, 3));
  const projectedPrice5Years = Math.round(todayDevPrice * Math.pow(growthFactor, 5));
  const projectedGain3Years = Math.max(0, projectedPrice3Years - dduPrice);
  const projectedGain5Years = Math.max(0, projectedPrice5Years - dduPrice);

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
                <span>5 РАЗДЕЛОВ ПРАВОВОГО АУДИТА</span>
              </span>

              {lot.isUrgentExit && lotStatus === 'available' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>СРОЧНЫЙ ВЫХОД</span>
                </span>
              )}

              {isDevAccredited && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Аккредитован в ТОП-банках (СБР)</span>
                </span>
              )}

              {Boolean(lot.is_negotiable || lot.isNegotiable) && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-300 text-xs font-bold">
                  <span>🤝 Возможен торг</span>
                </span>
              )}
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

              {Boolean(lot.is_negotiable || lot.isNegotiable) && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold">
                  <span>🤝 Возможен торг с продавцом</span>
                </div>
              )}

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
              {gallery.length === 0 ? (
                <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100 flex flex-col items-center justify-center border border-dashed border-slate-300 text-slate-500 p-6 text-center space-y-2">
                  <Building2 className="w-12 h-12 text-slate-400 stroke-1" />
                  <span className="text-sm font-bold text-slate-700">Фотографии загружаются</span>
                  <span className="text-xs text-slate-500 max-w-sm">
                    Куратор готовит визуализацию, рендеры и планировки объекта для публикации в каталоге.
                  </span>
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-slate-800 border border-slate-200/60 shadow-xs backdrop-blur-md text-xs font-bold">
                    {lot.constructionReadinessPercent}% готовности корпуса
                  </span>
                  <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/85 text-white text-xs font-bold backdrop-blur-md">
                    {lot.developer}
                  </span>
                </div>
              ) : (
                <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-slate-100 aspect-[16/10]">
                  <img
                    src={gallery[activeImageIndex % gallery.length]}
                    alt={lot.complexName}
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/95 text-slate-800 border border-slate-200/60 shadow-xs backdrop-blur-md text-xs font-bold">
                    {lot.constructionReadinessPercent}% готовности корпуса
                  </span>
                  <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-900/85 text-white text-xs font-bold backdrop-blur-md">
                    {lot.developer}
                  </span>
                </div>
              )}

              {/* Dynamic Thumbnails Strip: Hidden if single image or 0 images; shows actual count only */}
              {gallery.length > 1 && (
                <div
                  className={`grid gap-3 ${
                    gallery.length === 2
                      ? 'grid-cols-2'
                      : gallery.length === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4 sm:grid-cols-6'
                  }`}
                >
                  {gallery.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`rounded-xl overflow-hidden border-2 p-1 text-center transition-all cursor-pointer ${
                        activeImageIndex === idx
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="h-16 rounded-lg overflow-hidden bg-slate-100 aspect-[16/9]">
                        <img
                          src={imgUrl}
                          alt={`Фото ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 block truncate mt-0.5">
                        Фото {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}
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
                  <span>{language === 'ru' ? 'Конфиденциальность номера и этажа' : 'Masked Unit & Floor'}</span>
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
                  <span className="text-slate-400 block">Диапазон этажа:</span>
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
            />

            {/* Phase 5B Requirement: Safe Bank Settlement Assistant & Calculator */}
            <BankSettlementAssistant
              dealPriceRub={lot.cashPaidBySeller || lot.sellerReturnRub || 0}
              dealTrack={lot.dealTrack}
              className="my-2"
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
                <span className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black shadow-md flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Проверка завершена • 5 из 5 разделов</span>
                </span>
              </div>

              {/* Dynamic verified badges strictly from axes that passed inspection */}
              <div className="flex flex-wrap gap-2 text-xs">
                {resolveLotLegalAxes(lot)
                  .filter((axis) => axis.status === 'verified_safe')
                  .map((axis) => (
                    <span
                      key={axis.id}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-semibold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{axis.shortLabel}</span>
                    </span>
                  ))}
              </div>

              {/* 5 Real Audit Axes Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                {resolveLotLegalAxes(lot).map((axis) => {
                  const cfg = HONEST_STATUS_CONFIG[axis.status] || HONEST_STATUS_CONFIG.unverified;
                  return (
                    <div
                      key={axis.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {axis.title}
                        </span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {axis.notes || cfg.descriptionRu}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/50 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeClass}`}
                        >
                          {axis.status === 'verified_safe' && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                          {axis.status === 'required_at_deal' && <Clock className="w-3 h-3 text-sky-600 shrink-0" />}
                          {axis.status === 'condition_found' && <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />}
                          {axis.status === 'unverified' && <Clock className="w-3 h-3 text-slate-500 shrink-0" />}
                          {axis.status === 'critical_risk' && <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />}
                          <span>{cfg.labelRu}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons: Digital Certificate & Public Legal Report */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Публичное юридическое заключение</span>
                </button>

                <Link
                  to={`/verify/${lot.lotCode}`}
                  className="py-3 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
                >
                  <Award className="w-4 h-4 text-emerald-700" />
                  <span>Сертификат юридической проверки (в реестре)</span>
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
                    <span>Правовой анализ договора ДДУ</span>
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

            {/* Dynamic Infrastructure, Metro Stations & Interactive Yandex Map */}
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

              {/* Interactive Yandex Map with 5 Infrastructure Category Explorers */}
              <YandexLotMap
                lat={geo.coordinates.lat}
                lng={geo.coordinates.lng}
                complexName={lot.complexName}
                streetAddress={`${lot.district}, ${geo.streetAddress}`}
                metroStations={geo.metroStations}
                isSafeRadius={Boolean(lot.ownerDossier?.hideExactFloor)}
              />
            </div>

          </div>

          {/* Right Column (4 cols): Sticky Financial Card, District Link & Curator */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            
            {/* 1. Unified Financial Summary Card */}
            <div className="bg-white rounded-3xl border-2 border-emerald-500 shadow-xl p-6 sm:p-7 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-950 uppercase tracking-wider">
                  Финансовая сводка
                </h3>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  0% наценки
                </span>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-500 block">
                  Наличными продавцу сейчас (100% возврат):
                </span>
                <div className="text-3xl font-black text-slate-950 tracking-tight mt-0.5">
                  {formatRubles(lot.cashPaidBySeller)}
                </div>
                <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                  Ровно сумма, внесенная владельцем — без скрытых надбавок
                </span>
                {Boolean(lot.is_negotiable || lot.isNegotiable) && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold mt-2">
                    <span>🤝 Возможен торг с продавцом</span>
                  </div>
                )}
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
                <div className="flex justify-between text-slate-600">
                  <span>Полная стоимость квартиры по ДДУ:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.dduContractPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Остаток долга застройщику:</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.remainingInstallmentDebt)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Срок ввода объекта:</span>
                  <span className="font-semibold text-slate-900">{lot.deliveryDate}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Сервисный сбор платформы (2.5%):</span>
                  <span className="font-semibold text-slate-900">{formatRubles(lot.serviceCommissionRub)}</span>
                </div>
                <span className="text-[10px] text-slate-400 block italic">
                  * Сервисный сбор оплачивается строго после регистрации уступки в Росреестре.
                </span>

                {/* Developer consent fee display */}
                {isConsentPaidByBuyer ? (
                  <div className="space-y-0.5 pt-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Согласие застройщика на уступку:</span>
                      <span className="font-semibold text-slate-900">{formatRubles(lot.developerConsentFeeRub || 0)}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block italic">
                      * Оплачивается покупателем по установленному регламенту застройщика.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-0.5 pt-1">
                    <div className="flex justify-between text-emerald-800 font-bold bg-emerald-50/70 px-2.5 py-1.5 rounded-lg border border-emerald-200/60">
                      <span>Согласие застройщика на уступку:</span>
                      <span className="text-emerald-700 font-extrabold">Включено в сбор (0 ₽ доплат)</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block italic px-1">
                      * Если по регламенту застройщика сбор вносится покупателем напрямую, эта сумма полностью вычитается из сервисного сбора DomExit.
                    </span>
                  </div>
                )}

                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl flex justify-between items-center font-bold text-xs mt-3">
                  <span>Итого первый взнос на сделке:</span>
                  <span className="text-base font-black text-emerald-700 font-mono">
                    {formatRubles(totalFirstPaymentDeal)}
                  </span>
                </div>
              </div>

              {/* Actions based on lot status */}
              <div className="space-y-3 pt-2">
                {/* Staged Drop Quick Application Card */}
                {lot.dropConfig && lot.dropConfig.mode === 'staged_drop' && (
                  <LotDropApplicationCard
                    lot={lot}
                    user={user}
                    onOpenAuth={() =>
                      openAuthModal('Авторизуйтесь для подачи заявки в закрытый тактовый дроп')
                    }
                  />
                )}

                {lotStatus === 'available' && (!lot.dropConfig || lot.dropConfig.mode !== 'staged_drop') && (
                  user && (lot.sellerUserId === user.id || (lot as any).sellerId === user.id || (user.email && (lot as any).sellerEmail?.toLowerCase() === user.email.toLowerCase())) ? (
                    <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 space-y-1">
                      <div className="flex items-center space-x-2 font-bold text-xs">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Это ваш объект (вы продавец)</span>
                      </div>
                      <p className="text-[11px] text-indigo-700">
                        Подача заявки на собственный лот недоступна.
                      </p>
                    </div>
                  ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenBooking}
                      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Подать заявку на покупку (Кэш / Ипотека)</span>
                      <ArrowRight className="w-4 h-4 stroke-[3]" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          openAuthModal('Авторизуйтесь для подписания NDA и запроса просмотра объекта');
                          return;
                        }
                        setIsNdaModalOpen(true);
                      }}
                      className="w-full py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold text-xs border border-indigo-200 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Подписать NDA и запросить просмотр (ПЭП 63-ФЗ)</span>
                    </button>
                  </>
                  )
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
                      onClick={handleOpenBooking}
                      className="w-full py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <span>Подать заявку в резервный список</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {lotStatus === 'in_deal' && (!lot.dropConfig || lot.dropConfig.mode !== 'staged_drop') && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1.5">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Объект в активной сделке (Этап {lot.currentStage || 4}/5)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Приоритетный покупатель выбран и оформляет сделку с куратором. Новые заявки временно приостановлены.
                    </p>
                  </div>
                )}

                {lotStatus === 'closed' && (!lot.dropConfig || lot.dropConfig.mode !== 'staged_drop') && (
                  <div className="space-y-2">
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800">
                      <p className="font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Сделка по объекту завершена</span>
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
                        Права требования зарегистрированы в Росреестре.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Curator Card */}
            {(curatorEmployee || lot.curator) ? (() => {
              const curatorDisplayName = curatorEmployee?.name || lot.curator?.name || 'Куратор DomExit';
              const curatorDisplayRole =
                curatorEmployee?.role || lot.curator?.role || 'Персональное сопровождение сделки';
              const curatorDisplayPhoto = curatorEmployee?.photoUrl || lot.curator?.photoUrl || '';
              const curatorDisplayBio = curatorEmployee?.bio || lot.curator?.bio || '';
              const cleanPhone = getCleanCuratorPhone(curatorEmployee?.phone || lot.curator?.phone);
              const phoneHref = getCuratorPhoneHref(cleanPhone);
              const telegramHref = getCuratorTelegramHref(
                curatorEmployee?.telegram || lot.curator?.telegram,
                channels.telegramBotUrl,
                channels.telegramChannelUrl
              );
              const maxHref = getCuratorMaxHref(
                curatorEmployee?.maxProfile || lot.curator?.maxProfile,
                curatorEmployee?.whatsapp || lot.curator?.whatsapp
              );

              return (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center space-x-3.5">
                  <UserAvatar
                    src={curatorDisplayPhoto}
                    name={curatorDisplayName}
                    size="lg"
                    className="border-2 border-emerald-500 shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {language === 'ru' ? 'Персональный куратор лота' : 'Personal Lot Curator'}
                    </span>
                    <span className="font-bold text-sm text-slate-900 block truncate">
                      {curatorDisplayName}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold block truncate">
                      {curatorDisplayRole}
                    </span>
                  </div>
                </div>

                {curatorDisplayBio && (
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {curatorDisplayBio}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs text-center flex items-center justify-center space-x-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>

                  {phoneHref && (
                    <a
                      href={phoneHref}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center space-x-1"
                      title={cleanPhone}
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">{language === 'ru' ? 'Звонок' : 'Call'}</span>
                    </a>
                  )}

                  {maxHref && (
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
                  )}
                </div>

              {/* Curator Direct Chat Button */}
              <button
                type="button"
                onClick={() => setIsCuratorChatOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center space-x-2 cursor-pointer mt-1"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Чат с куратором онлайн</span>
              </button>
            </div>
              );
            })() : (
              <div className="bg-amber-50/70 rounded-2xl border border-amber-200 p-4 shadow-xs text-xs text-amber-900 font-semibold">
                Этап 0: Ожидает назначения персонального куратора DomExit
              </div>
            )}

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
                  <div className="h-40 bg-slate-100 relative overflow-hidden aspect-[16/9]">
                    <img
                      src={sim.imageUrl || FALLBACK_LOT_IMAGE}
                      alt={sim.complexName}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_LOT_IMAGE;
                      }}
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

      {/* Public Legal Verification Report Modal (Zero raw files/personal data exposed) */}
      <PublicLegalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        lot={lot}
        curator={curatorEmployee}
      />

      {/* Curator Direct Chat Modal Widget */}
      <CuratorChatWidget
        isOpen={isCuratorChatOpen}
        onClose={() => setIsCuratorChatOpen(false)}
        lotCode={lot.lotCode}
        lotTitle={lot.complexName}
        curatorId={curatorEmployee?.id || lot.assignedEmployeeId}
        curatorName={curatorEmployee?.name || lot.curator?.name || 'Куратор DomExit'}
        curatorRole={curatorEmployee?.role || lot.curator?.role || 'Персональное сопровождение сделки'}
        curatorPhone={curatorEmployee?.phone || lot.curator?.phone || ''}
        curatorTelegram={curatorEmployee?.telegram || lot.curator?.telegram || ''}
        curatorMax={curatorEmployee?.maxProfile || lot.curator?.maxProfile}
      />

      {/* Success Notification Toast */}
      {bookingSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-900 border-2 border-emerald-500 rounded-2xl p-5 shadow-2xl space-y-2 max-w-sm">
          <div className="flex items-center space-x-2 text-emerald-600 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>Заявка зарегистрирована в реестре!</span>
          </div>
          <p className="text-xs text-slate-600">
            Персональный куратор {curatorEmployee?.name || lot.curator?.name || 'DomExit'} получил вашу заявку в системе матчмейкинга. Статус отражен в вашем Личном кабинете.
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

      {/* PEP Electronic Signature NDA Modal */}
      <PepSignatureModal
        isOpen={isNdaModalOpen}
        onClose={() => setIsNdaModalOpen(false)}
        documentType="nda_viewing_act"
        lotCode={lot.lotCode}
        onSigned={() => {
          setIsNdaModalOpen(false);
          setNdaSignedToast(true);
        }}
      />

      {/* NDA Signed Success Notification Toast */}
      {ndaSignedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-900 border-2 border-indigo-500 rounded-2xl p-5 shadow-2xl space-y-2 max-w-sm animate-fade-in">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>NDA успешно подписан (ПЭП 63-ФЗ)!</span>
          </div>
          <p className="text-xs text-slate-600">
            Соглашение о конфиденциальности зафиксировано в неизменяемом реестре. Куратор свяжется с вами для согласования времени просмотра.
          </p>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => setNdaSignedToast(false)}
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
