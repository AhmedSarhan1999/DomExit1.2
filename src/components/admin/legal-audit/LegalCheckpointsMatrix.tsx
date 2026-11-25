import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ExternalLink,
  Download,
  Sliders,
  Check,
} from 'lucide-react';
import { LegalAuditCheckpoint } from '../../../types';

interface LegalCheckpointsMatrixProps {
  checkpoints: LegalAuditCheckpoint[];
  weightedIndex: number;
  onOpenInspector: (cp: LegalAuditCheckpoint) => void;
  onManualVerifyCheckpoint: (checkpointId: string) => void;
  onManualVerifyAll?: () => void;
  onDownloadProtocol: (registryType: 'EFRSB' | 'FSSP') => void;
  onOpenProofDoc?: (info: { proofDocKey?: string; proofDocUrl?: string; proofDocName?: string }) => void;
}

export const LegalCheckpointsMatrix: React.FC<LegalCheckpointsMatrixProps> = ({
  checkpoints,
  weightedIndex,
  onOpenInspector,
  onManualVerifyCheckpoint,
  onManualVerifyAll,
  onDownloadProtocol,
  onOpenProofDoc,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2 text-indigo-700">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              МАТРИЦА 4 КОНТРОЛЬНЫХ ЗОН (РИСК-ВЕСОВОЙ СКОРИНГ)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-1">
            Антибанкротный индекс чистоты: {weightedIndex}% из 100%
          </h3>
          <p className="text-xs text-slate-500">
            Каждая контрольная зона имеет математический вес. Для утверждения лота требуется индекс ≥ 85% и прикрепленные подтверждения.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDownloadProtocol('EFRSB')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Протокол ЕФРСБ</span>
          </button>
          <button
            type="button"
            onClick={() => onDownloadProtocol('FSSP')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Протокол ФССП</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checkpoints.map((cp) => {
          const isClean = cp.status === 'clean' && cp.score >= 8;
          const isAttention = cp.status === 'attention' || (cp.score >= 5 && cp.score < 8);
          const isCritical = cp.status === 'critical' || cp.score < 5;

          return (
            <div
              key={cp.id}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                isClean
                  ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                  : isAttention
                  ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                  : 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                      Вес в формуле: {cp.weightPercent}%
                    </span>
                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                      {cp.title}
                    </h4>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black shrink-0 ${
                      isClean
                        ? 'bg-emerald-100 text-emerald-900'
                        : isAttention
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {cp.score}/10
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {cp.notes}
                </p>

                {/* Proof doc badge */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2 truncate">
                    <FileCheck className={`w-3.5 h-3.5 shrink-0 ${cp.proofDocName ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-mono text-slate-600 truncate">
                      {cp.proofDocName ? `Скан: ${cp.proofDocName}` : 'Скан не прикреплен'}
                    </span>
                  </div>
                  {(cp.proofDocKey || cp.proofDocUrl) && (
                    onOpenProofDoc ? (
                      <button
                        type="button"
                        onClick={() => onOpenProofDoc({ proofDocKey: cp.proofDocKey, proofDocUrl: cp.proofDocUrl, proofDocName: cp.proofDocName })}
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center space-x-1 transition-colors shrink-0 cursor-pointer"
                      >
                        <span>Открыть скан ↗</span>
                      </button>
                    ) : (
                      <a
                        href={cp.proofDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold flex items-center space-x-1 transition-colors shrink-0"
                      >
                        <span>Открыть скан ↗</span>
                      </a>
                    )
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                <a
                  href={cp.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slate-500 hover:text-indigo-600 font-bold flex items-center space-x-1"
                >
                  <span>Реестр</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => onManualVerifyCheckpoint(cp.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200 transition-colors cursor-pointer"
                  >
                    ✓ 1-Click
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenInspector(cp)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    Инспекция
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
