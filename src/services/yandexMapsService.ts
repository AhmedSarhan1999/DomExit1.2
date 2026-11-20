import { RussianCityCode, MetroStationInfo } from '../types';
import { getRegionByCode, getDistrictGeo } from '../data/russianGeography';

// Read API keys securely from environment variables (Zero hardcoded keys in source)
const MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY || '';
const GEOCODER_API_KEY = import.meta.env.VITE_YANDEX_GEOCODER_API_KEY || '';
const SUGGEST_API_KEY = import.meta.env.VITE_YANDEX_SUGGEST_API_KEY || '';

let scriptLoadPromise: Promise<any> | null = null;

/**
 * Singleton loader for Yandex Maps JS API v3.
 * Loads https://api-maps.yandex.ru/v3/ once and resolves when ymaps3.ready completes.
 */
export function loadYandexMapsScript(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not defined (SSR environment)'));
  }

  if (window.ymaps3 && typeof window.ymaps3.ready === 'object') {
    return window.ymaps3.ready.then(() => window.ymaps3);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existing = document.querySelector('script[src*="api-maps.yandex.ru/v3"]');
    if (existing) {
      const pollReady = () => {
        if (window.ymaps3 && window.ymaps3.ready) {
          window.ymaps3.ready.then(() => resolve(window.ymaps3)).catch(reject);
        } else {
          setTimeout(pollReady, 80);
        }
      };
      pollReady();
      return;
    }

    if (!MAPS_API_KEY) {
      reject(new Error('VITE_YANDEX_MAPS_API_KEY is not defined in environment variables'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(MAPS_API_KEY)}&lang=ru_RU`;
    script.async = true;

    script.onload = () => {
      if (window.ymaps3 && window.ymaps3.ready) {
        window.ymaps3.ready
          .then(() => resolve(window.ymaps3))
          .catch((err: any) => reject(err));
      } else {
        reject(new Error('Yandex Maps v3 loaded but window.ymaps3.ready was not found'));
      }
    };

    script.onerror = (err) => {
      scriptLoadPromise = null;
      reject(new Error(`Failed to load Yandex Maps v3 script: ${err}`));
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface AddressSuggestion {
  title: string;
  subtitle?: string;
  fullAddress: string;
}

export interface GeocodeResult {
  coordinates: {
    lat: number;
    lng: number;
  };
  formattedAddress: string;
  district?: string;
}

/**
 * Calculates distance in kilometers between two geographic coordinates using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Autocomplete address suggestions using Yandex Geosuggest API with local fallback.
 */
export async function suggestAddresses(
  query: string,
  cityCode: RussianCityCode = 'spb'
): Promise<AddressSuggestion[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const regionConfig = getRegionByCode(cityCode);
  const cityPrefix = regionConfig.labelRu;

  // 1. Try Yandex Geosuggest API
  if (SUGGEST_API_KEY) {
    try {
      const fullQuery = clean.toLowerCase().includes(cityPrefix.toLowerCase())
        ? clean
        : `${cityPrefix}, ${clean}`;

      const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${encodeURIComponent(
        SUGGEST_API_KEY
      )}&text=${encodeURIComponent(fullQuery)}&lang=ru_RU&types=street,house,geo&results=6`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const results = data?.results || [];
        if (Array.isArray(results) && results.length > 0) {
          return results.map((item: any) => {
            const title = item.title?.text || clean;
            const subtitle = item.subtitle?.text || regionConfig.labelRu;
            return {
              title,
              subtitle,
              fullAddress: subtitle ? `${subtitle}, ${title}` : title,
            };
          });
        }
      }
    } catch (apiErr) {
      // Non-fatal: continue to graceful local fallback
      console.warn('[YandexGeosuggest] Online suggest fallback triggered:', apiErr);
    }
  }

  // 2. High-fidelity local fallback based on curated Russian districts and streets
  const localSuggestions: AddressSuggestion[] = [];
  const districts = regionConfig.districts || [];

  for (const d of districts) {
    if (d.defaultStreetRu && d.defaultStreetRu.toLowerCase().includes(clean.toLowerCase())) {
      localSuggestions.push({
        title: d.defaultStreetRu,
        subtitle: `${regionConfig.labelRu}, ${d.nameRu}`,
        fullAddress: `${regionConfig.labelRu}, ${d.nameRu}, ${d.defaultStreetRu}`,
      });
    }
    if (d.nameRu.toLowerCase().includes(clean.toLowerCase())) {
      localSuggestions.push({
        title: d.defaultStreetRu || d.nameRu,
        subtitle: `${regionConfig.labelRu}, ${d.nameRu}`,
        fullAddress: `${regionConfig.labelRu}, ${d.nameRu}${d.defaultStreetRu ? `, ${d.defaultStreetRu}` : ''}`,
      });
    }
  }

  return localSuggestions.slice(0, 5);
}

/**
 * Geocode an address into precise { lat, lng } coordinates and canonical Russian address using Yandex Geocoder API.
 */
