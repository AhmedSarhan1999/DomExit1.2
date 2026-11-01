import React from 'react';
import { Link } from 'react-router-dom';
import { Lot } from '../../types';
import { formatRubles, formatPercent } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { resolveLotGeoDetails } from '../../data/russianGeography';
import { ShieldCheck, Flame, ArrowRight, Heart, MapPin, TrainFront } from 'lucide-react';

interface LotCardProps {
  lot: Lot;
}

export const LotCard: React.FC<LotCardProps> = ({ lot }) => {
  const { language, t } = useLanguage();
  const { isFavorite, toggleFavorite } = useAuth();
  const favorited = isFavorite(lot.lotCode);

  const geo = resolveLotGeoDetails(lot);
  const primaryMetro = geo.metroStations[0];

  const savingsRub = lot.todayDeveloperPrice - lot.dduContractPrice;
  const savingsPercent =
    lot.todayDeveloperPrice > 0 ? (savingsRub / lot.todayDeveloperPrice) * 100 : 0;

  const lotStatus = lot.status || 'available';
  const floorLabel = lot.ownerDossier?.hideExactFloor
    ? `${lot.ownerDossier.floorRangeDisplay} ${language === 'ru' ? 'эт.' : 'fl.'}`
    : language === 'ru'
    ? `Этаж ${lot.floor} из ${lot.totalFloors}`
    : `Floor ${lot.floor}/${lot.totalFloors}`;

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
          <div className="flex flex-wrap items-center gap-1.5">
            {lotStatus === 'available' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 text-[11px] font-bold shadow-md">
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{language === 'ru' ? 'Доступен' : 'Available'}</span>
              </span>
            )}
            {lot.currentStage === 2 || lot.isEarlyAccessVIP ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[11px] font-bold shadow-md">
                <span>{language === 'ru' ? 'VIP 48ч Доступ' : 'VIP 48h Access'}</span>
              </span>
            ) : lotStatus === 'processing' ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-bold shadow-md">
                <span>{language === 'ru' ? `В сделке (${lot.currentStage || 3}/5)` : `In Deal (${lot.currentStage || 3}/5)`}</span>
              </span>
            ) : null}
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
            {(lot.developerAccreditationStatus === 'pending_bank_accreditation' ||
              lot.tags?.includes('Ожидает аккредитации банков')) && (
              <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold shadow-xs">
                <span>Ожидает аккредитации банков</span>
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
      <div className="p-5 flex-1 flex flex-col space-y-3.5">
        
        {/* Region, Developer, District & Unit Code */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700 inline-flex items-center space-x-1 truncate pr-2">
              <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">
                {language === 'ru' ? geo.region.shortLabelRu : geo.region.shortLabelEn} • {lot.district}
              </span>
            </span>
            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
              #{lot.lotCode}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
            {lot.complexName}
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {lot.developer} • {lot.areaM2} м² •{' '}
            {lot.rooms === 'studio' ? (language === 'ru' ? 'Студия' : 'Studio') : `${lot.rooms.replace('-room', '')}-комн.`} •{' '}
            {floorLabel}
          </p>

          {primaryMetro && (
            <div className="mt-1.5 inline-flex items-center space-x-1.5 text-[11px] text-slate-600 bg-slate-50 border border-slate-200/70 px-2 py-0.5 rounded-md">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: primaryMetro.lineColor }}
              />
              <TrainFront className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-medium truncate">{primaryMetro.name}</span>
              <span className="text-slate-400 shrink-0">({primaryMetro.travelTimeText})</span>
            </div>
          )}
        </div>

        {/* Cash Box (Light Gray) */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">{t.common.cashToSeller}</span>
            {lot.isNegotiable ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                {language === 'ru' ? 'Возможен торг' : 'Negotiable'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                {language === 'ru' ? '0 ₽ комиссия' : '0% Seller Fee'}
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
            <span className="text-slate-400">{language === 'ru' ? 'Цена м² по ДДУ:' : 'DDU Price / m²:'}</span>
            <span className="font-bold text-emerald-700">
              {formatRubles(Math.round(lot.dduContractPrice / Math.max(lot.areaM2, 1)))}/м²
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{language === 'ru' ? 'Остаток застройщику:' : 'Remaining to Dev:'}</span>
            <span className="font-medium text-slate-800">{formatRubles(lot.remainingInstallmentDebt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">{language === 'ru' ? 'Платеж рассрочки:' : 'Installment payment:'}</span>
            <span className="font-medium text-slate-800">{formatRubles(lot.installmentQuarterlyPayment)} / кв.</span>
          </div>
        </div>

        {/* Action Button: Emerald CTA */}
        <div className="pt-1 mt-auto">
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
