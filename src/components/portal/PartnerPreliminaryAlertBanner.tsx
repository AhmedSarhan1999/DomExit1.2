import React from 'react';
import { Clock, FileCheck } from 'lucide-react';
import { PartnerPreliminaryRequest } from '../../types';

export interface PartnerPreliminaryAlertBannerProps {
  request: PartnerPreliminaryRequest;
  remainingTimeText: string;
  onOpenModal: () => void;
}

export const PartnerPreliminaryAlertBanner: React.FC<PartnerPreliminaryAlertBannerProps> = ({
  request,
  remainingTimeText,
  onOpenModal,
}) => {
  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-500/10 border-2 border-amber-400 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider">
                Срочный запрос партнера • 7 дней
              </span>
              <span className="text-xs font-mono font-bold text-amber-900">
                ID: {request.clientCode}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-950 mt-1">
              Партнер «{request.partnerName}» открыл предварительный запрос на чистый выход
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 mt-1">
              Объект: {request.complexName} ({request.developer}). Загрузите скан ДДУ в защищенное хранилище для запуска аудита.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-amber-300 shadow-xs flex items-center space-x-2 text-xs font-mono font-bold text-amber-900">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Осталось: {remainingTimeText}</span>
          </div>

          <button
            type="button"
            onClick={onOpenModal}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            <span>Подтвердить и загрузить ДДУ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
