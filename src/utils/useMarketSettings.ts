import { useState, useEffect } from 'react';
import { MarketSettings } from '../types';
import { MarketSettingsRepository } from '../dal/repositories/MarketSettingsRepository';

export function useMarketSettings(): MarketSettings {
  const [settings, setSettings] = useState<MarketSettings>(() => MarketSettingsRepository.getSync());

  useEffect(() => {
    let isMounted = true;

    MarketSettingsRepository.getSettings().then((live) => {
      if (isMounted) setSettings(live);
    });

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<MarketSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    };

    window.addEventListener('domexit:market_settings_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('domexit:market_settings_updated', handleUpdate);
    };
  }, []);

  return settings;
}
