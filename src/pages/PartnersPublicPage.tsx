import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Handshake,
  Award,
  CheckCircle,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RUSSIAN_REGIONS } from '../data/russianGeography';
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  sanitizeDigitsOnly,
  validateRussianInn,
  validateTextEntityName,
} from '../utils/validators';
import { RussianCityCode } from '../types';

export const PartnersPublicPage: React.FC = () => {
  const { language } = useLanguage();
  const { user, login } = useAuth();

  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone ? formatRussianPhoneInput(user.phone) : '+7 (');
  const [organization, setOrganization] = useState('');
  const [inn, setInn] = useState('');
  const [city, setCity] = useState<RussianCityCode>('spb');
  const [category, setCategory] = useState<
    'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'
  >('mortgage_broker');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const nameCheck = validateTextEntityName(fullName, 'ФИО партнера');
    if (!nameCheck.valid) {
      setErrorMsg(nameCheck.messageRu || 'Укажите корректное ФИО партнера.');
      return;
    }

    if (!isValidRussianPhone(phone)) {
      setErrorMsg('Введите номер телефона РФ в стандарте +7 (XXX) XXX-XX-XX.');
      return;
    }

    if (inn.trim().length > 0) {
      const innCheck = validateRussianInn(inn);
      if (!innCheck.valid) {
        setErrorMsg(innCheck.messageRu || 'Некорректный ИНН (10 или 12 цифр).');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await login({
          name: fullName.trim(),
          phone,
          role: 'buyer',
        });
      }

      const partner = await PartnersRepository.add({
        uid: activeUser.id,
        userId: activeUser.id,
        clientCode: activeUser.clientCode,
        name: fullName.trim(),
        organization: organization.trim() || 'Независимый партнер DomExit',
        inn: inn.trim() || undefined,
        city,
        role:
          category === 'developer_cancellation'
            ? 'Отдел расторжений застройщика'
            : category === 'mortgage_broker'
            ? 'Ипотечный брокер'
            : category === 'lawyer'
            ? 'Юрист по недвижимости'
            : 'Менеджер Trade-in',
        category,
        phone,
        status: 'pending',
      });

      setAssignedCode(partner.referralCode);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-12">
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 text-slate-900 border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
            <Handshake className="w-3.5 h-3.5" />
            {language === 'ru' ? 'Партнерская программа DomExit B2B' : 'DomExit Partner Program'}
          </span>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-slate-900">
            {language === 'ru'
              ? 'Фиксированное вознаграждение 30 000 – 50 000 ₽ за каждый переданный ДДУ'
              : 'Fixed 30,000 – 50,000 ₽ Reward for Every Referred DDU Contract'}
          </h1>

          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            {language === 'ru'
              ? 'Для менеджеров отделов расторжений застройщиков, ипотечных центров, агентств недвижимости и юристов в 7 регионах РФ. Помогите клиенту сохранить 100% капитала и получите официальное вознаграждение в день раскрытия аккредитива.'
              : 'For developer cancellation managers, mortgage centers, real estate agencies, and attorneys across 7 Russian regions.'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200">
          <div>
            <span className="text-xs text-slate-500">Вознаграждение агента</span>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">от 30 000 ₽</div>
            <span className="text-[11px] text-slate-500">За каждый закрытый лот</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Срок закрытия сделки</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">7–14 дней</div>
            <span className="text-[11px] text-slate-500">Прямой пул покупателей</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Комиссия с продавца</span>
            <div className="text-2xl font-black text-emerald-600 mt-0.5">0 ₽</div>
            <span className="text-[11px] text-slate-500">Клиент возвращает 100%</span>
          </div>
          <div>
            <span className="text-xs text-slate-500">Безопасность</span>
            <div className="text-2xl font-black text-slate-900 mt-0.5">214-ФЗ</div>
            <span className="text-[11px] text-slate-500">Эскроу Сбербанк / ВТБ</span>
          </div>
        </div>
      </div>

      {/* 2-Column: Benefits on Left, Registration Form on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Benefits (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {language === 'ru' ? 'Кому подходит партнерство с DomExit?' : 'Who is DomExit Partnership For?'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Менеджерам застройщиков</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Клиент хочет расторгнуть ДДУ? Сохраните баланс эскроу застройщика и передайте лот на чистую переуступку с переводом долга.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Ипотечным брокерам</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Помогите клиенту, получившему отказ банка по ПДН или не тянущему ставку 21%, вернуть 100% внесенных средств.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Юристам и адвокатам</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Обеспечьте доверителю защиту от исполнительных производств и штрафов девелопера через согласованную цессию по ст. 11 214-ФЗ.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Риелторам и агентствам</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Переуступки с траншевой ипотекой или рассрочкой мы упаковываем, проводим 42 проверки и реализуем за 9–14 дней.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Прозрачный антифрод-регламент выплат
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-900">Фиксация по ID клиента (DEX-XXXXXX):</strong> Передайте клиента через Кабинет Партнера. У дольщика включается 7-дневное окно загрузки ДДУ.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-900">Аудит и матчмейкинг:</strong> Юристы DomExit проверяют объект и закрепляют проверенного покупателя. Статус сделки виден в вашем кабинете онлайн.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-900">Гарантированная выплата:</strong> В день регистрации уступки в Росреестре и раскрытия аккредитива ваше вознаграждение перечисляется по реквизитам ИП/СЗ/ООО.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Registration Card (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
            
            {!submitted ? (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-bold text-slate-900">
                    {language === 'ru' ? 'Аккредитация партнера B2B' : 'Register as Lead Partner'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Заявка поступает напрямую в панель Владельца платформы
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ваше ФИО *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Лебедев Константин Игоревич"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Номер телефона РФ (+7) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+7 (921) 000-00-00"
                      value={phone}
                      onChange={(e) => setPhone(formatRussianPhoneInput(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Регион работы *
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value as RussianCityCode)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                      >
                        {RUSSIAN_REGIONS.map((reg) => (
                          <option key={reg.code} value={reg.code}>
                            {reg.shortLabelRu}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ИНН ИП/ООО (опц.)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="781012345678"
                        value={inn}
                        onChange={(e) => setInn(sanitizeDigitsOnly(e.target.value, 12))}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Организация / агентство / девелопер
                    </label>
                    <input
                      type="text"
                      placeholder="АН «Петербургская Недвижимость» / Ипотечный центр"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Сфера деятельности
                    </label>
                    <select
                      value={category}
                      onChange={(e: any) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="developer_cancellation">Отдел расторжений девелопера</option>
                      <option value="mortgage_broker">Ипотечный брокер / Центр кредитования</option>
                      <option value="lawyer">Юрист / Адвокатское бюро</option>
                      <option value="trade_in_developer">Менеджер по программе Trade-in</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <Award className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Регистрация в реестре...'
                          : language === 'ru'
                          ? 'Подать заявку и получить реф-код'
                          : 'Apply & Get Partner Code'}
                      </span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 text-center">
                    Нажимая кнопку, вы соглашаетесь с регламентом B2B-выплат и защитой персональных данных 152-ФЗ.
                  </p>
                </form>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Заявка партнера зарегистрирована!
                </h3>
                <p className="text-xs text-slate-600">
                  Ваш предварительный реферальный код закреплен в системе:
                </p>

                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl font-mono text-lg font-bold text-emerald-900">
                  {assignedCode}
                </div>

                <p className="text-xs text-slate-500">
                  Заявка направлена Владельцу платформы на верификацию. Вы уже можете отслеживать статус в своем Кабинете Партнера.
                </p>

                <div className="space-y-2 pt-2">
                  <Link
                    to="/portal?tab=partner"
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2"
                  >
                    <span>Открыть Кабинет Партнера</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Отправить еще одну заявку
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
