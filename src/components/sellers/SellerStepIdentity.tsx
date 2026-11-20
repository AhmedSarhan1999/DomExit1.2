import React from 'react';
import { AlertCircle, Check, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  sanitizeDigitsOnly,
  validateRussianInn,
} from '../../utils/validators';

export interface SellerStepIdentityProps {
  sellerName: string;
  onSellerNameChange: (name: string) => void;
  sellerPhone: string;
  onSellerPhoneChange: (phone: string) => void;
  sellerInn: string;
  onSellerInnChange: (inn: string) => void;
  partnerRefCode: string;
  onPartnerRefCodeChange: (code: string) => void;
  isPartnerLocked: boolean;
  step2Error: string | null;
  touched: Record<string, boolean>;
  markTouched: (field: string) => void;
  onBackToStep1: () => void;
  onGoToStep3: () => void;
}

export const SellerStepIdentity: React.FC<SellerStepIdentityProps> = ({
  sellerName,
  onSellerNameChange,
  sellerPhone,
  onSellerPhoneChange,
  sellerInn,
  onSellerInnChange,
  partnerRefCode,
  onPartnerRefCodeChange,
  isPartnerLocked,
  step2Error,
  touched,
  markTouched,
  onBackToStep1,
  onGoToStep3,
}) => {
  const { language } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-slate-900">
          {language === 'ru'
            ? 'Идентификация правообладателя ДДУ'
            : 'DDU Holder Verification'}
        </h3>
        <p className="text-xs text-slate-500">
          Данные используются строго для автоматической сверки по базам ФССП и ЕФРСБ и подготовки согласия застройщика.
        </p>
      </div>

      {step2Error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-bold flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{step2Error}</span>
        </div>
      )}

      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ФИО правообладателя по договору ДДУ *
          </label>
          <input
            type="text"
            value={sellerName}
            onChange={(e) => onSellerNameChange(e.target.value)}
            onBlur={() => markTouched('sellerName')}
            placeholder={language === 'ru' ? 'Например: Иванов Иван Иванович' : 'Full Name'}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Телефон РФ (+7 (XXX) XXX-XX-XX) *
            </label>
            <input
              type="tel"
              value={sellerPhone}
              onChange={(e) => onSellerPhoneChange(formatRussianPhoneInput(e.target.value))}
              onBlur={() => markTouched('sellerPhone')}
              placeholder="+7 (911) 409-44-12"
              className={`w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono font-bold focus:outline-none ${
                isValidRussianPhone(sellerPhone)
                  ? 'border-emerald-400'
                  : 'border-slate-300 focus:border-emerald-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ИНН налогоплательщика (12 или 10 цифр) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={sellerInn}
              onChange={(e) => onSellerInnChange(sanitizeDigitsOnly(e.target.value, 12))}
              onBlur={() => markTouched('sellerInn')}
              placeholder="Например: 781432994102"
              className={`w-full px-4 py-3 rounded-xl border bg-white text-sm font-mono font-bold placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:outline-none ${
                validateRussianInn(sellerInn).valid
                  ? 'border-emerald-400'
                  : 'border-slate-300 focus:border-emerald-500'
              }`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-slate-700">
              Реферальный код партнера / брокера (необязательно)
            </label>
            {isPartnerLocked && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Код зафиксирован по реферальной ссылке</span>
              </span>
            )}
          </div>
          <input
            type="text"
            value={partnerRefCode}
            readOnly={isPartnerLocked}
            onChange={(e) => {
              if (!isPartnerLocked) {
                onPartnerRefCodeChange(e.target.value.toUpperCase());
              }
            }}
            placeholder="Например: PARTNER-SPB-12"
            className={`w-full px-4 py-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none ${
              isPartnerLocked
                ? 'border-emerald-400 bg-emerald-50/50 text-emerald-950 cursor-not-allowed shadow-inner'
                : 'border-slate-300 bg-white text-slate-900 focus:border-emerald-500'
            }`}
          />
          {isPartnerLocked && (
            <p className="text-[11px] text-emerald-700 font-semibold mt-1.5 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                ✓ Партнерский код зафиксирован: <strong>{partnerRefCode}</strong> (Ваш брокер получит вознаграждение при закрытии сделки)
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={onBackToStep1}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
        >
          ← Назад к параметрам ДДУ
        </button>
        <button
          type="button"
          onClick={onGoToStep3}
          className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center space-x-2 shadow-xs cursor-pointer"
        >
          <span>Открыть хранилище документов</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
