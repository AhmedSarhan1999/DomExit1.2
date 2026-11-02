import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { EmployeesRepository } from '../../dal/repositories/EmployeesRepository';
import { Employee, SidebarTabId } from '../../types';
import {
  LayoutDashboard,
  GitPullRequest,
  FileText,
  PackageCheck,
  Scale,
  Users,
  Building2,
  Search,
  ExternalLink,
  Menu,
  X,
  Crown,
  Briefcase,
  ArrowRightLeft,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, switchRole } = useAuth();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  const isMasterOwner = user?.email?.toLowerCase().trim() === 'amaas9499@gmail.com';
  const isEmployee = user?.activeRole === 'employee';
  const isOwner = !isEmployee;

  useEffect(() => {
    let isMounted = true;
    async function loadEmployee() {
      if (user?.email) {
        const emp = await EmployeesRepository.getByEmail(user.email);
        if (isMounted) setCurrentEmployee(emp);
      } else if (user?.assignedEmployeeId) {
        const emp = await EmployeesRepository.getById(user.assignedEmployeeId);
        if (isMounted) setCurrentEmployee(emp);
      }
    }
    loadEmployee();
    return () => {
      isMounted = false;
    };
  }, [user?.email, user?.assignedEmployeeId]);

  // Allowed tabs for employee (defaults to standard operational tabs if not specified)
  const allowedTabs: SidebarTabId[] = currentEmployee?.allowedSidebarTabs || [
    'pipeline',
    'packaging',
    'legal_audit',
    'matchmaker',
    'profile',
  ];

  interface NavItem {
    path: string;
    matchPrefix: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tabId?: SidebarTabId | 'dashboard' | 'closing' | 'partners_bot';
    ownerOnly?: boolean;
    employeeOnly?: boolean;
  }

  const allNavItems: NavItem[] = [
    {
      path: '/admin/dashboard',
      matchPrefix: '/admin/dashboard',
      label: language === 'ru' ? 'Дашборд Владельца' : 'Owner Dashboard',
      icon: LayoutDashboard,
      tabId: 'dashboard',
      ownerOnly: true, // Strictly hidden from employees
    },
    {
      path: '/admin/pipeline',
      matchPrefix: '/admin/pipeline',
      label: isOwner
        ? language === 'ru'
          ? 'Воронка всех сделок'
          : 'Platform Pipeline'
        : language === 'ru'
        ? 'Моя воронка сделок'
        : 'My Deal Pipeline',
      icon: GitPullRequest,
      tabId: 'pipeline',
    },
    {
      path: '/admin/matchmaker/U-10566',
      matchPrefix: '/admin/matchmaker',
      label: isOwner
        ? language === 'ru'
          ? 'ИИ-Матчмейкер (Все лоты)'
          : 'All Lots Matchmaker'
        : language === 'ru'
        ? 'Матчмейкер (Мои лоты)'
        : 'My Lots Buyer Offers',
      icon: Users,
      tabId: 'matchmaker',
    },
    {
      path: '/admin/packaging/U-10566',
      matchPrefix: '/admin/packaging',
      label: language === 'ru' ? 'Каталог и упаковка 152-ФЗ' : 'Packaging Studio 152-FZ',
      icon: PackageCheck,
      tabId: 'packaging',
    },
    {
      path: '/admin/legal-audit/U-10566',
      matchPrefix: '/admin/legal-audit',
      label: language === 'ru' ? 'Юридический аудит (42 пункта)' : 'Legal Audit (42 Checks)',
      icon: Scale,
      tabId: 'legal_audit',
    },
    {
      path: '/admin/closing/DEAL-2025-10566',
      matchPrefix: '/admin/closing',
      label: language === 'ru' ? 'Сделки в банках (Эскроу)' : 'Bank Escrow Closing',
      icon: Building2,
      tabId: 'closing',
    },
    {
      path: '/admin/partners-bot',
      matchPrefix: '/admin/partners-bot',
      label: language === 'ru' ? 'Инвесторы VIP и Партнеры' : 'VIP Investors & Partners',
      icon: Crown,
      tabId: 'partners_bot',
      ownerOnly: true, // Strictly hidden from employees
    },
  ];

  // RBAC Governance: Filter navigation items based on role and allowedSidebarTabs
  const visibleNavItems = allNavItems.filter((item) => {
    if (isEmployee) {
      if (item.ownerOnly) return false;
      // If item has a specific tabId in SidebarTabId, check allowedTabs
      if (item.tabId === 'pipeline' && !allowedTabs.includes('pipeline')) return false;
      if (item.tabId === 'matchmaker' && !allowedTabs.includes('matchmaker')) return false;
      if (item.tabId === 'packaging' && !allowedTabs.includes('packaging')) return false;
      if (item.tabId === 'legal_audit' && !allowedTabs.includes('legal_audit')) return false;
      return true;
    }
    return true;
  });

  const isActive = (prefix: string) => location.pathname.startsWith(prefix);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickSearch.trim();
    if (!q) return;
    const normalized = q.replace(/^#/, '');
    if (/^U-\d+/i.test(normalized)) {
      navigate(`/admin/legal-audit/${normalized.toUpperCase()}`);
    } else if (/^DEAL-/i.test(normalized)) {
      navigate(`/admin/closing/${normalized.toUpperCase()}`);
    } else {
      if (!isEmployee) {
        navigate(`/admin/archive-logs?q=${encodeURIComponent(q)}`);
      } else {
        navigate(`/admin/pipeline?q=${encodeURIComponent(q)}`);
      }
    }
    setMobileDrawerOpen(false);
  };

  const displayName =
    currentEmployee?.name ||
    user?.name ||
    (isOwner ? 'Ahmed Abdallah (CEO)' : 'Алексей Смирнов (Куратор)');

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();

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
          <div className="flex items-center space-x-2 min-w-0">
            {isOwner ? (
              <Crown className="w-4 h-4 text-indigo-600 shrink-0" />
            ) : (
              <Briefcase className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div className="text-[11px] font-bold truncate">
              {isOwner ? '👑 Владелец платформы' : `👔 Куратор: ${currentEmployee?.id || 'emp-1'}`}
            </div>
          </div>
          {/* Role switcher toggle strictly reserved for Master Owner */}
          {isMasterOwner && (
            <button
              type="button"
              onClick={() => switchRole(isOwner ? 'employee' : 'owner')}
              title="Переключить тестовый режим роли (Доступно Владельцу)"
              className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0 ml-1"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          {isOwner
            ? 'Полный доступ: выручка 2.5%, новые заявки, назначение сотрудников'
            : 'Изоляция 152-ФЗ: только назначенные вам объекты и прямые заявки'}
        </p>
      </div>

      {/* Quick Search */}
      <form onSubmit={handleQuickSearchSubmit} className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            placeholder={language === 'ru' ? 'Поиск лота (#U-...) или ФИО...' : 'Search lot or name...'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </form>

      {/* Nav Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.matchPrefix);
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

        {/* Owner-Only Compliance & Audit Logs: Strictly Hidden from Employee */}
        {!isEmployee && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {language === 'ru' ? 'Журналы и комплаенс' : 'Logs & Compliance'}
              </span>
            </div>

            <Link
              to="/admin/archive-logs"
              onClick={() => setMobileDrawerOpen(false)}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                isActive('/admin/archive-logs')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ru' ? 'Архив сделок и журнал решений' : 'Deals Archive & Audit Logs'}</span>
            </Link>
          </>
        )}

        {/* Employee Curator Profile (If allowed) */}
        {(!isEmployee || allowedTabs.includes('profile')) && (
          <Link
            to="/admin/profile"
            onClick={() => setMobileDrawerOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              isActive('/admin/profile')
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-600" />
            <span>{language === 'ru' ? 'Мой профиль куратора' : 'My Curator Profile'}</span>
          </Link>
        )}

        {/* Bank Portal Link: Strictly Hidden from Regular Employees */}
        {!isEmployee && (
          <Link
            to="/bank-portal"
            onClick={() => setMobileDrawerOpen(false)}
            className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              isActive('/bank-portal')
                ? 'bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs'
                : 'text-slate-600 hover:text-sky-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-4 h-4 text-sky-600" />
            <span>{language === 'ru' ? 'Банковский шлюз (Эскроу)' : 'Bank Escrow Gateway'}</span>
          </Link>
        )}
      </nav>

      {/* Bottom Compliance & Officer Indicator */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-600 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ЕИСЖС (Наш.дом.рф)</span>
          </span>
          <span className="text-emerald-700 font-bold flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Активна</span>
          </span>
        </div>

        <div className="flex items-center space-x-2.5 pt-2 border-t border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials || (isOwner ? 'AA' : 'АС')}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-900 truncate">{displayName}</span>
            <span className="text-[10px] text-emerald-700 truncate">
              {isOwner ? 'Генеральный директор / Владелец' : (currentEmployee?.role || 'Штатный куратор отдела выходов')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 text-slate-700 flex-col shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

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

      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
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
