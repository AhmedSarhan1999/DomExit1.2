import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, Building2, Landmark, ShieldCheck } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';

export const TermsOfServicePage: React.FC = () => {
  const { profile } = useCompanyProfileStore();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600 flex items-center space-x-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>На главную</span>
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">Правовая информация</span>
        </div>

        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Публичная оферта и регламент безопасных расчетов
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Пользовательское соглашение платформы «DomExit»
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
            <span>Редакция: 2026-v1</span>
            <span>•</span>
            <span>Владелец платформы: {profile.fullName}</span>
            <span>•</span>
            <span>ИНН: {profile.inn}</span>
          </div>
        </div>

        {/* Core Principles Alert Box */}
        <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-2xl p-5 space-y-2 text-xs text-indigo-950">
          <div className="font-black text-sm flex items-center space-x-2 text-indigo-900">
            <ShieldCheck className="w-4 h-4 text-indigo-700" />
            <span>Ключевые принципы безопасности сделок:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 leading-relaxed">
            <li>
              <strong>Сделки исключительно по 214-ФЗ:</strong> Платформа работает только с уступками по
              зарегистрированным договорам долевого участия (ДДУ).
            </li>
            <li>
              <strong>0% комиссии для продавца:</strong> Продавец получает 100% заявленного возврата средств без
              скрытых удержаний.
            </li>
            <li>
              <strong>Комиссия сервиса 2.5%:</strong> Оплачивается покупателем строго как 3-й транш безотзывного СБР
              только после получения выписки из Росреестра со штампом перехода прав.
            </li>
            <li>
              <strong>Банковская изоляция:</strong> Все взаиморасчеты ведутся через уполномоченные банки-партнеры
              ({profile.bankName} и др.).
            </li>
          </ul>
        </div>

        {/* Agreement Text */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 text-sm leading-relaxed text-slate-700">
          
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">1. Предмет соглашения</h2>
            <p>
              1.1. Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между{' '}
              {profile.fullName} (далее — «Компания», «Сервис») и физическим или юридическим лицом,
              использующим сервисы и витрину платформы «DomExit» (далее — «Пользователь»).
            </p>
            <p>
              1.2. Платформа «DomExit» предоставляет информационно-технологический комплекс для безопасной
              переуступки прав требований по договорам участия в долевом строительстве (214-ФЗ), юридического аудита
              чистоты сделки и синхронизации расчетов через Сервис безопасных расчетов (СБР) банков-партнеров.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">2. Статус сервиса и отказ от ответственности</h2>
            <p>
              2.1. Компания не является кредитной или банковской организацией, застройщиком либо стороной по
              договору уступки прав (цессии).
            </p>
            <p>
              2.2. Сервис безопасных расчетов (СБР), депонирование денежных средств и раскрытие аккредитивов
              осуществляются непосредственно уполномоченными банками-партнерами Российской Федерации ({profile.bankName},
              Банк ВТБ, Альфа-Банк, Банк ДОМ.РФ) в соответствии с их правилами и регламентами.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              3. Регламент расчетов и вознаграждение сервиса
            </h2>
            <p>
              3.1. Размещение заявок на срочный выход и поиск покупателей для продавцов недвижимости является
              бесплатным (0% комиссии).
            </p>
            <p>
              3.2. Вознаграждение Компании за оказание услуг по организации сделки, правовому комплаенсу (42 проверки)
              и сопровождению составляет 2.5% от суммы сделки и оплачивается покупателем прав.
            </p>
            <p>
              3.3. Выплата вознаграждения Компании блокируется на специальном счете СБР и перечисляется Компании
              исключительно в качестве третьего обусловленного транша после успешной государственной регистрации
              договора уступки в Росреестре.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">4. Права и обязанности сторон</h2>
            <p>
              4.1. Пользователь обязуется предоставлять достоверные сведения, правоустанавливающие документы
              (оригинал ДДУ, подтверждение оплаты, справки об отсутствии задолженностей).
            </p>
            <p>
              4.2. Компания вправе отказать в размещении лота или согласовании сделки при выявлении рисков банкротства
              продавца, непогашенных задолженностей перед застройщиком или непредоставлении согласий по 152-ФЗ.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">5. Реквизиты Компании</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 font-mono text-xs text-slate-800">
              <div>Наименование: {profile.fullName}</div>
              <div>Краткое наименование: {profile.shortName}</div>
              <div>ИНН / КПП: {profile.inn} / {profile.kpp}</div>
              <div>ОГРН: {profile.ogrn}</div>
              <div>Юридический адрес: {profile.legalAddress}</div>
              <div>Банк: {profile.bankName}</div>
              <div>БИК: {profile.bik}</div>
              <div>Р/с: {profile.checkingAccount}</div>
              <div>К/с: {profile.correspondentAccount}</div>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};
