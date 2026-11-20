import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, User, Settings, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfileModal } from '../profile/UserProfileModal';
import { apiClient } from '../../services/apiClient';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  };

  const [ydbStatus, setYdbStatus] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [isCheckingYdb, setIsCheckingYdb] = useState(false);

  const checkYdb = async () => {
    setIsCheckingYdb(true);
    const start = performance.now();
    try {
      const res = await apiClient.get<{ ok: boolean; env: string; region: string }>('/api/health');
      const latencyMs = Math.round(performance.now() - start);
      setYdbStatus({
        ok: res.ok,
        message: `Yandex Cloud (${res.region || 'ru-central1'}) [${res.env || 'live'}]`,
        latencyMs,
      });
    } catch (err: any) {
      setYdbStatus({
        ok: false,
        message: 'Сбой соединения с сервером',
        error: err?.message,
      });
    } finally {
      setIsCheckingYdb(false);
    }
  };

  useEffect(() => {
    checkYdb();
  }, []);

  return (
    <>
      <div className="bg-white border-b border-slate-200 px-6 py-4 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>{title}</span>
            </h1>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center space-x-3">
            {/* Clean Platform Service Status Indicator */}
            <button
              type="button"
              onClick={checkYdb}
              disabled={isCheckingYdb}
              title="Нажмите для проверки статуса сервисов"
              className={`hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer shadow-2xs ${
                ydbStatus?.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20'
                  : ydbStatus === null
                  ? 'bg-slate-100 border-slate-200 text-slate-600'
                  : 'bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  ydbStatus?.ok
                    ? 'bg-emerald-500'
                    : ydbStatus === null
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-600'
                }`}
              />
              <span>
                {isCheckingYdb
                  ? 'Синхронизация сервисов...'
                  : ydbStatus?.ok
                  ? 'Сервисы платформы активны'
                  : ydbStatus
                  ? 'Сбой подключения к данным'
                  : 'Инициализация...'}
              </span>
            </button>

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

            {/* Notification Bell -> Archive Logs */}
            <Link
              to="/admin/archive-logs"
              title={language === 'ru' ? 'Журнал решений и уведомлений' : 'Audit Logs & Alerts'}
              className="relative p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full" />
            </Link>

            {/* Personal Profile & Security Modal Button */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Настройки профиля и безопасность"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">{user?.name ? user.name.split(' ')[0] : 'Профиль'}</span>
              <Settings className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Prominent LogOut Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Выйти из учетной записи"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </div>

      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
