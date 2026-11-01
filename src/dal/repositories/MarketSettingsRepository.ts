import { DistrictYieldConfig, MarketSettings } from '../../types';
import { initialMarketSettings } from '../seedData';
import { DatabaseGateway } from '../DatabaseGateway';
import { AuditLogsRepository } from './AuditLogsRepository';

const COLLECTION = 'market_settings';
const DOC_ID = 'market_parameters';

export const DEFAULT_DISTRICT_YIELD_CONFIGS: Record<string, DistrictYieldConfig> = {
  'Приморский район': {
    districtNameRu: 'Приморский район',
    city: 'spb',
    dailyRentPercentOfMarket: 0.05,
    monthlyRentPercentOfMarket: 0.65,
    annualGrowthPercent: 11.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Московский район': {
    districtNameRu: 'Московский район',
    city: 'spb',
    dailyRentPercentOfMarket: 0.055,
    monthlyRentPercentOfMarket: 0.68,
    annualGrowthPercent: 12.2,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Василеостровский район': {
    districtNameRu: 'Василеостровский район',
    city: 'spb',
    dailyRentPercentOfMarket: 0.06,
    monthlyRentPercentOfMarket: 0.7,
    annualGrowthPercent: 12.8,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Петроградский район': {
    districtNameRu: 'Петроградский район',
    city: 'spb',
    dailyRentPercentOfMarket: 0.065,
    monthlyRentPercentOfMarket: 0.72,
    annualGrowthPercent: 13.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Невский район': {
    districtNameRu: 'Невский район',
    city: 'spb',
    dailyRentPercentOfMarket: 0.048,
    monthlyRentPercentOfMarket: 0.64,
    annualGrowthPercent: 10.8,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Пресненский район': {
    districtNameRu: 'Пресненский район',
    city: 'msk',
    dailyRentPercentOfMarket: 0.062,
    monthlyRentPercentOfMarket: 0.7,
    annualGrowthPercent: 14.0,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Хамовники': {
    districtNameRu: 'Хамовники',
    city: 'msk',
    dailyRentPercentOfMarket: 0.065,
    monthlyRentPercentOfMarket: 0.72,
    annualGrowthPercent: 14.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Раменки': {
    districtNameRu: 'Раменки',
    city: 'msk',
    dailyRentPercentOfMarket: 0.055,
    monthlyRentPercentOfMarket: 0.66,
    annualGrowthPercent: 12.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Даниловский район': {
    districtNameRu: 'Даниловский район',
    city: 'msk',
    dailyRentPercentOfMarket: 0.056,
    monthlyRentPercentOfMarket: 0.67,
    annualGrowthPercent: 12.8,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Хорошёво-Мнёвники': {
    districtNameRu: 'Хорошёво-Мнёвники',
    city: 'msk',
    dailyRentPercentOfMarket: 0.054,
    monthlyRentPercentOfMarket: 0.65,
    annualGrowthPercent: 12.4,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Центральный район (Сочи)': {
    districtNameRu: 'Центральный район (Сочи)',
    city: 'sochi',
    dailyRentPercentOfMarket: 0.085,
    monthlyRentPercentOfMarket: 0.78,
    annualGrowthPercent: 15.2,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Адлерский район (Сириус)': {
    districtNameRu: 'Адлерский район (Сириус)',
    city: 'sochi',
    dailyRentPercentOfMarket: 0.09,
    monthlyRentPercentOfMarket: 0.8,
    annualGrowthPercent: 15.8,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Хостинский район': {
    districtNameRu: 'Хостинский район',
    city: 'sochi',
    dailyRentPercentOfMarket: 0.08,
    monthlyRentPercentOfMarket: 0.75,
    annualGrowthPercent: 14.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Лазаревский район': {
    districtNameRu: 'Лазаревский район',
    city: 'sochi',
    dailyRentPercentOfMarket: 0.07,
    monthlyRentPercentOfMarket: 0.70,
    annualGrowthPercent: 13.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Ново-Савиновский район': {
    districtNameRu: 'Ново-Савиновский район',
    city: 'kazan',
    dailyRentPercentOfMarket: 0.052,
    monthlyRentPercentOfMarket: 0.66,
    annualGrowthPercent: 12.0,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Вахитовский район': {
    districtNameRu: 'Вахитовский район',
    city: 'kazan',
    dailyRentPercentOfMarket: 0.058,
    monthlyRentPercentOfMarket: 0.70,
    annualGrowthPercent: 13.0,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Советский район (Казань)': {
    districtNameRu: 'Советский район (Казань)',
    city: 'kazan',
    dailyRentPercentOfMarket: 0.048,
    monthlyRentPercentOfMarket: 0.62,
    annualGrowthPercent: 11.2,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Приволжский район': {
    districtNameRu: 'Приволжский район',
    city: 'kazan',
    dailyRentPercentOfMarket: 0.050,
    monthlyRentPercentOfMarket: 0.64,
    annualGrowthPercent: 11.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Ленинский район (ЕКБ)': {
    districtNameRu: 'Ленинский район (ЕКБ)',
    city: 'ekb',
    dailyRentPercentOfMarket: 0.050,
    monthlyRentPercentOfMarket: 0.65,
    annualGrowthPercent: 11.8,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Октябрьский район (ЕКБ)': {
    districtNameRu: 'Октябрьский район (ЕКБ)',
    city: 'ekb',
    dailyRentPercentOfMarket: 0.048,
    monthlyRentPercentOfMarket: 0.63,
    annualGrowthPercent: 11.2,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Верх-Исетский район': {
    districtNameRu: 'Верх-Исетский район',
    city: 'ekb',
    dailyRentPercentOfMarket: 0.052,
    monthlyRentPercentOfMarket: 0.67,
    annualGrowthPercent: 12.2,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
  'Кировский район (ЕКБ)': {
    districtNameRu: 'Кировский район (ЕКБ)',
    city: 'ekb',
    dailyRentPercentOfMarket: 0.049,
    monthlyRentPercentOfMarket: 0.64,
    annualGrowthPercent: 11.5,
    updatedAt: '2026-10-28T10:00:00.000Z',
  },
};

export class MarketSettingsRepository {
  private static cachedSettings: MarketSettings | null = null;

  static async getSettings(): Promise<MarketSettings> {
    if (this.cachedSettings) return this.cachedSettings;
    const settings = await DatabaseGateway.getById<MarketSettings>(COLLECTION, DOC_ID, [
      initialMarketSettings as MarketSettings,
    ]);
    const base = settings || (initialMarketSettings as MarketSettings);
    this.cachedSettings = {
      ...base,
      districtYieldConfigs: {
        ...DEFAULT_DISTRICT_YIELD_CONFIGS,
        ...(base.districtYieldConfigs || {}),
      },
    };
    return this.cachedSettings;
  }

  static async getDistrictYieldConfig(districtNameRu: string, city?: string): Promise<DistrictYieldConfig> {
    const settings = await this.getSettings();
    const map = settings.districtYieldConfigs || DEFAULT_DISTRICT_YIELD_CONFIGS;
    const trimmed = (districtNameRu || '').trim();
    if (city && map[`${city}:${trimmed}`]) return map[`${city}:${trimmed}`];
    if (map[trimmed]) return map[trimmed];

    const matchedKey = Object.keys(map).find(
      (k) =>
        k.toLowerCase() === trimmed.toLowerCase() ||
        (city && k.toLowerCase() === `${city}:${trimmed}`.toLowerCase()) ||
        trimmed.toLowerCase().includes(k.toLowerCase())
    );
    if (matchedKey) return map[matchedKey];

    return {
      districtNameRu: trimmed || 'Приморский район',
      city: (city as any) || 'spb',
      dailyRentPercentOfMarket: 0.05,
      monthlyRentPercentOfMarket: 0.65,
      annualGrowthPercent: 11.0,
      updatedAt: new Date().toISOString(),
    };
  }

  static async saveDistrictYieldConfig(
    config: DistrictYieldConfig,
    operatorName = 'Виктор Сергеевич (Владелец)'
  ): Promise<DistrictYieldConfig> {
    const current = await this.getSettings();
    const updatedConfig: DistrictYieldConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: operatorName,
    };
    const key = config.districtNameRu.trim();
    const nextMap: Record<string, DistrictYieldConfig> = {
      ...DEFAULT_DISTRICT_YIELD_CONFIGS,
      ...(current.districtYieldConfigs || {}),
      [key]: updatedConfig,
    };
    if (config.city) {
      nextMap[`${config.city}:${key}`] = updatedConfig;
    }

    await this.saveSettings({
      districtYieldConfigs: nextMap,
      updatedBy: operatorName,
    });

    return updatedConfig;
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
    await DatabaseGateway.save<MarketSettings>(COLLECTION, updated);

    await AuditLogsRepository.addLog({
      operatorName: updated.updatedBy || 'Виктор Сергеевич (Владелец)',
      operatorRole: 'owner',
      actionType: 'market_settings_updated',
      title: `Обновлены макроэкономические параметры (Ключевая ставка: ${updated.cbrKeyRatePercent}%, Семейная: ${updated.familyMortgageRatePercent}%)`,
      description: `Штраф застройщика: ${updated.developerPenaltyPercent}%, Комиссия покупателя: ${updated.buyerCommissionPercent}%.`,
    });

    try {
      window.dispatchEvent(new CustomEvent('domexit:market_settings_updated', { detail: updated }));
    } catch {
      // Non-browser environment fallback
    }

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
    } catch {
      // Fallback to seed
    }
    return initialMarketSettings as MarketSettings;
  }
}
