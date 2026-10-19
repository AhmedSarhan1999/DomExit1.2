import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  User, 
  Menu, 
  X, 
  ArrowUpRight,
  ChevronDown,
  Briefcase,
  Crown,
  Layers,
  Heart
} from 'lucide-react';

export const UnifiedNavbar: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, openAuthModal, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setServicesDropdownOpen(false);
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

  const handleServicesSelect = (role: 'owner' | 'employee') => {
    switchRole(role);
    setServicesDropdownOpen(false);
    navigate('/admin/dashboard');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md text-slate-800 border-b border-slate-200/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Left: Brand Logo & Emerald Badge */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 p-0.5 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
                <span className="font-extrabold text-white tracking-wider text-xl">D</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black tracking-tight text-slate-900">DomExit</span>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {t.brandTagline}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  {language === 'ru' ? 'Выход из ДДУ и рассрочек 0% наценки' : 'Clean Exit from DDU & Installments'}
                </span>
              </div>
            </Link>
          </div>

          {/* Center: Main Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-1.5">
            <Link
              to="/sellers"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/sellers')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.nav.sellers}
            </Link>
            <Link
              to="/opportunities"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/opportunities')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.nav.catalog}
            </Link>
            <Link
              to="/how-it-works"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/how-it-works')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.nav.howItWorks}
            </Link>
            <Link
              to="/story"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/story')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.nav.story}
            </Link>
            <Link
              to="/investors"
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isActive('/investors')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t.nav.investors}
            </Link>

            {/* Services Dropdown: Clean separation between Owner Dashboard & Employee Portal */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  location.pathname.startsWith('/admin')
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{language === 'ru' ? 'Сервисы' : 'Services'}</span>
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                  PRO
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {servicesDropdownOpen && (
                <div className="absolute top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    {language === 'ru' ? 'Операционные кабинеты:' : 'Operational Dashboards:'}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleServicesSelect('owner')}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-800 hover:text-indigo-900 transition-colors flex items-start space-x-3 cursor-pointer group"
                  >
                    <Crown className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {language === 'ru' ? 'Панель Владельца' : 'Owner Dashboard'}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        {language === 'ru' ? 'Контроль выручки 2.5%, одобрение заявок и назначение сотрудников' : 'Platform revenue, seller reviews & staffing'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleServicesSelect('employee')}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-emerald-50/80 text-slate-800 hover:text-emerald-900 transition-colors flex items-start space-x-3 cursor-pointer group"
                  >
                    <Briefcase className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {language === 'ru' ? 'Кабинет Сотрудника' : 'Employee Portal'}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight">
                        {language === 'ru' ? 'Назначенные лоты, входящие заявки покупателей и эскроу' : 'Assigned lots, buyer bids & escrow closing'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Right: Language Switcher, Action Buttons & Profile */}
          <div className="hidden sm:flex items-center space-x-3">
            {/* Dual Language Switcher: RU / EN strictly */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  language === 'ru'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>

            {/* Light Bordered "Want to Buy" Button */}
            <Link
              to="/opportunities"
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 shadow-xs transition-colors"
            >
              {t.nav.wantBuy}
            </Link>

            {/* Prominent Emerald Green "Want to Sell (0%)" Button */}
            <Link
              to="/sellers"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center space-x-1"
            >
              <span>{t.nav.wantSell}</span>
              <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </Link>

            {/* Unified Client Profile / Portal Button with Auth Trigger */}
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
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100/80 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 shadow-xs'
              }`}
            >
              <User className={`w-4 h-4 ${isAuthenticated ? 'text-emerald-700' : 'text-slate-500'}`} />
              <span className="text-xs font-bold truncate max-w-[100px]">
                {isAuthenticated ? user?.name.split(' ')[0] : (language === 'ru' ? 'Кабинет' : 'Portal')}
              </span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex lg:hidden items-center space-x-2">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
              className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-800 border border-slate-200"
            >
              {language.toUpperCase()}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-2 shadow-lg animate-fade-in">
          <Link
            to="/sellers"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2.5 rounded-lg text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80"
          >
            {t.nav.sellers} (0% комиссии)
          </Link>
          <Link
            to="/opportunities"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t.nav.catalog}
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t.nav.howItWorks}
          </Link>
          <Link
            to="/story"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {t.nav.story}
          </Link>
          <Link
            to="/investors"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
            className="w-full text-left block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {language === 'ru' ? 'Личный кабинет дольщика' : 'Client Portal'}
          </button>

          <div className="pt-2 border-t border-slate-100 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1">
              {language === 'ru' ? 'Операционные сервисы:' : 'Operational Services:'}
            </div>
            
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleServicesSelect('owner');
              }}
              className="w-full text-left block px-3 py-2 rounded-lg text-sm font-bold text-indigo-700 bg-indigo-50/60"
            >
              👑 {language === 'ru' ? 'Панель Владельца (CEO)' : 'Owner Dashboard'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleServicesSelect('employee');
              }}
              className="w-full text-left block px-3 py-2 rounded-lg text-sm font-bold text-emerald-700 bg-emerald-50/60"
            >
              👔 {language === 'ru' ? 'Кабинет Сотрудника (Куратор)' : 'Employee Portal'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

