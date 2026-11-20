import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  ExternalLink,
  Shield,
  Train,
  GraduationCap,
  Trees,
  HeartPulse,
  ShoppingBag,
  Navigation,
} from 'lucide-react';
import { Lot, MetroStationInfo } from '../../types';
import {
  loadYandexMapsScript,
  getYandexMapsExploreUrl,
  getYandexMapsPinUrl,
  INFRASTRUCTURE_CATEGORIES,
  InfrastructureCategory,
} from '../../services/yandexMapsService';

interface YandexLotMapProps {
  lat: number;
  lng: number;
  complexName: string;
  streetAddress: string;
  metroStations?: MetroStationInfo[];
  isSafeRadius?: boolean;
}

export const YandexLotMap: React.FC<YandexLotMapProps> = ({
  lat,
  lng,
  complexName,
  streetAddress,
  metroStations = [],
  isSafeRadius = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      setLoadError(null);

      try {
        const ymaps3 = await loadYandexMapsScript();
        if (isCancelled || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.destroy?.();
          } catch (_) {}
          mapInstanceRef.current = null;
          if (mapContainerRef.current) {
            mapContainerRef.current.innerHTML = '';
          }
        }

        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;

        const map = new YMap(mapContainerRef.current, {
          location: {
            center: [lng, lat],
            zoom: isSafeRadius ? 14 : 15,
          },
        });

        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));

        // Create Pin Element
        const pinEl = document.createElement('div');
        pinEl.style.transform = 'translate(-50%, -100%)';
        pinEl.style.cursor = 'pointer';

        if (isSafeRadius) {
          // Privacy-protected safe zone indicator
          pinEl.innerHTML = `
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #0f172a;
              color: #ffffff;
              border: 2px solid #38bdf8;
              padding: 6px 12px;
              border-radius: 9999px;
              box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.45);
              white-space: nowrap;
              font-family: ui-sans-serif, system-ui, sans-serif;
              font-size: 11px;
              font-weight: 800;
            ">
              <span style="color: #38bdf8;">🛡️</span>
              <span>Безопасный радиус дома</span>
            </div>
          `;
        } else {
          // Exact building pin
          pinEl.innerHTML = `
            <div style="
              display: inline-flex;
              flex-direction: column;
              background: #0f172a;
              color: #ffffff;
              border: 2px solid #10b981;
              padding: 6px 12px;
              border-radius: 12px;
              box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.45);
              white-space: nowrap;
              font-family: ui-sans-serif, system-ui, sans-serif;
            ">
              <span style="font-weight: 800; font-size: 12px; color: #34d399;">${complexName}</span>
              <span style="font-size: 10px; opacity: 0.85;">${streetAddress}</span>
            </div>
          `;
        }

        const marker = new YMapMarker(
          {
            coordinates: [lng, lat],
          },
          pinEl
        );

        map.addChild(marker);
        mapInstanceRef.current = map;
      } catch (err: any) {
        console.warn('[YandexLotMap] Failed to load Yandex Maps v3:', err);
        setLoadError(err?.message || 'Интерактивная карта Яндекс недоступна');
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
      }
    };
  }, [lat, lng, complexName, streetAddress, isSafeRadius]);

  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Train':
        return <Train className="w-3.5 h-3.5" />;
      case 'GraduationCap':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'Trees':
        return <Trees className="w-3.5 h-3.5" />;
      case 'HeartPulse':
        return <HeartPulse className="w-3.5 h-3.5" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-3.5 h-3.5" />;
      default:
        return <Navigation className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Map Display or Graceful Fallback Card */}
      <div className="relative w-full h-72 sm:h-80 rounded-3xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md">
        {!loadError ? (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm mb-1">{complexName}</h4>
            <p className="text-xs text-slate-300 max-w-sm mb-3">{streetAddress}</p>
            {isSafeRadius && (
              <span className="px-3 py-1 rounded-full bg-sky-900/60 border border-sky-400/30 text-sky-300 text-[11px] font-bold flex items-center gap-1.5 mb-3">
                <Shield className="w-3.5 h-3.5" />
                <span>Безопасный радиус дома (152-ФЗ)</span>
              </span>
            )}
          </div>
        )}

        {/* Floating Open on Yandex Maps Pill */}
        <div className="absolute top-3.5 right-3.5 z-10">
          <a
            href={getYandexMapsPinUrl(lat, lng, `${complexName}, ${streetAddress}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-white border border-slate-700 backdrop-blur-md text-xs font-bold shadow-lg transition-all flex items-center space-x-1.5"
          >
            <span>Открыть на Яндекс.Картах</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
          </a>
        </div>

        {/* Safe radius pill banner */}
        {isSafeRadius && !loadError && (
          <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl bg-slate-900/90 text-white border border-sky-400/40 text-[11px] font-bold shadow-md flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Безопасный радиус дома (152-ФЗ)</span>
          </div>
        )}
      </div>

      {/* Surrounding Infrastructure 5-Category Explorer Bar */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            <span>Инфраструктура рядом на Яндекс.Картах:</span>
          </span>
          <span className="text-[11px] text-slate-400">Быстрый поиск в 1 клик</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {INFRASTRUCTURE_CATEGORIES.map((cat) => (
            <a
              key={cat.id}
              href={getYandexMapsExploreUrl(lat, lng, cat.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs font-bold text-slate-700 hover:text-emerald-900 transition-all flex items-center space-x-1.5 shadow-2xs group"
            >
              <span className="text-slate-500 group-hover:text-emerald-600 transition-colors">
                {renderCategoryIcon(cat.iconName)}
              </span>
              <span>{cat.labelRu}</span>
              <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
