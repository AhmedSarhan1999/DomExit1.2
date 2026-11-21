import React, { useState, useEffect } from 'react';
import {
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  ArrowRight,
  Flame,
  Users,
  Check,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Lot, PriceAcceptance, BuyBoxTier } from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface LotDropApplicationCardProps {
  lot: Lot;
  user: any;
  onOpenAuth: () => void;
}

export const LotDropApplicationCard: React.FC<LotDropApplicationCardProps> = ({
  lot,
  user,
  onOpenAuth,
}) => {
  const dropConfig = lot.dropConfig;
  if (!dropConfig || dropConfig.mode !== 'staged_drop') {
    return null;
  }

  const [priceAcceptance, setPriceAcceptance] = useState<PriceAcceptance>('full_price');
  const [readiness24h, setReadiness24h] = useState<boolean>(true);
  const [deposit48h, setDeposit48h] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [appliedApp, setAppliedApp] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<BuyBoxTier>('silver');
  const [hasExistingApp, setHasExistingApp] = useState<boolean>(false);

  // Time remaining string calculation
  const [remainingText, setRemainingText] = useState<string>('');

  const targetDeadline =
    dropConfig.waveStatus === 'gold_wave'
      ? dropConfig.goldExclusiveUntil
      : dropConfig.closesAt;

  useEffect(() => {
    const updateCountdown = () => {
      if (!targetDeadline) return;
      const diffMs = new Date(targetDeadline).getTime() - Date.now();
      if (diffMs <= 0) {
        setRemainingText('Время истекло');
        return;
      }
      const totalSec = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      setRemainingText(`${hours}ч ${mins}м ${secs}с`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [targetDeadline]);

  // Load user buyBox tier & check existing app
  useEffect(() => {
    if (!user) return;
    const fetchUserStatus = async () => {
      try {
        const [bbRes, appsRes] = await Promise.all([
          apiClient.matching.getMyBuyBox().catch(() => null),
          apiClient
            .get<any>(`/api/data/buyer_applications?lotCode=${encodeURIComponent(lot.lotCode)}&limit=100`)
            .catch(() => ({ items: [] })),
        ]);

        if (bbRes && bbRes.ok && bbRes.tier) {
          setUserTier(bbRes.tier);
        }

        const appList: any[] = appsRes?.items || (Array.isArray(appsRes) ? appsRes : []);
        const validApp = appList.find(
          (a: any) => a.userId === user.id && a.queueStatus !== 'withdrawn'
        );
        if (validApp) {
          setHasExistingApp(true);
          setAppliedApp(validApp);
        }
      } catch (err) {
        console.warn('[LotDropApplicationCard] Failed to fetch user status:', err);
      }
    };
    fetchUserStatus();
  }, [user?.id, lot.lotCode]);

  const maxCap = dropConfig.maxApplicationsCap || 5;
  const currentCount = dropConfig.currentValidApplications || 0;
  const remainingSeats = Math.max(0, maxCap - currentCount);

  const isGoldWave = dropConfig.waveStatus === 'gold_wave';
  const isCapped = dropConfig.waveStatus === 'capped_closed' || remainingSeats <= 0;
  const isExpired = dropConfig.waveStatus === 'expired_closed';

  const isGoldRestricted = isGoldWave && userTier !== 'gold';

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.matching.applyToLotDrop(lot.lotCode, {
        priceAcceptance,
        readiness24h,
        deposit48h,
        ndaSigned: true,
      });

      if (res.ok) {
        setAppliedApp(res.application);
        setHasExistingApp(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Не удалось отправить заявку в тактовый дроп');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white border border-indigo-900/60 shadow-xl space-y-4">
      {/* Wave Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center space-x-1.5 ${
              isGoldWave
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                : dropConfig.waveStatus === 'silver_wave'
                ? 'bg-slate-300/20 text-slate-200 border-slate-400/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isGoldWave
                ? '🥇 РАННИЙ ДОСТУП: ВОЛНА GOLD'
                : dropConfig.waveStatus === 'silver_wave'
                ? '🥈 ОТКРЫТЫЙ РАУНД: SILVER'
                : isCapped
                ? '🛑 КВОТА ИСЧЕРПАНА'
                : '⌛ РАУНД ЗАВЕРШЕН'}
            </span>
          </span>
        </div>

        {/* Live Countdown */}
        {!isCapped && !isExpired && remainingText && (
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{remainingText}</span>
          </div>
        )}
      </div>

      {/* Seats Meter */}
      <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">Ограничение очереди:</span>
          <span className="font-bold font-mono text-white">
            Осталось {remainingSeats} из {maxCap} мест
          </span>
        </div>
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCapped ? 'bg-rose-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, (currentCount / maxCap) * 100)}%` }}
          />
        </div>
      </div>

      {/* Existing Application Banner */}
      {hasExistingApp && appliedApp ? (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 space-y-2 text-emerald-100">
          <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Ваша заявка принята в тактовый дроп!</span>
          </div>
          <p className="text-xs text-slate-200">
            Ваш Closing Score: <strong>{appliedApp.closingScore || 100}/105</strong>. Статус в очереди:{' '}
            <strong className="text-amber-300">{appliedApp.queueStatus || 'На рассмотрении'}</strong>.
          </p>
        </div>
      ) : isCapped ? (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Лимит мест ({maxCap}) в текущем тактовом окне исчерпан. Ожидайте ротации.</span>
        </div>
      ) : isExpired ? (
        <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs text-slate-300 flex items-center space-x-2">
          <Clock className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Окно приема заявок завершено.</span>
        </div>
      ) : isGoldRestricted ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs text-amber-200">
          <div className="flex items-center space-x-2 font-bold text-amber-300">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Окно раннего доступа Gold</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Подача заявок для Silver откроется автоматически после завершения окна Gold. Вы можете подать предварительную заявку через нашего Telegram-бота.
          </p>
        </div>
      ) : (
        /* Application Form */
        <form onSubmit={handleApply} className="space-y-3 pt-1">
          {errorMessage && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Price Acceptance */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              1. Ценовое предложение:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPriceAcceptance('full_price')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'full_price'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-bold">По цене лота</div>
                <div className="text-[10px] opacity-80">
                  {formatRubles(
                    (lot as any).priceRub ||
                      (lot as any).price ||
                      lot.dduContractPrice ||
                      lot.cashPaidBySeller ||
                      0
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPriceAcceptance('above_asking')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'above_asking'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="font-bold flex items-center space-x-1">
                  <span>Выше (+2%)</span>
                  <Flame className="w-3 h-3 text-amber-400" />
                </div>
                <div className="text-[10px] opacity-80">+10 баллов в Closing</div>
              </button>
            </div>
          </div>

          {/* Step 2: Readiness speed */}
          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={readiness24h}
                onChange={(e) => setReadiness24h(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-white/20 bg-white/5 focus:ring-indigo-500"
              />
              <span>Готовность выйти на согласование за 24ч (+10 баллов)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={deposit48h}
                onChange={(e) => setDeposit48h(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-white/20 bg-white/5 focus:ring-indigo-500"
              />
              <span>Готовность внести задаток за 48ч (+10 баллов)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <span>Отправка заявки...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Подать заявку в тактовый дроп</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
