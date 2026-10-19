import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Bell, Download, Plus, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onNewRequest?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle, onNewRequest }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <span>{title}</span>
        </h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-3">
        {/* Banking API indicator */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Сбер / ВТБ Эскроу API: Онлайн</span>
        </div>

        {/* Dual RU/EN language switcher in admin */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setLanguage('ru')}
            className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
              language === 'ru' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            RU
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
              language === 'en' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>

        {/* Notification Bell */}
        <button
          type="button"
          title="Уведомления"
          className="relative p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
        </button>

        {/* Export Report CTA */}
        <button
          type="button"
          onClick={() => alert(language === 'ru' ? 'Экспорт реестра сделок сформирован (XLSX/PDF)' : 'Registry exported (XLSX/PDF)')}
          className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Экспорт отчета' : 'Export Report'}</span>
        </button>

        {/* New Request Action */}
        <Link
          to="/sellers"
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>{language === 'ru' ? '+ Новая заявка ДДУ' : '+ New DDU Exit'}</span>
        </Link>
      </div>
    </div>
  );
};
