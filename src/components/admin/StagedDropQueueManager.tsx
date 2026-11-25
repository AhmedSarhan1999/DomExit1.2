import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Award,
  ArrowRight,
  TrendingUp,
  RotateCcw,
  Play,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Lot, BuyerApplication, BuyBoxTier, LotDropConfig } from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface StagedDropQueueManagerProps {
  lot: Lot;
  onLotUpdated?: () => void;
  onShowToast?: (msg: string) => void;
  onShowWarning?: (msg: string) => void;
}

export const StagedDropQueueManager: React.FC<StagedDropQueueManagerProps> = ({
  lot,
  onLotUpdated,
  onShowToast,
  onShowWarning,
}) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [totalApplications, setTotalApplications] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);

  // Drop configuration parameters (Default 0: open to all clients immediately)
  const [goldExclusiveHours, setGoldExclusiveHours] = useState<number>(0);
  const [windowHours, setWindowHours] = useState<number>(48);
  const [maxApplicationsCap, setMaxApplicationsCap] = useState<number>(5);

  const dropConfig: LotDropConfig | undefined = lot.dropConfig;
  const isStagedDrop = dropConfig && dropConfig.mode === 'staged_drop';

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.matching.getLotQueue(lot.lotCode);
      if (res.ok) {
        setQueue(res.queue || []);
        setTotalApplications(res.totalApplications || 0);
      }
    } catch (err: any) {
      console.warn('[StagedDropQueueManager] Failed to load queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [lot.lotCode]);

  const handleLaunchDrop = async () => {
    setActionLoading(true);
    try {
      const res = await apiClient.matching.launchLotDrop(lot.lotCode, {
        goldExclusiveHours,
        windowHours,
        maxApplicationsCap,
      });

      if (res.ok) {
        onShowToast?.(`Закрытый тактовый дроп по лоту #${lot.lotCode} успешно запущен!`);
        onLotUpdated?.();
        loadQueue();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось запустить тактовый дроп');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectPriority = async () => {
    const eligible = queue.filter((a) => a.queueStatus !== 'standby_in_other_deal');
    if (eligible.length === 0) {
      onShowWarning?.(
        queue.length === 0
          ? 'В очереди нет активных заявок для выбора приоритета'
          : 'Все кандидаты в очереди сейчас заняты в других активных сделках (лист ожидания).'
      );
      return;
    }

    setActionLoading(true);
    try {
      const p1 = eligible[0]?.id;
      const r2 = eligible[1]?.id;
      const r3 = eligible[2]?.id;

      const res = await apiClient.matching.selectLotPriority(lot.lotCode, {
        priority1AppId: p1,
        reserve2AppId: r2,
        reserve3AppId: r3,
      });
      if (res.ok) {
        onShowToast?.(`Кандидат №1 зафиксирован с дедлайном 24ч на просмотр и 48ч на депозит!`);
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Ошибка распределения приоритета');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteNext = async (reason: string = 'no_show') => {
    setActionLoading(true);
    try {
      const currentP1 = queue.find((a) => a.queueStatus === 'priority_1') || queue[0];
      const res = await apiClient.matching.promoteNextInQueue(lot.lotCode, {
        previousPriority1AppId: currentP1?.id,
        reason: reason as any,
      });
      if (res.ok) {
        onShowToast?.(`Очередь передана кандидату №2! Статус обновлен.`);
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось передать очередь кандидату из резерва');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmStep = async (step: 'completed_viewing' | 'escrow_confirmed') => {
    const currentP1 = queue.find((a) => a.queueStatus === 'priority_1') || queue[0];
    if (!currentP1) return;
    setActionLoading(true);
    try {
      const res = await apiClient.matching.confirmStep({
        lotCode: lot.lotCode,
        userId: currentP1.userId,
        step,
      });
      if (res.ok) {
        onShowToast?.(res.message || 'Этап успешно подтвержден! Начислено +5 к SLA надежности.');
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось подтвердить этап сделки');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSlaSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await apiClient.matching.runSlaSweep();
      if (res.ok) {
        onShowToast?.(`SLA Sweeper выполнен: проверено лотов: ${res.scannedLotsCount}, продвинуто: ${res.promotedCount}, штрафов: ${res.penalizedCount}`);
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Ошибка запуска SLA Sweeper');
    } finally {
      setIsSweeping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Staged Drop Control Panel */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 text-slate-900 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-300/60 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>УПРАВЛЕНИЕ ТАКТОВЫМ ДРОПОМ (STAGED DROP)</span>
              </span>
              {isStagedDrop && (
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    dropConfig.waveStatus === 'silver_wave' ||
                    (dropConfig.goldExclusiveHours || 0) === 0 ||
                    (dropConfig.goldExclusiveUntil && new Date() >= new Date(dropConfig.goldExclusiveUntil))
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : dropConfig.waveStatus === 'gold_wave'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : dropConfig.waveStatus === 'capped_closed'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}
                >
                  {dropConfig.waveStatus === 'silver_wave' ||
                  (dropConfig.goldExclusiveHours || 0) === 0 ||
                  (dropConfig.goldExclusiveUntil && new Date() >= new Date(dropConfig.goldExclusiveUntil))
                    ? '🟢 Открытый прием заявок (Все клиенты)'
                    : dropConfig.waveStatus === 'gold_wave'
                    ? `🥇 Волна Gold (${dropConfig.goldExclusiveHours || 24}ч)`
                    : dropConfig.waveStatus === 'capped_closed'
                    ? '🛑 Квота исчерпана'
                    : '⌛ Раунд закрыт'}
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-slate-900">
              {isStagedDrop ? 'Активный тактовый раунд лота #' + lot.lotCode : 'Запуск закрытого тактового дропа'}
            </h3>
          </div>

          {/* Quick Drop Launch / Re-Drop Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleLaunchDrop}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isStagedDrop ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isStagedDrop ? 'Перезапустить дроп (Re-Drop)' : 'Запустить тактовый дроп'}</span>
            </button>
          </div>
        </div>

        {/* Drop Settings Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-slate-600 font-medium block text-[11px]">
              Эксклюзивное окно Gold (0 — открыт сразу):
            </span>
            <input
              type="number"
              min="0"
              max="72"
              value={goldExclusiveHours}
              onChange={(e) => setGoldExclusiveHours(Math.max(0, Number(e.target.value)))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-slate-600 font-medium block text-[11px]">
              Общая длительность дропа (часы):
            </span>
            <input
              type="number"
              min="6"
              max="168"
              value={windowHours}
              onChange={(e) => setWindowHours(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
            <span className="text-slate-600 font-medium block text-[11px]">
              Лимит заявок в очереди (Cap):
            </span>
            <input
              type="number"
              min="3"
              max="20"
              value={maxApplicationsCap}
              onChange={(e) => setMaxApplicationsCap(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:border-emerald-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Explanatory SLA & State Machine Ribbon */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-xs space-y-2 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 font-bold text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>РЕГЛАМЕНТ ТАКТОВОГО ДРОПА И SLA ОЧЕРЕДИ (Этап 3 → Этап 4)</span>
          </div>
          <button
            type="button"
            disabled={isSweeping}
            onClick={handleRunSlaSweep}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto shrink-0"
            title="Запустить принудительную проверку просроченных дедлайнов (SLA Sweeper)"
          >
            <RotateCcw className={`w-3 h-3 ${isSweeping ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>{isSweeping ? 'Проверка SLA...' : 'Тест SLA Sweeper (Staging)'}</span>
          </button>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          • <strong>Кандидат №1</strong> получает эксклюзивное окно: <strong>24 часа</strong> на подтверждение просмотра объекта и <strong>48 часов</strong> на внесение обеспечения/депозита в эскроу. При фиксации №1 лот и связанная сделка автоматически переходят в статус <em>«Сделка / Эскроу» (Этап 4)</em>.
          <br />
          • Если Кандидат №1 срывает дедлайн или отказывается от сделки, SLA Sweeper автоматически понижает его рейтинг надежности (-15 баллов) и передает приоритет <strong>Резерву №2</strong>. Если резерва нет — лот возвращается на открытую витрину <em>(Этап 3)</em>.
        </p>
      </div>

      {/* 2. Hybrid Queue Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Гибридная очередь покупателей (Closing Score 0–105)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ранжирование по методологии DomExit: Способ оплаты (40) + Надежность (20) + Цена (25) + Скорость (20).
            </p>
          </div>

          {/* Action Buttons for Queue */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionLoading || queue.length === 0}
              onClick={handleSelectPriority}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Выбрать №1 + Резерв</span>
            </button>

            <button
              type="button"
              disabled={actionLoading || queue.length === 0}
              onClick={() => handlePromoteNext('no_show')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Передать очередь №2</span>
            </button>

            {queue.some((a) => a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal') && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmStep('completed_viewing')}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                title="Подтвердить завершение просмотра и начислить +5 баллов к SLA надежности"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Просмотр завершен (+5 к SLA)</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Загрузка очереди заявок...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            В очереди по лоту #{lot.lotCode} пока нет заявок инвесторов.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Статус в очереди</th>
                  <th className="py-2.5 px-3">Инвестор</th>
                  <th className="py-2.5 px-3">Ранг</th>
                  <th className="py-2.5 px-3">Closing Score</th>
                  <th className="py-2.5 px-3">Match %</th>
                  <th className="py-2.5 px-3">Условия сделки</th>
                  <th className="py-2.5 px-3">NDA (63-ФЗ)</th>
                  <th className="py-2.5 px-3">Дедлайны</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {queue.map((app, idx) => {
                  const isP1 = app.queueStatus === 'priority_1';
                  const isInDeal = app.queueStatus === 'in_deal';
                  const isStandby = app.queueStatus === 'standby_in_other_deal';
                  const isR2 = app.queueStatus === 'reserve_2';
                  const isR3 = app.queueStatus === 'reserve_3';

                  return (
                    <tr
                      key={app.id || idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        isP1 || isInDeal ? 'bg-amber-50/40 font-semibold' : isStandby ? 'bg-slate-50/80 opacity-80' : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        #{app.queuePosition || idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isInDeal
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isP1
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : isStandby
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : isR2
                              ? 'bg-slate-200 text-slate-800 border-slate-300'
                              : isR3
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {isInDeal
                            ? '🤝 В активной сделке'
                            : isP1
                            ? '👑 Приоритет №1'
                            : isStandby
                            ? `⏳ В активной сделке (#${app.activeDealLotCode || '—'}) — лист ожидания`
                            : isR2
                            ? '🥈 Резерв №2'
                            : isR3
                            ? '🥉 Резерв №3'
                            : 'В очереди'}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {app.userName || app.userEmail || 'Покупатель'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {app.userId?.slice(-6) || 'usr'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black border ${
                            app.tier === 'gold'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : app.tier === 'bronze'
                              ? 'bg-orange-50 text-orange-900 border-orange-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                          title="Повышение ранга до Gold возможно только через официальную верификацию документов в разделе «Верификация»"
                        >
                          {app.tier === 'gold' ? '🥇 Gold' : app.tier === 'bronze' ? '🥉 Bronze' : '🥈 Silver'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span className="text-sm font-black text-indigo-700">
                          {app.closingScore ?? 0}/105
                        </span>
                        <div className="text-[10px] text-slate-400">
                          SLA: {app.reliabilityScore ?? 100}%
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                        {app.matchScore ?? 0}%
                      </td>

                      <td className="py-3 px-3 text-[11px] space-y-0.5">
                        <div>
                          {app.priceAcceptance === 'above_asking'
                            ? '🚀 Выше рынка (+2%)'
                            : app.priceAcceptance === 'discount_requested'
                            ? '📉 С дисконтом'
                            : '✅ По полной цене'}
                        </div>
                        <div className="text-slate-500 text-[10px]">
                          24ч: {app.readiness24h ? 'Да' : 'Нет'} • 48ч: {app.deposit48h ? 'Да' : 'Нет'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {app.ndaSigned ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 text-[11px] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ПЭП 63-ФЗ</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Ожидает</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-[10px] text-slate-500 font-mono">
                        {app.viewingDeadlineAt ? (
                          <div>24ч: {new Date(app.viewingDeadlineAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                        ) : (
                          '—'
                        )}
                        {app.depositDeadlineAt && (
                          <div>48ч: {new Date(app.depositDeadlineAt).toLocaleDateString('ru-RU')}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
