import React from 'react';
import { FileCheck, Upload } from 'lucide-react';
import { PartnerPreliminaryRequest, DocumentMetadata } from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface PreliminaryRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: PartnerPreliminaryRequest | null;
  completionDocMeta: DocumentMetadata | null;
  completionNotes: string;
  onNotesChange: (notes: string) => void;
  completionError: string | null;
  onSelectFile: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PreliminaryRequestModal: React.FC<PreliminaryRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  completionDocMeta,
  completionNotes,
  onNotesChange,
  completionError,
  onSelectFile,
  onSubmit,
}) => {
  if (!isOpen || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-950 text-base">
                Подтверждение заявки и загрузка ДДУ
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                ID клиента: {request.clientCode}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Партнер-агент:</span>
            <span className="font-bold text-slate-900">{request.partnerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Объект / ЖК:</span>
            <span className="font-bold text-slate-900">{request.complexName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Сумма к возврату:</span>
            <span className="font-bold font-mono text-emerald-800">
              {formatRubles(request.paidAmountRub)}
            </span>
          </div>
        </div>

        {completionError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {completionError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Скан договора ДДУ (с отметкой Росреестра / ЭЦП) *
            </label>
            <div className="p-4 border-2 border-dashed border-amber-300 rounded-2xl bg-amber-50/40 text-center space-y-2">
              <Upload className="w-6 h-6 text-amber-600 mx-auto" />
              <p className="text-xs text-slate-600">
                {completionDocMeta
                  ? `✓ Файл загружен: ${completionDocMeta.name} (${(
                      completionDocMeta.sizeBytes / 1024
                    ).toFixed(0)} КБ)`
                  : 'Выберите реальный файл со своего устройства (PDF, JPG, PNG)'}
              </p>
              <button
                type="button"
                onClick={onSelectFile}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  completionDocMeta
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                }`}
              >
                {completionDocMeta ? 'Заменить файл ДДУ' : 'Выбрать файл ДДУ с устройства'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Комментарий для комплаенс-офиса
            </label>
            <textarea
              rows={2}
              placeholder="Пожелания по срокам выхода на сделку..."
              value={completionNotes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
            >
              Подтвердить и отправить на аудит
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
