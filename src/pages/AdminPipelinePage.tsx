import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import { DealsRepository } from '../dal/repositories/DealsRepository';
import { AuditLogsRepository } from '../dal/repositories/AuditLogsRepository';
import { DealTrack } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
} from 'lucide-react';

export const AdminPipelinePage: React.FC = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<DealTrack[]>([]);
  const [activeRouteFilter, setActiveRouteFilter] = useState<string>('all');
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isEmployee = user?.activeRole === 'employee';
  const currentEmployeeId = user?.assignedEmployeeId || 'emp-1';
  const operatorName =
    user?.name || (isEmployee ? 'Алексей Смирнов (Куратор)' : 'Виктор Сергеевич (CEO)');

  useEffect(() => {
    async function loadDeals() {
      const data = isEmployee
        ? await DealsRepository.getByEmployee(currentEmployeeId)
        : await DealsRepository.getAll();
      setDeals(data);
    }
    loadDeals();
  }, [isEmployee, currentEmployeeId]);

  const moveDealStage = async (deal: DealTrack, nextStage: DealTrack['stage'], nextLabel: string) => {
    const updated = await DealsRepository.updateStage(deal.dealId, nextStage);
    if (updated) {
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));

      await AuditLogsRepository.addLog({
        lotCode: deal.lotCode,
        dealId: deal.dealId,
        operatorName,
        operatorRole: isEmployee ? 'curator' : 'owner',
        actionType: 'packaging_published',
        title: `Сделка ${deal.dealId} (#${deal.lotCode}) переведена на этап: ${nextLabel}`,
        description: `Оператор ${operatorName} обновил статус сделки в канбан-воронке.`,
      });

      setToastMsg(`Сделка #${deal.lotCode} переведена: ${nextLabel}`);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const dduCount = deals.filter((d) => d.route === 'ddu_assignment').length;
  const fastCashCount = deals.filter((d) => d.route === 'fast_cash').length;
  const tradeInCount = deals.filter((d) => d.route === 'trade_in_6').length;
  const urgentCount = deals.filter((d) => d.daysLeft <= 14).length;

  const avgDays =
    deals.length > 0
      ? (deals.reduce((acc, d) => acc + Math.max(1, d.daysLeft), 0) / deals.length).toFixed(1)
      : '9.5';

  const filteredDeals = deals.filter((d) => {
    if (activeRouteFilter !== 'all' && d.route !== activeRouteFilter) return false;
    if (urgentOnly && d.daysLeft > 14) return false;
    return true;
  });

  const columns: {
    stage: DealTrack['stage'];
    title: string;
    next?: DealTrack['stage'];
    nextTitle?: string;
  }[] = [
    {
      stage: 'initial_audit',
      title: '1. Первичный аудит ДДУ',
      next: 'document_check',
      nextTitle: 'В документы →',
    },
    {
      stage: 'document_check',
      title: '2. Проверка документов',
      next: 'packaging',
      nextTitle: 'В упаковку →',
    },
    {
      stage: 'packaging',
      title: '3. Упаковка и публикация',
      next: 'buyer_matching',
      nextTitle: 'В подбор →',
    },
    {
      stage: 'buyer_matching',
      title: '4. Подбор покупателя',
      next: 'closing_escrow',
      nextTitle: 'На эскроу →',
    },
    { stage: 'closing_escrow', title: '5. Сделка и выплата (Эскроу)' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title={
            isEmployee
              ? 'Моя воронка сопровождения сделок (Изолированный контур)'
              : 'Глобальная воронка сопровождения выходов и сделок'
          }
          subtitle="Канбан-управление этапами переуступок 214-ФЗ, комплаенса 152-ФЗ и банковских расчетов"
        />

        {toastMsg && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-white/80 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>
        )}

        <div className="p-6 space-y-6 max-w-[1600px] w-full">
          {/* Top Conversion Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {isEmployee ? `КУРАТОР: ${operatorName}` : 'ИНСТИТУЦИОНАЛЬНЫЙ КОНТРОЛЬ'}
              </span>
              <h2 className="text-xl font-black text-slate-900">
                Канбан-воронка 5 этапов ({deals.length} сделок)
              </h2>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-right shadow-xs">
                <span className="text-[10px] text-slate-500 uppercase block">Активных в работе</span>
                <span className="text-base font-black text-emerald-700">{deals.length}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-right shadow-xs">
                <span className="text-[10px] text-slate-500 uppercase block">Средний резерв</span>
                <span className="text-base font-black text-sky-700">{avgDays} дн.</span>
              </div>
            </div>
          </div>

          {/* Route Filters & Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              {[
                { id: 'all', label: `Все маршруты (${deals.length})` },
                { id: 'ddu_assignment', label: `Маршрут 1: ДДУ Переуступка (${dduCount})` },
                { id: 'fast_cash', label: `Маршрут 2: Быстрый кэш (${fastCashCount})` },
                { id: 'trade_in_6', label: `Маршрут 3: Трейд-ин 6% (${tradeInCount})` },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveRouteFilter(r.id)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    activeRouteFilter === r.id
                      ? 'bg-white text-emerald-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setUrgentOnly(!urgentOnly)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs ${
                  urgentOnly
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>&le;14 дней ({urgentCount})</span>
              </button>

              <Link
                to="/sellers"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Создать сделку</span>
              </Link>
            </div>
          </div>

          {/* 5 Interactive Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
            {columns.map((col) => {
              const colDeals = filteredDeals.filter(
                (d) =>
                  d.stage === col.stage ||
                  (col.stage === 'closing_escrow' && d.stage === 'completed')
              );
              const colVolume = colDeals.reduce((sum, d) => sum + d.sellerReturnRub, 0);

              return (
                <div
                  key={col.stage}
                  className="bg-slate-100/70 rounded-2xl border border-slate-200 p-3.5 space-y-3 min-h-[550px] flex flex-col justify-between"
                >
                  <div className="space-y-1 pb-2 border-b border-slate-200">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                        {col.title}
                      </h4>
                      <span className="w-5 h-5 rounded-full bg-white border border-slate-200 text-emerald-700 font-mono font-bold text-[10px] flex items-center justify-center shadow-xs">
                        {colDeals.length}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      Объем: {formatRubles(colVolume)}
                    </span>
                  </div>

                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {colDeals.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Нет активных сделок на этапе
                      </div>
                    ) : (
                      colDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="bg-white border border-slate-200/90 hover:border-emerald-300 rounded-xl p-3.5 space-y-2.5 transition-all shadow-xs"
                        >
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-mono font-bold text-slate-800">
                              #{deal.lotCode}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                deal.daysLeft <= 6
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {deal.daysLeft === 0 ? 'Закрыто' : `${deal.daysLeft} дн.`}
                            </span>
                          </div>

                          <div>
                            <h5 className="font-bold text-xs text-slate-900 leading-tight">
                              {deal.lotTitle}
                            </h5>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {deal.developer} • Клиент: {deal.clientName}
                            </span>
                          </div>

                          <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-[11px] space-y-0.5 font-mono">
                            <div className="flex justify-between text-emerald-700 font-bold">
                              <span>Возврат:</span>
                              <span>{formatRubles(deal.sellerReturnRub)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>Дисконт:</span>
                              <span>-{formatRubles(deal.discountRub)}</span>
                            </div>
                          </div>

                          {/* Direct Operational Links */}
                          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                            <Link
                              to={`/admin/legal-audit/${deal.lotCode}`}
                              className="py-1 px-2 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-center"
                            >
                              ⚖️ Аудит
                            </Link>
                            <Link
                              to={
                                deal.stage === 'closing_escrow'
                                  ? `/admin/closing/${deal.dealId}`
                                  : deal.stage === 'buyer_matching'
                                  ? `/admin/matchmaker/${deal.lotCode}`
                                  : `/admin/packaging/${deal.lotCode}`
                              }
                              className="py-1 px-2 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-center"
                            >
                              {deal.stage === 'closing_escrow'
                                ? '🏦 Эскроу'
                                : deal.stage === 'buyer_matching'
                                ? '👥 Подбор'
                                : '📦 Упаковка'}
                            </Link>
                          </div>

                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                            <span className="text-emerald-700 flex items-center space-x-1 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ФССП: Чисто</span>
                            </span>
                            <span>•</span>
                            <span className="truncate">{deal.curatorName}</span>
                          </div>

                          {col.next && (
                            <button
                              type="button"
                              onClick={() =>
                                moveDealStage(deal, col.next!, col.nextTitle || col.next!)
                              }
                              className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 text-[11px] font-bold transition-all flex items-center justify-center space-x-1 border border-slate-200 shadow-xs cursor-pointer"
                            >
                              <span>{col.nextTitle}</span>
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
