import React from 'react';
import { Link } from 'react-router-dom';
import { Landmark, ExternalLink, AlertCircle, MessageCircle } from 'lucide-react';
import { KPIStats, Lot, SellerExitRequest, DealTrack } from '../../../types';
import { formatRubles } from '../../../utils/formatters';

export interface DashboardOverviewTabProps {
  kpis: KPIStats | null;
  sellerRequests: SellerExitRequest[];
  pendingSellerCount: number;
  lots: Lot[];
  allDeals: DealTrack[];
  curatorDialogs: Array<{
    lotCode: string;
    dealId?: string;
    senderName: string;
    senderRole: string;
    lastMessage: any;
    unreadCount: number;
  }>;
  onNavigateToSellers: () => void;
  onInspectLot: (lot: Lot, mode: 'approve' | 'docs' | 'reject') => void;
  onOpenCuratorChat: (lotCode: string) => void;
}

export const DashboardOverviewTab: React.FC<DashboardOverviewTabProps> = ({
  kpis,
  sellerRequests,
  pendingSellerCount,
  lots,
  allDeals,
  curatorDialogs,
  onNavigateToSellers,
  onInspectLot,
  onOpenCuratorChat,
}) => {
  const urgentLots = lots.filter(
    (l) => l.approvalStatus === 'pending_owner_approval' || l.additionalDocsRequested?.status === 'pending'
  );

  return (
    <div className="space-y-6">
      {/* Top 4 Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ЗАЯВКИ НА ВЫХОД В КОНТУРЕ
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
              {pendingSellerCount > 0
                ? `${pendingSellerCount} новых`
                : kpis?.todayNewRequestsGrowth || 'Активно'}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {kpis?.todayNewRequestsCount ?? sellerRequests.length} заявок
          </div>
          <p className="text-xs text-slate-500">
            Сумма возврата:{' '}
            <strong className="text-slate-800">
              {formatRubles(kpis?.todayNewRequestsReturnRub || 0)}
            </strong>
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              АКТИВНЫЕ ЛОТЫ В РЕЕСТРЕ
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
              Дисконт {kpis?.averageDiscountPercent ?? 21.8}%
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {kpis?.activeLotsCount ?? lots.length} объектов
          </div>
          <p className="text-xs text-slate-500">
            СПб: {kpis?.activeLotsSpbCount ?? 0} | МСК: {kpis?.activeLotsMskCount ?? 0} | Регионы РФ:{' '}
            {kpis?.activeLotsRegionsCount ?? 0}
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              СДЕЛКИ В БАНКАХ / РОСРЕЕСТРЕ
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
              {formatRubles(kpis?.dealsInEscrowTotalRub || 0)}
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {kpis?.dealsInEscrowStageCount ?? 0} эскроу
          </div>
          <p className="text-xs text-slate-500">
            Сбербанк: {kpis?.dealsInSberCount ?? 0} | ВТБ/Альфа: {kpis?.dealsInVtbCount ?? 0}
          </p>
        </div>

        {/* KPI 4: Company Revenue */}
        <div className="bg-emerald-50/60 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              ОЖИДАЕМАЯ КОМИССИЯ (2.5%)
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase shadow-xs">
              0 ₽ с продавцов
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-700">
            {formatRubles(kpis?.expectedCommissionMonthlyRub || 0)}
          </div>
          <p className="text-xs text-emerald-800/80">
            Факт: {formatRubles(kpis?.actualCommissionMonthlyRub || 0)} | В резерве:{' '}
            {formatRubles(kpis?.reservedCommissionMonthlyRub || 0)}
          </p>
        </div>
      </div>

      {/* Deals Pipeline & Critical Deadlines Summary */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-emerald-600" />
              <span>Воронка сделок и мониторинг СБР / Эскроу</span>
            </h3>
            <p className="text-xs text-slate-500">
              Текущие сделки на этапах одобрения, депонирования и регистрации в Росреестре.
            </p>
          </div>
          <Link
            to="/admin/pipeline"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors flex items-center space-x-1.5"
          >
            <span>Полная воронка сделок →</span>
          </Link>
        </div>

        {allDeals.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
            Активных сделок в воронке пока нет
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Код сделки / Лот</th>
                  <th className="py-3 px-3">Участники</th>
                  <th className="py-3 px-3">Банк-партнер</th>
                  <th className="py-3 px-3">Сумма СБР</th>
                  <th className="py-3 px-3">Текущий этап</th>
                  <th className="py-3 px-3 text-right">Комната сделки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allDeals.slice(0, 6).map((deal) => {
                  const stageBadge = {
                    initial_audit: { label: 'Аудит документов', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                    document_check: { label: 'Проверка комплаенс', color: 'bg-sky-50 text-sky-800 border-sky-200' },
                    packaging: { label: 'Упаковка и скоринг', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
                    buyer_matching: { label: 'Поиск покупателя', color: 'bg-purple-50 text-purple-800 border-purple-200' },
                    closing_escrow: { label: 'Эскроу в банке', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                    completed: { label: 'Сделка закрыта ✓', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                  }[deal.stage] || { label: deal.stage, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                  const dealBank = deal.escrowWorkflow?.bankName || 'Сбербанк';
                  const dealAmount = deal.escrowWorkflow?.depositedAmountRub || deal.sellerReturnRub || 0;

                  return (
                    <tr key={deal.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 font-mono">{deal.dealId}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {deal.lotTitle || deal.lotCode}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-900 font-medium">{deal.buyerName || 'Покупатель'}</div>
                        <div className="text-[11px] text-slate-400">
                          Продавец: {deal.sellerName || deal.clientName || 'Собственник'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{dealBank}</td>
                      <td className="py-3 px-3 font-bold font-mono text-emerald-700">
                        {dealAmount ? formatRubles(dealAmount) : '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${stageBadge.color}`}>
                          {stageBadge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link
                          to={`/admin/closing/${deal.dealId}`}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors inline-flex items-center space-x-1"
                        >
                          <span>Открыть</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Urgent Attention Desk: Lots awaiting approval / docs */}
      {urgentLots.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/60">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              <h4 className="text-sm font-black text-amber-950">
                Объекты, требующие внимания владельца ({urgentLots.length})
              </h4>
            </div>
            <button
              type="button"
              onClick={onNavigateToSellers}
              className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
            >
              Перейти к рассмотрению заявок →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentLots.slice(0, 6).map((lot) => (
              <div key={lot.id} className="p-3 bg-white rounded-2xl border border-amber-200/80 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-xs text-slate-900 truncate">{lot.complexName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      lot.approvalStatus === 'pending_owner_approval'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {lot.approvalStatus === 'pending_owner_approval' ? 'Ожидает аккредитации' : 'Запрос документов'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {lot.district} • {lot.developer}
                </p>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                  <span className="font-bold font-mono text-emerald-700">
                    {formatRubles(lot.cashPaidBySeller)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onInspectLot(lot, 'approve')}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    Рассмотреть →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INCOMING MESSAGES DESK: Curator Direct Chat Messages */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-indigo-600" />
              <span>Входящие сообщения от клиентов (Чат с куратором)</span>
              {curatorDialogs.reduce((sum, d) => sum + d.unreadCount, 0) > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-black animate-pulse">
                  {curatorDialogs.reduce((sum, d) => sum + d.unreadCount, 0)} непрочитанных
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Прямой канал связи с покупателями и продавцами по объектам и активным сделкам.
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-xs font-medium">
            Диалогов: {curatorDialogs.length}
          </span>
        </div>

        {curatorDialogs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Нет активных сообщений в чатах с куратором.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {curatorDialogs.map((dialog) => (
              <div
                key={dialog.lotCode}
                className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{dialog.lotCode}</span>
                    <span className="text-[11px] font-medium text-slate-600">{dialog.senderName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                      {dialog.senderRole === 'buyer'
                        ? 'Покупатель'
                        : dialog.senderRole === 'seller'
                        ? 'Продавец'
                        : 'Клиент'}
                    </span>
                    {dialog.unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                        +{dialog.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 truncate max-w-md">
                    {dialog.lastMessage?.text || 'Новый диалог'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenCuratorChat(dialog.lotCode)}
                  className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Открыть чат</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
