import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, User, Crown, Briefcase, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const { language, setLanguage } = useLanguage();
  const { user, switchRole } = useAuth();

  const isOwner = user?.activeRole === 'owner';

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-4 space-y-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

          {/* Quick Role Switcher */}
          <button
            type="button"
            onClick={() => switchRole(isOwner ? 'employee' : 'owner')}
            className={`hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              isOwner
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
            title="Быстрое переключение роли (Owner / Curator)"
          >
            {isOwner ? <Crown className="w-3.5 h-3.5 text-indigo-600" /> : <Briefcase className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isOwner ? 'Режим: Владелец' : 'Режим: Куратор'}</span>
          </button>

          {/* Notification Bell -> Archive Logs */}
          <Link
            to="/admin/archive-logs"
            title={language === 'ru' ? 'Журнал решений и уведомлений' : 'Audit Logs & Alerts'}
            className="relative p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
          </Link>

          {/* Personal Account / Portal Button */}
          <Link
            to="/portal"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Перейти в личный кабинет"
          >
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">{user?.name ? user.name.split(' ')[0] : 'Кабинет'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
