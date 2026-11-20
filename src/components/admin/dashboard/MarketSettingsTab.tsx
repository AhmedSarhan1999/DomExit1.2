import React, { useState } from 'react';
import { Sliders, Save, Loader2 } from 'lucide-react';
import { DistrictYieldConfig, MarketSettings, RussianCityCode } from '../../../types';
import { MarketSettingsRepository } from '../../../dal/repositories/MarketSettingsRepository';
import { AuditLogsRepository } from '../../../dal/repositories/AuditLogsRepository';
import { RUSSIAN_REGIONS, getDistrictsForRegion } from '../../../data/russianGeography';

export interface MarketSettingsTabProps {
  marketSettings: MarketSettings;
  operatorName: string;
  loadAllData: () => Promise<void>;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const MarketSettingsTab: React.FC<MarketSettingsTabProps> = ({
  marketSettings: initialMarketSettings,
  operatorName,
  loadAllData,
  showToast,
  showError,
}) => {
  const [formSettings, setFormSettings] = useState<MarketSettings>(initialMarketSettings);
  const [isSavingMarket, setIsSavingMarket] = useState<boolean>(false);

  // District Yield & Capital Growth Engine State
  const [selectedYieldCity, setSelectedYieldCity] = useState<RussianCityCode>('spb');
  const [selectedYieldDistrict, setSelectedYieldDistrict] = useState<string>('Приморский район');
  const [districtDailyRentPct, setDistrictDailyRentPct] = useState<number>(0.038);
  const [districtMonthlyRentPct, setDistrictMonthlyRentPct] = useState<number>(0.42);
  const [districtAnnualGrowthPct, setDistrictAnnualGrowthPct] = useState<number>(11.5);
  const [isSavingDistrictYield, setIsSavingDistrictYield] = useState<boolean>(false);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMarket(true);
    try {
      await MarketSettingsRepository.saveSettings({
        cbrKeyRatePercent: Number(formSettings.cbrKeyRatePercent),
        familyMortgageRatePercent: Number(formSettings.familyMortgageRatePercent),
        developerPenaltyPercent: Number(formSettings.developerPenaltyPercent),
        buyerCommissionPercent: Number(formSettings.buyerCommissionPercent),
      });

      await AuditLogsRepository.addLog({
        operatorName,
        operatorRole: 'owner',
        actionType: 'market_settings_updated',
        title: 'Обновлены базовые ставки рынка недвижимости РФ',
        description: `Ключевая ставка ЦБ: ${formSettings.cbrKeyRatePercent}%, Семейная ипотека: ${formSettings.familyMortgageRatePercent}%, Неустойка: ${formSettings.developerPenaltyPercent}%, Комиссия DomExit: ${formSettings.buyerCommissionPercent}%.`,
      });

      showToast('Рыночные ставки и формулы платформы успешно обновлены!');
      await loadAllData();
    } catch (err) {
      console.error('Failed to save market settings:', err);
      showError('Ошибка при сохранении рыночных ставок.');
    } finally {
      setIsSavingMarket(false);
    }
  };

  const handleUpdateDistrictYield = async () => {
    setIsSavingDistrictYield(true);
    try {
      const savedCfg: DistrictYieldConfig = await MarketSettingsRepository.saveDistrictYieldConfig(
        {
          districtNameRu: selectedYieldDistrict,
          city: selectedYieldCity,
          dailyRentPercentOfMarket: districtDailyRentPct,
          monthlyRentPercentOfMarket: districtMonthlyRentPct,
          annualGrowthPercent: districtAnnualGrowthPct,
          updatedAt: new Date().toISOString(),
        },
        operatorName || 'Ahmed Abdallah (CEO)'
      );
      showToast(
        `Коэффициенты доходности для локации «${savedCfg.districtNameRu}» (${(savedCfg.city || selectedYieldCity).toUpperCase()}) обновлены!`
      );
    } catch (err) {
      console.error('Failed to update district yield:', err);
      showError('Ошибка при обновлении параметров доходности района.');
    } finally {
      setIsSavingDistrictYield(false);
    }
  };

