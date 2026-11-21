import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatRubles } from '../../utils/formatters';
import { RussianRegionConfig } from '../../data/russianGeography';
import { TelegramConnectCard } from '../telegram/TelegramConnectCard';
import { GosuslugiEgrnGuide } from '../shared/GosuslugiEgrnGuide';

export interface SellerStepConfirmationProps {
  createdDealId: string;
  createdLotCode: string;
  cleanReturnDomExit: number;
  activeRegionConfig: RussianRegionConfig;
  complexName: string;
  district: string;
  sellerName: string;
  sellerInn: string;
  vaultDocsCount: number;
  onOpenSellerPortal: () => void;
  onOpenTracker: (dealId: string) => void;
  onResetNewCalculation: () => void;
}

export const SellerStepConfirmation: React.FC<SellerStepConfirmationProps> = ({
  createdDealId,
  createdLotCode,
  cleanReturnDomExit,
  activeRegionConfig,
  complexName,
  district,
  sellerName,
  sellerInn,
  vaultDocsCount,
  onOpenSellerPortal,
  onOpenTracker,
  onResetNewCalculation,
}) => {
  const { language } = useLanguage();

  return (
    <div className="max-w-xl mx-auto py-8 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
      </div>

      <div className="space-y-2">
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 text-xs font-bold font-mono">
          Сделка #{createdDealId} • Лот #{createdLotCode}
        </span>
        <h3 className="text-2xl font-black text-slate-950">
          {language === 'ru'
            ? 'Заявка сохранена в живом реестре DomExit!'
            : 'Request Saved in Live DomExit Registry!'}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Зафиксирована сумма чистого возврата{' '}
          <strong>{formatRubles(cleanReturnDomExit)}</strong>. Заявка поступила на стол
          Владельца платформы для назначения профильного юриста-куратора по региону{' '}
          <strong>{activeRegionConfig.shortLabelRu}</strong>.
        </p>
      </div>

      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-left">
        <div className="flex justify-between">
          <span className="text-slate-500">Объект и регион:</span>
          <span className="font-bold text-slate-900">
            {complexName} ({activeRegionConfig.shortLabelRu}, {district})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Правообладатель / ИНН:</span>
          <span className="font-mono font-bold text-slate-900">
            {sellerName} • ИНН {sellerInn}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Выплата на руки (100%):</span>
          <span className="font-black text-emerald-700 font-mono">
            {formatRubles(cleanReturnDomExit)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Документов к заявке:</span>
          <span className="font-bold text-indigo-700">{vaultDocsCount} шт.</span>
        </div>
      </div>

      <TelegramConnectCard className="text-left my-4 shadow-sm" />

      <GosuslugiEgrnGuide className="text-left my-4 shadow-sm" />

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={onOpenSellerPortal}
          className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
        >
          <span>Открыть кабинет продавца</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenTracker(createdDealId)}
          className="py-3.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
        >
          Трекер сделки 5 этапов
        </button>
        <button
          type="button"
          onClick={onResetNewCalculation}
          className="py-3.5 px-4 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Новый расчет
        </button>
      </div>
    </div>
  );
};
