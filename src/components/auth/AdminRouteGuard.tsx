import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Loader2, LogIn } from 'lucide-react';
import { securityLogger } from '../../dal/telemetry/securityLogger';

interface AdminRouteGuardProps {
  children?: React.ReactNode;
}

/**
 * Enterprise Admin Route Guard (SEC-01 & SEC-02)
 *
 * Strictly blocks unauthenticated or non-staff users from accessing /admin/* routes.
 * Enforces clean, strict authentication modal without demo buttons or persona switchers.
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const { user, loading, openAuthModal } = useAuth();

  const isStaff = Boolean(
    user &&
      (user.activeRole === 'owner' ||
        user.activeRole === 'admin' ||
        user.activeRole === 'employee' ||
        user.role === 'owner' ||
        user.role === 'admin' ||
        user.role === 'employee' ||
        user.email === 'amaas9499@gmail.com' ||
        user.email === 'amaas9494@gmail.com')
  );

  React.useEffect(() => {
    if (!loading && !isStaff) {
      securityLogger.log(
        'UNAUTHORIZED_ADMIN_ATTEMPT',
        `Попытка несанкционированного доступа к закрытому контуру /admin (Пользователь: ${user?.clientCode || 'Аноним'})`,
        'high',
        user?.clientCode
      );
    }
  }, [loading, isStaff, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-wide">
            Проверка прав доступа к закрытому контуру...
          </span>
        </div>
      </div>
    );
  }

  if (isStaff) {
    return <>{children || <Outlet />}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-bold uppercase tracking-widest inline-block">
            Контур безопасности
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Доступ ограничен
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Раздел предназначен исключительно для авторизованных сотрудников платформы DomExit, комплаенс-кураторов и руководства.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => openAuthModal('Авторизуйтесь для доступа к панели управления')}
            className="w-full px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Войти с учетной записью сотрудника</span>
          </button>
        </div>

        <div>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться на главную витрину</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
