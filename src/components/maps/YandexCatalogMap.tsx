import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lot } from '../../types';
import { getRegionByCode, resolveLotGeoDetails } from '../../data/russianGeography';
import { formatRubles, formatPercent } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  loadYandexMapsScript,
  getYandexMapsPinUrl,
} from '../../services/yandexMapsService';
import {
  ArrowRight,
  Building2,
  ExternalLink,
  MapPin,
  Navigation,
  ShieldCheck,
  TrainFront,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface YandexCatalogMapProps {
  lots: Lot[];
  selectedCity?: string;
  onSelectCity?: (cityCode: string) => void;
}

function formatCompactMillions(amount: number, lang: string): string {
  const millions = amount / 1_000_000;
  const formatted =
    millions >= 10 ? millions.toFixed(1) : millions.toFixed(2).replace(/\.?0+$/, '');
  return lang === 'ru' ? `${formatted} млн ₽` : `${formatted}M ₽`;
}

export const YandexCatalogMap: React.FC<YandexCatalogMapProps> = ({
  lots,
  selectedCity = 'all',
  onSelectCity,
}) => {
  const { language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [selectedLot, setSelectedLot] = useState<Lot | null>(lots[0] || null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // Sync selected lot when filter changes
  useEffect(() => {
    if (lots.length === 0) {
      setSelectedLot(null);
      return;
    }
    if (!selectedLot || !lots.some((l) => l.lotCode === selectedLot.lotCode)) {
      setSelectedLot(lots[0]);
    }
  }, [lots]);

  // Initialize Yandex Maps JS API v3
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      setLoadError(null);

      try {
        const ymaps3 = await loadYandexMapsScript();
        if (isCancelled || !mapContainerRef.current) return;

        // Clear existing map instance
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.destroy?.();
          } catch (_) {}
          mapInstanceRef.current = null;
          markersRef.current = [];
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = '';
          }
        }

        const cityConfig =
          selectedCity && selectedCity !== 'all'
            ? getRegionByCode(selectedCity)
            : getRegionByCode('spb');

        const initialCenter: [number, number] = [
          cityConfig.center.lng,
          cityConfig.center.lat,
        ];
        const initialZoom = selectedCity && selectedCity !== 'all' ? cityConfig.defaultZoom : 6;

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps3;

        const map = new YMap(mapContainerRef.current, {
          location: {
            center: initialCenter,
            zoom: initialZoom,
          },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        mapInstanceRef.current = map;
        setIsMapReady(true);
      } catch (err: any) {
        console.warn('[YandexCatalogMap] Failed to load Yandex Maps v3:', err);
        setLoadError(
          err?.message ||
            'Не удалось загрузить интерактивную карту Яндекс. Доступен автономный режим гео-каталога.'
        );
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.destroy?.();
        } catch (_) {}
        mapInstanceRef.current = null;
        markersRef.current = [];
      }
    };
  }, []);

  // Update center and zoom when selectedCity changes
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    const cityConfig =
      selectedCity && selectedCity !== 'all'
        ? getRegionByCode(selectedCity)
        : getRegionByCode('spb');

    const targetCenter: [number, number] = [cityConfig.center.lng, cityConfig.center.lat];
    const targetZoom = selectedCity && selectedCity !== 'all' ? cityConfig.defaultZoom : 6;

    try {
      mapInstanceRef.current.setLocation({
        center: targetCenter,
        zoom: targetZoom,
        duration: 400,
      });
    } catch (e) {
      console.warn('[YandexCatalogMap] setLocation error:', e);
    }
  }, [selectedCity, isMapReady]);

  // Render / Update custom markers on the YMap
  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady || typeof window === 'undefined' || !window.ymaps3) {
      return;
    }

    const { YMapMarker } = window.ymaps3;
    if (!YMapMarker) return;

    // Remove old markers
    for (const marker of markersRef.current) {
      try {
        mapInstanceRef.current.removeChild(marker);
      } catch (_) {}
    }
    markersRef.current = [];

    // Create marker for each lot
    lots.forEach((lot) => {
      const geo = resolveLotGeoDetails(lot);
      const isSelected = selectedLot?.lotCode === lot.lotCode;
      const priceText = formatCompactMillions(lot.cashPaidBySeller, language);

      // Create custom HTML marker DOM
      const markerEl = document.createElement('div');
      markerEl.className = 'domexit-yandex-marker';
      markerEl.style.cursor = 'pointer';
      markerEl.style.transform = 'translate(-50%, -100%)';
      markerEl.style.transition = 'all 0.2s ease';

      markerEl.innerHTML = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 9999px;
          background: ${isSelected ? '#059669' : '#0f172a'};
          color: #ffffff;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 11px;
          font-weight: 800;
          border: 2px solid ${isSelected ? '#34d399' : '#e2e8f0'};
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          white-space: nowrap;
        ">
          <span style="
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${isSelected ? '#ffffff' : '#34d399'};
          "></span>
          <span>${priceText}</span>
        </div>
      `;

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedLot(lot);
      });

      try {
        const marker = new YMapMarker(
          {
            coordinates: [geo.coordinates.lng, geo.coordinates.lat],
          },
          markerEl
        );

        mapInstanceRef.current.addChild(marker);
        markersRef.current.push(marker);
      } catch (err) {
        console.warn('[YandexCatalogMap] Add marker error:', err);
      }
    });
  }, [lots, selectedLot, isMapReady, language]);

  return (
    <div className="relative w-full h-[620px] rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xl">
      {/* City Switcher Overlay */}
      {onSelectCity && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-xl max-w-[calc(100%-2rem)]">
          <button
            type="button"
            onClick={() => onSelectCity('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCity === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            {language === 'ru' ? 'Все города' : 'All Cities'} ({lots.length})
          </button>
          <button
            type="button"
            onClick={() => onSelectCity('spb')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCity === 'spb'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            СПб
          </button>
          <button
            type="button"
            onClick={() => onSelectCity('msk')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCity === 'msk'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Москва
          </button>
        </div>
      )}

      {/* Main Map Container */}
      {!loadError ? (
        <div ref={mapContainerRef} className="w-full h-full z-0" />
      ) : (
        /* Graceful Fallback Card if JS API blocked or offline */
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold mb-1">
            {language === 'ru'
              ? 'Географический реестр объектов DomExit'
              : 'DomExit Property Geo-Registry'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
            В каталоге размещено <strong>{lots.length}</strong> проверенных объектов с прямым
            выходом дольщиков. Все объекты привязаны к координатам Яндекс.Карт.
          </p>
          {selectedLot && (
            <a
              href={getYandexMapsPinUrl(
                resolveLotGeoDetails(selectedLot).coordinates.lat,
                resolveLotGeoDetails(selectedLot).coordinates.lng,
                selectedLot.complexName
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg transition-all flex items-center space-x-2"
            >
              <span>Открыть подборку на Яндекс.Картах</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Selected Lot Compact Floating Card */}
      {selectedLot && (
        <div className="absolute bottom-5 left-5 right-5 sm:right-auto sm:max-w-md z-20 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-3xl p-4 shadow-2xl animate-fade-in text-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-emerald-400 font-mono text-[10px] font-bold">
                #{selectedLot.lotCode}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {selectedLot.district}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedLot(null)}
              className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-3.5 mt-3">
            <img
              src={selectedLot.imageUrl}
              alt={selectedLot.complexName}
              className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-slate-200"
            />
            <div className="flex-1 min-w-0 space-y-1">
              <h4 className="font-extrabold text-sm text-slate-950 truncate">
                {selectedLot.complexName}
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                {selectedLot.developer} • {selectedLot.deliveryDate}
              </p>

              <div className="pt-1">
                <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                  Кэш продавцу (100%):
                </span>
                <div className="text-base font-black text-emerald-700 font-mono">
                  {formatRubles(selectedLot.cashPaidBySeller)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center space-x-1.5 text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {selectedLot.areaM2} м² • {selectedLot.rooms === 'studio' ? 'Студия' : `${selectedLot.rooms.replace('-room', '')}-комн.`}
              </span>
            </div>

            <Link
              to={`/opportunities/${selectedLot.lotCode || selectedLot.id}`}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1 transition-colors"
            >
              <span>Смотреть лот</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
