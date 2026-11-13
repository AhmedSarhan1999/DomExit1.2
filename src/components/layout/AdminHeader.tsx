import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Bell, User, Crown, Briefcase, Settings, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserProfileModal } from '../profile/UserProfileModal';
import { YandexCloudAdapter } from '../../dal/adapters/YandexCloudAdapter';
import { useEnvironmentStore } from '../../stores/useEnvironmentStore';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, subtitle }) => {
  const { language, setLanguage } = useLanguage();
  const { user, switchRole } = useAuth();
  const { isProduction } = useEnvironmentStore();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [ydbStatus, setYdbStatus] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);
  const [isCheckingYdb, setIsCheckingYdb] = useState(false);

  const checkYdb = async () => {
    setIsCheckingYdb(true);
    try {
      const res = await YandexCloudAdapter.testConnection();
      setYdbStatus(res);
    } catch (err: any) {
      setYdbStatus({
        ok: false,
        message: 'Сбой соединения',
        error: err?.message,
      });
    } finally {
      setIsCheckingYdb(false);
    }
  };

  useEffect(() => {
    checkYdb();
  }, []);

  const isOwner = user?.activeRole === 'owner';

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
            {/* Live Yandex Cloud YDB & S3 Diagnostic Badge */}
            <button
              type="button"
              onClick={checkYdb}
              disabled={isCheckingYdb}
              title="Нажмите для активного тестирования Yandex Cloud YDB Document API & S3"
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
                    ? 'bg-emerald-500 animate-pulse'
                    : ydbStatus === null
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-600'
                }`}
              />
              <span>
                {isCheckingYdb
                  ? 'Проверка YDB & S3...'
                  : ydbStatus?.ok
                  ? `● Yandex YDB & S3: Подключено (Live • ${isProduction ? 'Production' : 'Sandbox'})${
                      ydbStatus.latencyMs ? ` [${ydbStatus.latencyMs}мс]` : ''
                    }`
                  : ydbStatus
                  ? `● Yandex YDB & S3: Ошибка (${ydbStatus.error || ydbStatus.message})`
                  : 'Подключение к YDB...'}
              </span>
            </button>

            {/* Banking API indicator */}
            <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Сбер / ВТБ Эскроу: Онлайн</span>
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
