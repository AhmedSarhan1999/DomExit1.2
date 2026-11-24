import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  ShieldCheck, 
  Phone, 
  Mail, 
  Lock, 
  User, 
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { apiClient } from '../../services/apiClient';
import { ConsentCheckboxes, ConsentState } from '../compliance/ConsentCheckboxes';
import { LegalRepository } from '../../dal/repositories/LegalRepository';
import { sanitizeReturnUrl } from '../../utils/securityGuards';
import { formatRussianPhoneInput, isValidRussianPhone } from '../../utils/validators';

export const AuthModal: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithYandex,
    loginWithEmail, 
    registerWithEmail,
    authIntentText,
    loading,
    authError
  } = useAuth();
  
  const { language } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [localError, setLocalError] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentState>({
    pdProcessing: false,
    termsAgreed: false,
    ads: false,
  });

  // Password recovery state (2 steps)
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setForgotSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError(language === 'ru' ? 'Введите корректный email' : 'Please provide a valid email');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await apiClient.auth.forgotPassword(cleanEmail);
      setForgotSuccess(res.message || 'Код восстановления отправлен на ваш email.');
      setForgotStep(2);
    } catch (err: any) {
      setLocalError(err?.message || 'Не удалось отправить код восстановления');
    } finally {
      setForgotLoading(false);
    }
  };

  const handlePerformPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setForgotSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = forgotCode.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setLocalError(language === 'ru' ? 'Введите 6-значный проверочный код' : 'Enter 6-digit verification code');
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setLocalError(language === 'ru' ? 'Пароль должен содержать минимум 8 символов' : 'Password must be at least 8 characters');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setLocalError(language === 'ru' ? 'Пароли не совпадают' : 'Passwords do not match');
      return;
    }

    try {
      setForgotLoading(true);
      const res = await apiClient.auth.resetPassword(cleanEmail, cleanCode, forgotNewPassword);
      setForgotSuccess(res.message || 'Пароль успешно изменен! Вход с новым паролем...');
      setPassword(forgotNewPassword);
      setTimeout(() => {
        setMode('signin');
        setForgotStep(1);
        setForgotCode('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotSuccess('Пароль успешно обновлен! Войдите в личный кабинет.');
      }, 1500);
    } catch (err: any) {
      setLocalError(err?.message || 'Ошибка сброса пароля. Проверьте код.');
    } finally {
      setForgotLoading(false);
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
        const loggedUser = await loginWithEmail(email, password);
        if (loggedUser) {
          const isStaffOrOwner =
            loggedUser.role === 'owner' ||
            loggedUser.role === 'admin' ||
            loggedUser.role === 'employee' ||
            loggedUser.activeRole === 'owner' ||
            loggedUser.activeRole === 'employee';
          if (isStaffOrOwner) {
            navigate('/admin/dashboard');
          } else {
            const rawReturnUrl = sessionStorage.getItem('domexit_return_url');
            sessionStorage.removeItem('domexit_return_url');
            navigate(sanitizeReturnUrl(rawReturnUrl, '/'));
          }
        }
      } else {
        if (!consents.pdProcessing || !consents.termsAgreed) {
          setLocalError(
            language === 'ru'
              ? 'Для регистрации необходимо подтвердить согласие на обработку персональных данных и принять Пользовательское соглашение'
              : 'Please accept terms and personal data processing to register'
          );
          return;
        }

        if (!isValidRussianPhone(phone.trim())) {
          setLocalError(
            language === 'ru'
              ? 'Номер телефона должен соответствовать стандарту РФ: +7 (XXX) XXX-XX-XX'
              : 'Phone number must match format: +7 (XXX) XXX-XX-XX'
          );
          return;
        }

        const registered = await registerWithEmail(email, password, name, phone, 'buyer');
        if (registered) {
          try {
            await LegalRepository.logUserConsent({
              user_id: registered.id || registered.clientCode,
              user_name: name || registered.name,
              phone: phone || registered.phone,
              email: email,
              action_type: 'registration',
              consented_documents: [
                { document_slug: 'terms', is_accepted: consents.termsAgreed },
                { document_slug: 'privacy', is_accepted: consents.pdProcessing },
                { document_slug: 'consent-pd', is_accepted: consents.pdProcessing },
                { document_slug: 'consent-ads', is_accepted: consents.ads },
              ],
            });
          } catch (logErr) {
            console.warn('[AuthModal] Consent log sync notice:', logErr);
          }
          const rawReturnUrl = sessionStorage.getItem('domexit_return_url');
          sessionStorage.removeItem('domexit_return_url');
          navigate(sanitizeReturnUrl(rawReturnUrl, '/'));
        }
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
              <span>{language === 'ru' ? 'Единая защищенная авторизация' : 'Unified Secure Auth'}</span>
            </div>
            
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">
              {language === 'ru' ? 'Вход в платформу DomExit' : 'Sign In to DomExit'}
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              {authIntentText || (language === 'ru'
                ? 'Войдите через Яндекс ID или по электронной почте для участия в сделках, бронирования лотов или подачи заявки партнера.'
                : 'Sign in with Yandex ID or Email to reserve properties, submit bids, or access partner benefits.')}
            </p>
          </div>

          {/* Error & Success Banners */}
          {(authError || localError) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                {authError || localError}
              </div>
            </div>
          )}

          {forgotSuccess && mode !== 'forgot' && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {forgotSuccess}
              </div>
            </div>
          )}

          {mode === 'forgot' ? (
            /* FORGOT PASSWORD 2-STEP FLOW */
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setForgotStep(1);
                    setLocalError(null);
                    setForgotSuccess(null);
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{language === 'ru' ? 'Назад ко входу' : 'Back to Sign In'}</span>
                </button>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {forgotStep === 1
                    ? (language === 'ru' ? 'Шаг 1 из 2: Запрос кода' : 'Step 1 of 2')
                    : (language === 'ru' ? 'Шаг 2 из 2: Новый пароль' : 'Step 2 of 2')}
                </span>
              </div>

              {forgotSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{forgotSuccess}</div>
                </div>
              )}

              {forgotStep === 1 ? (
                /* Step 1: Request OTP code */
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {language === 'ru' ? 'Восстановление доступа' : 'Password Recovery'}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {language === 'ru'
                        ? 'Укажите email вашей учетной записи. Мы отправим 6-значный одноразовый проверочный код.'
                        : 'Enter your account email. We will send a 6-digit one-time verification code.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Электронная почта (Email)' : 'Email'} *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        autoFocus
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <span>{language === 'ru' ? 'Отправка...' : 'Sending...'}</span>
                    ) : (
                      <>
                        <span>{language === 'ru' ? 'Отправить проверочный код' : 'Send Recovery Code'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Verify OTP and Set New Password */
                <form onSubmit={handlePerformPasswordReset} className="space-y-3.5">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {language === 'ru' ? 'Установка нового пароля' : 'Set New Password'}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {language === 'ru'
                        ? `Проверьте почту ${email} и введите 6-значный код.`
                        : `Check ${email} and enter the 6-digit code.`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Код из письма (6 цифр)' : '6-digit Code'} *
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        autoFocus
                        maxLength={6}
                        placeholder="123456"
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono tracking-widest text-center font-black focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Новый пароль (минимум 8 символов)' : 'New Password (min 8 chars)'} *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ru' ? 'Повторите новый пароль' : 'Confirm New Password'} *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={forgotConfirmPassword}
                        onChange={(e) => setForgotConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading || forgotCode.length !== 6}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <span>{language === 'ru' ? 'Сохранение...' : 'Saving...'}</span>
                    ) : (
                      <>
                        <span>{language === 'ru' ? 'Сохранить новый пароль' : 'Save New Password'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
                    >
                      {language === 'ru' ? 'Запросить код повторно' : 'Request code again'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* OFFICIAL YANDEX ID SIGN-IN BUTTON (149-FZ Compliant) */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => loginWithYandex()}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl border-2 border-red-500/20 hover:border-red-500/40 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-md shadow-red-600/20 transition-all flex items-center justify-center space-x-3 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white text-red-600 font-black text-sm leading-none shadow-xs">
                Я
              </span>
              <span>{language === 'ru' ? 'Войти через Яндекс ID' : 'Continue with Yandex ID'}</span>
            </button>
            <p className="text-[10px] text-center text-slate-500">
              {language === 'ru'
                ? 'Быстрый и защищенный вход через аккаунт Яндекс'
                : 'Instant secure domestic authorization via Yandex'}
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
                      onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 bg-slate-50 focus:bg-white font-mono"
                    />
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ru' ? 'Пароль' : 'Password'} *
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setForgotStep(1);
                      setLocalError(null);
                      setForgotSuccess(null);
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                  >
                    {language === 'ru' ? 'Забыли пароль?' : 'Forgot password?'}
                  </button>
                )}
              </div>
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

            {mode === 'register' && (
              <div className="pt-1">
                <ConsentCheckboxes
                  value={consents}
                  onChange={setConsents}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
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
          </>
          )}

          {/* Privacy Footnote */}
          <p className="text-[10px] text-slate-400 text-center leading-snug">
            {language === 'ru'
              ? 'Авторизация защищена современными протоколами шифрования. Данные сохраняются в защищенном облачном контуре.'
              : 'Secure authorization. Data is synchronized with a protected cloud perimeter.'}
          </p>

        </div>

      </div>
    </div>
  );
};

