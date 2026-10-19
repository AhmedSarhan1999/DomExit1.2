import React, { useState } from 'react';
import { 
  Users, 
  Handshake, 
  Award, 
  CheckCircle, 
  DollarSign, 
  ShieldCheck, 
  ArrowRight, 
  Building2, 
  Send,
  HelpCircle,
  Clock
} from 'lucide-react';
import { UnifiedNavbar } from '../components/layout/UnifiedNavbar';
import { UnifiedFooter } from '../components/layout/UnifiedFooter';
import { PartnersRepository } from '../dal/repositories/PartnersRepository';
import { useLanguage } from '../i18n/LanguageContext';

export const PartnersPublicPage: React.FC = () => {
  const { language } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [category, setCategory] = useState<'developer_cancellation' | 'mortgage_broker' | 'lawyer' | 'trade_in_developer'>('mortgage_broker');
  const [submitted, setSubmitted] = useState(false);
  const [assignedCode, setAssignedCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) return;

    const partner = await PartnersRepository.add({
      name: fullName,
      organization: organization || 'Партнер DomExit',
      role: category === 'developer_cancellation' 
        ? 'Отдел расторжений застройщика'
        : category === 'mortgage_broker'
        ? 'Ипотечный брокер'
        : category === 'lawyer'
        ? 'Юрист по недвижимости'
        : 'Менеджер Trade-in',
      category: category,
      phone: phone
    });

    setAssignedCode(partner.referralCode);
    setSubmitted(true);
  };

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full space-y-12">
        
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 text-slate-900 border border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold uppercase tracking-wider">
              <Handshake className="w-3.5 h-3.5" />
              {language === 'ru' ? 'Партнерская программа DomExit' : 'DomExit Partner Program'}
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-slate-900">
              {language === 'ru'
                ? 'Фиксированное вознаграждение 30 000 ₽ за каждый переданный ДДУ'
                : 'Fixed 30,000 ₽ Reward for Every Referred DDU Contract'}
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              {language === 'ru'
                ? 'Для менеджеров отделов расторжений застройщиков, ипотечных центров, агентств недвижимости и юристов. Помогите клиенту не потерять деньги, а мы гарантированно выплатим вознаграждение в день регистрации цессии в Росреестре.'
                : 'For developer cancellation managers, mortgage centers, real estate agencies, and attorneys. Help your client avoid severe penalties while earning guaranteed remuneration.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-200">
            <div>
              <span className="text-xs text-slate-500">Фиксированная выплата</span>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">30 000 ₽</div>
              <span className="text-[11px] text-slate-500">За каждый закрытый лот</span>
            </div>
            <div>
              <span className="text-xs text-slate-500">Срок закрытия сделки</span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">7–14 дней</div>
              <span className="text-[11px] text-slate-500">Быстрый поиск покупателя</span>
            </div>
            <div>
              <span className="text-xs text-slate-500">Комиссия с продавца</span>
              <div className="text-2xl font-black text-emerald-600 mt-0.5">0 ₽ (Бесплатно)</div>
              <span className="text-[11px] text-slate-500">Клиент возвращает 100%</span>
            </div>
            <div>
              <span className="text-xs text-slate-500">Безопасность</span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">214-ФЗ</div>
              <span className="text-[11px] text-slate-500">Эскроу и Сбербанк / ВТБ</span>
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
                <h3 className="font-bold text-slate-900 text-sm">
                  Менеджерам застройщиков
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Клиент хочет расторгнуть ДДУ? Не портите статистику расторжений девелопера. Передайте лот на чистую цессию без штрафа.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Ипотечным брокерам
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Помогите клиенту, получившему отказ банка или не тянущему платежи по ставке 18–21%, вернуть все внесенные деньги.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Юристам и адвокатам
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Обеспечьте доверителю защиту от банкротства и судебных споров с застройщиком через легитимную уступку с согласованием.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Риелторам и агентствам
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Переуступки со сложным обременением или рассрочкой, которые не берут обычные агентства, мы упаковываем и закрываем за 9 дней.
                </p>
              </div>

            </div>

            {/* 3 Steps */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Как происходят выплаты?
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-900">Передача контакта или ДДУ:</strong> Вы передаете контакт владельца договора через персональный реферальный код или бота.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-900">Бесплатный аудит и упаковка:</strong> Мы берем на себя 100% юридической работы, проверку по 42 параметрам и поиск покупателя с живыми деньгами.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-900">Выплата 30 000 ₽:</strong> В день выпуска выписки ЕГРН в Росреестре и раскрытия аккредитива мы перечисляем ваше вознаграждение.
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
                      {language === 'ru' ? 'Регистрация партнера-поставщика' : 'Register as Lead Partner'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Получите персональный реферальный код за 2 минуты
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ваше имя и фамилия *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Константин Лебедев"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Номер телефона / Telegram для связи *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="+7 (999) 000-00-00"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Организация или застройщик
                      </label>
                      <input
                        type="text"
                        placeholder="ПИК, Setl Group, Сбербанк, АН или частный брокер"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Сфера вашей деятельности
                      </label>
                      <select
                        value={category}
                        onChange={(e: any) => setCategory(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
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
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Award className="w-4 h-4" />
                        {language === 'ru' ? 'Получить партнерский код (30 000 ₽)' : 'Get Partner Code'}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 text-center">
                      Нажимая кнопку, вы соглашаетесь с условиями регламента выплат и обработкой персональных данных по 152-ФЗ.
                    </p>
                  </form>
                </>
              ) : (
                <div className="text-center py-6 space-y-4 animate-scale-up">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Вы успешно зарегистрированы!
                  </h3>
                  <p className="text-xs text-slate-600">
                    Ваш персональный код партнера для направления клиентов:
                  </p>

                  <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl font-mono text-lg font-bold text-emerald-900">
                    {assignedCode}
                  </div>

                  <p className="text-xs text-slate-500">
                    Куратор партнерской сети свяжется с вами в течение 15 минут для подтверждения реквизитов счета.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Зарегистрировать еще одного представителя
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
    </div>
  );
};
