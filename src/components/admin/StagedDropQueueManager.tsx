import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Users,
  Award,
  ArrowRight,
  RotateCcw,
  Play,
  FileText,
  XCircle,
  Eye,
  Archive,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { Lot, LotDropConfig } from '../../types';
import { formatRubles } from '../../utils/formatters';
import { BuyerApplicationDossierModal } from './BuyerApplicationDossierModal';

export interface StagedDropQueueManagerProps {
  lot: Lot;
  onLotUpdated?: () => void;
  onShowToast?: (msg: string) => void;
  onShowWarning?: (msg: string) => void;
}

const PAYMENT_SHORT_LABEL: Record<string, string> = {
  cash_100: '100% Кэш / СБР',
  family_mortgage_approved: 'Сем. ипотека',
  standard_mortgage_approved: 'Ипотека',
  alternative: 'Альтернатива',
};

export const StagedDropQueueManager: React.FC<StagedDropQueueManagerProps> = ({
  lot,
  onLotUpdated,
  onShowToast,
  onShowWarning,
}) => {
  const [queue, setQueue] = useState<any[]>([]);
  const [archivedQueue, setArchivedQueue] = useState<any[]>([]);
  const [queueTab, setQueueTab] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [isSweeping, setIsSweeping] = useState<boolean>(false);

  // Dossier inspection & reject modal state
  const [inspectApp, setInspectApp] = useState<any | null>(null);
  const [rejectModalApp, setRejectModalApp] = useState<any | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [waitlistMenuAppId, setWaitlistMenuAppId] = useState<string | null>(null);

  // Drop configuration parameters
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
        const activeList = res.queue || [];
        const archList = res.archivedQueue || [];
        setQueue(activeList);
        setArchivedQueue(archList);

        if (inspectApp) {
          const updated =
            activeList.find((a: any) => a.id === inspectApp.id) ||
            archList.find((a: any) => a.id === inspectApp.id) ||
            null;
          setInspectApp(updated);
        }
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

  const handleVerifyApp = async (
    appId: string,
    status: 'verified' | 'needs_clarification' | 'pending',
    note: string
  ) => {
    try {
      const res = await apiClient.matching.verifyApplication(appId, {
        curatorVerificationStatus: status,
        curatorVerificationNote: note,
      });
      if (res.ok) {
        onShowToast?.(
          status === 'verified'
            ? 'Заявка и документы отмечены как проверенные куратором ✓'
            : 'Запрос на уточнение отправлен покупателю'
        );
        await loadQueue();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось обновить статус проверки');
    }
  };

  const handleSelectWinner = async (appId: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient.matching.selectWinnerApplication(appId);
      if (res.ok) {
        onShowToast?.(
          `Назначен Победитель №1! Лот перешёл в Этап 4 (closing_escrow), остальные кандидаты сохранены в очереди.`
        );
        setInspectApp(null);
        await loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось назначить победителя');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetWaitlist = async (
    appId: string,
    targetStatus: 'reserve_2' | 'reserve_3' | 'waitlist' | 'pending_review'
  ) => {
    setActionLoading(true);
    setWaitlistMenuAppId(null);
    try {
      const res = await apiClient.matching.setWaitlistApplication(appId, { targetStatus });
      if (res.ok) {
        onShowToast?.(`Позиция кандидата обновлена: ${targetStatus}`);
        await loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось изменить статус ожидания');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectApp = async (appId: string, reason: string) => {
    setActionLoading(true);
    try {
      const res = await apiClient.matching.rejectApplication(appId, { rejectionReason: reason });
      if (res.ok) {
        onShowToast?.(
          `Заявка отклонена. Слот клиента освобождён, занятых мест в очереди: ${res.currentValidApplications}.`
        );
        setRejectModalApp(null);
        setRejectReasonInput('');
        setInspectApp(null);
        await loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось отклонить заявку');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteNext = async (reason: string = 'no_show') => {
    setActionLoading(true);
    try {
      const currentP1 = queue.find((a) => a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal');
      const res = await apiClient.matching.promoteNextInQueue(lot.lotCode, {
        previousPriority1AppId: currentP1?.id,
        reason: reason as any,
      });
      if (res.ok) {
        onShowToast?.(`Сделка передана резерву №2! Статус обновлен.`);
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Не удалось передать сделку кандидату из резерва');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmStep = async (step: 'completed_viewing' | 'escrow_confirmed') => {
    const currentP1 = queue.find((a) => a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal');
    if (!currentP1) return;
    setActionLoading(true);
    try {
      const res = await apiClient.matching.confirmStep({
        lotCode: lot.lotCode,
        userId: currentP1.userId,
        step,
      });
      if (res.ok) {
        onShowToast?.(res.message || 'Этап подтвержден! Начислено +5 к SLA надежности.');
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
        onShowToast?.(
          `SLA Sweeper выполнен: проверено лотов: ${res.scannedLotsCount}, продвинуто: ${res.promotedCount}, штрафов: ${res.penalizedCount}`
        );
        loadQueue();
        onLotUpdated?.();
      }
    } catch (err: any) {
      onShowWarning?.(err.message || 'Ошибка запуска SLA Sweeper');
    } finally {
      setIsSweeping(false);
    }
  };

  const activeWinner = queue.find(
    (a) => a.queueStatus === 'priority_1' || a.queueStatus === 'in_deal'
  );
  const reserve2Exists = queue.some((a) => a.queueStatus === 'reserve_2');
  const displayRows = queueTab === 'active' ? queue : archivedQueue;

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
              {isStagedDrop
                ? `Активный тактовый раунд лота #${lot.lotCode}`
                : 'Запуск закрытого тактового дропа'}
            </h3>
          </div>

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

      {/* Explanatory SLA Ribbon */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-xs space-y-2 border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 font-bold text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>РЕГЛАМЕНТ ТАКТОВОГО ДРОПА И ИНДИВИДУАЛЬНОГО ОТБОРА (Этап 3 → Этап 4)</span>
          </div>
          <button
            type="button"
            disabled={isSweeping}
            onClick={handleRunSlaSweep}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RotateCcw className={`w-3 h-3 ${isSweeping ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>{isSweeping ? 'Проверка SLA...' : 'Тест SLA Sweeper (Staging)'}</span>
          </button>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">
          • Куратор проверяет досье и документы каждого кандидата индивидуально (кнопка <strong>«Проверить»</strong>) и принимает точечные решения: <strong>Победитель №1</strong>, <strong>Резерв №2 / Лист ожидания</strong> или <strong>Отклонить</strong> с обязательным указанием причины.
        </p>
      </div>

      {/* 2. Hybrid Queue Table with Active/Archived Tabs & Per-Applicant Actions */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Очередь покупателей по лоту #{lot.lotCode}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ранжирование по методологии DomExit (Closing Score 0–105 + живой SLA из Buy-Box).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tabs: Active vs Rejected/Archived */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setQueueTab('active')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  queueTab === 'active'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Активная очередь ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueTab('archived')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center space-x-1 ${
                  queueTab === 'archived'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Отклонённые / Архив ({archivedQueue.length})</span>
              </button>
            </div>

            {activeWinner && reserve2Exists && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handlePromoteNext('no_show')}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Передать сделку резерву №2</span>
              </button>
            )}

            {activeWinner && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleConfirmStep('completed_viewing')}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
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
        ) : displayRows.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
            {queueTab === 'active'
              ? `В активной очереди по лоту #${lot.lotCode} пока нет заявок инвесторов.`
              : `Отклонённых или архивных заявок по лоту #${lot.lotCode} нет.`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 px-3">Покупатель</th>
                  <th className="py-2.5 px-3">Ранг и живой SLA</th>
                  <th className="py-2.5 px-3">Score / Match</th>
                  <th className="py-2.5 px-3">Оплата и кэш</th>
                  <th className="py-2.5 px-3">Документы и ПЭП</th>
                  <th className="py-2.5 px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {displayRows.map((app, idx) => {
                  const isP1 = app.queueStatus === 'priority_1';
                  const isInDeal = app.queueStatus === 'in_deal';
                  const isWinnerRow = isP1 || isInDeal;
                  const isStandby = app.queueStatus === 'standby_in_other_deal';
                  const isR2 = app.queueStatus === 'reserve_2';
                  const isR3 = app.queueStatus === 'reserve_3';
                  const isWaitlist = app.queueStatus === 'waitlist';
                  const isRejected = app.queueStatus === 'rejected';
                  const liveSla = app.reliabilityScore ?? 100;
                  const docsCount = Array.isArray(app.proofDocuments) ? app.proofDocuments.length : 0;

                  return (
                    <tr
                      key={app.id || idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        isWinnerRow
                          ? 'bg-emerald-50/40'
                          : isRejected
                          ? 'bg-rose-50/30'
                          : isStandby
                          ? 'bg-slate-50/80 opacity-85'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        #{app.queuePosition || idx + 1}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isWinnerRow
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isR2 || isR3 || isWaitlist
                              ? 'bg-sky-100 text-sky-900 border-sky-200'
                              : isStandby
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isInDeal
                            ? '🤝 В сделке'
                            : isP1
                            ? '👑 Победитель №1'
                            : isR2
                            ? '🥈 Резерв №2'
                            : isR3
                            ? '🥉 Резерв №3'
                            : isWaitlist
                            ? '⏳ Лист ожидания'
                            : isStandby
                            ? `⏳ В другой сделке (#${app.activeDealLotCode || '—'})`
                            : isRejected
                            ? '✕ Отклонена'
                            : app.queueStatus === 'completed'
                            ? '🏆 Закрыта'
                            : 'На рассмотрении'}
                        </span>
                        {isRejected && app.rejectionReason && (
                          <div className="text-[10px] text-rose-700 mt-1 max-w-[180px] truncate" title={app.rejectionReason}>
                            {app.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">
                          {app.userName || app.userEmail || 'Покупатель'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {app.buyerPhone || app.userPhone || app.buyerEmail || app.userEmail || `ID: ${app.userId?.slice(-6)}`}
                        </div>
                      </td>

                      <td className="py-3 px-3 space-y-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                            app.tier === 'gold'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : app.tier === 'bronze'
                              ? 'bg-orange-50 text-orange-900 border-orange-200'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {app.tier === 'gold' ? '🥇 Gold' : app.tier === 'bronze' ? '🥉 Bronze' : '🥈 Silver'}
                        </span>
                        <div
                          className={`text-[11px] font-mono font-black ${
                            liveSla >= 90
                              ? 'text-emerald-700'
                              : liveSla >= 70
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}
                        >
                          SLA: {liveSla}%
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        <span className="text-sm font-black text-indigo-700">
                          {app.closingScore ?? 0}/105
                        </span>
                        <div className="text-[10px] text-emerald-700 font-bold">
                          Match: {app.matchScore ?? 0}%
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[11px] space-y-0.5">
                        <div className="font-bold text-slate-800">
                          {PAYMENT_SHORT_LABEL[app.paymentMethod || 'cash_100'] || app.paymentMethod}
                        </div>
                        <div className="font-mono text-emerald-800 font-bold">
                          {app.confirmedCashRub ? formatRubles(app.confirmedCashRub) : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          24ч: {app.readiness24h ? 'Да' : 'Нет'} • 48ч: {app.deposit48h ? 'Да' : 'Нет'}
                        </div>
                      </td>

                      <td className="py-3 px-3 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              docsCount > 0 || app.goldVerification
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            <span>
                              {docsCount} док.{app.goldVerification ? ' + Gold' : ''}
                            </span>
                          </span>
                          {app.curatorVerificationStatus === 'verified' && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ Проверено
                            </span>
                          )}
                          {app.curatorVerificationStatus === 'needs_clarification' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              📝 Уточнение
                            </span>
                          )}
                        </div>
                        <div>
                          {app.ndaSigned ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>ПЭП 63-ФЗ ✓</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">ПЭП ожидает</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectApp(app)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Проверить</span>
                          </button>

                          {queueTab === 'active' && (
                            <>
                              <button
                                type="button"
                                disabled={
                                  actionLoading ||
                                  isWinnerRow ||
                                  isStandby ||
                                  Boolean(activeWinner && activeWinner.id !== app.id)
                                }
                                onClick={() => handleSelectWinner(app.id)}
                                title={
                                  isStandby
                                    ? 'Покупатель в другой активной сделке'
                                    : activeWinner && activeWinner.id !== app.id
                                    ? 'Уже есть активный Победитель №1'
                                    : 'Назначить Победителем №1'
                                }
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] flex items-center space-x-1 cursor-pointer disabled:opacity-40"
                              >
                                <Award className="w-3 h-3" />
                                <span>{isWinnerRow ? 'Победитель' : 'Победитель №1'}</span>
                              </button>

                              {!isStandby && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    disabled={actionLoading}
                                    onClick={() =>
                                      setWaitlistMenuAppId((prev) => (prev === app.id ? null : app.id))
                                    }
                                    className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold text-[11px] cursor-pointer"
                                  >
                                    В ожидание ▾
                                  </button>
                                  {waitlistMenuAppId === app.id && (
                                    <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-1 text-left">
                                      <button
                                        type="button"
                                        onClick={() => handleSetWaitlist(app.id, 'reserve_2')}
                                        className="w-full text-left px-3 py-1.5 hover:bg-sky-50 text-xs font-bold text-slate-800 cursor-pointer"
                                      >
                                        🥈 Резерв №2
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetWaitlist(app.id, 'reserve_3')}
                                        className="w-full text-left px-3 py-1.5 hover:bg-sky-50 text-xs font-bold text-slate-800 cursor-pointer"
                                      >
                                        🥉 Резерв №3
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetWaitlist(app.id, 'waitlist')}
                                        className="w-full text-left px-3 py-1.5 hover:bg-sky-50 text-xs font-bold text-slate-800 cursor-pointer"
                                      >
                                        ⏳ Лист ожидания
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetWaitlist(app.id, 'pending_review')}
                                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
                                      >
                                        Вернуть в рассмотрение
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => {
                                  setRejectModalApp(app);
                                  setRejectReasonInput('');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[11px] cursor-pointer"
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Buyer Dossier & Inspection Modal */}
      <BuyerApplicationDossierModal
        app={inspectApp}
        lotCode={lot.lotCode}
        hasOtherActiveWinner={Boolean(activeWinner && inspectApp && activeWinner.id !== inspectApp.id)}
        onClose={() => setInspectApp(null)}
        onVerify={handleVerifyApp}
        onSelectWinner={handleSelectWinner}
        onSetWaitlist={handleSetWaitlist}
        onReject={handleRejectApp}
      />

      {/* Reject Reason Modal */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Отклонить заявку кандидата?
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Покупатель: <strong>{rejectModalApp.userName || rejectModalApp.userEmail}</strong> • Лот #{lot.lotCode}. Его слот будет освобождён, а место в очереди лота откроется заново.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Причина отклонения (обязательно, мин. 3 символа):
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Укажите конкретную причину отказа (увидит покупатель и сохранится в аудите)..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-xs focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  setRejectModalApp(null);
                  setRejectReasonInput('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={actionLoading || rejectReasonInput.trim().length < 3}
                onClick={() => handleRejectApp(rejectModalApp.id, rejectReasonInput.trim())}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Отклоняем...' : 'Подтвердить отказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
