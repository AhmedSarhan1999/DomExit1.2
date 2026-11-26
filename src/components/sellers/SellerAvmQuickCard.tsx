import React, { useState } from 'react';
import { Sparkles, TrendingUp, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { formatRubles } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';

interface SellerAvmQuickCardProps {
  complexName: string;
  developerName?: string;
  region: string;
  areaSqm: number;
  dduFullPriceRub: number;
  paidToDeveloperRub: number;
  todayMarketPrice?: number;
}

export const SellerAvmQuickCard: React.FC<SellerAvmQuickCardProps> = ({
  complexName,
  developerName,
  region,
  areaSqm,
  dduFullPriceRub,
  paidToDeveloperRub,
  todayMarketPrice,
}) => {
  const [loading, setLoading] = useState(false);
  const [valuation, setValuation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEstimate = async () => {
    if (!complexName.trim() || areaSqm <= 0 || dduFullPriceRub <= 0) {
      setError('Укажите название ЖК, площадь (> 0) и цену ДДУ (> 0)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.aiLab.estimateAvm({
        complexName: complexName.trim(),
        developerName: developerName?.trim() || undefined,
        region: region || 'spb',
        areaSqm,
        dduFullPriceRub,
        paidToDeveloperRub: paidToDeveloperRub || dduFullPriceRub,
        developerPriceTodayRub: todayMarketPrice && todayMarketPrice > 0 ? todayMarketPrice : undefined,
        saveHistory: false,
      });

      if (res.ok && res.valuation) {
        setValuation(res.valuation);
      } else {
        setError('Не удалось получить экспресс-оценку');
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка расчёта AVM');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-lg border border-indigo-500/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <span>AVM v1 — Экспресс-оценка выхода</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold border border-emerald-500/30">
                0 ₽
              </span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Математический расчет по открытым данным ЕИСЖС и ЦБ РФ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading || !complexName.trim() || areaSqm <= 0 || dduFullPriceRub <= 0}
          className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-1.5 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Расчёт...</span>
            </>
          ) : (
            <>
              <TrendingUp className="w-3 h-3" />
              <span>{valuation ? 'Обновить' : 'Оценить'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-2 bg-rose-950/60 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {valuation && (
        <div className="space-y-2.5 pt-2 border-t border-slate-800 text-xs">
          <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-xl p-3 text-center">
            <span className="text-[10px] text-indigo-300 uppercase font-bold block mb-0.5">
              Рекомендованная цена быстрого выхода (14 дней)
            </span>
            <span className="text-xl font-black text-white">
              {formatRubles(valuation.fastExitPriceBandRub?.recommendedRub || 0)}
            </span>
            <div className="text-[10px] text-slate-300 flex items-center justify-center gap-2 mt-1">
              <span>Диапазон: {formatRubles(valuation.fastExitPriceBandRub?.minRub || 0)} — {formatRubles(valuation.fastExitPriceBandRub?.maxRub || 0)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2">
              <span className="text-slate-400 block text-[10px]">Ликвидность</span>
              <span className="font-bold text-emerald-400">
                {valuation.liquidityScore}/100 • {valuation.estimatedDaysToExit || '14–30 дней'}
              </span>
            </div>

            <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2">
              <span className="text-slate-400 block text-[10px]">Дисконт к застройщику</span>
              <span className="font-bold text-indigo-300">
                -{valuation.impliedDiscountVsDeveloperPct}% vs официальный прайс
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
