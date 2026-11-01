import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Lot } from '../types';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { RUSSIAN_REGIONS, getDistrictsForRegion, getRegionByCode } from '../data/russianGeography';
import { LotCard } from '../components/catalog/LotCard';
import { CatalogMapView } from '../components/catalog/CatalogMapView';
import { AdvancedFilterDrawer } from '../components/catalog/AdvancedFilterDrawer';
import { QuickMatchModal } from '../components/catalog/QuickMatchModal';
import {
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Flame,
  Key,
  Wallet,
  Building,
  RotateCcw,
  Zap,
  Send,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
} from 'lucide-react';

export const OpportunitiesPage: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCity = searchParams.get('city') || 'all';
  const initialDistrict = searchParams.get('district') || 'all';
  const initialView = searchParams.get('view') === 'map' ? 'map' : 'grid';

  const [allRegistryLots, setAllRegistryLots] = useState<Lot[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialDistrict);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>(initialView);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'processing' | 'closed'>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isQuickMatchOpen, setIsQuickMatchOpen] = useState<boolean>(false);

  // Dynamic Adaptive Pagination State
  const [pageSize, setPageSize] = useState<12 | 24 | 48>(12);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loadedExtraPages, setLoadedExtraPages] = useState<number>(0);

  // Active drawer filter state
  const [appliedFilters, setAppliedFilters] = useState<any>({});

  const isVipInvestor = !!(
    user?.isInvestorApproved ||
    user?.role === 'admin' ||
    user?.role === 'curator' ||
    user?.activeRole === 'owner' ||
    user?.activeRole === 'employee'
  );

  // Sync URL query params -> state when navigated from LotDetailsPage ("Смотреть похожие лоты в этом районе")
  useEffect(() => {
    const paramCity = searchParams.get('city') || 'all';
    const paramDistrict = searchParams.get('district') || 'all';
    if (paramCity !== selectedCity || paramDistrict !== selectedDistrict) {
      setSelectedCity(paramCity);
      setSelectedDistrict(paramDistrict);
      loadLots(appliedFilters, searchQuery, activeQuickFilter, statusFilter, paramCity, paramDistrict);
    }
  }, [searchParams]);

  const syncUrlParams = (cityVal: string, districtVal: string, viewVal: 'grid' | 'map' = viewMode) => {
    const next = new URLSearchParams();
    if (cityVal && cityVal !== 'all') next.set('city', cityVal);
    if (districtVal && districtVal !== 'all') next.set('district', districtVal);
    if (viewVal === 'map') next.set('view', 'map');
    setSearchParams(next, { replace: true });
  };

  const loadLots = async (
    customFilter = appliedFilters,
    search = searchQuery,
    quick = activeQuickFilter,
    status = statusFilter,
    city = selectedCity,
    district = selectedDistrict
  ) => {
    setLoading(true);

    // Fetch full live registry for accurate KPI & status counters
    const baseline = await LotsRepository.getAll({ status: 'all', isVipInvestor });
    setAllRegistryLots(baseline);

    const filterObj: any = {
      ...customFilter,
      searchQuery: search,
      status,
      isVipInvestor,
      city: city !== 'all' ? city : customFilter.city,
      district: district !== 'all' ? district : customFilter.district,
    };

    if (quick === 'urgent') filterObj.urgentOnly = true;
    if (quick === 'ready2026') filterObj.readyYear = 2026;
    if (quick === 'under3m') filterObj.maxCash = 3000000;

    const data = await LotsRepository.getAll(filterObj);
    setLots(data);
    setCurrentPage(1);
    setLoadedExtraPages(0);
    setLoading(false);
  };

  useEffect(() => {
    loadLots();
  }, [user]);

  const handleCityChange = (nextCity: string) => {
    setSelectedCity(nextCity);
    setSelectedDistrict('all');
    syncUrlParams(nextCity, 'all');
    loadLots(appliedFilters, searchQuery, activeQuickFilter, statusFilter, nextCity, 'all');
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setSelectedDistrict(nextDistrict);
    syncUrlParams(selectedCity, nextDistrict);
    loadLots(appliedFilters, searchQuery, activeQuickFilter, statusFilter, selectedCity, nextDistrict);
  };

  const handleViewModeChange = (mode: 'grid' | 'map') => {
    setViewMode(mode);
    syncUrlParams(selectedCity, selectedDistrict, mode);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    loadLots(appliedFilters, q, activeQuickFilter, statusFilter, selectedCity, selectedDistrict);
  };

  const handleQuickFilterClick = (filterKey: string) => {
    setActiveQuickFilter(filterKey);
    loadLots(appliedFilters, searchQuery, filterKey, statusFilter, selectedCity, selectedDistrict);
  };

  const handleStatusFilterClick = (statusKey: 'all' | 'available' | 'processing' | 'closed') => {
    setStatusFilter(statusKey);
    loadLots(appliedFilters, searchQuery, activeQuickFilter, statusKey, selectedCity, selectedDistrict);
  };

  const handleApplyDrawerFilters = (filters: any) => {
    const nextCity = filters.city || selectedCity;
    const nextDistrict = filters.district || (filters.city ? 'all' : selectedDistrict);
    setAppliedFilters(filters);
    syncUrlParams(nextCity, nextDistrict);
    loadLots(filters, searchQuery, activeQuickFilter, statusFilter, nextCity, nextDistrict);
  };

  const handleQuickMatchApply = (criteria: any) => {
    let maxCashVal = 15000000;
    if (criteria.cashLimit === '1.5m') maxCashVal = 2500000;
    if (criteria.cashLimit === '3m') maxCashVal = 3500000;
    if (criteria.cashLimit === '5m') maxCashVal = 5500000;

    const newFilters = {
      ...appliedFilters,
      maxCash: maxCashVal,
    };
    setAppliedFilters(newFilters);
    loadLots(newFilters, searchQuery, activeQuickFilter, statusFilter, selectedCity, selectedDistrict);
  };

  const handleResetAll = () => {
    setSearchQuery('');
    setActiveQuickFilter('all');
    setStatusFilter('all');
    setSelectedCity('all');
    setSelectedDistrict('all');
    setAppliedFilters({});
    syncUrlParams('all', 'all');
    loadLots({}, '', 'all', 'all', 'all', 'all');
  };

  // Live Registry Metrics
  const registryMetrics = useMemo(() => {
    const totalCount = allRegistryLots.length;
    const availableCount = allRegistryLots.filter((l) => (l.status || 'available') === 'available').length;
    const processingCount = allRegistryLots.filter((l) => l.status === 'processing').length;
    const closedCount = allRegistryLots.filter((l) => l.status === 'closed').length;
    const totalVolumeRub = allRegistryLots.reduce((acc, l) => acc + (l.dduContractPrice || 0), 0);
    const maxSavingsPct = allRegistryLots.reduce((max, l) => {
      if (!l.todayDeveloperPrice) return max;
      const pct = Math.round(((l.todayDeveloperPrice - l.dduContractPrice) / l.todayDeveloperPrice) * 100);
      return pct > max ? pct : max;
    }, 28);
    return {
      totalCount,
      availableCount,
      processingCount,
      closedCount,
      totalVolumeMillions: (totalVolumeRub / 1_000_000).toFixed(1),
      maxSavingsPct,
    };
  }, [allRegistryLots]);

  // Dynamic Adaptive Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(lots.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * pageSize;
  const endIdx = Math.min(lots.length, startIdx + pageSize * (1 + loadedExtraPages));
  const paginatedLots = lots.slice(startIdx, endIdx);
  const canLoadMore = endIdx < lots.length;

  const availableDistricts = selectedCity !== 'all' ? getDistrictsForRegion(selectedCity) : [];

  const activeFilterCount = [
    selectedCity !== 'all',
    selectedDistrict !== 'all',
    appliedFilters.maxCash,
    appliedFilters.maxMonthly,
    appliedFilters.minDiscount,
    appliedFilters.rooms,
    appliedFilters.urgentOnly,
    appliedFilters.deliveryYear && appliedFilters.deliveryYear !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Header & 4 Live Metric Cards */}
      <section className="bg-white text-slate-900 pt-10 pb-10 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'ru'
                    ? 'Верифицированный реестр переуступок 214-ФЗ • 7 регионов РФ'
                    : 'Verified 214-FZ Assignment Registry • 7 Russian Regions'}
                </span>
              </span>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                {language === 'ru'
                  ? 'Доступные возможности — переуступки ДДУ без наценки'
                  : 'Verified Opportunities: Clean DDU Assignments (0% Markup)'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                {language === 'ru'
                  ? 'Каждый лот прошел комплексную проверку по 42 параметрам. Покупка по цене старого договора ДДУ с защитой персональных данных 152-ФЗ.'
                  : 'Every property vetted by 42 parameters. Buy at original DDU contract price with 152-FZ privacy protection.'}
              </p>
            </div>

            {/* Prominent View Mode Toggle: Grid vs Interactive Map */}
            <div className="inline-flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ru' ? 'Вид сеткой' : 'Grid View'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('map')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                  viewMode === 'map'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ru' ? 'Интерактивная карта' : 'Interactive Map'}</span>
              </button>
            </div>
          </div>

          {/* 4 Live Registry Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {language === 'ru' ? 'ЛОТЫ В РЕЕСТРЕ' : 'LIVE REGISTRY UNITS'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
                {registryMetrics.totalCount}{' '}
                <span className="text-sm font-semibold text-slate-500">
                  {language === 'ru' ? 'объектов' : 'units'}
                </span>
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {language === 'ru'
                  ? `СПб, Москва, Сочи, Казань, ЕКБ, НСК, НН`
                  : '7 Major Russian Regions'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {language === 'ru' ? 'ОБЪЕМ АКТИВНОГО РЕЕСТРА' : 'VERIFIED ESCROW VOLUME'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
                {registryMetrics.totalVolumeMillions}{' '}
                <span className="text-sm font-semibold text-slate-500">
                  {language === 'ru' ? 'млн ₽' : 'M RUB'}
                </span>
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {language === 'ru' ? 'Проверенные счета эскроу 214-ФЗ' : 'Verified 214-FZ Escrow'}
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {language === 'ru' ? 'КОМИССИЯ ПРОДАВЦАМ' : 'SELLER COMMISSION'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1 block">
                0 ₽
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {language === 'ru' ? '100% возврат вложенного капитала' : '100% Seller Capital Return'}
              </span>
            </div>

            <div className="bg-emerald-50/80 text-emerald-950 border border-emerald-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                {language === 'ru' ? 'ЧИСТАЯ ВЫГОДА' : 'NET ADVANTAGE'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 block">
                до -{registryMetrics.maxSavingsPct}%
              </span>
              <span className="text-[11px] font-medium text-emerald-700 mt-0.5 block">
                {language === 'ru' ? 'От текущего прайса застройщика' : 'Below developer list price'}
              </span>
            </div>

          </div>

        </div>
      </section>

      {/* 2. Search, Geography Selectors, Quick Filters & Catalog View */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 w-full">
        
        {/* Search + Geography Selectors + Quick Match + Drawer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          
          {/* Search Input */}
          <div className="relative lg:col-span-5">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder={
                language === 'ru'
                  ? 'Поиск по ЖК, коду лота, району или девелоперу...'
                  : 'Search complex, lot code, district, developer...'
              }
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 bg-white text-xs sm:text-sm font-medium shadow-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* City / Region Dropdown */}
          <div className="relative lg:col-span-2">
            <MapPin className="w-4 h-4 text-emerald-600 absolute left-3.5 top-4 pointer-events-none" />
            <select
              value={selectedCity}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full pl-9 pr-3 py-3.5 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">
                {language === 'ru' ? 'Все регионы РФ (7)' : 'All Regions (7)'}
              </option>
              {RUSSIAN_REGIONS.map((reg) => (
                <option key={reg.code} value={reg.code}>
                  {language === 'ru' ? reg.shortLabelRu : reg.shortLabelEn}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic District Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={selectedCity === 'all'}
              className="w-full px-3.5 py-3.5 rounded-2xl border border-slate-300 bg-white text-xs font-bold text-slate-800 shadow-xs focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="all">
                {selectedCity === 'all'
                  ? language === 'ru'
                    ? 'Район (выберите город)'
                    : 'District (pick city)'
                  : language === 'ru'
                  ? 'Все районы города'
                  : 'All Districts'}
              </option>
              {availableDistricts.map((dist) => (
                <option key={dist.nameRu} value={dist.nameRu}>
                  {language === 'ru' ? dist.nameRu : dist.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="lg:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQuickMatchOpen(true)}
              className="flex-1 px-3.5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
            >
              <Zap className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{language === 'ru' ? '10-сек подбор' : '10s Match'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center space-x-1.5 border transition-all shrink-0 ${
                isFilterDrawerOpen || activeFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>
                {language === 'ru'
                  ? `Фильтры${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`
                  : `Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
              </span>
            </button>
          </div>

        </div>

        {/* Active Region / District Breadcrumb Strip */}
        {(selectedCity !== 'all' || selectedDistrict !== 'all') && (
          <div className="flex flex-wrap items-center gap-2 bg-emerald-50/70 border border-emerald-200 rounded-2xl px-4 py-2.5 text-xs">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span className="font-bold text-emerald-950">
              {language === 'ru' ? 'Активная локация:' : 'Active Location:'}
            </span>
            {selectedCity !== 'all' && (
              <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 font-semibold text-slate-800">
                {getRegionByCode(selectedCity).labelRu}
              </span>
            )}
            {selectedDistrict !== 'all' && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold">
                {selectedDistrict}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleCityChange('all')}
              className="ml-auto text-emerald-800 hover:text-emerald-950 font-bold underline"
            >
              {language === 'ru' ? 'Показать всю Россию' : 'Show All Russia'}
            </button>
          </div>
        )}

        {/* Popular Regions & Developers Quick Row */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 overflow-x-auto pb-1">
          <span className="font-semibold text-slate-700 shrink-0">
            {language === 'ru' ? 'Быстрый переход:' : 'Quick Jump:'}
          </span>
          {RUSSIAN_REGIONS.map((reg) => (
            <button
              key={reg.code}
              type="button"
              onClick={() => handleCityChange(selectedCity === reg.code ? 'all' : reg.code)}
              className={`px-2.5 py-1 rounded-lg border shrink-0 transition-colors font-semibold ${
                selectedCity === reg.code
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300'
              }`}
            >
              {language === 'ru' ? reg.shortLabelRu : reg.shortLabelEn}
            </button>
          ))}
        </div>

        {/* Status Filter Pills + Page Size Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-b border-slate-200/70 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 mr-1">
              {language === 'ru' ? 'Статус объектов:' : 'Property Status:'}
            </span>
            {[
              {
                id: 'all',
                label:
                  language === 'ru'
                    ? `Все статусы (${registryMetrics.totalCount})`
                    : `All (${registryMetrics.totalCount})`,
              },
              {
                id: 'available',
                label:
                  language === 'ru'
                    ? `🟢 Доступные (${registryMetrics.availableCount})`
                    : `🟢 Available (${registryMetrics.availableCount})`,
              },
              {
                id: 'processing',
                label:
                  language === 'ru'
                    ? `🟡 В сделке (${registryMetrics.processingCount})`
                    : `🟡 In Deal (${registryMetrics.processingCount})`,
              },
              {
                id: 'closed',
                label:
                  language === 'ru'
                    ? `⚪ Закрытые (${registryMetrics.closedCount})`
                    : `⚪ Closed (${registryMetrics.closedCount})`,
              },
            ].map((statusPill) => {
              const active = statusFilter === statusPill.id;
              return (
                <button
                  key={statusPill.id}
                  type="button"
                  onClick={() => handleStatusFilterClick(statusPill.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    active
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{statusPill.label}</span>
                </button>
              );
            })}
          </div>

          {/* Results Counter & Page Size Selector [12 | 24 | 48] */}
          <div className="flex items-center justify-between md:justify-end gap-3 text-xs">
            <span className="font-semibold text-slate-600">
              {language === 'ru' ? `Найдено: ${lots.length}` : `Found: ${lots.length}`}
            </span>
            {viewMode === 'grid' && (
              <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                {([12, 24, 48] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                      setLoadedExtraPages(0);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      pageSize === sz
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
                <span className="px-2 text-[11px] text-slate-400">
                  {language === 'ru' ? 'на стр.' : '/ page'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Filter Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: language === 'ru' ? 'Все категории' : 'All Categories', icon: null },
            { id: 'urgent', label: language === 'ru' ? '🔥 Срочный выход / Торг' : '🔥 Urgent Exit', icon: Flame },
            { id: 'ready2026', label: language === 'ru' ? '🔑 Сдача в 2025–2026 гг.' : '🔑 Handover 2025–2026', icon: Key },
            { id: 'under3m', label: language === 'ru' ? '💰 До 3 млн ₽ наличными' : '💰 Under 3M ₽ Cash', icon: Wallet },
            { id: 'subsidized', label: language === 'ru' ? '🏦 Семейная ипотека / Рассрочка 0%' : '🏦 0% Installment / Mortgage', icon: Building },
          ].map((pill) => {
            const active = activeQuickFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => handleQuickFilterClick(pill.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                  active
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        {/* Advanced Filter Drawer */}
        <AdvancedFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          onApply={handleApplyDrawerFilters}
          lotsCount={lots.length}
          selectedCity={selectedCity}
          selectedDistrict={selectedDistrict}
          onLocationChange={(city, district) => {
            setSelectedCity(city);
            setSelectedDistrict(district);
          }}
        />

        {/* 3. Main Content: Grid View OR Interactive Map View */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-5 border border-slate-200 animate-pulse space-y-4">
                <div className="h-52 bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-14 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : lots.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 my-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {language === 'ru' ? 'По заданным параметрам лоты не найдены' : 'No lots found matching criteria'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'ru'
                ? 'Попробуйте выбрать другой район/регион, увеличить лимит наличных или сбросить фильтры поиска.'
                : 'Try selecting another district/region, increasing your cash budget, or resetting filters.'}
            </p>
            <button
              type="button"
              onClick={handleResetAll}
              className="px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md inline-flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{language === 'ru' ? 'Сбросить все фильтры' : 'Reset All Filters'}</span>
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div className="py-2">
            <CatalogMapView
              lots={lots}
              selectedCity={selectedCity}
              onSelectCity={(cityCode) => handleCityChange(cityCode)}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
              {paginatedLots.map((lot) => (
                <LotCard key={lot.id} lot={lot} />
              ))}
            </div>

            {/* 4. Dynamic Adaptive Pagination + Load More */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                {language === 'ru'
                  ? `Показано ${startIdx + 1}–${endIdx} из ${lots.length} верифицированных лотов`
                  : `Showing ${startIdx + 1}–${endIdx} of ${lots.length} verified lots`}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {canLoadMore && (
                  <button
                    type="button"
                    onClick={() => setLoadedExtraPages((prev) => prev + 1)}
                    className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-1.5 transition-colors mr-2"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>
                      {language === 'ru'
                        ? `Загрузить еще (${Math.min(pageSize, lots.length - endIdx)})`
                        : `Load More (${Math.min(pageSize, lots.length - endIdx)})`}
                    </span>
                  </button>
                )}

                {totalPages > 1 && (
                  <div className="inline-flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => {
                        setCurrentPage((p) => Math.max(1, p - 1));
                        setLoadedExtraPages(0);
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => {
                          setCurrentPage(pageNum);
                          setLoadedExtraPages(0);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                          safeCurrentPage === pageNum
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => {
                        setCurrentPage((p) => Math.min(totalPages, p + 1));
                        setLoadedExtraPages(0);
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                      aria-label="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="inline-flex items-center space-x-1 text-xs text-slate-500">
                <span>{language === 'ru' ? 'Лотов на странице:' : 'Lots per page:'}</span>
                {([12, 24, 48] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setPageSize(sz);
                      setCurrentPage(1);
                      setLoadedExtraPages(0);
                    }}
                    className={`px-2 py-1 rounded-lg font-bold ${
                      pageSize === sz
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Bottom Telegram Bot Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 text-slate-900 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm mt-8">
          <div className="space-y-1.5 text-center sm:text-left">
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              VIP TELEGRAM МОНИТОРИНГ
            </span>
            <h3 className="text-xl font-bold text-slate-900">
              {language === 'ru'
                ? 'Не нашли подходящий жилой комплекс в выбранном районе?'
                : 'Did not find the right residential complex in your district?'}
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              {language === 'ru'
                ? 'Подключите Telegram-бот DomExit: получайте мгновенные уведомления о новых выходах из рассрочек со скидкой до 32% за 48 часов до общей публикации.'
                : 'Connect the DomExit Telegram Bot to receive instant alerts on new clean exits with up to 32% discount 48 hours before public release.'}
            </p>
          </div>
          <a
            href="https://t.me/domexit_ru"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{language === 'ru' ? 'Подключить Telegram-бот' : 'Connect Telegram Bot'}</span>
          </a>
        </div>

      </section>

      {/* Quick Discovery Modal */}
      <QuickMatchModal
        isOpen={isQuickMatchOpen}
        onClose={() => setIsQuickMatchOpen(false)}
        onFindMatches={handleQuickMatchApply}
      />

    </div>
  );
};
