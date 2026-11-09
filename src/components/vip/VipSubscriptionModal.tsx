import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Crown,
  Sparkles,
  ShieldCheck,
  Clock,
  CreditCard,
  QrCode,
  CheckCircle2,
  X,
  ArrowRight,
  Lock,
  AlertCircle,
  Building2,
  Phone,
  Mail,
  User,
  BadgeCheck,
} from 'lucide-react';
import { formatRussianPhoneInput, isValidRussianPhone } from '../../utils/validators';

interface VipSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultPlan?: 'monthly' | 'single' | 'yearly';
}

export const VipSubscriptionModal: React.FC<VipSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultPlan = 'monthly',
}) => {
  const { language } = useLanguage();
  const { user, login, activateVipSubscription } = useAuth();
  const navigate = useNavigate();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'single' | 'yearly'>(defaultPlan);
  const [paymentMethod, setPaymentMethod] = useState<'sbp' | 'card'>('sbp');

  // Contact details
  const [fullName, setFullName] = useState<string>(user?.name || '');
  const [phone, setPhone] = useState<string>(user?.phone ? formatRussianPhoneInput(user.phone) : '+7 (');
  const [email, setEmail] = useState<string>(user?.email || '');

  // Payment UI state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const planDetails = {
    monthly: {
      id: 'monthly',
      title: language === 'ru' ? 'Месячная подписка' : 'Monthly Access',
      price: '14 900 ₽',
      period: language === 'ru' ? '/ месяц' : '/ month',
      badge: language === 'ru' ? 'Популярный выбор' : 'Most Popular',
      description:
        language === 'ru'
          ? 'Полный доступ ко всем новым лотам за 48 часов до открытой публикации. Неограниченное число закрытых карточек.'
          : 'Full priority access to all upcoming DDU exit lots 48 hours before general release.',
      features: [
        language === 'ru' ? '48 часов форы перед общим каталогом' : '48-hour head start before public catalog',
        language === 'ru' ? 'Доступ к проверенным документам 214-ФЗ' : 'Direct access to verified 214-FZ documents',
        language === 'ru' ? 'Персональный куратор и быстрое бронирование' : 'Personal curator & instant reservation',
        language === 'ru' ? 'Пуш-уведомления о новых срочных выходах' : 'Push alerts on urgent distressed exits',
      ],
    },
    single: {
      id: 'single',
      title: language === 'ru' ? 'Разовый пропуск на лот' : 'Single Lot Pass',
      price: '4 900 ₽',
      period: language === 'ru' ? 'разово' : 'one-time',
      badge: null,
      description:
        language === 'ru'
          ? 'Раннее открытие полной карточки и юридического досье одного выбранного объекта до его выхода на открытый рынок.'
          : 'Early unlock of the complete legal dossier and reservation rights for a single lot.',
      features: [
        language === 'ru' ? 'Доступ к досье одного выбранного объекта' : 'Full dossier of 1 selected property',
        language === 'ru' ? 'Право бронирования за 48 часов' : '48h priority reservation right',
        language === 'ru' ? 'Отчет юридического аудита (42 пункта)' : '42-checkpoint legal audit report',
      ],
    },
    yearly: {
      id: 'yearly',
      title: language === 'ru' ? 'Годовой VIP-резидент' : 'Annual VIP Resident',
      price: '99 000 ₽',
      period: language === 'ru' ? '/ год' : '/ year',
      badge: language === 'ru' ? 'Выгода 45%' : 'Save 45%',
      description:
        language === 'ru'
          ? 'Максимальный статус для покупателей и семейных офисов: персональный куратор, индивидуальный поиск и приоритет в банках.'
          : 'Top tier for home-buyers and family offices: dedicated curator and priority bank approval.',
      features: [
        language === 'ru' ? '365 дней неограниченного раннего доступа' : '365 days of unlimited 48h priority access',
        language === 'ru' ? 'Выделенный юридический куратор на каждую сделку' : 'Dedicated legal curator on each deal',
        language === 'ru' ? 'Приоритетная подача в Сбербанк, ВТБ, ДОМ.РФ' : 'Direct VIP channel to partner banks',
        language === 'ru' ? 'Персональный подбор по закрытым базам' : 'Bespoke off-market lot sourcing',
      ],
    },
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatRussianPhoneInput(val));
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg(language === 'ru' ? 'Укажите ваше ФИО' : 'Please provide your full name');
      return;
    }
    if (!isValidRussianPhone(phone)) {
      setErrorMsg(language === 'ru' ? 'Укажите корректный телефон РФ (+7...)' : 'Please provide a valid Russian phone (+7...)');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(language === 'ru' ? 'Укажите корректный email для чека 54-ФЗ' : 'Please provide a valid email for the receipt');
      return;
    }

    setIsProcessing(true);

    try {
      // If user not authenticated, authenticate locally
      let activeUser = user;
      if (!activeUser) {
        activeUser = await login({
          name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          role: 'buyer',
          isVipSubscriber: true,
        });
      } else {
        await activateVipSubscription();
      }

      // Simulate secure bank gateway checkout step (1.5 seconds)
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
          onClose();
          navigate('/vip-catalog');
        }, 1200);
      }, 1400);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Ошибка обработки платежного запроса.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>DomExit VIP • Ранний доступ 48 часов</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {language === 'ru'
              ? 'Закрытый клуб раннего доступа DomExit'
              : 'DomExit 48-Hour Priority Early Access Club'}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
            {language === 'ru'
              ? 'Эксклюзивное право бронирования проверенных квартир от дольщиков по цене договора без посредников за 48 часов до публикации на общем рынке.'
              : 'Priority access to verified DDU distress exit lots at historical contract prices 48 hours before public release.'}
          </p>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 flex-1 text-slate-900">
          {/* Mission Note: Helping Distressed Sellers Without Speculation */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold block text-emerald-900">
                {language === 'ru' ? 'Социальная миссия платформы:' : 'Platform Social Mission:'}
              </span>
              {language === 'ru'
                ? 'Объекты поступают напрямую от дольщиков, оказавшихся под угрозой штрафов и расторжения договоров девелоперами. Платформа не работает со спекулятивными перекупами — покупатели приобретают реальное жилье по себестоимости договора.'
                : 'All properties come directly from distress contract-holders facing developer penalties. DomExit connects real buyers directly at original contract prices.'}
            </div>
          </div>

          {/* Step 1: Choose Tariff */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              {language === 'ru' ? '1. Выберите формат доступа:' : '1. Select Access Plan:'}
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.keys(planDetails) as Array<keyof typeof planDetails>).map((key) => {
                const plan = planDetails[key];
                const isSelected = selectedPlan === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    {plan.badge && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                        {plan.badge}
                      </span>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{plan.title}</span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>

                      <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-black text-slate-950 font-mono">{plan.price}</span>
                        <span className="text-[11px] text-slate-500">{plan.period}</span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-snug">{plan.description}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      {plan.features.slice(0, 2).map((feat, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 text-[10px] text-slate-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2 & 3 Form: Payer Data & Payment Gateway Selection */}
          <form onSubmit={handlePay} className="space-y-5">
            {/* Payer Data Grid */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                {language === 'ru' ? '2. Контактные данные плательщика:' : '2. Payer Details:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'ФИО' : 'Full Name'} *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder={language === 'ru' ? 'Иван Иванов' : 'John Doe'}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'Телефон РФ' : 'Russian Phone'} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="+7 (999) 000-00-00"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-semibold focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {language === 'ru' ? 'Email (для чека 54-ФЗ)' : 'Email for Receipt'} *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="client@domexit.ru"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
                {language === 'ru' ? '3. Выберите способ защищенной оплаты:' : '3. Payment Method:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('sbp')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center space-x-3 cursor-pointer ${
                    paymentMethod === 'sbp'
                      ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-slate-900">СБП (Система быстрых платежей)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black">0%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Мгновенная активация через мобильный банк по QR-коду
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-center space-x-3 cursor-pointer ${
                    paymentMethod === 'card'
                      ? 'border-indigo-600 bg-indigo-50/60 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-slate-900">Банковская карта РФ</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black">МИР / Visa</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block truncate">
                      Защищенный эквайринг по стандарту 3D-Secure 2.0
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success State Notification */}
            {isSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-3 animate-fade-in">
                <BadgeCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-sm font-black">
                    {language === 'ru' ? 'Оплата подтверждена! VIP-доступ активирован' : 'Payment Confirmed! VIP Access Activated'}
                  </div>
                  <div className="text-[11px] font-normal text-emerald-700">
                    {language === 'ru' ? 'Перенаправляем в закрытую витрину раннего доступа (48 часов)...' : 'Redirecting to 48h early access catalog...'}
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Note */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500 leading-relaxed flex items-start space-x-2">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                {language === 'ru'
                  ? 'Безопасный платежный шлюз аккредитован по стандарту безопасности PCI DSS Level 1. Электронный фискальный чек направляется в ФНС в соответствии с 54-ФЗ. Услуга является предоставлением информационного доступа к базе раннего мониторинга и не является инвестиционной рекомендацией.'
                  : 'PCI DSS Level 1 certified gateway. Fiscal receipt sent per Federal Law 54-FZ. Informational monitoring access only.'}
              </span>
            </div>

            {/* Action Submit Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isProcessing || isSuccess}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'ru' ? 'Соединение со шлюзом оплаты...' : 'Connecting to gateway...'}</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    <span>
                      {language === 'ru'
                        ? `Оплатить ${planDetails[selectedPlan].price} и получить доступ (48ч)`
                        : `Pay ${planDetails[selectedPlan].price} & Unlock 48h Access`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
