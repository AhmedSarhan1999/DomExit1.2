import React from 'react';
import { Link } from 'react-router-dom';
import { Lot } from '../../types';
import { formatRubles, formatPercent } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Flame, ArrowRight, Building, Calendar, Wallet, Heart } from 'lucide-react';

interface LotCardProps {
  lot: Lot;
}

export const LotCard: React.FC<LotCardProps> = ({ lot }) => {
  const { language, t } = useLanguage();
  const { user, isFavorite, toggleFavorite } = useAuth();
  const favorited = isFavorite(lot.lotCode);

  const savingsRub = lot.todayDeveloperPrice - lot.dduContractPrice;
  const savingsPercent = (savingsRub / lot.todayDeveloperPrice) * 100;

  const lotStatus = lot.status || 'available';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
      
      {/* Top Image Container */}
      <div className="relative h-56 overflow-hidden bg-slate-100">
        <img
          src={lot.imageUrl}
          alt={lot.complexName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center space-x-1.5">
            {lotStatus === 'available' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 text-[11px] font-bold shadow-md">
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{language === 'ru' ? 'Доступен' : 'Available'}</span>
              </span>
            )}
            {lotStatus === 'processing' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-bold shadow-md">
                <span>{language === 'ru' ? `В сделке (этап ${lot.currentStage || 2}/5)` : `In Deal (${lot.currentStage || 2}/5)`}</span>
              </span>
            )}
            {lotStatus === 'closed' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-700 text-white text-[11px] font-bold shadow-md">
                <span>{language === 'ru' ? 'Сделка закрыта' : 'Closed Deal'}</span>
              </span>
            )}

            {lot.isUrgentExit && lotStatus === 'available' && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold shadow-md animate-pulse">
                <Flame className="w-3 h-3" />
                <span>{language === 'ru' ? 'Срочный' : 'Urgent'}</span>
              </span>
            )}
          </div>

          {/* Favorite Heart Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(lot.lotCode);
            }}
            className={`pointer-events-auto p-2 rounded-xl backdrop-blur-md transition-all shadow-sm ${
              favorited
                ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-md scale-105'
                : 'bg-white/80 hover:bg-white text-slate-600 hover:text-rose-500 border border-slate-200/60'
            }`}
            title={favorited ? (language === 'ru' ? 'Удалить из избранного' : 'Remove favorite') : (language === 'ru' ? 'В избранное' : 'Add favorite')}
          >
            <Heart className={`w-4 h-4 transition-transform active:scale-125 ${favorited ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Bottom Badges over Image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold pointer-events-none">
          <span className="px-2.5 py-0.5 rounded-md bg-white/95 text-slate-800 shadow-xs border border-slate-200/60 backdrop-blur-sm">
            {language === 'ru' ? `Сдача: ${lot.deliveryDate}` : `Handover: ${lot.deliveryDate}`}
          </span>
          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50/95 text-emerald-800 border border-emerald-300 shadow-xs backdrop-blur-sm">
            {lot.escrowBank} Эскроу
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col space-y-4">
        
        {/* Unit Code, Developer & District */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-medium">{lot.developer} • {lot.district}</span>
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
              #{lot.lotCode}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
            {lot.complexName}
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {lot.areaM2} м² • {lot.rooms === 'studio' ? 'Студия' : `${lot.rooms.replace('-room', '')}-комн.`} • Этаж {lot.floor} из {lot.totalFloors}
          </p>
        </div>

        {/* Cash Box (Light Gray) */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">{t.common.cashToSeller}</span>
            {lot.isNegotiable && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded">
                {language === 'ru' ? 'Возможен торг' : 'Negotiable'}
              </span>
            )}
          </div>
          <div className="text-xl font-black text-slate-950 tracking-tight mt-0.5">
            {formatRubles(lot.cashPaidBySeller)}
          </div>
        </div>

        {/* Green Savings Box */}
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-800 font-semibold">{t.common.marketAdvantage}</span>
            <span className="text-emerald-700 font-extrabold">
              -{formatPercent(savingsPercent)}
            </span>
          </div>
          <div className="text-lg font-black text-emerald-800 tracking-tight">
            +{formatRubles(savingsRub)}
          </div>
          <div className="text-[11px] text-emerald-700/80 pt-1 border-t border-emerald-200/60 flex justify-between">
            <span>{t.common.todayPrice}</span>
            <span className="font-semibold">{formatRubles(lot.todayDeveloperPrice)}</span>
          </div>
        </div>

        {/* 3-Row Compact Specifications Table */}
        <div className="text-xs space-y-1.5 pt-1 text-slate-600 border-t border-slate-100">
          <div className="flex justify-between">
            <span className="text-slate-400">{language === 'ru' ? 'Остаток застройщику:' : 'Remaining to Dev:'}</span>
            <span className="font-medium text-slate-800">{formatRubles(lot.remainingInstallmentDebt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{language === 'ru' ? 'Платеж рассрочки:' : 'Installment payment:'}</span>
            <span className="font-medium text-slate-800">{formatRubles(lot.installmentQuarterlyPayment)} / кв.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{language === 'ru' ? 'Срок ввода:' : 'Handover term:'}</span>
            <span className="font-medium text-slate-800">{lot.deliveryDate}</span>
          </div>
        </div>

        {/* Action Button: Emerald CTA */}
        <div className="pt-2">
          <Link
            to={`/opportunities/${lot.lotCode}`}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xs hover:shadow-md"
          >
            <span>{t.common.details}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

      </div>

    </div>
  );
};
