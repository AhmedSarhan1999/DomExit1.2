import React from 'react';
import { ShieldCheck, FileCheck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { LegalAuditCheckpoint } from '../../../types';

interface LegalCheckpointsMatrixProps {
  checkpoints: LegalAuditCheckpoint[];
  weightedIndex: number;
  onOpenProofDoc?: (info: { proofDocKey?: string; proofDocUrl?: string; proofDocName?: string }) => void;
}

export const LegalCheckpointsMatrix: React.FC<LegalCheckpointsMatrixProps> = ({
  checkpoints,
  weightedIndex,
  onOpenProofDoc,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2 text-indigo-700">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              АВТОМАТИЧЕСКИЙ РАСЧЁТ ИНДЕКСА (БЕЗ ДУБЛИРОВАНИЯ ВВОДА)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900 mt-1">
            Антибанкротный индекс чистоты: {weightedIndex}% из 100%
          </h3>
          <p className="text-xs text-slate-500">
            Рассчитывается автоматически на основе проверенных госреестров (Вкладка 1), одобренных документов продавца и 5 разделов проверки (Вкладка 2). Для выпуска на упаковку требуется ≥ 85%.
          </p>
        </div>

        <span
          className={`px-4 py-2 rounded-2xl text-sm font-mono font-black border shrink-0 ${
            weightedIndex >= 85
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : weightedIndex > 0
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}
        >
          {weightedIndex}% / 100%
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {checkpoints.map((cp) => {
          const isEvaluated = Boolean(cp.evaluated && cp.status !== 'pending');
          const isClean = isEvaluated && cp.status === 'clean' && cp.score >= 8;
          const isAttention = isEvaluated && (cp.status === 'attention' || (cp.score >= 5 && cp.score < 8));
          const isCritical = isEvaluated && (cp.status === 'critical' || cp.score < 5);

          return (
            <div
              key={cp.id}
              className={`rounded-2xl p-4 border space-y-2.5 flex flex-col justify-between ${
                !isEvaluated
                  ? 'bg-slate-50 border-slate-200'
                  : isClean
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : isAttention
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-rose-50/50 border-rose-200'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                    Вес {cp.weightPercent}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-black ${
                      !isEvaluated
                        ? 'bg-slate-200 text-slate-700'
                        : isClean
                        ? 'bg-emerald-100 text-emerald-900'
                        : isAttention
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-900'
                    }`}
                  >
                    {cp.score}/10
                  </span>
                </div>

                <h4 className="text-xs font-black text-slate-900 leading-snug">{cp.shortLabel}</h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {isEvaluated ? cp.notes : 'Ожидает проверки в госреестрах и разделах аудита.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center space-x-1 font-bold text-slate-700">
                  {!isEvaluated ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">Не проверено</span>
                    </>
                  ) : isClean ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-800">Подтверждено</span>
                    </>
                  ) : isCritical ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span className="text-rose-800">Критичный риск</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-amber-800">Есть нюансы</span>
                    </>
                  )}
                </span>

                {cp.proofDocName && onOpenProofDoc && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenProofDoc({
                        proofDocKey: cp.proofDocKey,
                        proofDocUrl: cp.proofDocUrl,
                        proofDocName: cp.proofDocName,
                      })
                    }
                    className="inline-flex items-center space-x-1 text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    <FileCheck className="w-3 h-3" />
                    <span>Скан</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
