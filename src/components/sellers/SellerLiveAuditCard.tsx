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
    <aside className="w-full space-y-5">
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 leading-tight">
            {language === 'ru'
              ? 'СРАВНИТЕЛЬНЫЙ ФИНАНСОВЫЙ АУДИТ — LIVE РАСЧЕТ'
              : 'COMPARATIVE AUDIT — LIVE CALC'}
          </h3>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-2" />
        </div>

        {/* 1. Cancellation with Developer Penalty */}
        <div className="bg-[#FEF2F2] border border-rose-200 rounded-2xl p-4 space-y-1.5">
          <div className="flex justify-between items-center gap-2">
            <span className="font-bold text-rose-950 text-xs sm:text-sm leading-snug">
              {language === 'ru'
                ? 'Односторонний разрыв с девелопером'
                : 'Direct Cancellation with Developer'}
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold shrink-0 whitespace-nowrap">
              штраф {penaltyRatePercent}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight font-mono whitespace-nowrap">
            {contractPrice > 0 ? `-${formatRubles(devPenalty)}` : '—'}
          </div>
          <p className="text-[11px] text-rose-800/80 leading-normal">
            {contractPrice > 0
              ? language === 'ru'
                ? 'Прямая безвозвратная потеря из внесенных средств при расторжении'
                : 'Direct non-refundable loss from deposited capital'
              : language === 'ru'
              ? 'Укажите стоимость ДДУ для расчета возможного штрафа'
              : 'Enter DDU contract price to calculate penalty'}
          </p>
        </div>

        {/* 2. DomExit Clean Return */}
        <div className="bg-[#ECFDF5] border border-emerald-300 rounded-2xl p-4 space-y-1.5">
          <div className="flex justify-between items-center gap-2">
            <span className="font-bold text-emerald-950 text-xs sm:text-sm leading-snug">
              {language === 'ru'
                ? 'Чистый возврат через DomExit'
                : 'Clean Return via DomExit'}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold shrink-0 whitespace-nowrap">
              100% средств
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight font-mono whitespace-nowrap">
            {paidAmount > 0 ? formatRubles(cleanReturnDomExit) : '—'}
          </div>
          <p className="text-[11px] text-emerald-800/80 leading-normal">
            {paidAmount > 0
              ? language === 'ru'
                ? 'Полная выплата с аккредитива Сбербанка / ВТБ в день регистрации Росреестра'
                : 'Full payout from Sberbank / VTB escrow on Rosreestr registration day'
              : language === 'ru'
              ? 'Укажите выплаченную застройщику сумму'
              : 'Enter amount paid to developer'}
          </p>
        </div>

        {/* 3. Hero Net Benefit Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 space-y-3.5 shadow-lg">
          <span className="text-xs text-emerald-100 font-semibold block uppercase tracking-wider leading-snug">
            {language === 'ru'
              ? 'ВАША ЧИСТАЯ ВЫГОДА (Сохранение капитала)'
              : 'YOUR NET BENEFIT (Capital Preserved)'}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono whitespace-nowrap">
            {contractPrice > 0 ? `+${formatRubles(netFamilyBenefit)}` : '—'}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-emerald-500/50 text-[11px]">
            <div className="flex justify-between items-center text-emerald-100 gap-2">
              <span className="shrink-0">Регион размещения:</span>
              <span className="font-bold text-white text-right truncate">
                {activeRegionConfig.shortLabelRu} • {district}
              </span>
            </div>
            <div className="flex justify-between items-center text-emerald-100 gap-2">
              <span className="shrink-0">Дисконт для покупателя:</span>
              <span className="font-bold text-white text-right whitespace-nowrap">
                {contractPrice > 0 && todayMarketPrice > contractPrice
                  ? formatRubles(todayMarketPrice - contractPrice)
                  : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-emerald-100 pt-1">
            <span className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>{language === 'ru' ? 'Срок закрытия:' : 'Closing time:'}</span>
            </span>
            <span className="font-bold text-white whitespace-nowrap">9 рабочих дней</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
