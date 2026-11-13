import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Lot } from '../../types';
import { RUSSIAN_REGIONS, getRegionByCode, resolveLotGeoDetails } from '../../data/russianGeography';
import { formatPercent, formatRubles } from '../../utils/formatters';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ArrowRight,
  Building2,
  LocateFixed,
  MapPin,
  Navigation,
  ShieldCheck,
  TrainFront,
  X,
} from 'lucide-react';

interface CatalogMapViewProps {
  lots: Lot[];
  selectedCity?: string;
  onSelectCity?: (cityCode: string) => void;
}

function formatCompactMillions(amount: number, lang: string): string {
  const millions = amount / 1_000_000;
  const formatted = millions >= 10 ? millions.toFixed(1) : millions.toFixed(2).replace(/\.?0+$/, '');
  return lang === 'ru' ? `${formatted} млн ₽` : `${formatted}M ₽`;
}

export const CatalogMapView: React.FC<CatalogMapViewProps> = ({
  lots,
  selectedCity = 'all',
  onSelectCity,
}) => {
  const { language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedLot, setSelectedLot] = useState<Lot | null>(lots[0] || null);

  // Keep selectedLot in sync when filtered lots change
  useEffect(() => {
    if (lots.length === 0) {
      setSelectedLot(null);
      return;
    }
    if (!selectedLot || !lots.some((l) => l.lotCode === selectedLot.lotCode)) {
      setSelectedLot(lots[0]);
    }
  }, [lots]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] =
      selectedCity && selectedCity !== 'all'
        ? [getRegionByCode(selectedCity).center.lat, getRegionByCode(selectedCity).center.lng]
        : [57.8, 41.0];
    const initialZoom = selectedCity && selectedCity !== 'all' ? getRegionByCode(selectedCity).defaultZoom : 5;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO | DomExit 214-ФЗ Гео-Реестр',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersGroup;

    // Ensure proper tile sizing after mount
    setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Render interactive banking markers whenever lots or selectedLot updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    lots.forEach((lot) => {
      const geo = resolveLotGeoDetails(lot);
      const isSelected = selectedLot?.lotCode === lot.lotCode;
      const status = lot.status || 'available';

      const bgClass = isSelected
        ? 'background:#059669;color:#ffffff;border:2px solid #ecfdf5;transform:scale(1.08);z-index:999;'
        : status === 'processing'
        ? 'background:#d97706;color:#ffffff;border:1.5px solid #fef3c7;'
        : status === 'closed'
        ? 'background:#475569;color:#f8fafc;border:1.5px solid #cbd5e1;'
        : 'background:#0f172a;color:#ffffff;border:1.5px solid #10b981;';

      const shortComplex =
        lot.complexName.length > 20 ? `${lot.complexName.slice(0, 19)}…` : lot.complexName;
      const priceBadge = formatCompactMillions(lot.cashPaidBySeller, language);

      const html = `
        <div style="
          display:inline-flex;
          flex-direction:column;
          align-items:flex-start;
          padding:5px 10px;
          border-radius:12px;
          box-shadow:0 8px 20px -4px rgba(15,23,42,0.38);
          cursor:pointer;
          transition:all 0.18s ease;
          white-space:nowrap;
          font-family:Inter,system-ui,sans-serif;
          ${bgClass}
        ">
          <div style="display:flex;align-items:center;gap:5px;font-weight:800;font-size:12px;line-height:1.15;">
            <span>${priceBadge}</span>
            ${
              lot.isUrgentExit
                ? '<span style="background:#e11d48;color:#fff;font-size:9px;padding:1px 4px;border-radius:4px;">HOT</span>'
                : ''
            }
          </div>
          <div style="font-size:10px;font-weight:600;opacity:0.9;margin-top:1px;">
            ${shortComplex}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'domexit-custom-lot-marker',
        html,
        iconSize: [140, 42],
        iconAnchor: [70, 21],
      });

      const marker = L.marker([geo.coordinates.lat, geo.coordinates.lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', () => {
        setSelectedLot(lot);
        map.flyTo([geo.coordinates.lat, geo.coordinates.lng], Math.max(map.getZoom(), 12), {
          duration: 0.6,
        });
      });

      marker.addTo(markersGroup);
    });
  }, [lots, selectedLot, language]);

  // Fit bounds when lot list or selectedCity changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedCity && selectedCity !== 'all') {
      const region = getRegionByCode(selectedCity);
      const cityLots = lots.filter((l) => l.city === selectedCity);
      if (cityLots.length > 1) {
        const bounds = L.latLngBounds(
          cityLots.map((l) => {
            const g = resolveLotGeoDetails(l);
            return [g.coordinates.lat, g.coordinates.lng] as [number, number];
          })
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
      } else if (cityLots.length === 1) {
        const g = resolveLotGeoDetails(cityLots[0]);
        map.setView([g.coordinates.lat, g.coordinates.lng], 13);
      } else {
        map.setView([region.center.lat, region.center.lng], region.defaultZoom);
      }
      return;
    }

    if (lots.length > 1) {
      const bounds = L.latLngBounds(
        lots.map((l) => {
          const g = resolveLotGeoDetails(l);
          return [g.coordinates.lat, g.coordinates.lng] as [number, number];
        })
      );
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 12 });
    } else if (lots.length === 1) {
      const g = resolveLotGeoDetails(lots[0]);
      map.setView([g.coordinates.lat, g.coordinates.lng], 13);
    }
  }, [lots, selectedCity]);

  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || lots.length === 0) return;
    const bounds = L.latLngBounds(
      lots.map((l) => {
        const g = resolveLotGeoDetails(l);
        return [g.coordinates.lat, g.coordinates.lng] as [number, number];
      })
    );
    map.fitBounds(bounds, { padding: [55, 55], maxZoom: 12 });
  };

  const selectedGeo = selectedLot ? resolveLotGeoDetails(selectedLot) : null;
  const selectedSavingsRub = selectedLot
    ? selectedLot.todayDeveloperPrice - selectedLot.dduContractPrice
    : 0;
  const selectedSavingsPercent =
    selectedLot && selectedLot.todayDeveloperPrice > 0
      ? (selectedSavingsRub / selectedLot.todayDeveloperPrice) * 100
      : 0;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Top Map Toolbar: Region Quick-Zoom Pills */}
      <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold tracking-tight">
            {language === 'ru'
              ? `Интерактивная карта объектов (${lots.length})`
              : `Interactive Registry Map (${lots.length})`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
          <button
            type="button"
            onClick={() => {
              onSelectCity?.('all');
              handleFitAll();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
              selectedCity === 'all'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {language === 'ru' ? 'Вся РФ' : 'All Russia'}
          </button>
          {RUSSIAN_REGIONS.map((reg) => (
            <button
              key={reg.code}
              type="button"
              onClick={() => onSelectCity?.(reg.code)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors shrink-0 ${
                selectedCity === reg.code
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {language === 'ru' ? reg.shortLabelRu : reg.shortLabelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split View: Map Canvas + Floating / Side Interactive Lot Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Map Canvas */}
        <div className="relative lg:col-span-8 h-[480px] sm:h-[580px] bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Floating Reset Bounds Button */}
          <button
            type="button"
            onClick={handleFitAll}
            className="absolute top-3 right-3 z-[400] px-3 py-2 rounded-xl bg-white/95 hover:bg-white text-slate-800 border border-slate-200 shadow-md text-xs font-bold flex items-center space-x-1.5 backdrop-blur-sm transition-all"
          >
            <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Показать все маркеры' : 'Fit All Markers'}</span>
          </button>

          {/* Map Legend */}
          <div className="absolute bottom-3 left-3 z-[400] px-3 py-2 rounded-xl bg-white/95 border border-slate-200 shadow-md backdrop-blur-sm flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-700">
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-emerald-500 inline-block" />
              <span>{language === 'ru' ? 'Доступен' : 'Available'}</span>
            </span>
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              <span>{language === 'ru' ? 'Выбран' : 'Selected'}</span>
            </span>
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              <span>{language === 'ru' ? 'В сделке' : 'In Deal'}</span>
            </span>
          </div>
        </div>

        {/* Selected Lot Interactive Banking Preview Panel */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/70 flex flex-col justify-between p-5">
          {selectedLot && selectedGeo ? (
            <div className="space-y-4">
              {/* Photo Header */}
              <div className="relative h-48 rounded-2xl overflow-hidden border border-slate-200 bg-slate-200">
                <img
                  src={selectedLot.imageUrl}
                  alt={selectedLot.complexName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-extrabold shadow">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>#{selectedLot.lotCode}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900/85 text-white text-[11px] font-bold backdrop-blur-sm">
                    {selectedLot.escrowBank} Эскроу
                  </span>
                </div>
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-white/95 text-slate-900 text-[11px] font-bold shadow-xs">
                    {selectedGeo.region.shortLabelRu}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedLot(null)}
                    className="p-1 rounded-lg bg-slate-900/70 text-white hover:bg-slate-900 lg:hidden"
                    aria-label="Close preview"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Complex & Location Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{selectedLot.developer}</span>
                  </span>
                  <span>{selectedLot.deliveryDate}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-snug">
                  {selectedLot.complexName}
                </h3>
                <p className="text-xs text-slate-600 flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    {selectedLot.district}, {selectedGeo.streetAddress}
                  </span>
                </p>

                {/* Primary Metro / Transport Station */}
                {selectedGeo.metroStations.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {selectedGeo.metroStations.slice(0, 2).map((st, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: st.lineColor }}
                        />
                        <TrainFront className="w-3 h-3 text-slate-400" />
                        <span>{st.name}</span>
                        <span className="text-slate-400">• {st.travelTimeText}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Specs Strip (152-FZ Masked Floor) */}
              <div className="grid grid-cols-3 gap-2 text-center bg-white rounded-xl p-2.5 border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Площадь</span>
                  <span className="font-bold text-slate-900">{selectedLot.areaM2} м²</span>
                </div>
                <div className="border-x border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Формат</span>
                  <span className="font-bold text-slate-900">
                    {selectedLot.rooms === 'studio'
                      ? 'Студия'
                      : `${selectedLot.rooms.replace('-room', '')}-комн.`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Этаж (152-ФЗ)</span>
                  <span className="font-bold text-slate-900">
                    {selectedLot.ownerDossier?.hideExactFloor
                      ? selectedLot.ownerDossier.floorRangeDisplay
                      : `${selectedLot.floor}/${selectedLot.totalFloors}`}
                  </span>
                </div>
              </div>

              {/* Financial Advantage & 100% Seller Return */}
              <div className="space-y-2">
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 block">
                      {language === 'ru' ? 'Наличными продавцу (вход):' : 'Cash to Seller:'}
                    </span>
                    <span className="text-xl font-black text-slate-950">
                      {formatRubles(selectedLot.cashPaidBySeller)}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold">
                    {language === 'ru' ? '100% возврат продавцу' : '100% Seller Return'}
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-800 block">
                      {language === 'ru' ? 'Чистая экономия к застройщику:' : 'Savings vs Developer:'}
                    </span>
                    <span className="text-base font-black text-emerald-800">
                      +{formatRubles(selectedSavingsRub)}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black">
                    -{formatPercent(selectedSavingsPercent)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2 text-slate-500">
              <MapPin className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">
                {language === 'ru' ? 'Выберите маркер на карте' : 'Select a marker on the map'}
              </p>
              <p className="text-xs text-slate-500 max-w-xs">
                {language === 'ru'
                  ? 'Нажмите на любой ценовой индикатор ЖК, чтобы открыть экспресс-досье объекта.'
                  : 'Click any price badge on the map to inspect the property dossier.'}
              </p>
            </div>
          )}

          {selectedLot && (
            <div className="pt-4 mt-4 border-t border-slate-200 space-y-2">
              <Link
                to={`/opportunities/${selectedLot.lotCode}`}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all"
              >
                <span>
                  {language === 'ru'
                    ? 'Перейти к полному паспорту лота'
                    : 'Open Full Property Dossier'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Quick Horizontal Switcher across filtered lots */}
              {lots.length > 1 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    {language === 'ru'
                      ? `Объект ${lots.findIndex((l) => l.lotCode === selectedLot.lotCode) + 1} из ${lots.length}`
                      : `Unit ${lots.findIndex((l) => l.lotCode === selectedLot.lotCode) + 1} of ${lots.length}`}
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = lots.findIndex((l) => l.lotCode === selectedLot.lotCode);
                        const prev = lots[(idx - 1 + lots.length) % lots.length];
                        setSelectedLot(prev);
                      }}
                      className="font-bold text-slate-700 hover:text-emerald-700"
                    >
                      ← {language === 'ru' ? 'Пред.' : 'Prev'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = lots.findIndex((l) => l.lotCode === selectedLot.lotCode);
                        const next = lots[(idx + 1) % lots.length];
                        setSelectedLot(next);
                      }}
                      className="font-bold text-slate-700 hover:text-emerald-700"
                    >
                      {language === 'ru' ? 'След.' : 'Next'} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
