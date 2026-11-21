import React from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  CheckCircle2,
  MessageSquare,
  Phone,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { BuyerCandidate, Lot, DealTrack, UserProfile } from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface BuyerDealsTabProps {
  userBids: BuyerCandidate[];
  allLots: Lot[];
  allDeals: DealTrack[];
  user: UserProfile | null;
  onDownloadBidProof: (bid: BuyerCandidate) => void;
  onOpenCuratorChat: (lotCode: string, dealId: string) => void;
  onOpenBuyerVault: (lotCode: string) => void;
}

export const BuyerDealsTab: React.FC<BuyerDealsTabProps> = ({
  userBids,
  allLots,
  allDeals,
  user,
  onDownloadBidProof,
  onOpenCuratorChat,
  onOpenBuyerVault,
}) => {
  return (
    <div className="space-y-6">
      {/* Live Buyer Bids List */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Ваши заявки на покупку ({userBids.length} из макс. 3 активных)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Все поданные предложения синхронизированы с модулем матчмейкинга ответственного куратора.
            </p>
          </div>
          <Link
            to="/opportunities"
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Открыть каталог лотов РФ →
          </Link>
        </div>

        {userBids.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-3">
            <p className="text-sm font-bold text-slate-700">
              У вас пока нет активных предложений о покупке
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Выберите проверенную квартиру в каталоге переуступок и подайте заявку в ежедневное окно отбора.
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
            {userBids.map((bid) => {
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

                    <div className="flex flex-wrap items-center gap-2">
                      {bid.buyerTrack === 'mortgage_substitution' ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Трек: Кэш + Ипотека
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Трек: 100% Кэш
                        </span>
                      )}

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          bid.status === 'priority_reserved'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : bid.status === 'declined' ||
                              bid.status === 'withdrawn_accepted_elsewhere'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {bid.status === 'priority_reserved'
                          ? '✓ Утверждено куратором!'
                          : bid.status === 'under_review'
                          ? 'Ликвидность проверена • В финале'
                          : bid.status === 'withdrawn_accepted_elsewhere'
                          ? 'Авто-отзыв (одобрен другой лот)'
                          : bid.status === 'declined'
                          ? 'Выбран другой кандидат'
                          : 'На рассмотрении куратора'}
                      </span>
                    </div>
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

                  {bid.status === 'priority_reserved' && (() => {
                    const linkedDeal = allDeals.find(
                      (d) => d.lotCode.toUpperCase() === (bid.lotCode || '').toUpperCase()
                    );
                    const matchedLot = allLots.find(
                      (l) => l.lotCode.toUpperCase() === (bid.lotCode || '').toUpperCase()
                    );
                    const curatorData = matchedLot?.curator;
                    const wfStep = linkedDeal?.escrowWorkflow?.step || 'curator_review';
                    const curatorName =
                      linkedDeal?.assignedEmployeeName ||
                      linkedDeal?.curatorName ||
                      curatorData?.name ||
                      'Алексей Смирнов';
                    const curatorPhone = curatorData?.phone || '+7 (921) 456-78-90';
                    const curatorTelegram = curatorData?.telegram || '@domexit_official';
                    const curatorMax = curatorData?.maxProfile || curatorData?.whatsapp;
                    const curatorPhoto = curatorData?.photoUrl;
                    return (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              {wfStep === 'curator_review' &&
                                'Ваша заявка утверждена куратором! Готовится передача пакета документов в банк-партнёр.'}
                              {wfStep === 'bank_escrow_deposit' &&
                                'Шаг 1 синхронизирован: Документы переданы в банк • Открывается аккредитив СБР.'}
                              {wfStep === 'signing_photos' &&
                                'Шаг 2 синхронизирован: Средства надежно заблокированы в банке (Депонирование СБР подтверждено). Назначено подписание.'}
                              {wfStep === 'bank_funds_release' &&
                                'Шаг 3 синхронизирован: Подписание завершено, штамп Росреестра загружен • Передано в банк на раскрытие аккредитива.'}
                              {wfStep === 'deal_finalized' &&
                                'Шаг 4 завершён: Аккредитив СБР раскрыт, транши выплачены • Сделка официально закрыта!'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <Link
                              to={`/opportunities/${bid.lotCode}`}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0"
                            >
                              Паспорт лота →
                            </Link>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-emerald-100 shadow-2xs">
                            <div className="flex items-center space-x-3">
                              {curatorPhoto ? (
                                <img
                                  src={curatorPhoto}
                                  alt={curatorName}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                                  {curatorName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                                  Ваш персональный куратор сделки
                                </span>
                                <h5 className="font-bold text-xs text-slate-900">{curatorName}</h5>
                                <p className="text-[11px] text-slate-500 max-w-lg mt-0.5">
                                  Сопровождение открытия аккредитива в банке, согласование с застройщиком и регистрация в Росреестре
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onOpenCuratorChat(bid.lotCode || '', linkedDeal?.dealId || '')}
                                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Чат с куратором</span>
                              </button>
                              <a
                                href={`tel:${curatorPhone.replace(/[^\d+]/g, '')}`}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center space-x-1.5 transition-colors"
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
                                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-colors"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                                <span>Telegram</span>
                              </a>
                              {curatorMax && (
                                <a
                                  href={
                                    curatorMax.startsWith('http') || curatorMax.startsWith('max://')
                                      ? curatorMax
                                      : `https://max.im/${curatorMax.replace(/[^\w]/g, '')}`
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-black text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
                                  title="Профиль MAX (Messenger / App)"
                                >
                                  <span className="w-3.5 h-3.5 rounded bg-indigo-600 text-white text-[8px] font-black flex items-center justify-center">
                                    M
                                  </span>
                                  <span>MAX</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onOpenBuyerVault(bid.lotCode || '')}
                                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Документы сделки</span>
                              </button>
                            </div>
                          </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
