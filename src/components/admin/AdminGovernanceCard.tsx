import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Database,
  Cloud,
  HardDrive,
  RefreshCw,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { SecurityIncidentsRepository } from '../../dal/repositories/SecurityIncidentsRepository';
import { SecurityIncidentRecord } from '../../types';

interface SystemHealthData {
  status: 'healthy' | 'degraded';
  timestamp: string;
  ydb: {
    ok: boolean;
    latencyMs: number;
    endpoint: string;
  };
  storage: {
    publicBucket: string;
    publicBucketOk: boolean;
    privateBucket: string;
    privateBucketOk: boolean;
  };
  backups: {
    latestDailyKey: string | null;
    latestDailyAt: string | null;
    latestDailySizeBytes: number;
    ageHours: number | null;
    isHealthy: boolean;
    totalDailyBackups: number;
    totalPreCutoverBackups: number;
  };
  journal: {
    todayDateUtc: string;
    todayEventCount: number;
  };
  runtime: {
    env: string;
    region: string;
    nodeVersion: string;
    memoryRssMb: number;
    uptimeSeconds: number;
  };
}

interface AdminGovernanceCardProps {
  className?: string;
  showToast?: (msg: string, type?: 'success' | 'warning' | 'info') => void;
}

export const AdminGovernanceCard: React.FC<AdminGovernanceCardProps> = ({
  className = '',
  showToast,
}) => {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningBackup, setRunningBackup] = useState(false);
  const [sendingTestTg, setSendingTestTg] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedBackupKey, setSelectedBackupKey] = useState<string>('');

  const loadAll = useCallback(async () => {
    try {
      const [healthRes, backupsRes, incidentsRes] = await Promise.all([
        apiClient.admin.getSystemHealth().catch(() => null),
        apiClient.admin.getBackups().catch(() => ({ backups: [] })),
        SecurityIncidentsRepository.getAll().catch(() => []),
      ]);

      if (healthRes) setHealthData(healthRes);
      if (backupsRes?.backups) {
        setBackupsList(backupsRes.backups);
        if (backupsRes.backups.length > 0) {
          setSelectedBackupKey(backupsRes.backups[0].key);
        }
      }
      if (Array.isArray(incidentsRes)) {
        // Sort newest first
        const sorted = [...incidentsRes].sort((a, b) => {
          const ta = new Date(a.timestamp || (a as any).createdAt || 0).getTime();
          const tb = new Date(b.timestamp || (b as any).createdAt || 0).getTime();
          return tb - ta;
        });
        setIncidents(sorted.slice(0, 10));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 60000); // 1-minute auto poll
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleRunBackup = async () => {
    try {
      setRunningBackup(true);
      const res = await apiClient.admin.runBackupNow();
      if (showToast) {
        showToast(
          `✓ Резервная копия базы создана! Записей: ${res.totalRecords || 0}`,
          'success'
        );
      }
      await loadAll();
    } catch (err: any) {
      if (showToast) {
        showToast(`Ошибка бэкапа: ${err.message}`, 'warning');
      }
    } finally {
      setRunningBackup(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setSendingTestTg(true);
      const res = await apiClient.telegram.testNotification();
      if (res.success && showToast) {
        showToast('✓ Тестовое оповещение успешно доставлено в Telegram!', 'success');
      } else if (showToast) {
        showToast(`Не удалось отправить оповещение: ${res.description || 'Проверьте привязку'}`, 'warning');
      }
    } catch (err: any) {
      if (showToast) {
        showToast(`Ошибка Telegram: ${err.message}`, 'warning');
      }
    } finally {
      setSendingTestTg(false);
    }
  };

  const handleResolveIncident = async (inc: SecurityIncidentRecord) => {
    try {
      setResolvingId(inc.id);
      const updated = {
        ...inc,
        status: 'resolved' as const,
        resolvedAt: new Date().toISOString(),
      };
      await SecurityIncidentsRepository.updateIncident(updated);
      setIncidents((prev) => prev.map((item) => (item.id === inc.id ? updated : item)));
      if (showToast) {
        showToast(`✓ Инцидент #${inc.id} помечен как решенный`, 'success');
      }
    } catch (err: any) {
      if (showToast) {
        showToast(`Не удалось обновить статус: ${err.message}`, 'warning');
      }
    } finally {
      setResolvingId(null);
    }
  };

  // Count incidents in last 24h
  const now = Date.now();
  const dayAgo = now - 24 * 3600 * 1000;
  const recentIncidents = incidents.filter(
    (i) => new Date(i.timestamp || (i as any).createdAt || 0).getTime() > dayAgo
  );
  const openIncidents = incidents.filter((i) => i.status !== 'resolved');
  const highSeverityCount = recentIncidents.filter(
    (i) => i.severity === 'high' || i.severity === 'critical'
  ).length;

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Background Gradient Mesh */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                ЦЕНТР ХОСТИНГА, БЕЗОПАСНОСТИ И РЕЗЕРВНОГО КОПИРОВАНИЯ
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                152-ФЗ LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Московский облачный контур Yandex Cloud (ru-central1) • Единый пульт генерального директора
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleTestTelegram}
            disabled={sendingTestTg}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-200 flex items-center space-x-1.5 transition-all cursor-pointer"
            title="Отправить проверочное оповещение в Telegram владельца"
          >
            <Send className={`w-3.5 h-3.5 text-sky-400 ${sendingTestTg ? 'animate-bounce' : ''}`} />
            <span>Тест Telegram</span>
          </button>
          <button
            onClick={loadAll}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 transition-all cursor-pointer"
            title="Обновить метрики"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6 relative z-10">
        {/* =========================================================================
            SECTION 1: Infrastructure Health in Moscow
        ========================================================================= */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>1. Инфраструктура в Москве</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  healthData?.status === 'healthy'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {healthData?.status === 'healthy' ? 'ШТАТНО (HEALTHY)' : 'ДЕГРАДАЦИЯ'}
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">СУБД YDB Latency:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {healthData ? `${healthData.ydb.latencyMs} ms` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Публичный S3 (Фото):</span>
                <span className="font-bold text-slate-200">
                  {healthData?.storage.publicBucketOk ? '✓ Доступен' : '✗ Ошибка'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Приватный S3 (Юр. документы):</span>
                <span className="font-bold text-slate-200">
                  {healthData?.storage.privateBucketOk ? '✓ Защищен (152-ФЗ)' : '✗ Ошибка'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Память Node.js RSS:</span>
                <span className="font-mono text-slate-200">
                  {healthData ? `${healthData.runtime.memoryRssMb} MB` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Событий в журнале S3 сегодня:</span>
                <span className="font-mono font-bold text-indigo-400">
                  {healthData ? healthData.journal.todayEventCount : 0}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Регион: <b>{healthData?.runtime.region || 'ru-central1'}</b></span>
            <span>Uptime: <b>{healthData ? `${Math.floor(healthData.runtime.uptimeSeconds / 60)} мин` : '—'}</b></span>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: Automated Daily Backups
        ========================================================================= */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-sky-400" />
                <span>2. Ежедневный бэкап YDB</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  healthData?.backups.isHealthy
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {healthData?.backups.isHealthy ? 'АКТУАЛЕН' : 'ТРЕБУЕТСЯ'}
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Расписание триггера:</span>
                <span className="font-bold text-slate-200">Ежедневно в 05:00 MSK</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Возраст последнего архива:</span>
                <span className="font-mono text-slate-200">
                  {healthData?.backups.ageHours !== null && healthData?.backups.ageHours !== undefined
                    ? `${healthData.backups.ageHours} ч. назад`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Размер архива:</span>
                <span className="font-mono text-slate-200">
                  {healthData?.backups.latestDailySizeBytes
                    ? `${(healthData.backups.latestDailySizeBytes / 1024).toFixed(1)} KB`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Всего архивов в S3:</span>
                <span className="font-mono text-slate-200">
                  {healthData
                    ? `${healthData.backups.totalDailyBackups} дн. / ${healthData.backups.totalPreCutoverBackups} pre-cutover`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Dropdown of backups */}
            {backupsList.length > 0 && (
              <div className="mt-3">
                <label className="text-[10px] text-slate-400 block mb-1">Снимки базы в S3:</label>
                <select
                  value={selectedBackupKey}
                  onChange={(e) => setSelectedBackupKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-200 truncate focus:outline-hidden"
                >
                  {backupsList.slice(0, 5).map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.folder}: {b.key.split('/').pop()} ({(b.sizeBytes / 1024).toFixed(1)} KB)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={handleRunBackup}
            disabled={runningBackup}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningBackup ? 'animate-spin' : ''}`} />
            <span>{runningBackup ? 'Создание снимка базы...' : 'Создать бэкап сейчас'}</span>
          </button>
        </div>

        {/* =========================================================================
            SECTION 3: Security & Anomaly Radar
        ========================================================================= */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>3. Радар инцидентов и аномалий</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  highSeverityCount === 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {highSeverityCount === 0 ? 'УГРОЗ НЕТ' : `ТРЕВОГА (${highSeverityCount})`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3.5 text-center">
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">За 24ч:</span>
                <span className="text-base font-black text-slate-100">{recentIncidents.length}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Высокий риск:</span>
                <span className={`text-base font-black ${highSeverityCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
                  {highSeverityCount}
                </span>
              </div>
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-2">
                <span className="text-[10px] text-slate-400 block">Открыто:</span>
                <span className={`text-base font-black ${openIncidents.length > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                  {openIncidents.length}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
              Автоматический радар блокирует попытки XSS, подделки привилегий, флуд запросами и утечки номеров в чате с отправкой пуш-уведомления в Telegram.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Канал алертов: <b>Telegram OS</b></span>
            <span>Аудит: <b>security_incidents</b></span>
          </div>
        </div>
      </div>

      {/* Incidents Table / List */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 relative z-10">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Журнал последних зафиксированных инцидентов (security_incidents):</span>
        </h4>

        {incidents.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 text-center text-xs text-slate-400">
            Инцидентов безопасности не зафиксировано. Система работает в штатном режиме.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-xl">Время</th>
                  <th className="py-2.5 px-3">Уровень</th>
                  <th className="py-2.5 px-3">Тип</th>
                  <th className="py-2.5 px-3">Субъект</th>
                  <th className="py-2.5 px-3">Описание инцидента</th>
                  <th className="py-2.5 px-3 text-right rounded-r-xl">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {incidents.map((inc) => {
                  const dateStr = new Date(inc.timestamp || (inc as any).createdAt || 0).toLocaleString('ru-RU');
                  const isResolved = inc.status === 'resolved';

                  return (
                    <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            inc.severity === 'critical'
                              ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                              : inc.severity === 'high'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : inc.severity === 'medium'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {inc.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300 whitespace-nowrap">
                        {(inc as any).type || 'security'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {(inc as any).actorRole || 'guest'} ({(inc as any).actorUserId?.slice(0, 10) || 'anon'})
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-md truncate" title={inc.description || inc.title}>
                        {inc.title || inc.description}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isResolved ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center justify-end space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Решено</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleResolveIncident(inc)}
                            disabled={resolvingId === inc.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            {resolvingId === inc.id ? 'Обновление...' : 'Закрыть (Решено)'}
                          </button>
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
