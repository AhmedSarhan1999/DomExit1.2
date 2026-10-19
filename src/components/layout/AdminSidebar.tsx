import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  GitPullRequest,
  FileText,
  PackageCheck,
  Scale,
  Users,
  Building2,
  Bot,
  Search,
  CheckCircle,
  ExternalLink,
  Shield,
  Layers,
  Menu,
  X,
  Crown,
  Briefcase,
  ArrowRightLeft
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const { user, switchRole } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isOwner = user?.activeRole === 'owner' || (!user?.activeRole && true);
  const isEmployee = user?.activeRole === 'employee';

  const allNavItems = [
    {
      path: '/admin/dashboard',
      label: isOwner 
        ? (language === 'ru' ? 'Дашборд Владельца' : 'Owner Dashboard')
        : (language === 'ru' ? 'Мои назначенные объекты' : 'My Assigned Lots'),
      icon: LayoutDashboard,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/pipeline',
      label: isOwner 
        ? (language === 'ru' ? 'Воронка всех сделок' : 'Platform Pipeline')
        : (language === 'ru' ? 'Моя воронка сделок' : 'My Deal Pipeline'),
      icon: GitPullRequest,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/matchmaker/U-10566',
      label: isOwner
        ? (language === 'ru' ? 'ИИ-Матчмейкер (Все лоты)' : 'All Lots Matchmaker')
        : (language === 'ru' ? 'Матчмейкер (Заявки на мои лоты)' : 'My Lots Buyer Offers'),
      icon: Users,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/packaging/U-10566',
      label: language === 'ru' ? 'Каталог и упаковка 152-ФЗ' : 'Packaging Studio 152-FZ',
      icon: PackageCheck,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/legal-audit/U-10566',
      label: language === 'ru' ? 'Юридический аудит (42 пункта)' : 'Legal Audit (42 Checks)',
      icon: Scale,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/closing/DEAL-2025-10566',
      label: language === 'ru' ? 'Сделки в банках (Эскроу)' : 'Bank Escrow Closing',
      icon: Building2,
      roles: ['owner', 'employee'],
    },
    {
      path: '/admin/partners-bot',
      label: language === 'ru' ? 'Управление Партнерами и TG-бот' : 'Partners & TG Bot Desk',
      icon: Bot,
      roles: ['owner'], // STRICTLY HIDDEN FROM EMPLOYEE AS DIRECTED
    },
  ];

  // Filter items according to active role
  const visibleNavItems = allNavItems.filter((item) => {
    if (isEmployee) return item.roles.includes('employee');
    return true;
  });

  const isActive = (path: string) => location.pathname === path;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-700">
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200">
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-xl font-black text-slate-900 tracking-tight">DomExit</span>
          <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
            {isOwner ? 'OWNER / CEO' : 'STAFF / CURATOR'}
          </span>
        </Link>
        <Link to="/" title="Открыть сайт" className="text-slate-400 hover:text-slate-700">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </div>

      {/* Role Indicator & Mode Switcher */}
      <div className="p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isOwner ? (
              <Crown className="w-4 h-4 text-indigo-600 shrink-0" />
            ) : (
              <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div className="text-[11px] font-bold truncate">
              {isOwner ? '👑 Владелец платформы' : '👔 Куратор (Сотрудник)'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => switchRole(isOwner ? 'employee' : 'owner')}
            title="Переключить режим для тестирования"
            className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {isOwner 
            ? 'Полный доступ: выручка 2.5%, новые заявки, назначение сотрудников' 
            : 'Только назначенные объекты и прямые заявки покупателей'}
        </p>
      </div>

      {/* Quick Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={language === 'ru' ? 'Поиск лота или ФИО...' : 'Search lot or name...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileDrawerOpen(false)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                active
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="pt-4 pb-2 px-3">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            {language === 'ru' ? 'Клиентский доступ' : 'Client Access'}
          </span>
        </div>

        <Link
          to="/portal"
          onClick={() => setMobileDrawerOpen(false)}
          className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-slate-50 transition-colors"
        >
          <Layers className="w-4 h-4 text-sky-600" />
          <span>{language === 'ru' ? 'Личный кабинет клиента' : 'Client Portal'}</span>
        </Link>
      </nav>

      {/* Bottom Compliance & Officer Indicator */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-600 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ЕИСЖС (Наш.дом.рф)</span>
          </span>
          <span className="text-emerald-700 font-bold">Активна</span>
        </div>

        <div className="flex items-center space-x-2.5 pt-2 border-t border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {isOwner ? 'ВC' : 'АМ'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">
              {isOwner ? 'Виктор Сергеевич' : 'Алексей Морозов'}
            </span>
            <span className="text-[10px] text-emerald-700 truncate">
              {isOwner ? 'Генеральный директор' : 'Куратор отдела выходов'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (Hidden on mobile < md) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 text-slate-700 flex-col shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* 2. Mobile Floating Trigger Button (< md) */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-md hover:bg-slate-50 flex items-center space-x-1.5 cursor-pointer"
          aria-label="Open Admin Menu"
        >
          <Menu className="w-5 h-5 text-emerald-600" />
          <span className="text-xs font-bold">Меню CRM</span>
        </button>
      </div>

      {/* 3. Mobile Slide-out Drawer with Backdrop */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl z-10 flex flex-col">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 z-20 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

