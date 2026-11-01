import React, { useEffect, useState } from 'react';
import { formatRubles } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { RUSSIAN_REGIONS, getDistrictsForRegion } from '../../data/russianGeography';
import { DevelopersRepository } from '../../dal/repositories/DevelopersRepository';
import { AccreditedDeveloper } from '../../types';
import { SlidersHorizontal, RotateCcw, Bookmark, Check, MapPin } from 'lucide-react';

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: any) => void;
  lotsCount: number;
  selectedCity?: string;
  selectedDistrict?: string;
  onLocationChange?: (city: string, district: string) => void;
}

export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({
  isOpen,
  onClose,
  onApply,
  lotsCount,
  selectedCity = 'all',
  selectedDistrict = 'all',
  onLocationChange,
}) => {
  const { language } = useLanguage();

  const [city, setCity] = useState<string>(selectedCity);
  const [district, setDistrict] = useState<string>(selectedDistrict);
  const [developer, setDeveloper] = useState<string>('all');
  const [accreditedDevs, setAccreditedDevs] = useState<AccreditedDeveloper[]>([]);
  const [rooms, setRooms] = useState<string>('all');
  const [maxCash, setMaxCash] = useState<number>(15000000);
  const [maxMonthly, setMaxMonthly] = useState<number>(250000);
  const [interestFreeOnly, setInterestFreeOnly] = useState<boolean>(false);
  const [deliveryYear, setDeliveryYear] = useState<string>('all');
  const [aaaDevelopersOnly, setAaaDevelopersOnly] = useState<boolean>(true);
  const [cessionAssistIncluded, setCessionAssistIncluded] = useState<boolean>(true);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  useEffect(() => {
    setCity(selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    setDistrict(selectedDistrict);
  }, [selectedDistrict]);

  useEffect(() => {
    DevelopersRepository.getAccreditedDevelopers().then((devs) => {
      setAccreditedDevs(devs);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const availableDistricts = city !== 'all' ? getDistrictsForRegion(city) : [];

  const handleCitySelect = (nextCity: string) => {
    setCity(nextCity);
    setDistrict('all');
    onLocationChange?.(nextCity, 'all');
  };

  const handleDistrictSelect = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    onLocationChange?.(city, nextDistrict);
  };

  const handleReset = () => {
    setCity('all');
    setDistrict('all');
    setDeveloper('all');
    setRooms('all');
    setMaxCash(15000000);
    setMaxMonthly(250000);
    setInterestFreeOnly(false);
    setDeliveryYear('all');
    setAaaDevelopersOnly(false);
    setCessionAssistIncluded(false);
    setMinDiscount(0);
    setUrgentOnly(false);
    onLocationChange?.('all', 'all');
    onApply({});
  };

  const handleApply = () => {
    onLocationChange?.(city, district);
    onApply({
      city: city !== 'all' ? city : undefined,
      district: district !== 'all' ? district : undefined,
      developer: developer !== 'all' ? developer : undefined,
      rooms: rooms !== 'all' ? rooms : undefined,
      maxCash: maxCash < 15000000 ? maxCash : undefined,
      maxMonthly: maxMonthly < 250000 ? maxMonthly : undefined,
      interestFreeOnly,
      deliveryYear,
      aaaDevelopersOnly,
      cessionAssistIncluded,
      minDiscount: minDiscount > 0 ? minDiscount : undefined,
      urgentOnly,
    });
    onClose();
  };

  const handleSaveSubscription = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3500);
  };

  return (
    <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 p-6 sm:p-8 my-6 shadow-xl transition-all animate-fadeIn">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            {language === 'ru'
              ? 'Параметры поиска, география РФ и структура сделки'
              : 'Search Parameters, Russian Geography & Deal Structure'}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          {language === 'ru' ? '✕ Свернуть' : '✕ Close'}
        </button>
      </div>

      {/* Location Row inside Drawer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 pb-2">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Регион / Город РФ:' : 'Region / City:'}</span>
          </label>
          <select
            value={city}
            onChange={(e) => handleCitySelect(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">
              {language === 'ru' ? 'Все регионы России (7 агломераций)' : 'All Russian Regions'}
            </option>
            {RUSSIAN_REGIONS.map((reg) => (
              <option key={reg.code} value={reg.code}>
                {language === 'ru' ? reg.labelRu : reg.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {language === 'ru' ? 'Район города / локация:' : 'City District:'}
          </label>
          <select
            value={district}
            onChange={(e) => handleDistrictSelect(e.target.value)}
            disabled={city === 'all'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option value="all">
              {city === 'all'
                ? language === 'ru'
                  ? 'Сначала выберите город'
                  : 'Select city first'
                : language === 'ru'
                ? 'Все районы выбранного региона'
                : 'All districts in region'}
            </option>
            {availableDistricts.map((dist) => (
              <option key={dist.nameRu} value={dist.nameRu}>
                {language === 'ru' ? dist.nameRu : dist.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            {language === 'ru' ? 'Комнатность лота:' : 'Unit Format:'}
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
              { id: 'studio', label: language === 'ru' ? 'Студия' : 'Studio' },
              { id: '1-room', label: '1К' },
              { id: '2-room', label: '2К' },
              { id: '3-room', label: '3К+' },
            ].map((rm) => (
              <button
                key={rm.id}
                type="button"
                onClick={() => setRooms(rm.id)}
                className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                  rooms === rm.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {rm.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3 Vertical Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-5">
        
        {/* Column 1: Financial Profile */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {language === 'ru' ? '1. Финансовый профиль' : '1. Financial Profile'}
          </h4>

          {/* Max Cash Slider */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-600">
                {language === 'ru' ? 'Макс. сумма наличными продавцу:' : 'Max cash to seller:'}
              </span>
              <span className="font-bold text-emerald-700">
                {maxCash >= 15000000
                  ? language === 'ru'
                    ? 'Без лимита'
                    : 'No limit'
                  : formatRubles(maxCash)}
              </span>
            </div>
            <input
              type="range"
              min="1500000"
              max="15000000"
              step="250000"
              value={maxCash}
              onChange={(e) => setMaxCash(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[
                { label: '2.5 млн', val: 2500000 },
                { label: '4 млн', val: 4000000 },
                { label: '7 млн', val: 7000000 },
                { label: language === 'ru' ? 'Все' : 'All', val: 15000000 },
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setMaxCash(pill.val)}
                  className={`py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    maxCash === pill.val
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Installment Slider */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-600">
                {language === 'ru' ? 'Макс. ежемесячный эквивалент:' : 'Max monthly equivalent:'}
              </span>
              <span className="font-bold text-slate-900">
                {maxMonthly >= 250000
                  ? language === 'ru'
                    ? 'Любой'
                    : 'Any'
                  : `${formatRubles(maxMonthly)} / мес.`}
              </span>
            </div>
            <input
              type="range"
              min="30000"
              max="250000"
              step="5000"
              value={maxMonthly}
              onChange={(e) => setMaxMonthly(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
          </div>

          <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={interestFreeOnly}
              onChange={(e) => setInterestFreeOnly(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
            />
            <span>{language === 'ru' ? 'Только беспроцентная рассрочка 0%' : 'Interest-free installment only'}</span>
          </label>
        </div>

        {/* Column 2: Terms and Readiness */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
            {language === 'ru' ? '2. Сроки и готовность' : '2. Terms & Handover'}
          </h4>

          <div>
            <label className="block text-xs text-slate-600 mb-2">
              {language === 'ru' ? 'Срок сдачи дома:' : 'Completion deadline:'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: language === 'ru' ? 'Все' : 'All' },
                { id: 'ready', label: language === 'ru' ? 'Сдан / 2025' : 'Ready / 2025' },
                { id: '2026', label: language === 'ru' ? 'Сдача 2026' : '2026' },
                { id: '2027+', label: language === 'ru' ? 'Сдача 2027+' : '2027+' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDeliveryYear(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    deliveryYear === item.id
                      ? 'bg-sky-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700">
            <div>
              <label className="block text-xs text-slate-600 mb-1.5 font-semibold">
                {language === 'ru'
                  ? 'Застройщик (Единый реестр банков):'
                  : 'Accredited Developer:'}
              </label>
              <select
                value={developer}
                onChange={(e) => setDeveloper(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">
                  {language === 'ru'
                    ? `Все застройщики (${accreditedDevs.length || 15} в реестре)`
                    : 'All Developers'}
                </option>
                {accreditedDevs.map((dev) => (
                  <option key={dev.id} value={dev.name}>
                    {dev.name} (ИНН {dev.inn})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aaaDevelopersOnly}
                onChange={(e) => setAaaDevelopersOnly(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
              />
              <span>{language === 'ru' ? 'Только аккредитованные застройщики AAA' : 'Only AAA Accredited Developers'}</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cessionAssistIncluded}
                onChange={(e) => setCessionAssistIncluded(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
              />
              <span>{language === 'ru' ? 'Согласование цессии девелопером 0 ₽' : 'Free developer assignment approval'}</span>
            </label>
          </div>
        </div>

        {/* Column 3: Discount & Urgency */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {language === 'ru' ? '3. Скидка и параметры выгоды' : '3. Discount & Financial Advantage'}
          </h4>

          <div>
            <label className="block text-xs text-slate-600 mb-2">
              {language === 'ru' ? 'Минимальная скидка от цены застройщика:' : 'Min developer discount:'}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 10, 15, 22].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMinDiscount(d)}
                  className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
                    minDiscount === d
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d === 0 ? (language === 'ru' ? 'Любая' : 'Any') : `От ${d}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={urgentOnly}
                onChange={(e) => setUrgentOnly(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
              />
              <span className="font-semibold text-slate-800">
                {language === 'ru' ? 'Только срочный выход (максимальный дисконт)' : 'Urgent exits only (max discount)'}
              </span>
            </label>
            <p className="text-[11px] text-slate-500 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
              {language === 'ru'
                ? 'Способ финансирования (100% кэш или банковская ипотека на остаток ДДУ) моделируется в кредитном калькуляторе карточки лота.'
                : 'Funding method (100% cash or mortgage on remaining DDU debt) is modeled in the unit credit calculator.'}
            </p>
          </div>
        </div>

      </div>

      {/* Action Bar Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Сбросить всё' : 'Reset All'}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveSubscription}
            className="flex items-center space-x-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>
              {savedNotice
                ? language === 'ru'
                  ? '✓ Подписка на фильтр активирована'
                  : '✓ Search alert activated'
                : language === 'ru'
                ? 'Сохранить подписку на фильтр'
                : 'Save search alert'}
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <span className="text-xs text-slate-500">
            {language === 'ru' ? `Найдено в реестре: ${lotsCount}` : `${lotsCount} verified units`}
          </span>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{language === 'ru' ? `Применить параметры` : `Apply Filters`}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