  const handleCitySelectChange = (cityCode: RussianCityCode) => {
    setSelectedYieldCity(cityCode);
    const districts = getDistrictsForRegion(cityCode);
    if (districts.length > 0) {
      setSelectedYieldDistrict(districts[0].nameRu);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Benchmark Interest Rates */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Базовые макроэкономические ставки РФ и комиссия платформы
            </h3>
            <p className="text-xs text-slate-500">
              Глобальные финансовые параметры, используемые в математических моделях дисконтирования ДДУ, неустойках по 214-ФЗ и расчете чистой доходности.
            </p>
          </div>
        </div>

        <form onSubmit={handleSettingsSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Ключевая ставка ЦБ РФ (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formSettings.cbrKeyRatePercent}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, cbrKeyRatePercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-black text-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[10px] text-slate-400 block">
                База для дисконтирования и неустоек
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Семейная ипотека (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={formSettings.familyMortgageRatePercent}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    familyMortgageRatePercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-black text-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Субсидируемый бенчмарк для покупателя
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Неустойка застройщика (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formSettings.developerPenaltyPercent}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    developerPenaltyPercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-black text-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Формула 1/150 ключевой ставки
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Комиссия DomExit (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={formSettings.buyerCommissionPercent}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    buyerCommissionPercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-black text-lg text-emerald-700 font-mono focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Фиксированная выручка с покупателя
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingMarket}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isSavingMarket ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingMarket ? 'Сохранение...' : 'Сохранить базовые ставки'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. District Yield & Capital Growth Engine (Two-Tier Location Selector) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-black">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Калькулятор доходности районов и динамики цен (Двухуровневый селектор)
            </h3>
            <p className="text-xs text-slate-500">
              Тонкая настройка коэффициентов посуточной, долгосрочной аренды и прогноза прироста стоимости для каждого административного района.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Шаг 1: Выберите субъект / агломерацию РФ
              </label>
              <select
                value={selectedYieldCity}
                onChange={(e) => handleCitySelectChange(e.target.value as RussianCityCode)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:border-sky-600 cursor-pointer"
              >
                {RUSSIAN_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.labelRu}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Шаг 2: Выберите административный район / локацию
              </label>
              <select
                value={selectedYieldDistrict}
                onChange={(e) => setSelectedYieldDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-900 focus:outline-none focus:border-sky-600 cursor-pointer"
              >
                {getDistrictsForRegion(selectedYieldCity).map((dist) => (
                  <option key={dist.nameRu} value={dist.nameRu}>
                    {dist.nameRu}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Коэффициент посуточной аренды (%/день)
              </label>
              <input
                type="number"
                step="0.005"
                min="0"
                max="1"
                value={districtDailyRentPct}
                onChange={(e) => setDistrictDailyRentPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-bold text-base text-slate-900 font-mono focus:outline-none focus:border-sky-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Доля от рыночной стоимости за 1 сутки аренды
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Коэффициент помесячной аренды (%/мес)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="5"
                value={districtMonthlyRentPct}
                onChange={(e) => setDistrictMonthlyRentPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-bold text-base text-slate-900 font-mono focus:outline-none focus:border-sky-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Ставка долгосрочной аренды (% от стоимости квартиры)
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Прогноз прироста цены (%/год)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={districtAnnualGrowthPct}
                onChange={(e) => setDistrictAnnualGrowthPct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-bold text-base text-emerald-700 font-mono focus:outline-none focus:border-emerald-600"
              />
              <span className="text-[10px] text-slate-400 block">
                Ежегодный рост капитализации в данном районе
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={isSavingDistrictYield}
              onClick={handleUpdateDistrictYield}
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs transition-all shadow-xs flex items-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              {isSavingDistrictYield ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingDistrictYield ? 'Сохранение...' : 'Применить к выбранному району'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