export async function geocodeAddress(
  address: string,
  cityCode: RussianCityCode = 'spb'
): Promise<GeocodeResult | null> {
  const clean = address.trim();
  if (!clean) return null;

  const regionConfig = getRegionByCode(cityCode);

  if (GEOCODER_API_KEY) {
    try {
      const fullQuery = clean.toLowerCase().includes(regionConfig.labelRu.toLowerCase())
        ? clean
        : `${regionConfig.labelRu}, ${clean}`;

      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(
        GEOCODER_API_KEY
      )}&geocode=${encodeURIComponent(fullQuery)}&format=json&lang=ru_RU&results=1`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const member = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
        if (member) {
          const pos = member.Point?.pos; // "lng lat"
          if (pos) {
            const [lngStr, latStr] = pos.split(' ');
            const lat = parseFloat(latStr);
            const lng = parseFloat(lngStr);
            const formattedAddress =
              member.metaDataProperty?.GeocoderMetaData?.text || clean;

            // Attempt to extract district name if available
            const components =
              member.metaDataProperty?.GeocoderMetaData?.Address?.Components || [];
            const districtComp = components.find(
              (c: any) => c.kind === 'district' || c.kind === 'sub_locality'
            );

            return {
              coordinates: { lat, lng },
              formattedAddress,
              district: districtComp?.name,
            };
          }
        }
      }
    } catch (geoErr) {
      console.warn('[YandexGeocoder] Geocoding API fallback triggered:', geoErr);
    }
  }

  // Fallback: district or city center anchor from russianGeography
  const fallbackDistrict = regionConfig.districts?.[0] || getDistrictGeo(cityCode, '');
  return {
    coordinates: {
      lat: fallbackDistrict.coordinates.lat,
      lng: fallbackDistrict.coordinates.lng,
    },
    formattedAddress: `${regionConfig.labelRu}, ${clean}`,
    district: fallbackDistrict.nameRu,
  };
}

/**
 * Discover the nearest metro station around { lat, lng } via Yandex Geocoder (kind=metro).
 * Computes distance and travel time (walk or transport).
 */
export async function findNearestMetro(
  lat: number,
  lng: number,
  cityCode: RussianCityCode = 'spb'
): Promise<MetroStationInfo | null> {
  if (GEOCODER_API_KEY && lat && lng) {
    try {
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(
        GEOCODER_API_KEY
      )}&geocode=${lng.toFixed(6)},${lat.toFixed(6)}&kind=metro&format=json&lang=ru_RU&results=3`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const members = data?.response?.GeoObjectCollection?.featureMember || [];
        if (Array.isArray(members) && members.length > 0) {
          const nearest = members[0]?.GeoObject;
          if (nearest) {
            const rawName = nearest.name || 'Метро';
            const cleanName = rawName.replace(/^(станция метро|метро)\s+/i, '').trim();
            const pos = nearest.Point?.pos;

            let distKm = 0.8;
            if (pos) {
              const [stLngStr, stLatStr] = pos.split(' ');
              distKm = haversineDistanceKm(lat, lng, parseFloat(stLatStr), parseFloat(stLngStr));
            }

            const isWalk = distKm <= 1.4;
            const travelMinutes = isWalk
              ? Math.max(3, Math.round(distKm * 12.5))
              : Math.max(5, Math.round(distKm * 3.5 + 4));

            return {
              name: cleanName,
              travelTimeText: `${travelMinutes} мин. ${isWalk ? 'пешком' : 'транспортом'}`,
              mode: isWalk ? 'walk' : 'drive',
              lineColor: cityCode === 'msk' ? '#ED1B35' : '#0078C9',
            };
          }
        }
      }
    } catch (metroErr) {
      console.warn('[YandexGeocoder] Nearest metro query fallback triggered:', metroErr);
    }
  }

  // Fallback to district default metro station
  const regionConfig = getRegionByCode(cityCode);
  const firstStation = regionConfig.districts?.[0]?.metroStations?.[0];
  return firstStation || null;
}

export type InfrastructureCategory = 'metro' | 'schools' | 'parks' | 'clinics' | 'shops';

export interface InfrastructureButtonDef {
  id: InfrastructureCategory;
  labelRu: string;
  iconName: string;
  query: string;
}

export const INFRASTRUCTURE_CATEGORIES: InfrastructureButtonDef[] = [
  {
    id: 'metro',
    labelRu: 'Метро и транспорт',
    iconName: 'Train',
    query: 'метро, остановка общественного транспорта',
  },
  {
    id: 'schools',
    labelRu: 'Школы и детсады',
    iconName: 'GraduationCap',
    query: 'школа, детский сад, лицей',
  },
  {
    id: 'parks',
    labelRu: 'Парки и отдых',
    iconName: 'Trees',
    query: 'парк, сквер, набережная',
  },
  {
    id: 'clinics',
    labelRu: 'Клиники и аптеки',
    iconName: 'HeartPulse',
    query: 'поликлиника, больница, аптека',
  },
  {
    id: 'shops',
    labelRu: 'Магазины и ТЦ',
    iconName: 'ShoppingBag',
    query: 'супермаркет, торговый центр, магазин продуктов',
  },
];

/**
 * Builds a direct exploration link to Yandex Maps centered on property coordinates.
 */
export function getYandexMapsExploreUrl(
  lat: number,
  lng: number,
  category: InfrastructureCategory
): string {
  const item = INFRASTRUCTURE_CATEGORIES.find((c) => c.id === category);
  const query = item ? item.query : 'инфраструктура';
  return `https://yandex.ru/maps/?ll=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&text=${encodeURIComponent(
    query
  )}`;
}

/**
 * Builds a direct pin URL to open the exact property coordinates on Yandex Maps.
 */
export function getYandexMapsPinUrl(lat: number, lng: number, title?: string): string {
  const textParam = title ? `&text=${encodeURIComponent(title)}` : '';
  return `https://yandex.ru/maps/?ll=${lng.toFixed(6)},${lat.toFixed(6)}&z=16&pt=${lng.toFixed(
    6
  )},${lat.toFixed(6)},pm2rdm${textParam}`;
}
