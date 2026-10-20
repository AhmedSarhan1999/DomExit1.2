import { MarketSettings } from '../../types';
import { initialMarketSettings } from '../seedData';
import { FirebaseAdapter } from '../adapters/FirebaseAdapter';

const COLLECTION = 'market_settings';
const DOC_ID = 'market_parameters';

export class MarketSettingsRepository {
  private static cachedSettings: MarketSettings | null = null;

  static async getSettings(): Promise<MarketSettings> {
    if (this.cachedSettings) return this.cachedSettings;
    const settings = await FirebaseAdapter.getEntity<MarketSettings>(
      COLLECTION,
      DOC_ID,
      [initialMarketSettings as MarketSettings]
    );
    this.cachedSettings = settings || (initialMarketSettings as MarketSettings);
    return this.cachedSettings;
  }

  static async saveSettings(newSettings: Partial<MarketSettings>): Promise<MarketSettings> {
    const current = await this.getSettings();
    const updated: MarketSettings = {
      ...current,
      ...newSettings,
      id: DOC_ID,
      updatedAt: new Date().toISOString(),
    };

    this.cachedSettings = updated;
    await FirebaseAdapter.saveEntity(COLLECTION, updated);

    // Broadcast instant update event across application tabs and components
    try {
      window.dispatchEvent(new CustomEvent('domexit:market_settings_updated', { detail: updated }));
    } catch {}

    return updated;
  }

  static getSync(): MarketSettings {
    if (this.cachedSettings) return this.cachedSettings;
    const storageKey = `domexit_fb_${COLLECTION}`;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          this.cachedSettings = arr[0];
          return arr[0];
        }
      }
    } catch {}
    return initialMarketSettings as MarketSettings;
  }
}
