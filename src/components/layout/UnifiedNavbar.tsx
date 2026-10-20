import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { EmployeesRepository } from '../../dal/repositories/EmployeesRepository';
import { 
  ShieldCheck, 
  User, 
  Menu, 
  X, 
  ArrowUpRight, 
  ChevronDown, 
  Briefcase, 
  Crown, 
  Building2,
  Sparkles,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const UnifiedNavbar: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, openAuthModal, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // 7-Role Options (Mission 2.1)
  const roleOptions: Array<{
    id: 'owner' | 'employee' | 'bank' | 'partner' | 'investor' | 'seller' | 'buyer';
    title: string;
    badge: string;
    subtitle: string;
    icon: string;
    targetPath: string;
  }> = [
    {
      id: 'owner',
      title: language === 'ru' ? 'Владелец платформы' : 'Platform Owner',
      badge: '👑 CEO',
      subtitle: language === 'ru' ? 'Выручка 2.5%, назначения, полный доступ' : 'Revenue, staff & settings',
      icon: '👑',
      targetPath: '/admin/dashboard',
    },
    {
      id: 'employee',
      title: language === 'ru' ? 'Сотрудник / Куратор' : 'Curator / Lawyer',
      badge: '👨‍💼 Алексей С.',
      subtitle: language === 'ru' ? 'Юр. аудит 42, упаковка 152-ФЗ, отбор' : 'Legal audit & matching',
      icon: '👨‍💼',
      targetPath: '/admin/dashboard',
    },
    {
      id: 'bank',
      title: language === 'ru' ? 'Банк-партнер' : 'Partner Bank',
      badge: '🏦 Сбербанк / ВТБ',
      subtitle: language === 'ru' ? 'Кредитные лимиты, эскроу и СБР' : 'Credit limits & escrow',
      icon: '🏦',
      targetPath: '/bank-portal',
    },
    {
      id: 'partner',
      title: language === 'ru' ? 'Партнер-брокер' : 'Partner Broker',
      badge: '🤝 Агентство',
      subtitle: language === 'ru' ? 'Рефералы DEX-ID, бонусы 50 000 ₽' : 'Referral tracking & bonuses',
      icon: '🤝',
      targetPath: '/portal',
    },
    {
      id: 'investor',
      title: language === 'ru' ? 'VIP Инвестор' : 'VIP Investor',
      badge: '💎 Закрытый пул',
      subtitle: language === 'ru' ? 'Ранний доступ 48ч, флиппинг-пакеты' : 'Early 48h access & syndicates',
      icon: '💎',
      targetPath: '/portal',
    },
    {
      id: 'seller',
      title: language === 'ru' ? 'Продавец ДДУ' : 'DDU Seller',
      badge: '🏠 Александр В.',
      subtitle: language === 'ru' ? 'Трекер 5 этапов, выплата кэша 100%' : '5-step cession deal tracker',
      icon: '🏠',
      targetPath: '/client-tracker',
    },
    {
      id: 'buyer',
      title: language === 'ru' ? 'Покупатель' : 'Buyer',
      badge: '🔑 Иван П.',
      subtitle: language === 'ru' ? '3 заявки, ликвидность, подбор лота' : '3 active bids, credit check',
      icon: '🔑',
      targetPath: '/portal',
    },
  ];

  const currentRoleOption = roleOptions.find(o => o.id === user?.activeRole) || roleOptions[0];

  // Verify staff / owner access
  useEffect(() => {
    async function checkAccess() {
      if (!isAuthenticated || !user) {
        setHasStaffAccess(false);
        return;
      }
      if (
        user.role === 'admin' || 
        user.activeRole === 'owner' || 
        user.email === 'amaas9499@gmail.com' || 
        user.email === 'ceo@domexit.ru' ||
        user.email === 'amaas9494@gmail.com'
      ) {
        setHasStaffAccess(true);
        return;
      }
      const isEmp = await EmployeesRepository.isEmployeeEmail(user.email);
      setHasStaffAccess(isEmp);
    }
    checkAccess();
  }, [isAuthenticated, user?.email, user?.role, user?.activeRole]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setServicesDropdownOpen(false);
      }
      if (roleSwitcherRef.current && !roleSwitcherRef.current.contains(event.target as Node)) {
        setRoleSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    if (isAuthenticated) {
      navigate('/portal');
    } else {
      openAuthModal(
        language === 'ru' 
          ? 'Войдите в систему для доступа к вашему единому кабинету дольщика и отслеживания сделок'
          : 'Sign in to access your unified client portal and track cession deals',
        () => navigate('/portal')
      );
    }
  };

  const handleRoleSelect = (opt: typeof roleOptions[0]) => {
    switchRole(opt.id);
    setRoleSwitcherOpen(false);
    navigate(opt.targetPath);
  };

  const handleServicesSelect = (role: 'owner' | 'employee') => {
    switchRole(role);
    setServicesDropdownOpen(false);
    navigate('/admin/dashboard');
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0F172A]/95 backdrop-blur-md text-slate-100 border-b border-slate-800 shadow-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Left: Brand Logo & Emerald Badge */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 p-0.5 shadow-md shadow-emerald-900/40 group-hover:scale-105 transition-transform flex items-center justify-center">
                <span className="font-extrabold text-white tracking-wider text-xl">D</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black tracking-tight text-white">DomExit</span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {t.brandTagline}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  {language === 'ru' ? 'Выход из ДДУ и рассрочек 0% наценки' : 'Clean Exit from DDU & Installments'}
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Main Navigation */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-1.5">
            <Link
              to="/sellers"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                isActive('/sellers')
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.nav.sellers}
            </Link>
            <Link
              to="/opportunities"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                isActive('/opportunities')
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.nav.catalog}
            </Link>
            <Link
              to="/how-it-works"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                isActive('/how-it-works')
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.nav.howItWorks}
            </Link>
            <Link
              to="/story"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                isActive('/story')
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.nav.story}
            </Link>
            <Link
              to="/investors"
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                isActive('/investors')
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {t.nav.investors}
            </Link>

            {/* Direct Link to Bank Portal for Bank Partners */}
            {user?.activeRole === 'bank' && (
              <Link
                to="/bank-portal"
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                  isActive('/bank-portal')
                    ? 'bg-sky-950 text-sky-300 border border-sky-600'
                    : 'text-sky-400 hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Банк-шлюз' : 'Bank Gateway'}</span>
              </Link>
            )}

            {/* Operational Services Dropdown */}
            {hasStaffAccess && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                    location.pathname.startsWith('/admin')
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-600/70'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>{language === 'ru' ? 'Управление' : 'Management'}</span>
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30">
                    PRO
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {servicesDropdownOpen && (
                  <div className="absolute top-full mt-2 w-68 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in space-y-1 text-slate-100">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      {language === 'ru' ? 'Операционные кабинеты:' : 'Operational Dashboards:'}
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleServicesSelect('owner')}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-indigo-950/70 text-slate-200 hover:text-indigo-200 transition-colors flex items-start space-x-3 cursor-pointer group"
                    >
                      <Crown className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {language === 'ru' ? 'Панель Владельца' : 'Owner Dashboard'}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          {language === 'ru' ? 'Выручка 2.5%, назначения и настройки' : 'Platform revenue & staffing'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleServicesSelect('employee')}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-950/70 text-slate-200 hover:text-emerald-200 transition-colors flex items-start space-x-3 cursor-pointer group"
                    >
                      <Briefcase className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {language === 'ru' ? 'Кабинет Сотрудника' : 'Employee Portal'}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          {language === 'ru' ? 'Назначенные лоты, заявки и эскроу' : 'Assigned lots & buyer bids'}
                        </div>
                      </div>
                    </button>

                    <Link
                      to="/bank-portal"
                      onClick={() => setServicesDropdownOpen(false)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-sky-950/70 text-slate-200 hover:text-sky-200 transition-colors flex items-start space-x-3 cursor-pointer group block"
                    >
                      <Building2 className="w-4 h-4 text-sky-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          {language === 'ru' ? 'Банковский Шлюз' : 'Bank Gateway'}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-tight">
                          {language === 'ru' ? 'Кредитные лимиты и СБР эскроу' : 'Credit limits & escrow'}
                        </div>
                      </div>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right: Instant Role Switcher, Direct Actions, Language & Profile */}
          <div className="hidden sm:flex items-center space-x-2.5">
            
            {/* MISSION 2.1: Instant Account & Role Switcher */}
            <div className="relative" ref={roleSwitcherRef}>
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="h-9 px-3 rounded-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 hover:from-indigo-900 hover:to-indigo-900 border border-indigo-500/50 text-indigo-200 text-xs font-bold transition-all flex items-center space-x-2 shadow-xs cursor-pointer group"
                title="Сменить аккаунт / Роль платформы"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform shrink-0" />
                <span className="hidden xl:inline text-slate-400 text-[11px]">{language === 'ru' ? 'Роль:' : 'Role:'}</span>
                <span className="text-white font-extrabold flex items-center space-x-1 truncate max-w-[120px]">
                  <span>{currentRoleOption.icon}</span>
                  <span className="truncate">{currentRoleOption.badge.replace(/^[^\w\sа-яА-ЯёЁ]+/, '') || 'Владелец'}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900/98 border border-slate-700/80 rounded-2xl shadow-2xl p-2.5 z-50 animate-fade-in space-y-1 text-slate-100 backdrop-blur-xl">
                  <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                    <span>{language === 'ru' ? 'Сменить аккаунт / Роль:' : 'Switch Account / Role:'}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">7 ролей</span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto space-y-1 pt-1">
                    {roleOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleRoleSelect(opt)}
                        className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start space-x-3 cursor-pointer ${
                          user?.activeRole === opt.id
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{opt.title}</span>
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                            {opt.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dual Language Switcher: RU / EN strictly */}
            <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  language === 'ru'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {/* "Want to Buy" Button */}
            <Link
              to="/opportunities"
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 shadow-xs transition-colors"
            >
              {t.nav.wantBuy}
            </Link>

            {/* Prominent Emerald Green "Want to Sell (0%)" Button */}
            <Link
              to="/sellers"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-900/40 hover:shadow-emerald-900/60 transition-all flex items-center space-x-1"
            >
              <span>{t.nav.wantSell}</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>

            {/* Unified Client Profile / Portal Button */}
            <button
              type="button"
              onClick={handleProfileClick}
              title={
                isAuthenticated 
                  ? (language === 'ru' ? `Кабинет: ${user?.name}` : `Cabinet: ${user?.name}`)
                  : (language === 'ru' ? 'Войти в личный кабинет' : 'Sign in to Cabinet')
              }
              className={`h-9 px-3 rounded-xl border transition-all flex items-center space-x-2 cursor-pointer ${
                isAuthenticated 
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 shadow-xs'
                  : 'bg-slate-800/90 border-slate-700 hover:border-slate-600 text-slate-200 hover:text-white shadow-xs'
              }`}
            >
              <User className={`w-4 h-4 ${isAuthenticated ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="text-xs font-bold truncate max-w-[90px]">
                {isAuthenticated ? user?.name.split(' ')[0] : (language === 'ru' ? 'Кабинет' : 'Portal')}
              </span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              className="px-2 py-1 bg-slate-800 rounded text-xs font-bold text-slate-200 border border-slate-700"
            >
              {language.toUpperCase()}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0F172A] border-b border-slate-800 px-4 pt-3 pb-6 space-y-2 shadow-2xl animate-fade-in text-white">
          <Link
            to="/sellers"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40"
          >
            {t.nav.sellers} (0% комиссии)
          </Link>
          <Link
            to="/opportunities"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t.nav.catalog}
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t.nav.howItWorks}
          </Link>
          <Link
            to="/story"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t.nav.story}
          </Link>
          <Link
            to="/investors"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {t.nav.investors}
          </Link>

          {/* Mobile Client Portal Link */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              handleProfileClick();
            }}
            className="w-full text-left block px-3 py-2 rounded-xl text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            {language === 'ru' ? 'Личный кабинет' : 'Client Portal'}
          </button>

          {/* Mobile 7-Role Switcher */}
          <div className="pt-2 border-t border-slate-800 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1 flex items-center justify-between">
              <span>{language === 'ru' ? 'Быстрая смена роли:' : 'Quick Role Switch:'}</span>
              <span className="text-emerald-400 font-mono">7 ролей</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {roleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleRoleSelect(opt);
                  }}
                  className={`p-2 rounded-xl text-left text-xs font-bold flex items-center space-x-2 border transition-all ${
                    user?.activeRole === opt.id
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="truncate">{opt.badge}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
