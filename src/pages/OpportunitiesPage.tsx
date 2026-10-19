import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Lot } from '../types';
import { LotsRepository } from '../dal/repositories/LotsRepository';
import { LotCard } from '../components/catalog/LotCard';
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
  ArrowRight,
} from 'lucide-react';

export const OpportunitiesPage: React.FC = () => {
  const { language, t } = useLanguage();

  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'processing' | 'closed'>('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isQuickMatchOpen, setIsQuickMatchOpen] = useState<boolean>(false);

  // Active filter state
  const [appliedFilters, setAppliedFilters] = useState<any>({});

  const loadLots = async (customFilter = appliedFilters, search = searchQuery, quick = activeQuickFilter, status = statusFilter) => {
    setLoading(true);
    let filterObj: any = {
      searchQuery: search,
      status: status,
      ...customFilter,
    };

    if (quick === 'urgent') filterObj.urgentOnly = true;
    if (quick === 'ready2026') filterObj.readyYear = 2026;
    if (quick === 'under2m') filterObj.maxCash = 2000000;

    const data = await LotsRepository.getAll(filterObj);
    setLots(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLots();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    loadLots(appliedFilters, q, activeQuickFilter, statusFilter);
  };

  const handleQuickFilterClick = (filterKey: string) => {
    setActiveQuickFilter(filterKey);
    loadLots(appliedFilters, searchQuery, filterKey, statusFilter);
  };

  const handleStatusFilterClick = (statusKey: 'all' | 'available' | 'processing' | 'closed') => {
    setStatusFilter(statusKey);
    loadLots(appliedFilters, searchQuery, activeQuickFilter, statusKey);
  };

  const handleApplyDrawerFilters = (filters: any) => {
    setAppliedFilters(filters);
    loadLots(filters, searchQuery, activeQuickFilter, statusFilter);
  };

  const handleQuickMatchApply = (criteria: any) => {
    let maxCashVal = 10000000;
    if (criteria.cashLimit === '1.5m') maxCashVal = 1500000;
    if (criteria.cashLimit === '3m') maxCashVal = 3000000;
    if (criteria.cashLimit === '5m') maxCashVal = 5000000;

    const newFilters = {
      maxCash: maxCashVal,
    };
    setAppliedFilters(newFilters);
    loadLots(newFilters, searchQuery, activeQuickFilter, statusFilter);
  };

  const handleResetAll = () => {
    setSearchQuery('');
    setActiveQuickFilter('all');
    setStatusFilter('all');
    setAppliedFilters({});
    loadLots({}, '', 'all', 'all');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Header & 4 Large Metric Cards - matches reference screenshot */}
      <section className="bg-white text-slate-900 pt-10 pb-12 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="space-y-2 max-w-3xl">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ru' ? 'Верифицированный реестр переуступок 214-ФЗ' : 'Verified 214-FZ Assignment Registry'}</span>
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {language === 'ru'
                ? 'Доступные возможности — переуступки ДДУ без наценки'
                : 'Verified Opportunities: Clean DDU Assignments (0% Markup)'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {language === 'ru'
                ? 'Каждый лот прошел комплексную проверку по 42 параметрам. Вы покупаете квартиру по цене старого договора 2023–2024 гг. с экономией до 32%.'
                : 'Every property vetted by 42 parameters. Buy at original 2023–2024 contract price with up to 32% discount.'}
            </p>
          </div>

          {/* 4 Large Metric Cards (clean white cards with subtle borders) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {language === 'ru' ? 'АКТИВНЫЕ ЛОТЫ' : 'ON THE PLATFORM'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
                9,227 <span className="text-sm font-semibold text-slate-500">{language === 'ru' ? 'квартир' : 'units'}</span>
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                СПб, Москва и области
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {language === 'ru' ? 'ОБЪЕМ РЕЕСТРА' : 'MARKET VALUE'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 block">
                133 <span className="text-sm font-semibold text-slate-500">{language === 'ru' ? 'млрд ₽' : 'B RUB'}</span>
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Верифицированные эскроу
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
                100% возврат капитала
              </span>
            </div>

            <div className="bg-emerald-50/80 text-emerald-950 border border-emerald-200 rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                {language === 'ru' ? 'ЧИСТАЯ ВЫГОДА' : 'NET ADVANTAGE'}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 block">
                до -32%
              </span>
              <span className="text-[11px] font-medium text-emerald-700 mt-0.5 block">
                От текущего прайса девелопера
              </span>
            </div>

          </div>

        </div>
      </section>

      {/* 2. Search, Quick Filters & Controls */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Search Bar & Drawer Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder={language === 'ru' ? 'Поиск по ЖК, району, метро или застройщику (Setl Group, ПИК, ЛСР)...' : 'Search by complex, developer, district...'}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-300 bg-white text-sm font-medium shadow-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsQuickMatchOpen(true)}
              className="px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-2 shadow-xs transition-colors shrink-0"
            >
              <Zap className="w-4 h-4 text-emerald-200" />
              <span>{language === 'ru' ? '10-сек подбор' : '10s Discovery'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              className={`px-5 py-3.5 rounded-2xl font-bold text-xs flex items-center space-x-2 border transition-all shrink-0 ${
                isFilterDrawerOpen
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{language === 'ru' ? 'Фильтры (3)' : 'Filters (3)'}</span>
            </button>
          </div>

        </div>

        {/* Popular Keywords Row */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 overflow-x-auto pb-1">
          <span className="font-semibold text-slate-700 shrink-0">Популярное:</span>
          {['Setl Group', 'ПИК', 'Группа ЛСР', 'Приморский р-н', 'Невский р-н', 'Васильевский о-в', 'Москва Премиум'].map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => {
                setSearchQuery(kw);
                loadLots(appliedFilters, kw, activeQuickFilter);
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 shrink-0 transition-colors"
            >
              {kw}
            </button>
          ))}
        </div>

        {/* 1. Status Filter Pills (Requirement 6: All deals remain on platform with status filters) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-200/60 pb-3">
          <span className="text-xs font-bold text-slate-700 mr-1">
            {language === 'ru' ? 'Статус объектов:' : 'Property Status:'}
          </span>
          {[
            { id: 'all', label: language === 'ru' ? 'Все статусы (12)' : 'All Statuses (12)' },
            { id: 'available', label: language === 'ru' ? '🟢 Доступные сейчас' : '🟢 Available Now' },
            { id: 'processing', label: language === 'ru' ? '🟡 В сделке (на проверке)' : '🟡 In Deal / Escrow' },
            { id: 'closed', label: language === 'ru' ? '⚪ Закрытые сделки' : '⚪ Closed Deals' },
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

        {/* 2. Quick Filter Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { id: 'all', label: 'Все категории', icon: null },
            { id: 'urgent', label: '🔥 Готов к торгу / Срочный выход', icon: Flame },
            { id: 'ready2026', label: '🔑 Сдача в 2025–2026 гг.', icon: Key },
            { id: 'under2m', label: '💰 До 2 млн ₽ наличными', icon: Wallet },
            { id: 'subsidized', label: '🏦 Субсидированная ипотека / Рассрочка', icon: Building },
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

        {/* Advanced Filter Drawer (Interface 7 State A) */}
        <AdvancedFilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          onApply={handleApplyDrawerFilters}
          lotsCount={lots.length}
        />

        {/* 3. Card Grid (3 columns on web, 1 on mobile) */}
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
              Попробуйте увеличить сумму первого взноса или сбросить фильтры поиска
            </p>
            <button
              type="button"
              onClick={handleResetAll}
              className="px-5 py-2.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl shadow-md inline-flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Сбросить все фильтры</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4">
            {lots.map((lot) => (
              <LotCard key={lot.id} lot={lot} />
            ))}
          </div>
        )}

        {/* 4. Pagination */}
        <div className="pt-8 border-t border-slate-200 flex items-center justify-center space-x-2">
          <button className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs">1</button>
          <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100">2</button>
          <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100">3</button>
          <span className="text-slate-400 px-2 text-xs">...</span>
          <button className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100">48</button>
        </div>

        {/* Bottom Telegram Bot Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 text-slate-900 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm mt-8">
          <div className="space-y-1.5 text-center sm:text-left">
            <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              VIP TELEGRAM МОНИТОРИНГ
            </span>
            <h3 className="text-xl font-bold text-slate-900">Не нашли подходящий жилой комплекс?</h3>
            <p className="text-xs text-slate-600 max-w-xl">
              Подключите Telegram-бот DomExit: получайте мгновенные уведомления о новых выходах из рассрочек со скидкой до 30% за 48 часов до публикации на сайте.
            </p>
          </div>
          <a
            href="https://t.me/domexit_ru"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Подключить Telegram-бот</span>
          </a>
        </div>

      </section>

      {/* Quick Discovery Modal (Interface 7 State B) */}
      <QuickMatchModal
        isOpen={isQuickMatchOpen}
        onClose={() => setIsQuickMatchOpen(false)}
        onFindMatches={handleQuickMatchApply}
      />

    </div>
  );
};
