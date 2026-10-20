import React, { useState } from 'react';
import { formatRubles } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { SlidersHorizontal, RotateCcw, Bookmark, Check } from 'lucide-react';

interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: any) => void;
  lotsCount: number;
}

export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({
  isOpen,
  onClose,
  onApply,
  lotsCount,
}) => {
  const { language } = useLanguage();

  const [maxCash, setMaxCash] = useState<number>(3500000);
  const [maxMonthly, setMaxMonthly] = useState<number>(85000);
  const [interestFreeOnly, setInterestFreeOnly] = useState<boolean>(true);
  const [deliveryYear, setDeliveryYear] = useState<string>('all');
  const [aaaDevelopersOnly, setAaaDevelopersOnly] = useState<boolean>(true);
  const [cessionAssistIncluded, setCessionAssistIncluded] = useState<boolean>(true);
  const [minDiscount, setMinDiscount] = useState<number>(15);
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setMaxCash(5000000);
    setMaxMonthly(150000);
    setInterestFreeOnly(false);
    setDeliveryYear('all');
    setAaaDevelopersOnly(false);
    setCessionAssistIncluded(false);
    setMinDiscount(10);
    setUrgentOnly(false);
    onApply({});
  };

  const handleApply = () => {
    onApply({
      maxCash,
      maxMonthly,
      interestFreeOnly,
      deliveryYear,
      aaaDevelopersOnly,
      cessionAssistIncluded,
      minDiscount,
      urgentOnly,
    });
    onClose();
  };

  return (
    <div className="bg-white text-slate-900 rounded-3xl border border-slate-200 p-6 sm:p-8 my-6 shadow-xl transition-all animate-fadeIn">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            {language === 'ru' ? 'Параметры поиска и структура сделки' : 'Search Parameters & Deal Structure'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          {language === 'ru' ? '✕ Свернуть' : '✕ Close'}
        </button>
      </div>

      {/* 3 Vertical Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
        
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
              <span className="font-bold text-emerald-700">{formatRubles(maxCash)}</span>
            </div>
            <input
              type="range"
              min="1000000"
              max="10000000"
              step="250000"
              value={maxCash}
              onChange={(e) => setMaxCash(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            {/* Quick Pills */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[
                { label: '1.5 млн', val: 1500000 },
                { label: '3 млн', val: 3000000 },
                { label: '5 млн', val: 5000000 },
                { label: 'Все', val: 10000000 },
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
                {language === 'ru' ? 'Макс. ежемесячный платеж:' : 'Max monthly payment:'}
              </span>
              <span className="font-bold text-slate-900">{formatRubles(maxMonthly)} / мес.</span>
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

          {/* Interest Free Toggle */}
          <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={interestFreeOnly}
              onChange={(e) => setInterestFreeOnly(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
            />
            <span>{language === 'ru' ? 'Только беспроцентная рассрочка' : 'Interest-free installment only'}</span>
          </label>
        </div>

        {/* Column 2: Terms and Readiness */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
            {language === 'ru' ? '2. Сроки и готовность' : '2. Terms & Handover'}
          </h4>

          {/* Delivery Year Pills */}
          <div>
            <label className="block text-xs text-slate-600 mb-2">
              {language === 'ru' ? 'Срок сдачи дома:' : 'Completion deadline:'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'all', label: 'Все' },
                { id: 'ready', label: 'Сдан / Ключи' },
                { id: '2025', label: 'Сдача 2025' },
                { id: '2026', label: 'Сдача 2026' },
                { id: '2027+', label: 'Сдача 2027+' },
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

          {/* Verified Developer Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-200 text-xs text-slate-700">
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
              <span>{language === 'ru' ? 'Согласование цессии девелопером берем на себя 0 ₽' : 'Free developer assignment approval'}</span>
            </label>
          </div>
        </div>

        {/* Column 3: Discount & Urgency (Funding type removed per Task 3) */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            {language === 'ru' ? '3. Скидка и параметры выгоды' : '3. Discount & Financial Advantage'}
          </h4>

          {/* Discount Range Buttons */}
          <div>
            <label className="block text-xs text-slate-600 mb-2">
              {language === 'ru' ? 'Минимальная скидка от цены рынка:' : 'Min market discount:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[10, 15, 25].map((d) => (
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
                  От {d}%
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
                ? 'ℹ️ Способ финансирования (100% кэш или ипотека) выбирается покупателем на этапе подачи заявки в зависимости от персональной кредитоспособности.'
                : 'ℹ️ Funding method (100% cash or mortgage) is selected by the buyer at application depending on credit rating.'}
            </p>
          </div>
        </div>

      </div>

      {/* Action Bar Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <div className="flex items-center space-x-4">
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
            onClick={() => alert(language === 'ru' ? 'Параметры фильтрации сохранены в Telegram бот' : 'Search saved to Telegram')}
            className="flex items-center space-x-1.5 text-xs text-sky-600 hover:text-sky-700 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Сохранить параметры поиска в Telegram' : 'Save search in Telegram'}</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <span className="text-xs text-slate-500">
            {language === 'ru' ? `${lotsCount} проверенных лотов` : `${lotsCount} verified units`}
          </span>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{language === 'ru' ? `Применить фильтры (${lotsCount}) ->` : `Apply Filters (${lotsCount}) ->`}</span>
          </button>
        </div>
      </div>

    </div>
  );
};
