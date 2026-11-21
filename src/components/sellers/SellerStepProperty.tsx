import React from 'react';
import {
  Lock,
  AlertCircle,
  MapPin,
  Compass,
  Train,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  RUSSIAN_REGIONS,
  getDistrictsForRegion,
  getRegionByCode,
} from '../../data/russianGeography';
import { formatDeveloperOption, normalizeDeveloperName } from '../../dal/repositories/DevelopersRepository';
import { sanitizeDigitsOnly } from '../../utils/validators';
import { formatRubles } from '../../utils/formatters';
import { AddressAutocompleteInput } from '../maps/AddressAutocompleteInput';
import { RUSSIAN_BANKS } from '../../data/russianBanks';
import { AccreditedDeveloper, Lot, RussianCityCode, UserProfile } from '../../types';

export interface SellerStepPropertyProps {
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  step1Error: string | null;
  locationRegion: RussianCityCode;
  onRegionChange: (region: RussianCityCode) => void;
  district: string;
  onDistrictChange: (district: string) => void;
  streetAddress: string;
  onStreetAddressChange: (address: string) => void;
  onSelectAddressDetails: (details: {
    address: string;
    coordinates?: { lat: number; lng: number };
    nearestMetro?: { name: string; lineColor?: string; travelTimeText: string; mode?: 'walk' | 'drive' };
    district?: string;
  }) => void;
  metroName: string;
  onMetroNameChange: (metro: string) => void;
  metroTime: string;
  onMetroTimeChange: (time: string) => void;
  metroTransport: 'walk' | 'transport';
  onMetroTransportChange: (transport: 'walk' | 'transport') => void;
  developerName: string;
  onDeveloperNameChange: (dev: string) => void;
  developerInn: string;
  onDeveloperInnChange: (inn: string) => void;
  isAddingNewDeveloper: boolean;
  onToggleAddingNewDeveloper: () => void;
  accreditedDevelopers: AccreditedDeveloper[];
  complexName: string;
  onComplexNameChange: (complex: string) => void;
  dduCode: string;
  onDduCodeChange: (ddu: string) => void;
  rooms: Lot['rooms'];
  onRoomsChange: (rooms: Lot['rooms']) => void;
  areaM2: string;
  onAreaM2Change: (area: string) => void;
  floor: string;
  onFloorChange: (floor: string) => void;
  totalFloors: string;
  onTotalFloorsChange: (total: string) => void;
  contractPriceStr: string;
  onContractPriceStrChange: (price: string) => void;
  paidAmountStr: string;
  onPaidAmountStrChange: (paid: string) => void;
  todayMarketPriceStr: string;
  onTodayMarketPriceStrChange: (today: string) => void;
  contractPrice: number;
  paidAmount: number;
  financialValidation: {
    valid: boolean;
    paidErrorRu?: string;
    paidErrorEn?: string;
    contractErrorRu?: string;
    contractErrorEn?: string;
  };
  exitRoute: 'ddu_assignment' | 'fast_cash' | 'trade_in_6';
  onExitRouteChange: (route: 'ddu_assignment' | 'fast_cash' | 'trade_in_6') => void;
  usedMatkap: 'no' | 'yes';
  onUsedMatkapChange: (val: 'no' | 'yes') => void;
  isNegotiable: boolean;
  onIsNegotiableChange: (val: boolean) => void;
  sellerBanks: string[];
  onSellerBanksChange: (banks: string[]) => void;
  agreeTerms: boolean;
  onAgreeTermsChange: (agree: boolean) => void;
  touched: Record<string, boolean>;
  markTouched: (field: string) => void;
  onGoToStep2: () => void;
}

