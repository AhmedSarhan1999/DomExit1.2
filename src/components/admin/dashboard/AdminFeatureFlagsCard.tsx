import React from 'react';
import { Sliders, Sparkles, Landmark } from 'lucide-react';
import { useFeatureFlagsStore } from '../../../stores/useFeatureFlagsStore';

export interface AdminFeatureFlagsCardProps {
  showToast: (msg: string) => void;
}

export const AdminFeatureFlagsCard: React.FC<AdminFeatureFlagsCardProps> = ({ showToast }) => {
  const { enableVipClub, enableBankPortal, toggleFlag } = useFeatureFlagsStore();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Управление модулями платформы (Feature Flags)
            </h3>
            <p className="text-[11px] text-slate-500">
              Динамическое включение и отключение сервисных модулей без перезагрузки системы
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Phase 1 MVP
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flag 1: VIP Club */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            enableVipClub ? 'bg-amber-50/40 border-amber-300' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-900">
                  Модуль раннего доступа (VIP-клуб 48ч и подписки)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {enableVipClub
                  ? 'Включено: закрытый каталог /vip-catalog и платные подписки активны.'
                  : 'Выключено (Запуск после подключения ЮKassa): все объекты публикуются в открытом каталоге.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                toggleFlag('enableVipClub');
                showToast(
                  !enableVipClub
                    ? 'VIP-клуб 48ч и витрина раннего доступа активированы'
                    : 'VIP-клуб отключен. Каталог открыт для всех покупателей напрямую.'
                );
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableVipClub ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enableVipClub ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Flag 2: Bank Portal */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            enableBankPortal ? 'bg-sky-50/40 border-sky-300' : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Landmark className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold text-slate-900">
                  Модуль банковского шлюза (Кабинет банков-партнеров)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {enableBankPortal
                  ? 'Включено: прямой кабинет банков /bank-portal и учет офицеров СБР активны.'
                  : 'Выключено (Работа через аккредитивы и кураторов): сделки закрываются куратором на месте.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                toggleFlag('enableBankPortal');
                showToast(
                  !enableBankPortal
                    ? 'Банковский шлюз /bank-portal активирован'
                    : 'Банковский шлюз отключен. Работа ведется куратором через отделения банков.'
                );
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableBankPortal ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enableBankPortal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
