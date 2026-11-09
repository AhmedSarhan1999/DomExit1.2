import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, BellRing } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';

export const ConsentAdsPage: React.FC = () => {
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
          <span className="text-slate-800 font-bold">Правовое согласие</span>
        </div>

        {/* Page Header */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-black">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Статья 18 Федерального закона № 38-ФЗ «О рекламе»
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Согласие на получение информационных и рекламных рассылок
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Предоставление настоящего согласия является добровольным и не является условием использования основных
            сервисов платформы DomExit.
          </p>
        </div>

        {/* Form Body */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 text-sm leading-relaxed text-slate-700">
          <p>
            Настоящим я, действуя своей волей и в своем интересе, в соответствии со статьей 18 Федерального закона от
            13.03.2006 № 38-ФЗ «О рекламе», даю свое согласие {profile.fullName} (ИНН: {profile.inn}, адрес:{' '}
            {profile.legalAddress}) на получение сообщений информационного и рекламного характера.
          </p>

          <h3 className="text-base font-bold text-slate-900 pt-2">1. Способы распространения информации:</h3>
          <p>
            Рассылка осуществляется посредством сетей электросвязи, включая отправку SMS-сообщений на указанный
            номер телефона, сообщений по электронной почте, push-уведомлений в браузере, а также сообщений через
            мессенджеры (Telegram, MAX).
          </p>

          <h3 className="text-base font-bold text-slate-900 pt-2">2. Тематика направляемых сообщений:</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Появление новых дисконтных лотов уступки по 214-ФЗ с ценой ниже застройщика;</li>
            <li>Аналитические обзоры доходности районов, динамики ставок банков и ПДН;</li>
            <li>Специальные предложения банков-партнеров по сниженным ипотечным ставкам;</li>
            <li>Приглашения в клуб раннего доступа и программы приоритетного бронирования квартир.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 pt-2">3. Порядок отзыва согласия:</h3>
          <p>
            Я проинформирован(а) о том, что имею безусловное право в любое время отказаться от получения рекламных
            сообщений одним из следующих способов:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Нажатием на ссылку «Отписаться от рассылки» в нижней части любого электронного письма;
            </li>
            <li>
              Путем направления электронного сообщения с пометкой «Отказ от рассылки» на адрес:{' '}
              <a href={`mailto:${profile.privacyEmail}`} className="text-emerald-700 font-bold underline">
                {profile.privacyEmail}
              </a>
              ;
            </li>
            <li>
              Через переключатель уведомлений в личном кабинете на платформе.
            </li>
          </ul>
          <p className="text-xs text-slate-500 pt-2">
            Компания обязуется прекратить направление рекламных материалов не позднее 24 часов с момента получения
            соответствующего уведомления.
          </p>
        </div>

      </div>
    </div>
  );
};
