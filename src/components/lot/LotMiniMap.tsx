import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LotMiniMapProps {
  lat: number;
  lng: number;
  complexName: string;
  streetAddress: string;
}

export const LotMiniMap: React.FC<LotMiniMapProps> = ({
  lat,
  lng,
  complexName,
  streetAddress,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'domexit-lot-detail-pin',
      html: `
        <div style="
          display:inline-flex;
          flex-direction:column;
          background:#0f172a;
          color:#ffffff;
          border:2px solid #10b981;
          padding:6px 12px;
          border-radius:12px;
          box-shadow:0 10px 25px -5px rgba(15,23,42,0.45);
          white-space:nowrap;
          font-family:Inter,system-ui,sans-serif;
        ">
          <span style="font-weight:800;font-size:12px;color:#34d399;">${complexName}</span>
          <span style="font-size:10px;opacity:0.85;">${streetAddress}</span>
        </div>
      `,
      iconSize: [180, 44],
      iconAnchor: [90, 22],
    });

    L.marker([lat, lng], { icon }).addTo(map);
    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, complexName, streetAddress]);

  return <div ref={containerRef} className="w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 z-0" />;
};
