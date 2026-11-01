import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Building2, Mail, Phone, MapPin, Landmark } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';

export const PrivacyPolicyPage: React.FC = () => {
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Федеральный закон № 152-ФЗ «О персональных данных»
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Политика в отношении обработки персональных данных
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
            <span>Редакция: 2.1-2026</span>
            <span>•</span>
            <span>Дата актуализации: {new Date(profile.updatedAt).toLocaleDateString('ru-RU')}</span>
            <span>•</span>
            <span>Оператор: {profile.fullName}</span>
          </div>
        </div>

        {/* Requisites Quick Summary Box */}
        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-5 space-y-3 text-xs text-emerald-950">
          <div className="font-black text-sm flex items-center space-x-2 text-emerald-900">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>Реквизиты оператора персональных данных:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 leading-relaxed">
            <div>
              <strong>Оператор:</strong> {profile.fullName} ({profile.shortName})
            </div>
            <div>
              <strong>ИНН / КПП:</strong> {profile.inn} / {profile.kpp}
            </div>
            <div>
              <strong>ОГРН:</strong> {profile.ogrn}
            </div>
            <div>
              <strong>Ответственный за организацию обработки ПД (DPO):</strong> {profile.dpoName}
            </div>
            <div className="sm:col-span-2">
              <strong>Адрес места нахождения:</strong> {profile.legalAddress}
            </div>
            <div>
              <strong>Email для обращений:</strong>{' '}
              <a href={`mailto:${profile.privacyEmail}`} className="underline font-bold text-emerald-800">
                {profile.privacyEmail}
              </a>
            </div>
            <div>
              <strong>Официальный телефон:</strong> {profile.officialPhone}
            </div>
          </div>
        </div>

        {/* Document Content: 11 Full Sections */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-8 text-sm leading-relaxed text-slate-700">
          
          {/* Section 1 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">1. Общие положения</h2>
            <p>
              1.1. Настоящая Политика оператора {profile.fullName} (далее — «Оператор») определяет порядок и
              условия обработки персональных данных, а также устанавливает меры по обеспечению безопасности
              персональных данных в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ
              «О персональных данных» (далее — «Закон № 152-ФЗ»).
            </p>
            <p>
              1.2. Обеспечение прав и свобод граждан при обработке их персональных данных, включая защиту прав
              на неприкосновенность частной жизни, личную и семейную тайну, является безусловным приоритетом в
              деятельности сервиса «DomExit».
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">2. Принципы обработки персональных данных</h2>
            <p>
              2.1. Обработка персональных данных осуществляется на законной и справедливой основе.
            </p>
            <p>
              2.2. Обработка персональных данных ограничивается достижением конкретных, заранее определенных и
              законных целей. Не допускается обработка данных, несовместимая с целями их сбора.
            </p>
            <p>
              2.3. Содержание и объем обрабатываемых персональных данных соответствуют заявленным целям обработки.
              Оператор категорически не допускает обработку избыточных данных по отношению к заявленным целям.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              3. Категории субъектов и объем обрабатываемых данных
            </h2>
            <p>3.1. Оператор осуществляет обработку данных следующих категорий субъектов:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Пользователи платформы (покупатели и продавцы прав по договорам ДДУ 214-ФЗ);</li>
              <li>Представители девелоперов, генеральных подрядчиков и банков-партнеров;</li>
              <li>Сотрудники, кураторы и партнеры платформы.</li>
            </ul>
            <p>3.2. К обрабатываемым данным относятся:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Фамилия, имя, отчество;</li>
              <li>Контактный номер телефона РФ (+7);</li>
              <li>Адрес электронной почты;</li>
              <li>Идентификационные данные документов (реквизиты ДДУ, чеков и справок об оплате);</li>
              <li>Технические метаданные (IP-адрес, cookie, user-agent) в обезличенном виде.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">4. Цели обработки персональных данных</h2>
            <p>Обработка персональных данных осуществляется в целях:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Исполнения Пользовательского соглашения и содействия в совершении сделок уступки прав (цессии)
                по 214-ФЗ;
              </li>
              <li>
                Организации безопасных расчетов через сервис безопасных расчетов (СБР) и эскроу в уполномоченных
                банках ({profile.bankName} и др.);
              </li>
              <li>
                Юридического аудита (42 контрольные точки комплаенса ДДУ) и проверки отсутствия задолженностей;
              </li>
              <li>
                Направления сервисных уведомлений о ходе сделки и с согласия пользователя — информационных
                материалов (ст. 18 ФЗ-38).
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">5. Правовые основания обработки</h2>
            <p>
              Правовыми основаниями обработки являются: Конституция РФ, Гражданский кодекс РФ, Федеральный закон
              № 214-ФЗ, Федеральный закон № 152-ФЗ, Устав Оператора, договоры, заключаемые между Оператором и
              субъектами, а также явные согласия субъектов персональных данных.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              6. Локализация баз данных на территории Российской Федерации
            </h2>
            <p>
              В соответствии с частью 5 статьи 18 Закона № 152-ФЗ Оператор гарантирует, что при сборе персональных
              данных граждан РФ запись, систематизация, накопление, хранение, уточнение (обновление, изменение) и
              извлечение данных осуществляются с использованием баз данных, находящихся исключительно на территории
              Российской Федерации в защищенном контуре российской облачной платформы (Yandex Cloud).
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">7. Порядок сбора, хранения и защиты данных</h2>
            <p>
              7.1. Безопасность данных обеспечивается правовыми, организационными и техническими мерами
              (шифрование при передаче TLS 1.3, контроль доступа на уровне ролей RBAC, изоляция банковских
              тенантов, протоколирование действий операторов).
            </p>
            <p>
              7.2. Оператор применяет технологию маскирования персональных данных (Data Masking Layer) при
              автоматизированном анализе документации, исключая раскрытие чувствительных сведений третьим лицам.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              8. Условия трансграничной передачи данных
            </h2>
            <p>
              Трансграничная передача персональных данных пользователей Оператором категорически не осуществляется.
              Все операции производятся строго в российской юрисдикции.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              9. Актуализация, исправление и уничтожение персональных данных
            </h2>
            <p>
              9.1. Субъект персональных данных вправе требовать уточнения своих данных, их блокирования или
              уничтожения при неполноте, устаревании или незаконности обработки.
            </p>
            <p>
              9.2. В случае выявления неправомерной обработки или отзыва согласия Оператор прекращает обработку и
              уничтожает соответствующие данные в срок, не превышающий 10 (десяти) рабочих дней с даты получения
              требования, направленного на электронный адрес {profile.privacyEmail}.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">10. Права субъектов персональных данных</h2>
            <p>
              Субъект имеет право на получение сведений об обработке его данных, об операторе, источниках
              получения, сроках обработки, а также право на обжалование любых неправомерных действий в
              Роскомнадзор или в судебном порядке.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-2">
            <h2 className="text-lg font-black text-slate-900">
              11. Заключительные положения и контакты DPO
            </h2>
            <p>
              По любым вопросам исполнения настоящей Политики и защиты прав субъектов персональных данных вы
              можете обратиться к лицу, ответственному за организацию обработки персональных данных (DPO):
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 font-mono text-xs">
              <div>ФИО: {profile.dpoName}</div>
              <div>Организация: {profile.fullName}</div>
              <div>Email: {profile.privacyEmail}</div>
              <div>Телефон: {profile.officialPhone}</div>
              <div>Адрес: {profile.postalAddress}</div>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};
