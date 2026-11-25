import React from 'react';
import { Scale, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Lot } from '../../../types';
import { LegalVerificationProgress } from './legalAuditGate';

interface LegalAuditHeaderCardProps {
  lot: Lot;
  accessibleLots: Lot[];
  sellerFullName: string;
  sellerInn: string;
  progress: LegalVerificationProgress;
  onSelectLotCode: (code: string) => void;
}

export const LegalAuditHeaderCard: React.FC<LegalAuditHeaderCardProps> = ({
  lot,
  accessibleLots,
  sellerFullName,
  sellerInn,
  progress,
  onSelectLotCode,
}) => {
  const isStampIssued = Boolean(lot.isVerified);
  const hasAnyCritical = progress.hasCriticalRadar || progress.hasCriticalAxis;
  const isZeroState =
    !isStampIssued &&
    progress.evaluatedAxesCount === 0 &&
    progress.passedRequiredRadarCount === 0 &&
    progress.weightedIndex === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-indigo-700">
          <Scale className="w-5 h-5 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider">
            ПРОТОКОЛ ПРАВОВОГО СКОРИНГА #{lot.lotCode}
          </span>
          <select
            value={lot.lotCode}
            onChange={(e) => onSelectLotCode(e.target.value)}
            className="px-3 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
          >
            {accessibleLots.map((l) => (
              <option key={l.id} value={l.lotCode}>
                #{l.lotCode} — {l.complexName}
              </option>
            ))}
          </select>

          {isStampIssued ? (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black">
              ✓ Штамп «Документы проверены» выдан
            </span>
          ) : hasAnyCritical ? (
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black">
              ⛔ Обнаружены риски (заблокирован)
            </span>
          ) : isZeroState ? (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold">
              ⏳ Не проверено (требуется аудит)
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
              🔍 Аудит в процессе
            </span>
          )}
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Аудит: {sellerFullName}{' '}
            <span className="text-sm font-mono text-slate-500">(ИНН: {sellerInn})</span>
          </h2>
          <p className="text-xs text-slate-500 pt-1">
            {lot.dealTrack === 'secondary_dkp'
              ? 'Вторичное жилье (ДКП)'
              : 'Новостройка (ДДУ / Цессия)'}{' '}
            • {lot.complexName} ({lot.developer})
          </p>
        </div>
      </div>

      <div
        className={`rounded-3xl p-5 shrink-0 w-full lg:w-[400px] shadow-sm border space-y-2.5 ${
          isStampIssued || progress.canApprove
            ? 'bg-emerald-50/80 border-emerald-300'
            : hasAnyCritical
            ? 'bg-rose-50/80 border-rose-300'
            : isZeroState
            ? 'bg-slate-50 border-slate-300'
            : 'bg-amber-50/70 border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase text-slate-700">
            ИНДЕКС ЧИСТОТЫ И ПРОГРЕСС:
          </span>
          <div
            className={`text-lg font-black flex items-center space-x-1.5 ${
              isStampIssued || progress.canApprove
                ? 'text-emerald-800'
                : hasAnyCritical
                ? 'text-rose-800'
                : 'text-slate-800'
            }`}
          >
            {isStampIssued || progress.canApprove ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : hasAnyCritical ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-mono">{progress.weightedIndex}%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-bold">
          <div className="bg-white/80 rounded-xl p-2 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 block font-normal">Документы</span>
            <span className="text-slate-900 font-mono">
              {progress.approvedMandatoryDocsCount} из {progress.requiredMandatoryDocsTotal}
            </span>
          </div>
          <div className="bg-white/80 rounded-xl p-2 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 block font-normal">Госреестры</span>
            <span className="text-slate-900 font-mono">
              {progress.passedRequiredRadarCount} из {progress.requiredRadarTotal}
            </span>
          </div>
          <div className="bg-white/80 rounded-xl p-2 border border-slate-200/80 text-center">
            <span className="text-[10px] text-slate-500 block font-normal">Разделы</span>
            <span className="text-slate-900 font-mono">
              {progress.evaluatedAxesCount} из {progress.axesTotal}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
