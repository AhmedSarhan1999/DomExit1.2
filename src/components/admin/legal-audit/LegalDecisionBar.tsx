import React from 'react';
import { Building2, Check } from 'lucide-react';

interface LegalDecisionBarProps {
  curatorName: string;
  enableBankPortal: boolean;
  onOpenBankModal: () => void;
  onOpenRequestDocsModal: () => void;
  onOpenRejectModal: () => void;
  onApproveLegal: () => void;
}

export const LegalDecisionBar: React.FC<LegalDecisionBarProps> = ({
  curatorName,
  enableBankPortal,
  onOpenBankModal,
  onOpenRequestDocsModal,
  onOpenRejectModal,
  onApproveLegal,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-sm">
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
        {enableBankPortal && (
          <button
            type="button"
            onClick={onOpenBankModal}
            className="px-3.5 py-2.5 rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Запрос в банк</span>
          </button>
        )}
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
        <button
          type="button"
          onClick={onApproveLegal}
          className="px-6 py-2.5 rounded-xl font-black text-xs shadow-xs flex items-center space-x-2 transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Утвердить: Выдать штамп</span>
        </button>
      </div>
    </div>
  );
};