export const SellerStepProperty: React.FC<SellerStepPropertyProps> = ({
  user,
  onOpenAuthModal,
  step1Error,
  locationRegion,
  onRegionChange,
  district,
  onDistrictChange,
  streetAddress,
  onStreetAddressChange,
  onSelectAddressDetails,
  metroName,
  onMetroNameChange,
  metroTime,
  onMetroTimeChange,
  metroTransport,
  onMetroTransportChange,
  developerName,
  onDeveloperNameChange,
  developerInn,
  onDeveloperInnChange,
  isAddingNewDeveloper,
  onToggleAddingNewDeveloper,
  accreditedDevelopers,
  complexName,
  onComplexNameChange,
  dduCode,
  onDduCodeChange,
  rooms,
  onRoomsChange,
  areaM2,
  onAreaM2Change,
  floor,
  onFloorChange,
  totalFloors,
  onTotalFloorsChange,
  contractPriceStr,
  onContractPriceStrChange,
  paidAmountStr,
  onPaidAmountStrChange,
  todayMarketPriceStr,
  onTodayMarketPriceStrChange,
  contractPrice,
  paidAmount,
  financialValidation,
  exitRoute,
  onExitRouteChange,
  usedMatkap,
  onUsedMatkapChange,
  isNegotiable,
  onIsNegotiableChange,
  sellerBanks,
  onSellerBanksChange,
  agreeTerms,
  onAgreeTermsChange,
  touched,
  markTouched,
  onGoToStep2,
}) => {
  const { language } = useLanguage();
  const regionDistricts = getDistrictsForRegion(locationRegion);
  const activeRegionConfig = getRegionByCode(locationRegion);

  return (
    <div className="min-w-0 space-y-5">
      {!user && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <Lock className="w-5 h-5 text-sky-600 shrink-0" />
            <div>
              <span className="font-bold text-sky-950 block">Вы оформляете заявку в гостевом режиме</span>
              <span className="text-sky-800 text-[11px]">Войдите в личный кабинет, чтобы сохранить черновик и отслеживать статус выхода</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('domexit_return_url', '/app/seller');
              }
              onOpenAuthModal();
            }}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold shrink-0 transition-colors cursor-pointer text-center"
          >
            Войти / Регистрация
          </button>
        </div>
      )}

      {step1Error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{step1Error}</span>
        </div>
      )}

      {/* Hierarchical Russian Region, District, Address & Metro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Город / Субъект РФ *' : 'Region / City *'}</span>
          </label>
          <select
            value={locationRegion}
            onChange={(e) => onRegionChange(e.target.value as RussianCityCode)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            {RUSSIAN_REGIONS.map((reg) => (
              <option key={reg.code} value={reg.code}>
                {language === 'ru' ? reg.labelRu : reg.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            {language === 'ru' ? 'Район / Локация *' : 'District *'}
          </label>
          <select
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
          >
            {regionDistricts.map((dist) => (
              <option key={dist.nameRu} value={dist.nameRu}>
                {language === 'ru' ? dist.nameRu : dist.nameEn}
              </option>
            ))}
          </select>
        </div>

        {/* Complete Location Address Input with Yandex Suggest & Geocoder */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center space-x-1">
            <Compass className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ru' ? 'Адрес объекта: улица, дом / корпус' : 'Property Address: Street, House / Building'}</span>
          </label>
          <AddressAutocompleteInput
            value={streetAddress}
            onChange={onStreetAddressChange}
            onBlur={() => markTouched('streetAddress')}
            cityCode={locationRegion}
            placeholder="Например: Комендантский пр-т, д. 62, к. 1"
            onSelectAddress={onSelectAddressDetails}
          />
        </div>

        {/* Nearest Metro Station */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center space-x-1">
            <Train className="w-3.5 h-3.5 text-sky-600" />
            <span>{language === 'ru' ? 'Ближайшая станция метро' : 'Nearest Metro Station'}</span>
          </label>
          <input
            type="text"
            value={metroName}
            onChange={(e) => onMetroNameChange(e.target.value)}
            onBlur={() => markTouched('metroName')}
            placeholder="Например: Комендантский проспект"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Travel Time & Mode */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{language === 'ru' ? 'Время и способ до метро' : 'Time & Mode to Metro'}</span>
          </label>
          <div className="flex items-center space-x-2">
            <div className="relative w-1/2">
              <input
                type="text"
                inputMode="numeric"
                value={metroTime}
                onChange={(e) => onMetroTimeChange(sanitizeDigitsOnly(e.target.value, 2))}
                placeholder="10"
                className="w-full px-3 py-2.5 pr-8 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 text-center focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold">
                мин
              </span>
            </div>
            <div className="w-1/2 flex rounded-xl border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => onMetroTransportChange('walk')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  metroTransport === 'walk'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Пешком
              </button>
              <button
                type="button"
                onClick={() => onMetroTransportChange('transport')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  metroTransport === 'transport'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Транспорт
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Developer & Complex Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-800">
              {language === 'ru' ? 'Застройщик *' : 'Developer *'}
            </label>
            <button
              type="button"
              onClick={onToggleAddingNewDeveloper}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {isAddingNewDeveloper
                ? '← Выбрать из списка застройщиков'
                : '+ Добавить нового застройщика'}
            </button>
          </div>

          {!isAddingNewDeveloper ? (
            <>
              <select
                value={developerName}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    onToggleAddingNewDeveloper();
                  } else {
                    onDeveloperNameChange(e.target.value);
                    const matched = accreditedDevelopers.find((d) => d.name === e.target.value);
                    if (matched) onDeveloperInnChange(matched.inn);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
              >
                {accreditedDevelopers.length === 0 ? (
                  <option value="" disabled>
                    -- Нет аккредитованных застройщиков (0) --
                  </option>
                ) : (
                  accreditedDevelopers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {formatDeveloperOption(d)}
                    </option>
                  ))
                )}
                <option value="__ADD_NEW__" className="font-bold text-emerald-700 bg-emerald-50">
                  + Добавить нового застройщика
                </option>
              </select>
              {accreditedDevelopers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {activeRegionConfig.majorDevelopers
                    .filter((dev) => accreditedDevelopers.some((a) => a.name === dev))
                    .slice(0, 4)
                    .map((dev) => (
                      <button
                        key={dev}
                        type="button"
                        onClick={() => {
                          onDeveloperNameChange(dev);
                          const matched = accreditedDevelopers.find(
                            (d) => d.name === dev || normalizeDeveloperName(d.name) === normalizeDeveloperName(dev)
                          );
                          if (matched?.inn) onDeveloperInnChange(matched.inn);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          developerName === dev
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {dev}
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3 bg-amber-50/80 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>Добавление нового застройщика</span>
                </span>
                {accreditedDevelopers.length > 0 && (
                  <button
                    type="button"
                    onClick={onToggleAddingNewDeveloper}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    Выбрать из списка ({accreditedDevelopers.length})
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Наименование нового застройщика *
                </label>
                <input
                  type="text"
                  value={developerName}
                  onChange={(e) => onDeveloperNameChange(e.target.value)}
                  onBlur={() => markTouched('developerName')}
                  placeholder="Например: СК «Северный Горизонт»"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ИНН застройщика (10 цифр) *
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={developerInn}
                  onChange={(e) => onDeveloperInnChange(sanitizeDigitsOnly(e.target.value))}
                  onBlur={() => markTouched('developerInn')}
                  placeholder="Например: 7813654902"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-3 bg-white/90 border border-amber-300/80 rounded-xl text-[11px] text-amber-950 leading-relaxed font-medium">
                «Заявка на добавление застройщика отправлена администратору платформы. После проверки ИНН застройщик появится в общем списке».
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {language === 'ru' ? 'Название Жилого Комплекса *' : 'Residential Complex *'}
          </label>
          <input
            type="text"
            value={complexName}
            onChange={(e) => onComplexNameChange(e.target.value)}
            onBlur={() => markTouched('complexName')}
            placeholder="Например: ЖК «Чистое Небо»"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* DDU Number + Rooms + Area + Floors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {language === 'ru' ? 'Номер договора ДДУ *' : 'DDU Number *'}
          </label>
          <input
            type="text"
            value={dduCode}
            onChange={(e) => onDduCodeChange(e.target.value)}
            onBlur={() => markTouched('dduCode')}
            placeholder="Например: ДДУ-78/10566"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {language === 'ru' ? 'Комнатность' : 'Rooms'}
          </label>
          <select
            value={rooms}
            onChange={(e) => onRoomsChange(e.target.value as Lot['rooms'])}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
          >
            <option value="studio">Студия</option>
            <option value="1-room">1-комн.</option>
            <option value="euro">Евро-2 / Евро-3</option>
            <option value="2-room">2-комн.</option>
            <option value="3-room">3-комн.+</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {language === 'ru' ? 'Площадь (м²) *' : 'Area (m²) *'}
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={areaM2}
            onChange={(e) =>
              onAreaM2Change(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))
            }
            onBlur={() => markTouched('areaM2')}
            placeholder="Например: 42.5"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {language === 'ru' ? 'Этаж / Всего' : 'Floor / Total'}
          </label>
          <div className="flex items-center space-x-1">
            <input
              type="text"
              inputMode="numeric"
              value={floor}
              onChange={(e) => onFloorChange(sanitizeDigitsOnly(e.target.value, 3))}
              onBlur={() => markTouched('floor')}
              className="w-1/2 px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-center placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              placeholder="9"
            />
            <span className="text-slate-400 font-bold">/</span>
            <input
              type="text"
              inputMode="numeric"
              value={totalFloors}
              onChange={(e) => onTotalFloorsChange(sanitizeDigitsOnly(e.target.value, 3))}
              onBlur={() => markTouched('totalFloors')}
              className="w-1/2 px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-center placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              placeholder="24"
            />
          </div>
        </div>
      </div>

      {/* Strict Financial Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {language === 'ru'
              ? 'Полная цена договора ДДУ (₽) *'
              : 'Total DDU Contract Price (₽) *'}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={contractPriceStr}
            placeholder="Например: 10 500 000"
            onChange={(e) => onContractPriceStrChange(sanitizeDigitsOnly(e.target.value, 10))}
            onBlur={() => markTouched('contractPrice')}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none transition-colors ${
              touched.contractPrice && financialValidation.contractErrorRu
                ? 'border-rose-400 bg-rose-50/40 text-slate-900'
                : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
            }`}
          />
          <span className="text-[11px] text-slate-500 font-mono block mt-1">
            {contractPrice > 0 ? formatRubles(contractPrice) : '—'}
          </span>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-slate-800">
              {language === 'ru'
                ? 'Выплачено застройщику (₽) *'
                : 'Paid to Developer (₽) *'}
            </label>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              2 – 50 млн ₽
            </span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            value={paidAmountStr}
            placeholder="Например: 3 500 000"
            onChange={(e) => onPaidAmountStrChange(sanitizeDigitsOnly(e.target.value, 9))}
            onBlur={() => markTouched('paidAmount')}
            className={`w-full px-4 py-3 rounded-xl border text-sm font-mono font-bold placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none transition-colors ${
              touched.paidAmount && financialValidation.paidErrorRu
                ? 'border-rose-500 bg-rose-50/40 text-slate-900'
                : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
            }`}
          />
          <span className="text-[11px] text-emerald-700 font-mono font-bold block mt-1">
            {paidAmount > 0 ? (
              <>
                На руки 100%: {formatRubles(paidAmount)} • Остаток долга:{' '}
                {formatRubles(Math.max(0, contractPrice - paidAmount))}
              </>
            ) : (
              <span className="text-slate-400 font-normal">Сумма к получению на аккредитив</span>
            )}
          </span>
        </div>
      </div>

      {(touched.contractPrice || touched.paidAmount || step1Error) &&
        !financialValidation.valid &&
        (contractPrice > 0 || paidAmount > 0) && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-semibold">
            {language === 'ru'
              ? financialValidation.paidErrorRu || financialValidation.contractErrorRu
              : financialValidation.paidErrorEn || financialValidation.contractErrorEn}
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {language === 'ru'
              ? 'Текущая цена аналога у застройщика (₽)'
              : 'Current Developer Price (₽)'}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={todayMarketPriceStr}
            placeholder={
              contractPrice > 0
                ? `Например: ${Math.round(contractPrice * 1.24)}`
                : 'Например: 13 200 000'
            }
            onChange={(e) =>
              onTodayMarketPriceStrChange(sanitizeDigitsOnly(e.target.value, 10))
            }
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-semibold placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            {language === 'ru' ? 'Маршрут выхода из ДДУ' : 'Exit Route'}
          </label>
          <select
            value={exitRoute}
            onChange={(e) => onExitRouteChange(e.target.value as any)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
          >
            <option value="ddu_assignment">Классическая уступка прав (100% возврат)</option>
            <option value="fast_cash">Срочный выход за 5–7 дней (приоритетный пул)</option>
            <option value="trade_in_6">Обмен / Перевод на Семейную ипотеку 6%</option>
          </select>
        </div>
      </div>

      {/* Maternal Capital Check (Deal-Breaker) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span className="text-rose-600">*</span>
            <span>Использовался ли материнский капитал (Маткапитал) при оплате договора ДДУ?</span>
          </label>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
            Маткапитал
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onUsedMatkapChange('no')}
            className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              usedMatkap === 'no'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${usedMatkap === 'no' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>Нет, не использовался</span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-700">✓ Подходит для DomExit</span>
          </button>

          <button
            type="button"
            onClick={() => onUsedMatkapChange('yes')}
            className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
              usedMatkap === 'yes'
                ? 'bg-rose-50 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${usedMatkap === 'yes' ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Да, использовался</span>
            </span>
            <span className="text-[10px] font-semibold text-rose-700">Ограничение платформы</span>
          </button>
        </div>

        {usedMatkap === 'yes' && (
          <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-2 animate-fade-in">
            <div className="flex items-center space-x-2 font-bold text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Переуступка прав с материнским капиталом не осуществляется</span>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              Переуступка прав по ДДУ с использованием материнского капитала требует предварительного разрешения органов опеки и обязательного выделения долей детям. В целях защиты участников и соблюдения регламента сроков платформа DomExit не принимает такие объекты в работу.
            </p>
          </div>
        )}
      </div>

      {/* Commercial Conditions: Negotiation & Settlement Banks */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <label className="text-xs font-black text-slate-900 block mb-1">
            {language === 'ru' ? 'Возможен ли торг по цене уступки?' : 'Is price negotiation allowed?'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onIsNegotiableChange(false)}
              className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                !isNegotiable
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>Нет, цена фиксированная (без торга)</span>
              {!isNegotiable && <span className="text-emerald-700 text-xs">✓</span>}
            </button>

            <button
              type="button"
              onClick={() => onIsNegotiableChange(true)}
              className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                isNegotiable
                  ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>Да, возможен торг</span>
              {isNegotiable && <span className="text-amber-700 text-xs font-black">🤝</span>}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-black text-slate-900 block mb-1">
            {language === 'ru'
              ? 'Банки продавца для проведения аккредитивных расчетов'
              : 'Seller Banks for Letter of Credit Settlements'}
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Покупатель сможет выбрать один из этих банков при подаче предложения о покупке:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {RUSSIAN_BANKS.map((b) => {
              const isSelected = sellerBanks.includes(b.name);
              return (
                <label
                  key={b.id}
                  className={`flex items-center space-x-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSellerBanksChange([...sellerBanks, b.name]);
                      } else {
                        if (sellerBanks.length <= 1) return;
                        onSellerBanksChange(sellerBanks.filter((n) => n !== b.name));
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span className="truncate">{b.shortName || b.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-1">
        <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-700">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => onAgreeTermsChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
          />
          <span className="leading-snug">
            {language === 'ru'
              ? 'Согласен на реализацию лота по цене старого договора ДДУ без наценки (0 ₽ НДФЛ) с расчетом через банковский аккредитив.'
              : 'I agree to sell the lot at original DDU contract price with 0% markup via bank letter of credit.'}
          </span>
        </label>
      </div>

      <div className="pt-2">
        <button
          type="button"
          disabled={usedMatkap === 'yes'}
          onClick={onGoToStep2}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2 ${
            usedMatkap === 'yes'
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
          }`}
        >
          <span>
            {language === 'ru'
              ? 'Подтвердить расчет и перейти к данным дольщика'
              : 'Confirm Calculation & Proceed'}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
