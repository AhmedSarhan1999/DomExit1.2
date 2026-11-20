import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import { Lot } from '../../types';
import { formatRubles } from '../../utils/formatters';

export interface FavoritesTabProps {
  favoriteLots: Lot[];
  onToggleFavorite: (lotCode: string) => void;
}

export const FavoritesTab: React.FC<FavoritesTabProps> = ({
  favoriteLots,
  onToggleFavorite,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
              <Heart className="w-5 h-5 text-rose-600 fill-rose-600" />
              <span>Избранные объекты ({favoriteLots.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Сохраненные лоты с оперативным отслеживанием статуса сделки.
            </p>
          </div>
          <Link
            to="/opportunities"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors"
          >
            Перейти в общий каталог
          </Link>
        </div>

        {favoriteLots.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Heart className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-base text-slate-700">
              У вас пока нет сохраненных объектов
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Нажимайте на иконку сердца на карточке любого лота в каталоге для быстрого доступа.
            </p>
            <Link
              to="/opportunities"
              className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Открыть каталог предложений
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteLots.map((fav) => (
              <div
                key={fav.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={fav.imageUrl}
                    alt={fav.complexName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase shadow-sm ${
                        fav.status === 'available'
                          ? 'bg-emerald-600 text-white'
                          : fav.status === 'processing'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-700 text-white'
                      }`}
                    >
                      {fav.status === 'available'
                        ? 'Доступен'
                        : fav.status === 'processing'
                        ? 'В сделке'
                        : 'Закрыт'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(fav.lotCode)}
                    className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full text-rose-600 shadow-sm cursor-pointer"
                  >
                    <Heart className="w-4 h-4 fill-rose-600" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      #{fav.lotCode}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 mt-1">{fav.complexName}</h4>
                    <span className="text-xs text-slate-500">
                      {fav.district} • {fav.developer} • {fav.areaM2} м²
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Кэш продавцу:</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {formatRubles(fav.cashPaidBySeller)}
                      </span>
                    </div>
                    <Link
                      to={`/opportunities/${fav.lotCode}`}
                      className="text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center space-x-1"
                    >
                      <span>Паспорт лота</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
