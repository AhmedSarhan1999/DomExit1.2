import React from 'react';
import { Link } from 'react-router-dom';
import { Share2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { useCompanyProfileStore } from '../../stores/useCompanyProfileStore';

export const ConsentDistributionPage: React.FC = () => {
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
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Статья 10.1 Федерального закона № 152-ФЗ
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
                Согласие на распространение персональных данных (отзывы и кейсы)
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Регулирует публикацию отзывов, кейсов закрытых сделок и историй успеха в публичном пространстве.
          </p>
        </div>

        {/* Form Body */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 text-sm leading-relaxed text-slate-700">
          <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-950 space-y-1">
            <strong>Правило платформы DomExit по умолчанию:</strong>
            <p>
              Все отзывы и кейсы закрытия сделок на сайте публикуются в строго обезличенной форме (пример:{' '}
              <em>«Алексей С., г. Санкт-Петербург — возврат 2 485 230 ₽»</em>) без раскрытия паспортных данных, полных
              фамилий, адресов квартир и номеров договоров.
            </p>
          </div>

          <p>
            Настоящим, в случае направления отзыва, фото- или видеоматериалов с церемонии подписания цессии либо
            участия в интервью, субъект персональных данных дает согласие {profile.fullName} (ИНН: {profile.inn}) на
            распространение следующих данных неограниченному кругу лиц:
          </p>

          <h3 className="text-base font-bold text-slate-900 pt-2">
            1. Категории данных, разрешенных к распространению:
          </h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Имя и первая буква фамилии (или псевдоним по выбору субъекта);</li>
            <li>Город проживания и наименование жилого комплекса (без указания номера квартиры);</li>
            <li>Сумма возвращенного или сэкономленного капитала;</li>
            <li>Текст добровольного отзыва и согласованная фотография/видеозапись;</li>
            <li>Срок завершения сделки и наименование финансирующего банка-партнера.</li>
          </ul>

          <h3 className="text-base font-bold text-slate-900 pt-2">
            2. Запреты и условия обработки (ч. 9 ст. 10.1 ФЗ-152):
          </h3>
          <p>
            Субъект вправе установить запреты на передачу (кроме предоставления доступа) этих данных Оператором, а
            также запреты на обработку или условия обработки (кроме получения доступа) этих данных третьими лицами.
            Категорически запрещается использование данных в целях, порочащих честь, достоинство и деловую репутацию.
          </p>

          <h3 className="text-base font-bold text-slate-900 pt-2">3. Порядок прекращения распространения:</h3>
          <p>
            Действие согласия прекращается немедленно по первому требованию субъекта данных. Заявление об отзыве
            согласия на распространение направляется на адрес:{' '}
            <a href={`mailto:${profile.privacyEmail}`} className="text-emerald-700 font-bold underline">
              {profile.privacyEmail}
            </a>
            . Оператор удаляет публикацию из общего доступа в течение 3 (трех) рабочих дней.
          </p>
        </div>

      </div>
    </div>
  );
};
