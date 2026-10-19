import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Quote,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Scale,
  Award,
  ArrowRight,
  Send,
} from 'lucide-react';

export const StoryPage: React.FC = () => {
  const { language } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Founder's Executive Banner (Bright Light Theme) */}
      <section className="bg-white text-slate-900 pt-14 pb-20 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: Founder Card */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200/90 rounded-3xl p-6 shadow-sm relative overflow-hidden text-center sm:text-left">
                <div className="w-28 h-28 rounded-2xl bg-gradient-to-tr from-emerald-500 to-sky-600 mx-auto sm:mx-0 p-1 mb-4 shadow-md">
                  <div className="w-full h-full bg-emerald-600 rounded-[14px] flex items-center justify-center font-black text-3xl text-white">
                    АВ
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-900">Александр Васильев</h3>
                  <p className="text-xs text-emerald-700 font-semibold">
                    Основатель платформы DomExit • Экс-директор по развитию девелопмента
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-6 mt-4 border-t border-slate-200 text-left">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-lg font-black text-slate-900 block">12+ лет</span>
                    <span className="text-[11px] text-slate-500">в девелопменте и PropTech</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                    <span className="text-lg font-black text-emerald-600 block">133 млрд ₽</span>
                    <span className="text-[11px] text-slate-500">реестр проверенных ДДУ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: The Question & Quote */}
            <div className="lg:col-span-7 space-y-6">
              
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                <Quote className="w-3.5 h-3.5" />
                <span>История началась с простого вопроса...</span>
              </span>

              <blockquote className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug tracking-tight">
                «Почему человек должен терять миллионы рублей своих сбережений только потому, что больше не может продолжать платить рассрочку?»
              </blockquote>

              <div className="bg-slate-50 border-l-4 border-emerald-500 p-5 rounded-r-2xl text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 border-y border-r border-slate-200/60">
                <p>
                  Рынок новостроек Санкт-Петербурга и Москвы переживает тектонический сдвиг. В 2023–2024 годах тысячи семей приобрели квартиры в рассрочку от застройщиков в надежде перейти на ипотеку перед вводом дома. Но взлет ключевой ставки до 21% закрыл эту возможность.
                </p>
                <p>
                  Стандартный рынок предлагал лишь два губительных пути: потерять 15% штрафа при расторжении с девелопером или месяцами безуспешно продавать лот на Авито. Мы создали DomExit как третий — честный и математически безупречный путь.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="#manifesto"
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  Читать манифест рынка
                </a>
                <a
                  href="#principles"
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-colors"
                >
                  3 принципа платформы
                </a>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 2. Market Crisis Anatomy & Triple-Win Model */}
      <section id="manifesto" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
            Анализ рынка недвижимости 2024–2026
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Анатомия кризиса рассрочек и рождение честной альтернативы
          </h2>
          <p className="text-sm text-slate-600">
            Почему традиционные инструменты риелторов больше не работают в сегменте строящегося жилья
          </p>
        </div>

        {/* 2 Problem Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <TrendingDown className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">ФАКТОР 01</span>
            </div>
            <h3 className="text-xl font-bold text-slate-950">
              «Ловушка переходного периода»
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Девелоперы массово выдавали программы «10/90» и «20/80» с отсрочкой основного платежа до конца 2025–2026 годов. При текущей ставке ЦБ рефинансировать этот остаток в базовую ипотеку под 22%–25% годовых для большинства покупателей стало экономически невозможно: ежемесячный платеж вырос в 3.5 раза.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">ФАКТОР 02</span>
            </div>
            <h3 className="text-xl font-bold text-slate-950">
              «Тупик стандартного рынка»
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              При попытке расторгнуть договор девелопер удерживает до 15% от полной стоимости квартиры (штраф 1.5–2 млн рублей) и затягивает возврат остатка на 6–18 месяцев. Агентства недвижимости не умеют работать с обременениями рассрочки и требуют непомерные комиссии.
            </p>
          </div>

        </div>

        {/* Wide Emerald Triple-Win Solution Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-black uppercase tracking-widest bg-emerald-950/40 px-3 py-1 rounded-full text-emerald-200">
              НАШЕ РЕШЕНИЕ
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              МОДЕЛЬ ТРОЙНОГО ВЫИГРЫША (TRIPLE WIN)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs sm:text-sm">
            <div className="bg-emerald-950/30 backdrop-blur-md rounded-2xl p-5 border border-emerald-400/20 space-y-2">
              <span className="text-emerald-300 font-bold uppercase text-[11px] block">Выигрыш продавца</span>
              <h4 className="font-bold text-white text-base">100% Возврат средств</h4>
              <p className="text-emerald-100 leading-relaxed">
                Получает ровно ту сумму, которую перечислил застройщику. 0% комиссий, 0% удержаний, деньги на руках через 7–14 дней.
              </p>
            </div>

            <div className="bg-emerald-950/30 backdrop-blur-md rounded-2xl p-5 border border-emerald-400/20 space-y-2">
              <span className="text-emerald-300 font-bold uppercase text-[11px] block">Выигрыш покупателя</span>
              <h4 className="font-bold text-white text-base">Старая цена 2023–2024 гг.</h4>
              <p className="text-emerald-100 leading-relaxed">
                Покупает проверенную квартиру на 20%–30% дешевле текущего прайса девелопера с сохранением первоначального графика рассрочки.
              </p>
            </div>

            <div className="bg-emerald-950/30 backdrop-blur-md rounded-2xl p-5 border border-emerald-400/20 space-y-2">
              <span className="text-emerald-300 font-bold uppercase text-[11px] block">Выигрыш девелопера</span>
              <h4 className="font-bold text-white text-base">Платежеспособный дольщик</h4>
              <p className="text-emerald-100 leading-relaxed">
                Застройщик избегает дефолта по эскроу-счету, судебных издержек и получает финансово надежного нового участника строительства.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* 3. Three Institutional Principles */}
      <section id="principles" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Три институциональных принципа DomExit
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Непреложные правила работы, которые защищают каждого участника платформы
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm">
                01
              </span>
              <h3 className="text-lg font-bold text-slate-950">
                0% наценок и скрытых комиссий
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Мы категорически запрещаем искусственное завышение стоимости. Цена квартиры в договоре цессии строго равна сумме фактически внесенных денег плюс остаток задолженности перед застройщиком.
              </p>
            </div>

            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm">
                02
              </span>
              <h3 className="text-lg font-bold text-slate-950">
                100% документальная верификация (42 параметра)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ни один лот не публикуется на витрине без комплексного скоринга по базам ЕФРСБ, ФССП, НБКИ, проверки использования маткапитала и нотариального согласия супругов.
              </p>
            </div>

            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 space-y-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm">
                03
              </span>
              <h3 className="text-lg font-bold text-slate-950">
                Институциональная безопасность (Эскроу по 214-ФЗ)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Все финансовые потоки проходят исключительно через номинальные счета и аккредитивы ПАО Сбербанк и ВТБ. Раскрытие средств продавцу происходит строго после электронной регистрации Росреестра.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Key Milestones Timeline */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Ключевые вехи развития
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            От юридического эксперимента до федерального стандарта переуступки
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 shadow-sm">
            <span className="text-emerald-600 font-black text-lg">2023 год</span>
            <h3 className="text-sm font-bold text-slate-900">Идея и юридический протокол</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Разработка правового регламента цессии при рассрочках с ведущими юристами Санкт-Петербурга. Первые 50 тестовых выходов без штрафов.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 shadow-sm">
            <span className="text-emerald-600 font-black text-lg">2024 год</span>
            <h3 className="text-sm font-bold text-slate-900">Запуск платформы и 500 сделок</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Прямая интеграция со шлюзами Росреестра и аккредитивами Сбербанка. Запуск закрытого VIP Telegram-сообщества инвесторов.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-2 shadow-sm">
            <span className="text-emerald-600 font-black text-lg">2025–2026 гг.</span>
            <h3 className="text-sm font-bold text-slate-900">Федеральный статус — 9,200+ квартир</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Официальное партнерство с отделами расторжений крупнейших застройщиков (Setl Group, ПИК, ЛСР). Объем активов превысил 133 млрд ₽.
            </p>
          </div>
        </div>

        {/* Bottom Contact Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-bold text-slate-900">Обсудить сотрудничество или предложить лот</h3>
            <p className="text-xs text-slate-600">
              Работаем с дольщиками, семейными офисами, банками и застройщиками
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/sellers"
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              Предложить квартиру (0%)
            </Link>
            <Link
              to="/investors"
              className="px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 shadow-xs transition-all"
            >
              Инвестировать
            </Link>
          </div>
        </div>

      </section>

    </div>
  );
};
