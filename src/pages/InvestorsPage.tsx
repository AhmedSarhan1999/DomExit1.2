import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { InvestorClubRepository } from '../dal/repositories/InvestorClubRepository';
import {
  ShieldCheck,
  TrendingUp,
  Lock,
  CheckCircle2,
  Building2,
  Coins,
  Send,
  ArrowRight,
  Globe,
  Sparkles,
  Check,
} from 'lucide-react';

export const InvestorsPage: React.FC = () => {
  const { language } = useLanguage();

  const [step, setStep] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Form State with LocalStorage Auto-Save
  const [fullName, setFullName] = useState<string>(() => localStorage.getItem('inv_fullName') || '');
  const [company, setCompany] = useState<string>(() => localStorage.getItem('inv_company') || '');
  const [locationCity, setLocationCity] = useState<string>(() => localStorage.getItem('inv_city') || 'Санкт-Петербург');
  const [contactInfo, setContactInfo] = useState<string>(() => localStorage.getItem('inv_contact') || '');
  const [entityType, setEntityType] = useState<any>(() => localStorage.getItem('inv_entityType') || 'individual');
  const [capitalVolume, setCapitalVolume] = useState<any>(() => localStorage.getItem('inv_capital') || '15-50m');
  const [strategy, setStrategy] = useState<any>(() => localStorage.getItem('inv_strategy') || 'flipping');
  const [regions, setRegions] = useState<string[]>(['spb', 'msk']);
  const [services, setServices] = useState<string[]>(['buyout_pool']);
  const [targetIRR, setTargetIRR] = useState<string>('28%');
  const [customProposal, setCustomProposal] = useState<string>('');
  const [ndaAgreed, setNdaAgreed] = useState<boolean>(true);

  // Auto-save effect
  useEffect(() => {
    localStorage.setItem('inv_fullName', fullName);
    localStorage.setItem('inv_company', company);
    localStorage.setItem('inv_city', locationCity);
    localStorage.setItem('inv_contact', contactInfo);
    localStorage.setItem('inv_entityType', entityType);
    localStorage.setItem('inv_capital', capitalVolume);
    localStorage.setItem('inv_strategy', strategy);
  }, [fullName, company, locationCity, contactInfo, entityType, capitalVolume, strategy]);

  const toggleRegion = (r: string) => {
    setRegions(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r]);
  };

  const toggleService = (s: string) => {
    setServices(services.includes(s) ? services.filter((x) => x !== s) : [...services, s]);
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ndaAgreed) {
      alert(language === 'ru' ? 'Пожалуйста, подтвердите согласие с NDA' : 'Please accept NDA terms');
      return;
    }
    await InvestorClubRepository.submit({
      fullName,
      companyOrFund: company,
      countryAndCity: locationCity,
      contactTelegramOrPhone: contactInfo,
      entityType,
      capitalVolume,
      strategy,
      targetRegions: regions,
      requestedServices: services,
      customProposal,
      ndaAgreed,
    });
    setIsSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Header & 3 Large Stat Badges - Light Theme */}
      <section className="bg-white text-slate-900 pt-14 pb-16 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              Для инвесторов и фондов
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-sky-700 border border-slate-200 text-xs font-bold">
              214-ФЗ & Эскроу безопасность
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-amber-700 border border-slate-200 text-xs font-bold">
              RU & MENA Desk (ОАЭ)
            </span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              Инвестируйте в рынок срочных выходов и переуступок РФ
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Платформа DomExit обеспечивает чистый выход продавцам за 100% внесенных денег и открывает закрытый реестр проверенных договоров ДДУ со скидкой 15%–30% для частного и институционального капитала.
            </p>
          </div>

          {/* 3 Stat Badges Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">Порог входа</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">от 5 000 000 ₽</span>
              <span className="text-[11px] text-slate-500">~$50 000 / прямой выкуп</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">Доходность стратегий</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">24–38% годовых</span>
              <span className="text-[11px] text-slate-500">С защитой капитала в эскроу</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <span className="text-xs text-slate-500 uppercase tracking-wider block">Пул проверенных лотов</span>
              <span className="text-2xl font-black text-sky-600 mt-1 block">&gt; 133 млрд ₽</span>
              <span className="text-[11px] text-slate-500">Setl Group, ПИК, ЛСР</span>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Main 2-Column Section */}
      <section className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): 6-Step Investor Accreditation Questionnaire */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  АККРЕДИТАЦИЯ ИНВЕСТОРА
                </span>
                <h2 className="text-xl font-black text-slate-950">
                  Анкета инвестора и партнера (Шаг {step} из 6)
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {Math.round((step / 6) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(step / 6) * 100}%` }}
              />
            </div>

            {/* Confidentiality Notice */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center space-x-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Работаем под строгим NDA. Данные защищены и сохраняются в браузере автоматически.</span>
            </div>

            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">
                  Анкета аккредитации принята!
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  Специалист инвестиционного деска DomExit свяжется с вами в течение 30 минут для подписания цифрового NDA и открытия доступа к закрытому пулу переуступок.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setStep(1);
                  }}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors"
                >
                  Заполнить новую анкету
                </button>
              </div>
            ) : (
              <form onSubmit={handleFinalSubmit} className="space-y-6">
                
                {/* STEP 1: Entity Details */}
                {step === 1 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      1. Данные инвестора / организации и статус
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">ФИО или контактное лицо *</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Константин Александрович В."
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Название фонда / компании (если есть)</label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Aurora Capital Family Office"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Город / Страна *</label>
                        <input
                          type="text"
                          required
                          value={locationCity}
                          onChange={(e) => setLocationCity(e.target.value)}
                          placeholder="Санкт-Петербург"
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Телефон / Telegram *</label>
                        <input
                          type="text"
                          required
                          value={contactInfo}
                          onChange={(e) => setContactInfo(e.target.value)}
                          placeholder="+7 (921) ___-__-__"
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Тип субъекта:</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {[
                          { id: 'individual', label: 'Частный инвестор' },
                          { id: 'fund', label: 'Инвестиционный фонд / Family Office' },
                          { id: 'developer', label: 'Девелопер / Генподрядчик' },
                          { id: 'bank', label: 'Банк / Финансовая организация' },
                          { id: 'finishing', label: 'Компания по ремонту и меблировке' },
                          { id: 'agency', label: 'Международное агентство (MENA)' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setEntityType(item.id)}
                            className={`p-3 rounded-xl text-left border font-semibold transition-all ${
                              entityType === item.id
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                      >
                        <span>Далее: Капитал и стратегии</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Capital & Strategy */}
                {step === 2 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      2. Объем доступной ликвидности и стратегия
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Объем свободного капитала:</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          { id: '5-15m', label: '5–15 млн ₽' },
                          { id: '15-50m', label: '15–50 млн ₽' },
                          { id: '50-200m', label: '50–200 млн ₽' },
                          { id: '>200m', label: '> 200 млн ₽' },
                        ].map((cap) => (
                          <button
                            key={cap.id}
                            type="button"
                            onClick={() => setCapitalVolume(cap.id)}
                            className={`py-3 rounded-xl text-center font-bold border transition-all ${
                              capitalVolume === cap.id
                                ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {cap.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Приоритетная стратегия:</label>
                      
                      {[
                        {
                          id: 'flipping',
                          title: '1. Быстрая перепродажа / Флиппинг цессий',
                          desc: 'Покупка уступок с дисконтом 15–30% и реализация на завершающей стадии стройки.',
                        },
                        {
                          id: 'rental_fitout',
                          title: '2. Доходная долгосрочная аренда и ремонт под ключ',
                          desc: 'Покупка с отделкой White Box, доведение до стандарта арендного фонда и пассивный доход.',
                        },
                        {
                          id: 'equity_platform',
                          title: '3. Долевое участие в платформе (Equity / Pre-IPO)',
                          desc: 'Инвестиции в капитал самой платформы DomExit Technologies и региональную экспансию.',
                        },
                        {
                          id: 'institutional_partnership',
                          title: '4. Институциональное или подрядное партнерство',
                          desc: 'Штатные программы утилизации остатков, факторинг или подрядные работы.',
                        },
                      ].map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setStrategy(item.id)}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                            strategy === item.id
                              ? 'border-emerald-500 bg-emerald-50/80 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-bold text-xs text-slate-900 block">{item.title}</span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">{item.desc}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        ← Назад
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                      >
                        <span>Далее: География и сервисы</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Geographic Focus */}
                {step === 3 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      3. Целевые локации и география
                    </h3>

                    <div className="space-y-2">
                      {[
                        { id: 'spb', label: 'Санкт-Петербург и Ленинградская область' },
                        { id: 'msk', label: 'Москва и Московская область' },
                        { id: 'mena', label: 'Международные расчеты (ОАЭ / Дубай / AED Desk)' },
                      ].map((reg) => (
                        <label
                          key={reg.id}
                          className="flex items-center space-x-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs font-semibold text-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={regions.includes(reg.id)}
                            onChange={() => toggleRegion(reg.id)}
                            className="w-4 h-4 text-emerald-600 rounded accent-emerald-600"
                          />
                          <span>{reg.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        ← Назад
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                      >
                        <span>Далее: Специальные услуги</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: Special Services */}
                {step === 4 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      4. Дополнительные сервисы после приобретения
                    </h3>

                    <div className="space-y-2">
                      {[
                        { id: 'buyout_pool', label: 'Подключение к пулу срочного выкупа за 48 часов' },
                        { id: 'turnkey_fitout', label: 'Чистовая отделка, дизайн и меблировка под ключ' },
                        { id: 'rental_mgmt', label: 'Доверительное управление арендой и поиск арендаторов' },
                        { id: 'legal_escrow', label: 'Индивидуальное сопровождение эскроу-сделок в банках' },
                      ].map((srv) => (
                        <label
                          key={srv.id}
                          className="flex items-center space-x-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer text-xs font-semibold text-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={services.includes(srv.id)}
                            onChange={() => toggleService(srv.id)}
                            className="w-4 h-4 text-emerald-600 rounded accent-emerald-600"
                          />
                          <span>{srv.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        ← Назад
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                      >
                        <span>Далее: Доходность и параметры</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5: IRR and Comments */}
                {step === 5 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      5. Целевая доходность и индивидуальные пожелания
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ожидаемая годовая доходность (IRR):
                      </label>
                      <input
                        type="text"
                        value={targetIRR}
                        onChange={(e) => setTargetIRR(e.target.value)}
                        placeholder="25–35% годовых"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Особые пожелания, типы жилых комплексов или предложения о сотрудничестве:
                      </label>
                      <textarea
                        rows={3}
                        value={customProposal}
                        onChange={(e) => setCustomProposal(e.target.value)}
                        placeholder="Интересуют только 1-комн. квартиры в Приморском районе со сдачей в 2026 г., готовы финансировать до 50 млн ₽ ежемесячно..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        ← Назад
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(6)}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all"
                      >
                        <span>Далее: Проверка и подписание NDA</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 6: Review, NDA & Submit */}
                {step === 6 && (
                  <div className="space-y-4 animate-fadeIn">
                    <h3 className="font-bold text-sm text-slate-900">
                      6. Подтверждение данных и аккредитация
                    </h3>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Инвестор:</span>
                        <span className="font-bold text-slate-900">{fullName || 'Анонимный инвестор'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Компания:</span>
                        <span className="font-bold text-slate-900">{company || 'Частный капитал'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Объем капитала:</span>
                        <span className="font-bold text-emerald-700">{capitalVolume}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Стратегия:</span>
                        <span className="font-bold text-slate-900">{strategy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Контакты:</span>
                        <span className="font-bold text-slate-900">{contactInfo}</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                      <label className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          required
                          checked={ndaAgreed}
                          onChange={(e) => setNdaAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded text-emerald-600 accent-emerald-600"
                        />
                        <span className="leading-snug">
                          Согласен с соглашением о неразглашении (NDA) и защите закрытой информации по переуступкам. Подтверждаю чистоту источника происхождения капитала.
                        </span>
                      </label>
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        ← Назад
                      </button>
                      <button
                        type="submit"
                        className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/25 flex items-center space-x-2 transition-all"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Отправить анкету на аккредитацию</span>
                      </button>
                    </div>
                  </div>
                )}

              </form>
            )}

          </div>

          {/* Right Column (5 cols): Why Top Investors Choose DomExit */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                ПРЕИМУЩЕСТВА ДЛЯ FAMILY OFFICE
              </span>
              <h2 className="text-xl font-black text-slate-950">
                Почему ведущие инвесторы и family office выбирают DomExit
              </h2>

              {/* 3 White Cards */}
              <div className="space-y-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1.5">
                  <span className="font-bold text-sm text-slate-900 block">
                    Неорганизованный рынок с дисконтом
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Доступ к лотам до их выхода на открытые площадки. Продавцы готовы фиксировать сделку по цене первоначального договора.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1.5">
                  <span className="font-bold text-sm text-slate-900 block">
                    Гарантированный дисконт 15–30%
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Покупка напрямую без риелторских наценок и скрытых комиссий с полным сохранением условий рассрочки от девелопера.
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-1.5">
                  <span className="font-bold text-sm text-slate-900 block">
                    Экспансия на рынки MENA и расчеты в AED
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Возможность структурирования сделок через офис в Дубае для международных инвесторов и фондов Ближнего Востока.
                  </p>
                </div>
              </div>

              {/* 3 Steps */}
              <div className="p-4 bg-slate-100/80 rounded-2xl text-xs space-y-2 text-slate-700">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">1</span>
                  <span>Заявка за 2 минуты и первичный скоринг</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">2</span>
                  <span>NDA и доступ к закрытому пулу лотов</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">3</span>
                  <span>Личная встреча и безопасная сделка в банке</span>
                </div>
              </div>

              {/* IR Desk Card (Light Theme) */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 text-slate-900 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    IR Desk DomExit
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    24/7 ONLINE
                  </span>
                </div>
                <h4 className="font-bold text-base text-slate-900">Индивидуальные инвестиционные пулы</h4>
                <p className="text-xs text-slate-600">
                  Прямая связь с управляющим партнером по вопросам участия в капитале или синдицированного выкупа от 100 млн ₽.
                </p>
                <a
                  href="https://t.me/domexit_ru"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 transition-all block text-center"
                >
                  <Send className="w-4 h-4 inline mr-1" />
                  <span>Связаться с IR Desk в Telegram</span>
                </a>
              </div>

              {/* Capital purity badge */}
              <div className="flex items-center space-x-2 text-xs text-slate-500 justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% расчетная чистота капитала по стандартам ЦБ РФ</span>
              </div>

            </div>

          </div>

        </div>
      </section>

    </div>
  );
};
