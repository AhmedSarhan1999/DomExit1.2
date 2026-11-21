import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../services/apiClient';
import { SecurityIncidentsRepository } from '../../../dal/repositories/SecurityIncidentsRepository';
import {
  Database,
  HardDrive,
  Send,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface AdminSlimStatusBarProps {
  onNavigateToSystem?: () => void;
  className?: string;
}

export const AdminSlimStatusBar: React.FC<AdminSlimStatusBarProps> = ({
  onNavigateToSystem,
  className = '',
}) => {
  const [ydbOk, setYdbOk] = useState<boolean>(true);
  const [ydbLatency, setYdbLatency] = useState<number | null>(null);
  const [s3Ok, setS3Ok] = useState<boolean>(true);
  const [backupHealthy, setBackupHealthy] = useState<boolean>(true);
  const [backupAgeHours, setBackupAgeHours] = useState<number | null>(null);
  const [telegramLinked, setTelegramLinked] = useState<boolean>(false);
  const [telegramUsername, setTelegramUsername] = useState<string | undefined>();
  const [incidentCount, setIncidentCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const loadStatus = useCallback(async () => {
    try {
      const [healthRes, tgRes, incidentsRes] = await Promise.all([
        apiClient.admin.getSystemHealth().catch(() => null),
        apiClient.telegram.getStatus().catch(() => null),
        SecurityIncidentsRepository.getAll().catch(() => []),
      ]);

      if (healthRes) {
        setYdbOk(Boolean(healthRes.ydb?.ok));
        setYdbLatency(healthRes.ydb?.latencyMs ?? null);
        setS3Ok(Boolean(healthRes.storage?.publicBucketOk && healthRes.storage?.privateBucketOk));
        setBackupHealthy(Boolean(healthRes.backups?.isHealthy));
        setBackupAgeHours(healthRes.backups?.ageHours ?? null);
      }

      if (tgRes) {
        setTelegramLinked(Boolean(tgRes.linked));
        setTelegramUsername(tgRes.telegramUsername);
      }

      if (Array.isArray(incidentsRes)) {
        const open = incidentsRes.filter((i) => i.status !== 'resolved').length;
        setIncidentCount(open);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 60000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 shadow-2xs text-xs flex flex-wrap items-center justify-between gap-3 min-h-[52px] ${className}`}
    >
      {/* Left Indicators Row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* YDB Latency */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              ydbOk ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold">YDB:</span>
          <span className={`font-bold ${ydbOk ? 'text-emerald-700' : 'text-rose-600'}`}>
            {ydbLatency !== null ? `${ydbLatency} ms` : ydbOk ? 'OK' : 'ERR'}
          </span>
        </div>

        {/* S3 Storage */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              s3Ok ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <HardDrive className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold">S3:</span>
          <span className={`font-bold ${s3Ok ? 'text-slate-800' : 'text-rose-600'}`}>
            {s3Ok ? 'OK (152-ФЗ)' : 'ERR'}
          </span>
        </div>

        {/* Automated Daily Backup */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              backupHealthy ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className="font-semibold">Бэкап:</span>
          <span className={`font-bold ${backupHealthy ? 'text-emerald-700' : 'text-amber-700'}`}>
            {backupHealthy
              ? backupAgeHours !== null
                ? `${backupAgeHours}ч назад`
                : 'Актуален'
              : 'Требуется'}
          </span>
        </div>

        {/* Telegram OS Status */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-medium ${
            telegramLinked
              ? 'bg-sky-50 text-sky-800 border-sky-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <Send className="w-3 h-3 text-sky-600" />
          <span>Telegram:</span>
          <span className="font-bold">
            {telegramLinked
              ? telegramUsername
                ? `@${telegramUsername}`
                : 'Подключен'
              : 'Не привязан'}
          </span>
        </div>

        {/* Incidents Counter */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] ${
            incidentCount > 0
              ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          <ShieldAlert className={`w-3.5 h-3.5 ${incidentCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          <span>Инциденты:</span>
          <span className="font-bold font-mono">{incidentCount}</span>
        </div>
      </div>

      {/* Right Action / Shortcut */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={loadStatus}
          disabled={loading}
          title="Обновить статус инфраструктуры"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        </button>

        {onNavigateToSystem && (
          <button
            type="button"
            onClick={onNavigateToSystem}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <span>Система и Бэкапы</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
