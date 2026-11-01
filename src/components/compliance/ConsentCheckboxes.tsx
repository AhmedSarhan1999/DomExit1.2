import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export interface ConsentState {
  pdProcessing: boolean;
  termsAgreed: boolean;
  ads: boolean;
}

interface ConsentCheckboxesProps {
  value: ConsentState;
  onChange: (updated: ConsentState) => void;
  className?: string;
  disabled?: boolean;
}

export const ConsentCheckboxes: React.FC<ConsentCheckboxesProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs text-slate-700 ${className}`}
    >
      <div className="flex items-center space-x-2 text-slate-800 font-bold border-b border-slate-200 pb-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-slate-600">
          Правовое согласие и защита данных (152-ФЗ и 38-ФЗ)
        </span>
      </div>

      {/* Checkbox 1: Mandatory Personal Data Processing */}
      <label className="flex items-start space-x-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          required
          disabled={disabled}
          checked={value.pdProcessing}
          onChange={(e) => onChange({ ...value, pdProcessing: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer disabled:opacity-50"
        />
        <span className="leading-snug">
          <strong className="text-slate-900">Я даю согласие</strong> на обработку моих персональных
          данных в соответствии с{' '}
          <Link
            to="/consent-pd"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline font-semibold hover:text-emerald-800"
          >
            Согласием на обработку ПД
          </Link>{' '}
          и ознакомлен с{' '}
          <Link
            to="/privacy"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline font-semibold hover:text-emerald-800"
          >
            Политикой конфиденциальности
          </Link>
          <span className="text-rose-600 ml-0.5">*</span>
        </span>
      </label>

      {/* Checkbox 2: Mandatory Terms of Service Agreement */}
      <label className="flex items-start space-x-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          required
          disabled={disabled}
          checked={value.termsAgreed}
          onChange={(e) => onChange({ ...value, termsAgreed: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer disabled:opacity-50"
        />
        <span className="leading-snug">
          <strong className="text-slate-900">Я принимаю</strong> условия{' '}
          <Link
            to="/terms"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline font-semibold hover:text-emerald-800"
          >
            Пользовательского соглашения платформы
          </Link>{' '}
          и регламент расчетов через эскроу/СБР
          <span className="text-rose-600 ml-0.5">*</span>
        </span>
      </label>

      {/* Checkbox 3: Strictly Optional Marketing & Ads under 38-FZ */}
      <label className="flex items-start space-x-2.5 cursor-pointer select-none pt-1 border-t border-slate-100">
        <input
          type="checkbox"
          disabled={disabled}
          checked={value.ads}
          onChange={(e) => onChange({ ...value, ads: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer disabled:opacity-50"
        />
        <span className="text-slate-600 leading-snug">
          Я согласен получать информационные и рекламные уведомления о новых дисконтных объектах,
          ставках банков и статусе сделок в соответствии со ст. 18 ФЗ-38 «О рекламе» (
          <Link
            to="/consent-ads"
            target="_blank"
            rel="noreferrer"
            className="text-slate-700 underline hover:text-emerald-700"
          >
            Согласие на рассылку
          </Link>
          , опционально)
        </span>
      </label>
    </div>
  );
};
