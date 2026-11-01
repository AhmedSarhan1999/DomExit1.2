import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';

export const ConsentPdPage: React.FC = () => {
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Статья 9 Федерального закона № 152-ФЗ
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Согласие на обработку персональных данных
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Настоящее согласие является конкретным, информированным и сознательным выражением воли субъекта
            персональных данных.
          </p>
        </div>

        {/* Consent Form Body */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 text-sm leading-relaxed text-slate-700">
          <p>
            Я, регистрируясь, заполняя формы заявки (на выход из ДДУ, покупку лота, инвестирование или партнерство) на
            интернет-сайте сервиса «DomExit», действуя свободно, своей волей и в своем интересе, в соответствии со
            ст. 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных», даю свое согласие:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-1 text-xs">
            <div className="font-bold text-slate-900 text-sm">Оператор:</div>
            <div>
              <strong>{profile.fullName}</strong> ({profile.shortName})
            </div>
            <div>ИНН: {profile.inn} | ОГРН: {profile.ogrn}</div>
            <div>Адрес: {profile.legalAddress}</div>
            <div>Email DPO: {profile.privacyEmail}</div>
          </div>

          <h3 className="text-base font-bold text-slate-900 pt-2">
            1. Перечень персональных данных, на обработку которых дается согласие:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Фамилия, имя, отчество;</li>
            <li>Контактный номер телефона РФ (+7);</li>
            <li>Адрес электронной почты;</li>
            <li>Сведения о правах требования по договору участия в долевом строительстве (214-ФЗ);</li>
            <li>
              Пользовательские обезличенные данные (тип устройства, IP-адрес, файлы cookie в соответствии с
              настройками).
            </li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 pt-2">
            2. Перечень действий с персональными данными и цели их обработки:
          </h3>
          <p>
            Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение,
            использование, обезличивание, блокирование, удаление, уничтожение персональных данных с использованием
            средств автоматизации на серверах в РФ (Yandex Cloud) в целях:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Предоставления функционала платформы «DomExit»;</li>
            <li>Юридической экспертизы документов и структурирования безопасной цессии;</li>
            <li>
              Взаимодействия с банками-партнерами ({profile.bankName} и др.) для открытия СБР и аккредитивов;
            </li>
            <li>Связи с субъектом данных, направления сервисных статусов и выписок.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 pt-2">
            3. Срок действия согласия и порядок его отзыва:
          </h3>
          <p>
            Настоящее согласие действует с момента его предоставления до момента достижения целей обработки или до
            момента его отзыва.
          </p>
          <p>
            Согласие может быть отозвано субъектом персональных данных в любой момент путем направления письменного
            заявления в свободной форме на электронную почту Оператора:{' '}
            <a href={`mailto:${profile.privacyEmail}`} className="text-emerald-700 font-bold underline">
              {profile.privacyEmail}
            </a>
            . Оператор прекращает обработку персональных данных и уничтожает их в срок, не превышающий 10 рабочих дней
            с момента получения отзыва.
          </p>
        </div>

      </div>
    </div>
  );
};
