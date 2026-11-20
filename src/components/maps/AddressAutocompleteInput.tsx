import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, Navigation, Check } from 'lucide-react';
import { RussianCityCode, MetroStationInfo } from '../../types';
import {
  suggestAddresses,
  geocodeAddress,
  findNearestMetro,
  AddressSuggestion,
} from '../../services/yandexMapsService';

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectAddress?: (details: {
    address: string;
    coordinates?: { lat: number; lng: number };
    nearestMetro?: MetroStationInfo;
    district?: string;
  }) => void;
  cityCode?: RussianCityCode;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
}

export const AddressAutocompleteInput: React.FC<AddressAutocompleteInputProps> = ({
  value,
  onChange,
  onSelectAddress,
  cityCode = 'spb',
  placeholder = 'Например: Комендантский пр-т, д. 62, к. 1',
  className = '',
  onBlur,
}) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await suggestAddresses(query, cityCode);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setSelectedIndex(-1);
      } catch (err) {
        console.warn('[AddressAutocomplete] Suggest error:', err);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [cityCode]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newVal);
    }, 350);
  };

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    const selectedText = item.title;
    onChange(selectedText);
    setIsOpen(false);
    setSuggestions([]);

    if (onSelectAddress) {
      setIsGeocoding(true);
      try {
        const geocoded = await geocodeAddress(item.fullAddress || selectedText, cityCode);
        let metro: MetroStationInfo | undefined = undefined;

        if (geocoded?.coordinates) {
          const nearest = await findNearestMetro(
            geocoded.coordinates.lat,
            geocoded.coordinates.lng,
            cityCode
          );
          if (nearest) metro = nearest;
        }

        onSelectAddress({
          address: selectedText,
          coordinates: geocoded?.coordinates,
          nearestMetro: metro,
          district: geocoded?.district,
        });
      } catch (err) {
        console.warn('[AddressAutocomplete] Geocoding error:', err);
        onSelectAddress({ address: selectedText });
      } finally {
        setIsGeocoding(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="off"
          className={
            className ||
            'w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500'
          }
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none text-slate-400">
          {isLoading || isGeocoding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Navigation className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto py-1 text-xs">
          {suggestions.map((item, idx) => (
            <li
              key={`${item.fullAddress}-${idx}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input onBlur before click registers
                handleSelectSuggestion(item);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`px-3.5 py-2.5 flex items-start space-x-2.5 cursor-pointer transition-colors ${
                selectedIndex === idx ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <MapPin
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  selectedIndex === idx ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{item.title}</div>
                {item.subtitle && (
                  <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                )}
              </div>
              {selectedIndex === idx && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
