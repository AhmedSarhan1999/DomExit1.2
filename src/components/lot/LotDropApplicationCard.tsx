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
  const [activeSlotsCount, setActiveSlotsCount] = useState<number>(0);

  const isSelfSeller = Boolean(
    user &&
      (lot.sellerUserId === user.id ||
        (lot as any).sellerId === user.id ||
        (user.email && (lot as any).sellerEmail && String((lot as any).sellerEmail).trim().toLowerCase() === String(user.email).trim().toLowerCase()))
  );

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

  // Load user buyBox tier & check existing app strictly matching lotCode
  useEffect(() => {
    setHasExistingApp(false);
    setAppliedApp(null);
    if (!user) return;
    const fetchUserStatus = async () => {
      try {
        const [bbRes, myAppsRes] = await Promise.all([
          apiClient.matching.getMyBuyBox().catch(() => null),
          apiClient.matching.getMyApplications().catch(() => null),
        ]);

        const resolvedTier = bbRes?.buyBox?.tier || bbRes?.tier || myAppsRes?.tier || (user.buyerTier as BuyBoxTier);
        if (resolvedTier) {
          setUserTier(resolvedTier);
        }

        if (myAppsRes?.ok) {
          setActiveSlotsCount(myAppsRes.activeCount || 0);
          const targetCode = String(lot.lotCode || '').trim().toUpperCase();
          const validApp = (myAppsRes.activeApplications || []).find(
            (a: any) => String(a.lotCode || '').trim().toUpperCase() === targetCode
          );
          if (validApp) {
            setHasExistingApp(true);
            setAppliedApp(validApp);
          }
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
    <div className="bg-white rounded-3xl p-5 sm:p-6 text-slate-900 border border-emerald-200/90 shadow-xs space-y-4">
      {/* Wave Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center space-x-1.5 ${
              isGoldWave
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : dropConfig.waveStatus === 'silver_wave'
                ? 'bg-slate-100 text-slate-800 border-slate-300'
                : 'bg-rose-100 text-rose-800 border-rose-300'
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
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-700">
            <Clock className="w-3.5 h-3.5" />
            <span>{remainingText}</span>
          </div>
        )}
      </div>

      {/* Seats Meter */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium">Ограничение очереди:</span>
          <span className="font-bold font-mono text-slate-900">
            Осталось {remainingSeats} из {maxCap} мест
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCapped ? 'bg-rose-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${Math.min(100, (currentCount / maxCap) * 100)}%` }}
          />
        </div>
      </div>

      {/* Self-Owner Guard OR Existing Application Banner */}
      {isSelfSeller ? (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1.5 text-indigo-950">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Это ваш объект (вы продавец)</span>
          </div>
          <p className="text-[11px] text-indigo-700 leading-relaxed">
            Подача заявки на покупку собственного объекта недоступна. Управляйте продажей и документами в разделе «Я продавец» личного кабинета.
          </p>
        </div>
      ) : hasExistingApp && appliedApp ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2 text-emerald-950">
          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>Ваша заявка принята в тактовый дроп!</span>
          </div>
          <p className="text-xs text-slate-700">
            Ваш Closing Score: <strong>{appliedApp.closingScore || 100}/105</strong>. Статус в очереди:{' '}
            <strong className="text-amber-800">
              {appliedApp.queueStatus === 'standby_in_other_deal'
                ? `В листе ожидания (активная сделка по #${appliedApp.activeDealLotCode || 'другому лоту'})`
                : appliedApp.queueStatus === 'priority_1'
                ? 'Выбраны победителем (№1)'
                : appliedApp.queueStatus || 'На рассмотрении'}
            </strong>.
          </p>
        </div>
      ) : activeSlotsCount >= 3 ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-amber-950">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Достигнут лимит активных заявок (3 из 3)</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Одновременно можно участвовать не более чем в 3 сделках/очередях. Вы можете отозвать одну из открытых заявок в личном кабинете, чтобы подать на этот объект.
          </p>
        </div>
      ) : isCapped ? (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>Лимит мест ({maxCap}) в текущем тактовом окне исчерпан. Ожидайте ротации.</span>
        </div>
      ) : isExpired ? (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center space-x-2">
          <Clock className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Окно приема заявок завершено.</span>
        </div>
      ) : isGoldRestricted ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-900">
          <div className="flex items-center space-x-2 font-bold text-amber-800">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Окно раннего доступа Gold</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Подача заявок для Silver откроется автоматически после завершения окна Gold. Вы можете подать предварительную заявку через нашего Telegram-бота.
          </p>
        </div>
      ) : (
        /* Application Form */
        <form onSubmit={handleApply} className="space-y-3 pt-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Price Acceptance */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              1. Ценовое предложение:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPriceAcceptance('full_price')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  priceAcceptance === 'full_price'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
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
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="font-bold flex items-center space-x-1">
                  <span>Выше (+2%)</span>
                  <Flame className="w-3 h-3 text-amber-300" />
                </div>
                <div className="text-[10px] opacity-80">+10 баллов в Closing</div>
              </button>
            </div>
          </div>

          {/* Step 2: Readiness speed */}
          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={readiness24h}
                onChange={(e) => setReadiness24h(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 bg-white focus:ring-emerald-500"
              />
              <span>Готовность выйти на согласование за 24ч (+10 баллов)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={deposit48h}
                onChange={(e) => setDeposit48h(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 border-slate-300 bg-white focus:ring-emerald-500"
              />
              <span>Готовность внести задаток за 48ч (+10 баллов)</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 mt-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
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
