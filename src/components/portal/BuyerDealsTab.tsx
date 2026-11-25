import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  CheckCircle2,
  MessageSquare,
  Phone,
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Archive,
  XCircle,
  Award,
} from 'lucide-react';
import { BuyerCandidate, BuyerApplication, Lot, DealTrack, UserProfile } from '../../types';
import { formatRubles } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';

export interface BuyerDealsTabProps {
  userBids: BuyerCandidate[];
  activeApplications?: BuyerApplication[];
  archivedApplications?: BuyerApplication[];
  reliabilityScore?: number;
  buyerTier?: string;
  allLots: Lot[];
  allDeals: DealTrack[];
  user: UserProfile | null;
  onRefreshData?: () => Promise<void> | void;
  onDownloadBidProof: (bid: BuyerCandidate) => void;
  onOpenCuratorChat: (lotCode: string, dealId: string) => void;
  onOpenBuyerVault: (lotCode: string) => void;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash_100: '100% Кэш / СБР',
  cash_plus_mortgage: 'Кэш + Ипотека (Семейная / Рыночная)',
  family_mortgage: 'Семейная ипотека',
  mortgage_substitution: 'Кэш + Ипотека',
};

const APP_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  in_deal: {
    label: 'В активной сделке',
    className: 'bg-emerald-600 text-white shadow-xs',
  },
  priority_1: {
    label: 'Приоритет №1 (Окно 24ч / Депозит 48ч)',
    className: 'bg-amber-500 text-slate-950 font-black shadow-xs',
  },
  reserve_2: {
    label: 'Резерв №2 (Очередь отбора)',
    className: 'bg-indigo-100 text-indigo-900 border border-indigo-200',
  },
  reserve_3: {
    label: 'Резерв №3 (Очередь отбора)',
    className: 'bg-slate-200 text-slate-800 border border-slate-300',
  },
  standby_in_other_deal: {
    label: 'Заморожена (вы в другой сделке)',
    className: 'bg-amber-50 text-amber-900 border border-amber-300',
  },
  pending_review: {
    label: 'В очереди на отбор (Активна)',
    className: 'bg-sky-100 text-sky-900 border border-sky-200',
  },
  waitlist: {
    label: 'Лист ожидания (Активна)',
    className: 'bg-sky-100 text-sky-900 border border-sky-200',
  },
  withdrawn_from_queue: {
    label: 'Отозвана из очереди (без штрафа)',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  withdrawn_from_deal: {
    label: 'Отказ от сделки (-15 SLA)',
    className: 'bg-rose-100 text-rose-800 border border-rose-200',
  },
  rejected: {
    label: 'Отклонена / выбран другой кандидат',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  completed: {
    label: 'Сделка успешно закрыта',
    className: 'bg-emerald-100 text-emerald-900 border border-emerald-200',
  },
  lot_closed: {
    label: 'Лот закрыт / продан',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
  expired: {
    label: 'Истек срок SLA',
    className: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  withdrawn: {
    label: 'Отозвана заявителем',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
};

export const BuyerDealsTab: React.FC<BuyerDealsTabProps> = ({
  userBids,
  activeApplications = [],
  archivedApplications = [],
  reliabilityScore = 100,
  buyerTier,
  allLots,
  allDeals,
  user,
  onRefreshData,
  onDownloadBidProof,
  onOpenCuratorChat,
  onOpenBuyerVault,
}) => {
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [dealWithdrawTarget, setDealWithdrawTarget] = useState<BuyerApplication | null>(null);
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showArchive, setShowArchive] = useState<boolean>(false);

  const effectiveTier = (buyerTier || (user as any)?.buyerTier || 'silver').toLowerCase();
  const activeSlotCount = activeApplications.length;

  const handleQueueWithdraw = async (app: BuyerApplication) => {
    setWithdrawingId(app.id);
    setFeedbackMsg(null);
    try {
      const res = await apiClient.matching.withdrawApplication(
        app.id,
        'Отзыв заявки из очереди покупателем'
      );
      setFeedbackMsg({
        type: 'ok',
        text: res.message || `Заявка по лоту #${app.lotCode} отозвана без штрафа. Слот освобожден.`,
      });
      await onRefreshData?.();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'Не удалось отозвать заявку',
      });
    } finally {
      setWithdrawingId(null);
    }
  };

  const handleConfirmDealWithdraw = async () => {
    if (!dealWithdrawTarget) return;
    setWithdrawingId(dealWithdrawTarget.id);
    setFeedbackMsg(null);
    try {
      const res = await apiClient.matching.withdrawApplication(
        dealWithdrawTarget.id,
        withdrawReason.trim() || 'Отказ победителя от выхода на сделку'
      );
      setDealWithdrawTarget(null);
      setWithdrawReason('');
      setFeedbackMsg({
        type: 'ok',
        text:
          res.message ||
          `Вы отказались от сделки по лоту #${dealWithdrawTarget.lotCode}. Списано -15 баллов SLA.`,
      });
      await onRefreshData?.();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'Ошибка при отказе от сделки',
      });
    } finally {
      setWithdrawingId(null);
    }
  };

  // Fallback to legacy candidates only for lots not represented in buyer_applications
  const representedLotCodes = new Set(
    [...activeApplications, ...archivedApplications].map((a) => String(a.lotCode || '').toUpperCase())
  );
  const legacyOnlyBids = userBids.filter(
    (b) => !representedLotCodes.has(String(b.lotCode || '').toUpperCase())
  );

  return (
    <div className="space-y-6">
      {/* Main 3-Slot Active Applications Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Мои заявки на покупку ({activeSlotCount} из макс. 3 активных)
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                  effectiveTier === 'gold'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : effectiveTier === 'bronze'
                    ? 'bg-orange-50 text-orange-900 border-orange-200'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                {effectiveTier === 'gold' ? '🥇 Gold' : effectiveTier === 'bronze' ? '🥉 Bronze' : '🥈 Silver'} • SLA {reliabilityScore}/100
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Одновременно можно участвовать не более чем в 3 активных лотах. Отзыв из очереди свободен и без штрафов; отказ после победы снижает SLA на -15 баллов.
            </p>
          </div>
          <Link
            to="/opportunities"
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0"
          >
            Открыть каталог лотов РФ →
          </Link>
        </div>

        {feedbackMsg && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              feedbackMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {activeApplications.length === 0 && legacyOnlyBids.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700">
              У вас пока нет активных заявок на покупку
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Выберите проверенную квартиру в каталоге переуступок и подайте заявку в окно отбора (до 3 активных слотов одновременно).
            </p>
            <Link
              to="/opportunities"
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              <span>Перейти к выбору объекта</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeApplications.map((app) => {
              const matchedLot = allLots.find(
                (l) => l.lotCode.toUpperCase() === (app.lotCode || '').toUpperCase()
              );
              const linkedDeal = allDeals.find(
                (d) => d.lotCode.toUpperCase() === (app.lotCode || '').toUpperCase()
              );
              const lotDisplayTitle =
                app.lotTitle ||
                (matchedLot ? `${matchedLot.complexName} (${matchedLot.district})` : `Лот #${app.lotCode}`);
              const formattedDate = app.createdAt
                ? new Date(app.createdAt).toLocaleString('ru-RU')
                : 'Недавно';
              const statusKey = app.queueStatus || 'pending_review';
              const statusMeta = APP_STATUS_META[statusKey] || {
                label: statusKey,
                className: 'bg-slate-100 text-slate-800',
              };
              const isWinner = app.queueStatus === 'priority_1' || app.queueStatus === 'in_deal';
              const isStandby = app.queueStatus === 'standby_in_other_deal';
              const isWithdrawing = withdrawingId === app.id;

              const liquidityAmount =
                app.availableLiquidityRub || app.offeredPriceRub || app.lotPriceRub || 0;
              const paymentLabel =
                PAYMENT_LABEL[app.paymentMethod || 'cash_100'] || '100% Кэш / СБР';

              const curatorData = matchedLot?.curator;
              const curatorName =
                app.curatorName ||
                linkedDeal?.assignedEmployeeName ||
                linkedDeal?.curatorName ||
                curatorData?.name ||
                'Куратор DomExit';
              const curatorPhone = curatorData?.phone || '+7 (812) 409-00-00';
              const curatorTelegram = curatorData?.telegram || '@domexit_official';

              return (
                <div
                  key={app.id}
                  className={`p-5 rounded-2xl border space-y-4 transition-all ${
                    isWinner
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                      : isStandby
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/opportunities/${app.lotCode}`}
                          className="font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded text-xs"
                        >
                          #{app.lotCode}
                        </Link>
                        <Link
                          to={`/opportunities/${app.lotCode}`}
                          className="font-bold text-sm text-slate-900 hover:text-emerald-700"
                        >
                          {lotDisplayTitle}
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Подано: {formattedDate} • Заявитель: {app.userName || user?.name} ({user?.clientCode || app.userEmail})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-800 text-[11px] font-bold">
                        Score: {app.closingScore ?? 0}/105 • Match {app.matchScore ?? 0}%
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusMeta.className}`}>
                        {statusMeta.label}
                        {isStandby && app.activeDealLotCode ? ` (#${app.activeDealLotCode})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Подтвержденный бюджет:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {liquidityAmount > 0 ? formatRubles(liquidityAmount) : 'По Buy-Box профилю'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Формат расчетов:</span>
                      <span className="font-bold text-slate-800">{paymentLabel}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Условия и SLA:</span>
                      <span className="font-semibold text-slate-800">
                        {app.readiness24h ? 'Выход за 24ч' : 'Стандарт'} • {app.deposit48h ? 'Депозит 48ч' : 'По договору'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Цифровая подпись:</span>
                      <span className="inline-flex items-center space-x-1 font-bold text-emerald-700 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{app.ndaSigned ? 'ПЭП 63-ФЗ + NDA' : 'Оформляется'}</span>
                      </span>
                    </div>
                  </div>

                  {isStandby && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start space-x-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Вы уже выбраны победителем по лоту <strong>#{app.activeDealLotCode}</strong>. Эта заявка временно переведена в лист ожидания и автоматически вернется к активному отбору, если та сделка сорвется.
                      </span>
                    </div>
                  )}

                  {isWinner && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 font-bold">
                          <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            Поздравляем! Вы зафиксированы как Приоритет №1 по объекту #{app.lotCode}. Куратор сопровождает выход на аккредитив и ДДУ.
                          </span>
                        </div>
                        <Link
                          to={`/opportunities/${app.lotCode}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                        >
                          Паспорт лота →
                        </Link>
                      </div>

                      {linkedDeal?.escrowWorkflow?.step && (
                        <div className="bg-white/90 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                            Статус банковского закрытия сделки ({linkedDeal.escrowWorkflow.bankName || 'Эскроу / СБР'}):
                          </div>
                          <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                            {[
                              { id: 'curator_review', label: '1. Куратор' },
                              { id: 'escrow_opened', label: '2. Счёт СБР' },
                              { id: 'funds_deposited', label: '3. Депозит' },
                              { id: 'rosreestr_submitted', label: '4. Росреестр' },
                              { id: 'deal_finalized', label: '5. Выплата' },
                            ].map((st, idx) => {
                              const order = [
                                'curator_review',
                                'escrow_opened',
                                'funds_deposited',
                                'rosreestr_submitted',
                                'deal_finalized',
                              ];
                              const currentIdx = order.indexOf(linkedDeal.escrowWorkflow!.step);
                              const passed = idx <= currentIdx;
                              return (
                                <div
                                  key={st.id}
                                  className={`px-2 py-1.5 rounded-lg font-bold text-center border ${
                                    passed
                                      ? 'bg-emerald-600 text-white border-emerald-700'
                                      : 'bg-slate-50 text-slate-400 border-slate-200'
                                  }`}
                                >
                                  {st.label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2.5 border-t border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-100">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Персональный куратор сделки
                          </span>
                          <h5 className="font-bold text-xs text-slate-900">{curatorName}</h5>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenCuratorChat(app.lotCode, linkedDeal?.dealId || '')}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Чат с куратором</span>
                          </button>
                          <a
                            href={`tel:${curatorPhone.replace(/[^\d+]/g, '')}`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center space-x-1.5"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{curatorPhone}</span>
                          </a>
                          <a
                            href={
                              curatorTelegram.startsWith('http')
                                ? curatorTelegram
                                : `https://t.me/${curatorTelegram.replace('@', '')}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                            <span>Telegram</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => onOpenBuyerVault(app.lotCode)}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Документы сделки</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer actions: Withdraw from queue (0 penalty) OR Withdraw from active deal (-15 SLA modal) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                    <Link
                      to={`/opportunities/${app.lotCode}`}
                      className="text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                    >
                      Перейти к карточке объекта #{app.lotCode} →
                    </Link>

                    {isWinner ? (
                      <button
                        type="button"
                        disabled={isWithdrawing}
                        onClick={() => {
                          setDealWithdrawTarget(app);
                          setWithdrawReason('');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Отказаться от сделки</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isWithdrawing}
                        onClick={() => handleQueueWithdraw(app)}
                        className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isWithdrawing ? 'Отзыв...' : 'Отозвать заявку (без штрафа)'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Legacy Candidate Records Fallback */}
            {legacyOnlyBids.map((bid) => {
              const matchedLot = allLots.find(
                (l) => l.lotCode.toUpperCase() === (bid.lotCode || '').toUpperCase()
              );
              const lotDisplayTitle = matchedLot
                ? `${matchedLot.complexName} (${matchedLot.district})`
                : `Лот #${bid.lotCode}`;
              const formattedDate = bid.timestamp
                ? new Date(bid.timestamp).toLocaleString('ru-RU')
                : bid.requestedTimestamp;

              return (
                <div
                  key={bid.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/opportunities/${bid.lotCode}`}
                          className="font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-0.5 rounded text-xs"
                        >
                          #{bid.lotCode}
                        </Link>
                        <Link
                          to={`/opportunities/${bid.lotCode}`}
                          className="font-bold text-sm text-slate-900 hover:text-emerald-700"
                        >
                          {lotDisplayTitle}
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        Подано: {formattedDate} • Заявитель: {bid.name} ({bid.clientCode || user?.clientCode})
                      </span>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                      {bid.status === 'priority_reserved'
                        ? '✓ Утверждено куратором'
                        : 'На рассмотрении куратора'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Подтвержденный кэш:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatRubles(bid.availableLiquidity)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Регламент выхода:</span>
                      <span className="font-bold text-slate-800">{bid.readinessTimeline}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Документ к заявке:</span>
                      {bid.documentId || bid.bankApprovalDocUrl ? (
                        <button
                          type="button"
                          onClick={() => onDownloadBidProof(bid)}
                          className="text-sky-700 hover:underline font-bold flex items-center space-x-1 mt-0.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {bid.bankApprovalDocName || 'Подтверждение_ликвидности.pdf'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-400">В обработке</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archive Section */}
      {archivedApplications.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="flex items-center space-x-2 text-sm font-black text-slate-800 hover:text-indigo-700 cursor-pointer"
            >
              <Archive className="w-4 h-4 text-slate-500" />
              <span>Архив заявок ({archivedApplications.length})</span>
              <span className="text-xs font-semibold text-slate-400">
                {showArchive ? '▲ Свернуть' : '▼ Показать'}
              </span>
            </button>
          </div>

          {showArchive && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {archivedApplications.map((app) => {
                const statusKey = app.queueStatus || 'withdrawn';
                const isCompletedWin = statusKey === 'completed' || app.status === 'completed';
                const statusMeta = APP_STATUS_META[statusKey] || {
                  label: statusKey,
                  className: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div
                    key={app.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      isCompletedWin
                        ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/opportunities/${app.lotCode}`}
                          className="font-mono font-bold text-indigo-700 hover:underline"
                        >
                          #{app.lotCode}
                        </Link>
                        <span className="font-bold text-slate-900">{app.lotTitle || `Лот #${app.lotCode}`}</span>
                        {isCompletedWin && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                            🏆 Вы победили — сделка успешно закрыта
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500">
                        Подана: {app.createdAt ? new Date(app.createdAt).toLocaleString('ru-RU') : '—'}
                        {(app.completedAt || app.withdrawnAt)
                          ? ` • Завершена: ${new Date(app.completedAt || app.withdrawnAt || '').toLocaleString('ru-RU')}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {isCompletedWin && (
                        <button
                          type="button"
                          onClick={() => onOpenBuyerVault(app.lotCode)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center space-x-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Документы закрытия</span>
                        </button>
                      )}
                      <span className={`px-3 py-1 rounded-full font-bold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Winner Deal Withdrawal (-15 SLA Warning) */}
      {dealWithdrawTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Отказ от активной сделки по лоту #{dealWithdrawTarget.lotCode}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Вы уже закреплены победителем (Приоритет №1). При отказе от выхода на сделку:
                </p>
              </div>
            </div>

            <ul className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1.5 list-disc pl-6">
              <li>
                Ваш рейтинг надежности (<strong>SLA</strong>) будет снижен на <strong>-15 баллов</strong>.
              </li>
              <li>
                Объект <strong>#{dealWithdrawTarget.lotCode}</strong> вернется в активную продажу и перейдет следующему кандидату.
              </li>
              <li>
                Ваши замороженные заявки по другим лотам будут разморожены и вернутся в очередь отбора.
              </li>
            </ul>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Причина отказа (необязательно):
              </label>
              <input
                type="text"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Например: изменились условия одобрения ипотеки"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={withdrawingId === dealWithdrawTarget.id}
                onClick={() => setDealWithdrawTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Остаться в сделке
              </button>
              <button
                type="button"
                disabled={withdrawingId === dealWithdrawTarget.id}
                onClick={handleConfirmDealWithdraw}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
              >
                {withdrawingId === dealWithdrawTarget.id
                  ? 'Оформляем отказ...'
                  : 'Подтвердить отказ (-15 SLA)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
