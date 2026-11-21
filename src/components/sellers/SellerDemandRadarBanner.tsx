import React, { useState, useEffect, useRef } from 'react';
import { Users, Sparkles, TrendingUp, ShieldCheck, Banknote } from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { formatRubles } from '../../utils/formatters';

export interface SellerDemandRadarBannerProps {
  city?: string;
  priceRub?: number;
  dealTrack?: string;
}

export const SellerDemandRadarBanner: React.FC<SellerDemandRadarBannerProps> = ({
  city = 'spb',
  priceRub = 12500000,
  dealTrack = 'ddu_cession',
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [radarData, setRadarData] = useState<{
    totalMatched: number;
    goldCount: number;
    silverCount: number;
    totalDeclaredLiquidityRub: number;
  } | null>(null);

  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.matching.getDemandRadar({
          city,
          maxBudget: priceRub > 0 ? priceRub : undefined,
          dealTrack,
        });

        if (res.ok) {
          setRadarData({
            totalMatched: res.totalMatched || 0,
            goldCount: res.goldCount || 0,
            silverCount: res.silverCount || 0,
            totalDeclaredLiquidityRub: res.totalDeclaredLiquidityRub || 0,
          });
        }
      } catch (err) {
        console.warn('[SellerDemandRadarBanner] Non-fatal demand radar fetch error:', err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [city, priceRub, dealTrack]);

  const totalMatched = radarData?.totalMatched ?? 0;
  const goldCount = radarData?.goldCount ?? 0;
  const silverCount = radarData?.silverCount ?? 0;
  const liquidity = radarData?.totalDeclaredLiquidityRub ?? 0;

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white border border-emerald-500/30 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              РАДАР ЛИКВИДНОСТИ DOMEXIT В ВАШЕМ РЕГИОНЕ
            </span>
          </div>

          <p className="text-xs sm:text-sm font-bold text-slate-100">
            {loading ? (
              <span className="text-slate-400">Калибровка пула покупателей по вашим параметрам...</span>
            ) : totalMatched > 0 ? (
              <span>
                В базе DomExit сейчас{' '}
                <strong className="text-emerald-400 font-extrabold text-sm sm:text-base underline decoration-emerald-500 underline-offset-4">
                  {totalMatched} проверенных инвесторов
                </strong>{' '}
                с подтвержденным бюджетом под ваш объект
              </span>
            ) : (
              <span>
                В базе DomExit зарегистрированы инвесторы с открытым лимитом ликвидности в вашем регионе
              </span>
            )}
          </p>
        </div>

        {/* Aggregate Stats Badges (Strictly ZERO PII) */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px]">
            {goldCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center space-x-1">
                <span>🥇 Gold: {goldCount} (100% кэш)</span>
              </span>
            )}
            {silverCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-300/20 text-slate-200 border border-slate-300/30 font-bold flex items-center space-x-1">
                <span>🥈 Silver: {silverCount} (Ипотека)</span>
              </span>
            )}
            {liquidity > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                {formatRubles(liquidity)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
