import React, { useState } from 'react';
import { Sparkles, TrendingUp, ShieldCheck, Clock, AlertTriangle, ArrowRight, CheckCircle2, Loader2, Info } from 'lucide-react';
import { formatRubles } from '../../../utils/formatters';
import { apiClient } from '../../../services/apiClient';

interface AvmValuationCardProps {
  lotCode?: string;
  complexName: string;
  developerName?: string;
  developerInn?: string;
  region: string;
  areaSqm: number;
  rooms?: string | number;
  floor?: number;
  totalFloors?: number;
  oldDduPrice: number;
  debtToDev: number;
  todayDevPrice: number;
  developerConsentFeeRub?: number;
  deliveryDate?: string;
  onApplyRecommendedPrice?: (recommendedPriceRub: number, todayDevPriceRub?: number) => void;
}

export const AvmValuationCard: React.FC<AvmValuationCardProps> = ({
  lotCode,
  complexName,
  developerName,
  developerInn,
  region,
  areaSqm,
  rooms,
  floor,
  totalFloors,
  oldDduPrice,
  debtToDev,
  todayDevPrice,
  developerConsentFeeRub,
  deliveryDate,
  onApplyRecommendedPrice,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valuation, setValuation] = useState<any>(null);
  const [applied, setApplied] = useState(false);

  const handleRunValuation = async () => {
    if (!complexName || areaSqm <= 0 || oldDduPrice <= 0) {
      setError('Для оценки AVM укажите ЖК, площадь (> 0) и цену ДДУ (> 0)');
      return;
    }

    setLoading(true);
    setError(null);
    setApplied(false);

    try {
      const parsedRooms = typeof rooms === 'string' ? (rooms.includes('studio') ? 0 : parseInt(rooms) || 1) : rooms || 1;
      const res = await apiClient.aiLab.estimateAvm({
        lotCode,
        complexName,
        developerName,
        developerInn,
        region: region || 'spb',
        areaSqm,
        rooms: parsedRooms,
        floor,
        totalFloors,
        dduFullPriceRub: oldDduPrice,
        paidToDeveloperRub: Math.max(0, oldDduPrice - debtToDev),
        remainingDebtRub: debtToDev,
        handoverQuarter: deliveryDate,
        developerConsentFeeRub,
        developerPriceTodayRub: todayDevPrice > 0 ? todayDevPrice : undefined,
        saveHistory: Boolean(lotCode),
      });

      if (res.ok && res.valuation) {
        setValuation(res.valuation);
      } else {
        setError('Не удалось рассчитать оценку');
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка расчёта AVM оценки');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!valuation || !onApplyRecommendedPrice) return;
    const recommended = valuation.fastExitPriceBandRub?.recommendedRub;
    const anchorDev = valuation.anchorDeveloperTotalRub;
    if (recommended) {
      onApplyRecommendedPrice(recommended, anchorDev);
      setApplied(true);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'underpriced_hot':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">🔥 Огненная цена (ликвидация)</span>;
      case 'fair_fast_exit':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">⚡ Справедливый быстрый выход (14 дней)</span>;
      case 'slightly_overpriced':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">⚠️ Умеренная цена (30–60 дней)</span>;
      case 'overpriced_risk':
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">🛑 Риск завышения (60+ дней)</span>;
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/20 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black tracking-wide flex items-center gap-2">
              <span>AVM v1 — Оценка Переуступки</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                0 ₽ • Математическая модель
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              ЕИСЖС (Наш.Дом.РФ) + Бенчмарки + Ставка ЦБ РФ + Параметры ДДУ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunValuation}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Расчёт AVM...</span>
            </>
          ) : (
            <>
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{valuation ? 'Пересчитать AVM' : '⚡ Рассчитать цену быстрого выхода'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Valuation Output */}
      {valuation && (
        <div className="space-y-4 pt-2 border-t border-slate-800">
          {/* Main Price Band Display */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Нижняя граница (Срочно)
              </span>
              <span className="text-lg font-black text-slate-200">
                {formatRubles(valuation.fastExitPriceBandRub?.minRub || 0)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {Math.round((valuation.fastExitPriceBandRub?.minRub || 0) / (areaSqm || 1)).toLocaleString('ru-RU')} ₽/м²
              </span>
            </div>

            <div className="bg-gradient-to-b from-indigo-600/30 to-indigo-900/40 border-2 border-indigo-400/60 rounded-2xl p-4 text-center relative overflow-hidden">
              <div className="absolute top-1.5 right-2">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500 text-white">
                  Фокус DomExit
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-indigo-300 block mb-1">
                Рекомендованная цена (14 дней)
              </span>
              <span className="text-2xl font-black text-white">
                {formatRubles(valuation.fastExitPriceBandRub?.recommendedRub || 0)}
              </span>
              <span className="text-xs text-indigo-200 font-semibold block mt-1">
                {Math.round((valuation.fastExitPriceBandRub?.recommendedRub || 0) / (areaSqm || 1)).toLocaleString('ru-RU')} ₽/м²
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Верхняя граница (Максимум)
              </span>
              <span className="text-lg font-black text-slate-200">
                {formatRubles(valuation.fastExitPriceBandRub?.maxRub || 0)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {Math.round((valuation.fastExitPriceBandRub?.maxRub || 0) / (areaSqm || 1)).toLocaleString('ru-RU')} ₽/м²
              </span>
            </div>
          </div>

          {/* Key Metrics: Savings, Discount, Liquidity */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <span className="text-slate-400 block text-[11px]">Выгода покупателя vs Застройщик</span>
              <span className="text-base font-black text-emerald-400">
                +{formatRubles(valuation.buyerNetSavingsRub || 0)}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Скидка: {valuation.impliedDiscountVsDeveloperPct}%
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <span className="text-slate-400 block text-[11px]">Ликвидность объекта</span>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-base font-black text-white">
                  {valuation.liquidityScore}/100
                </span>
                <div className="w-16 bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      valuation.liquidityScore >= 80
                        ? 'bg-emerald-500'
                        : valuation.liquidityScore >= 60
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, valuation.liquidityScore)}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {valuation.pricingVerdict ? getVerdictBadge(valuation.pricingVerdict) : null}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <span className="text-slate-400 block text-[11px]">Прогноз срока продажи</span>
              <div className="flex items-center space-x-1.5 mt-1 text-slate-200 font-bold">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{valuation.estimatedDaysToExit || '14–30 дней'}</span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Доверие к данным: {valuation.dataQualityConfidence === 'high' ? 'Высокое' : 'Среднее'}
              </span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <span className="text-slate-400 block text-[11px]">Ориентир застройщика</span>
              <span className="text-base font-bold text-slate-200">
                {formatRubles(valuation.anchorDeveloperTotalRub || 0)}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {Math.round(valuation.anchorDeveloperPricePerSqmRub || 0).toLocaleString('ru-RU')} ₽/м²
              </span>
            </div>
          </div>

          {/* Explanation bullets */}
          {valuation.explanationBullets && valuation.explanationBullets.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Обоснование математической оценки:
              </span>
              <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                {valuation.explanationBullets.map((b: string, idx: number) => (
                  <li key={idx} className="leading-relaxed">{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          {onApplyRecommendedPrice && (
            <div className="pt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                {applied ? '✅ Рекомендованная цена применена к полям карточки' : 'Перенести рекомендованную цену в карточку объекта:'}
              </span>
              <button
                type="button"
                onClick={handleApply}
                disabled={applied}
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  applied
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-emerald-500/25 active:scale-95'
                }`}
              >
                {applied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Применено</span>
                  </>
                ) : (
                  <>
                    <span>Применить рекомендованную цену ({formatRubles(valuation.fastExitPriceBandRub?.recommendedRub || 0)})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
