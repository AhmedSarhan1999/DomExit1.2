import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Lock, 
  User, 
  ArrowRight,
  Sparkles,
  AlertCircle,
  Briefcase,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithGoogle, 
    loginWithEmail, 
    registerWithEmail,
    quickDemoLogin,
    authIntentText,
    loading,
    authError
  } = useAuth();
  
  const { language } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'seller' | 'partner' | 'investor'>('buyer');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.warn('Google sign-in caught:', err);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError(language === 'ru' ? 'Заполните email и пароль' : 'Please provide email and password');
      return;
    }

    try {
      if (mode === 'signin') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name, phone, selectedRole);
      }
    } catch (err: any) {
      console.warn('Email auth notice:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto">
        
        {/* Top Accent Gradient & Close Button */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-600" />
        
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8 space-y-5">
          
          {/* Header & Badges */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{language === 'ru' ? 'Единая защищенная авторизация 214-ФЗ' : 'Unified Secure 214-FZ Auth'}</span>
            </div>
            
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">
              {language === 'ru' ? 'Вход в платформу DomExit' : 'Sign In to DomExit'}
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              {authIntentText || (language === 'ru'
                ? 'Войдите через Google или по электронной почте для участия в сделках, бронирования лотов или подачи заявки партнера.'
                : 'Sign in with Google or Email to reserve properties, submit bids, or access partner benefits.')}
            </p>
          </div>

          {/* Error Banner */}
          {(authError || localError) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {authError || localError}
              </div>
            </div>
          )}

          {/* OFFICIAL GOOGLE SIGN-IN BUTTON (Prominent & Real) */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs transition-all flex items-center justify-center space-x-3 active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{language === 'ru' ? 'Войти через Google' : 'Continue with Google'}</span>
            </button>
            <p className="text-[10px] text-center text-slate-600">
              {language === 'ru' ? 'Мгновенная авторизация через официальный аккаунт Google' : 'Instant real Firebase Google Auth'}
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {language === 'ru' ? 'или по электронной почте' : 'or with email'}
            </span>
          </div>

          {/* Tabs: Sign In vs Register */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => { setMode('signin'); setLocalError(null); }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {language === 'ru' ? 'Вход по паролю' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setLocalError(null); }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {language === 'ru' ? 'Регистрация' : 'Create Account'}
            </button>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'Ваше имя' : 'Full Name'} *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      placeholder={language === 'ru' ? 'Иван Сергеевич' : 'John Doe'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'Номер телефона (+7)' : 'Phone (+7)'} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      required
                      placeholder="+7 (911) 000-00-00"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'Основной статус:' : 'Initial Account Role:'}
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('buyer')}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        selectedRole === 'buyer'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Покупатель
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('seller')}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        selectedRole === 'seller'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Продавец
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('partner')}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        selectedRole === 'partner'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Партнер
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('investor')}
                      className={`py-1.5 rounded-lg border text-center transition-all ${
                        selectedRole === 'investor'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Инвестор
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Электронная почта (Email)' : 'Email'} *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ru' ? 'Пароль' : 'Password'} *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
            >
              {loading ? (
                <span>{language === 'ru' ? 'Обработка...' : 'Processing...'}</span>
              ) : (
                <>
                  <span>
                    {mode === 'signin' 
                      ? (language === 'ru' ? 'Войти в личный кабинет' : 'Sign In')
                      : (language === 'ru' ? 'Зарегистрироваться' : 'Create Account')}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Personas (Mission 2.2: 7 Roles with uniform password DomExit2026!) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{language === 'ru' ? 'Быстрый вход для тестирования ролей:' : 'Quick Demo Login (7 Roles):'}</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded font-bold">
                Пароль: DomExit2026!
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-semibold">
              {/* 1. Owner */}
              <button
                type="button"
                onClick={() => quickDemoLogin('owner')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-indigo-50/80 text-slate-800 hover:text-indigo-950 border border-slate-200 hover:border-indigo-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-indigo-900">👑 Владелец / CEO</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">amaas9499@gmail.com</div>
                </div>
                <span className="text-[9px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">Полный</span>
              </button>

              {/* 2. Employee */}
              <button
                type="button"
                onClick={() => quickDemoLogin('employee')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-blue-50/80 text-slate-800 hover:text-blue-950 border border-slate-200 hover:border-blue-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-blue-900">👨‍💼 Куратор / Юрист</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">amaas9494@gmail.com</div>
                </div>
                <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">Штат</span>
              </button>

              {/* 3. Bank */}
              <button
                type="button"
                onClick={() => quickDemoLogin('bank')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-sky-50/80 text-slate-800 hover:text-sky-950 border border-slate-200 hover:border-sky-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-sky-900">🏦 Банк-партнер</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">bank@domexit.ru</div>
                </div>
                <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">Эскроу</span>
              </button>

              {/* 4. Partner */}
              <button
                type="button"
                onClick={() => quickDemoLogin('partner')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-purple-50/80 text-slate-800 hover:text-purple-950 border border-slate-200 hover:border-purple-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-purple-900">🤝 Партнер-брокер</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">partner@domexit.ru</div>
                </div>
                <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">Бонусы</span>
              </button>

              {/* 5. Investor */}
              <button
                type="button"
                onClick={() => quickDemoLogin('investor')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-amber-50/80 text-slate-800 hover:text-amber-950 border border-slate-200 hover:border-amber-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-amber-900">💎 VIP Инвестор</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">investor@domexit.ru</div>
                </div>
                <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Ранний 48ч</span>
              </button>

              {/* 6. Seller */}
              <button
                type="button"
                onClick={() => quickDemoLogin('seller')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-emerald-50/80 text-slate-800 hover:text-emerald-950 border border-slate-200 hover:border-emerald-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-[11px] text-emerald-900">🏠 Продавец ДДУ</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">seller@domexit.ru</div>
                </div>
                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">0% сбор</span>
              </button>

              {/* 7. Buyer */}
              <button
                type="button"
                onClick={() => quickDemoLogin('buyer')}
                disabled={loading}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 border border-slate-200 hover:border-slate-300 text-left shadow-2xs transition-all flex items-center justify-between cursor-pointer sm:col-span-2"
              >
                <div>
                  <div className="font-bold text-[11px] text-slate-900">🔑 Покупатель (100% Кэш / Ипотека)</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">client@domexit.ru / buyer@domexit.ru</div>
                </div>
                <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">3 заявки</span>
              </button>
            </div>
          </div>

          {/* Privacy Footnote */}
          <p className="text-[10px] text-slate-400 text-center leading-snug">
            {language === 'ru'
              ? 'Авторизация защищена протоколом 152-ФЗ. Данные синхронизируются с базой данных Firebase.'
              : 'Protected under 152-FZ. Synchronized with live Firebase Database.'}
          </p>

        </div>

      </div>
    </div>
  );
};

