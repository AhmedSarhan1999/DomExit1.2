import React from 'react';
import { Clock } from 'lucide-react';
import { RussianRegionConfig } from '../../data/russianGeography';
import { formatRubles } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';

export interface SellerLiveAuditCardProps {
  contractPrice: number;
  paidAmount: number;
  todayMarketPrice: number;
  penaltyRatePercent: number;
  activeRegionConfig: RussianRegionConfig;
  district: string;
  cleanReturnDomExit: number;
  devPenalty: number;
  netFamilyBenefit: number;
}

export const SellerLiveAuditCard: React.FC<SellerLiveAuditCardProps> = ({
  contractPrice,
  paidAmount,
  todayMarketPrice,
  penaltyRatePercent,
  activeRegionConfig,
  district,
  cleanReturnDomExit,
  devPenalty,
  netFamilyBenefit,
}) => {
  const { language } = useLanguage();

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {language === 'ru'
            ? 'СРАВНИТЕЛЬНЫЙ ФИНАНСОВЫЙ АУДИТ — LIVE РАСЧЕТ'
            : 'COMPARATIVE AUDIT — LIVE CALC'}
        </h3>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      <div className="bg-[#FEF2F2] border border-rose-200 rounded-2xl p-4 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-rose-950">
            {language === 'ru'
              ? 'Односторонний разрыв с девелопером'
              : 'Direct Cancellation with Developer'}
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold">
            штраф {penaltyRatePercent}%
          </span>
        </div>
        <div className="text-2xl font-black text-rose-600 tracking-tight font-mono">
          {contractPrice > 0 ? `-${formatRubles(devPenalty)}` : '—'}
        </div>
        <p className="text-[11px] text-rose-800/80">
          {contractPrice > 0
            ? language === 'ru'
              ? 'Прямая безвозвратная потеря из внесенных средств при расторжении'
              : 'Direct non-refundable loss from deposited capital'
            : language === 'ru'
            ? 'Укажите стоимость ДДУ для расчета возможного штрафа'
            : 'Enter DDU contract price to calculate penalty'}
        </p>
      </div>

      <div className="bg-[#ECFDF5] border border-emerald-300 rounded-2xl p-4 space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-emerald-950">
            {language === 'ru'
              ? 'Чистый возврат через DomExit'
              : 'Clean Return via DomExit'}
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold">
            100% средств
          </span>
        </div>
        <div className="text-2xl font-black text-emerald-700 tracking-tight font-mono">
          {paidAmount > 0 ? formatRubles(cleanReturnDomExit) : '—'}
        </div>
        <p className="text-[11px] text-emerald-800/80">
          {paidAmount > 0
            ? language === 'ru'
              ? 'Полная выплата с аккредитива Сбербанка / ВТБ в день регистрации Росреестра'
              : 'Full payout from Sberbank / VTB escrow on Rosreestr registration day'
            : language === 'ru'
            ? 'Укажите выплаченную застройщику сумму'
            : 'Enter amount paid to developer'}
        </p>
      </div>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 space-y-3 shadow-lg">
        <span className="text-xs text-emerald-100 font-semibold block uppercase tracking-wider">
          {language === 'ru'
            ? 'ВАША ЧИСТАЯ ВЫГОДА (Сохранение семейного капитала)'
            : 'YOUR NET BENEFIT (Capital Preserved)'}
        </span>
        <div className="text-3xl font-black text-white tracking-tight font-mono">
          {contractPrice > 0 ? `+${formatRubles(netFamilyBenefit)}` : '—'}
        </div>

        <div className="space-y-1 pt-2 border-t border-emerald-500/50 text-[11px]">
          <div className="flex justify-between text-emerald-100">
            <span>Регион размещения:</span>
            <span className="font-bold text-white">
              {activeRegionConfig.shortLabelRu} • {district}
            </span>
          </div>
          <div className="flex justify-between text-emerald-100">
            <span>Дисконт для нового покупателя:</span>
            <span className="font-bold text-white">
              {contractPrice > 0 && todayMarketPrice > contractPrice
                ? formatRubles(todayMarketPrice - contractPrice)
                : '—'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-emerald-100 pt-1">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-emerald-300" />
            <span>{language === 'ru' ? 'Средний срок закрытия:' : 'Avg. closing time:'}</span>
          </span>
          <span className="font-bold text-white">9 рабочих дней</span>
        </div>
      </div>
    </div>
  );
};
