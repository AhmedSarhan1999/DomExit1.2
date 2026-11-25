import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { Lot } from '../../../types';
import { MissingGateItem } from './legalAuditGate';

interface LegalDecisionBarProps {
  lot?: Lot | null;
  curatorName: string;
  canApprove: boolean;
  isApproving?: boolean;
  missingItems: MissingGateItem[];
  onSwitchTab?: (tab: 1 | 2 | 3) => void;
  onOpenRequestDocsModal: () => void;
  onOpenRejectModal: () => void;
  onApproveLegal: () => void;
}

export const LegalDecisionBar: React.FC<LegalDecisionBarProps> = ({
  lot,
  curatorName,
  canApprove,
  isApproving = false,
  missingItems,
  onSwitchTab,
  onOpenRequestDocsModal,
  onOpenRejectModal,
  onApproveLegal,
}) => {
  const isApproved = Boolean(
    lot?.isVerified ||
    lot?.approvalStatus === 'approved_for_packaging' ||
    lot?.approvalStatus === 'approved' ||
    (lot?.currentStage && lot.currentStage >= 2)
  );

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
            ЮР
          </div>
          <div>
            <span className="font-bold text-xs text-slate-900 block">{curatorName}</span>
            <span className="text-[11px] text-slate-500 block">Правовой комплаенс DomExit</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            type="button"
            onClick={onOpenRequestDocsModal}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs border border-slate-200 transition-colors cursor-pointer"
          >
            Запросить доп. документы
          </button>
          <button
            type="button"
            onClick={onOpenRejectModal}
            className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors cursor-pointer"
          >
            ✕ Отклонить
          </button>

          {isApproved && lot?.lotCode ? (
            <Link
              to={`/admin/packaging/${lot.lotCode}`}
              className="px-6 py-2.5 rounded-xl font-black text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <span>Перейти к упаковке лота (Этап 2)</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={!canApprove || isApproving}
              onClick={onApproveLegal}
              className={`px-6 py-2.5 rounded-xl font-black text-xs shadow-xs flex items-center space-x-2 transition-all ${
                canApprove && !isApproving
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
              }`}
              title={
                canApprove
                  ? 'Выдать штамп и сразу перейти к упаковке (Этап 2)'
                  : 'Кнопка заблокирована до выполнения всех обязательных проверок'
              }
            >
              {canApprove ? <Check className="w-4 h-4 stroke-[3]" /> : <Lock className="w-4 h-4" />}
              <span>
                {isApproving
                  ? 'Сохранение и переход...'
                  : 'Утвердить и передать в упаковку (Этап 2)'}
              </span>
            </button>
          )}
        </div>
      </div>

      {!isApproved && !canApprove && missingItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-black text-amber-950">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Кнопка выдачи штампа заблокирована. Необходимо завершить ({missingItems.length}):
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSwitchTab?.(item.tab)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-semibold text-left transition-colors cursor-pointer"
              >
                Вкладка {item.tab}: {item.label} →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
