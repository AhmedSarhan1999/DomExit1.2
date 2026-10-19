import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Building2,
  Clock,
  Landmark,
  FileCheck,
  Users,
  Send,
  HelpCircle,
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  const { language } = useLanguage();
  const [activeTrack, setActiveTrack] = useState<'seller' | 'buyer'>('seller');

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* 1. Header & 4 Indicator Cards */}
      <section className="bg-white text-slate-900 pt-14 pb-20 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
          
          <div className="space-y-3 max-w-3xl mx-auto">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
              <span>{language === 'ru' ? 'Стандарт безопасной переуступки 214-ФЗ' : '214-FZ Safe Assignment Standard'}</span>
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
              {language === 'ru'
                ? 'Как мы работаем? Прозрачный процесс на каждом этапе'
                : 'How We Work: Transparent Process at Every Stage'}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              {language === 'ru'
                ? 'Полный институциональный цикл: от закрытого экспресс-аудита до электронной регистрации уступки права в Росреестре за 48 часов.'
                : 'Full institutional lifecycle: from confidential express audit to digital Rosreestr registration in 48 hours.'}
            </p>
          </div>

          {/* Switch tabs */}
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 mx-auto">
            <button
              type="button"
              onClick={() => setActiveTrack('seller')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTrack === 'seller'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'ru' ? 'Владельцу / Продавцу 0% комиссия' : 'For Sellers (0% Fee)'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTrack('buyer')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTrack === 'buyer'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'ru' ? 'Инвестору / Покупателю Скидка до 30%' : 'For Buyers (Up to -30%)'}
            </button>
          </div>

          {/* 4 Top Indicator Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto pt-4 text-left">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm">
              <span className="text-2xl font-black text-emerald-600 block">0%</span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {language === 'ru' ? 'Комиссия продавца' : 'Seller Commission'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {language === 'ru' ? '100% возврат внесенных денег' : '100% refund of deposited cash'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm">
              <span className="text-2xl font-black text-sky-600 block">3–7 дней</span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {language === 'ru' ? 'Срок подбора покупателя' : 'Matching Timeframe'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {language === 'ru' ? 'Через закрытый пул инвесторов' : 'Via private investor pool'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm">
              <span className="text-2xl font-black text-amber-600 block">Аккредитив</span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {language === 'ru' ? 'Банки топ-10 РФ' : 'Top 10 Russian Banks'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {language === 'ru' ? 'Сбербанк, ВТБ, Альфа' : 'Sberbank, VTB, Alfa'}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 shadow-sm">
              <span className="text-2xl font-black text-emerald-600 block">24 часа</span>
              <span className="text-xs font-bold text-slate-900 mt-1 block">
                {language === 'ru' ? 'Полный аудит лота' : 'Full Lot Audit'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {language === 'ru' ? 'Чек-лист 42 параметра' : '42-parameter checklist'}
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* 2. Two Parallel Tracks (Columns Side by Side) */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            {language === 'ru' ? 'Два параллельных трека сделки' : 'Two Parallel Transaction Tracks'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {language === 'ru'
              ? 'Прозрачные шаги для обеих сторон: максимальная защита капитала и гарантия закрытия'
              : 'Clear steps for both parties: maximum capital protection and closing guarantee'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* Left Column: Seller's Path (5 numbered steps) */}
          <div className="bg-white rounded-3xl border-2 border-emerald-500/40 p-6 sm:p-8 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'ru' ? 'Путь продавца квартиры' : 'Seller Path (0% Commission)'}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {language === 'ru' ? '0% комиссии' : '0% fee'}
                </span>
              </div>

              {/* 5 Steps */}
              <div className="space-y-4 text-xs">
                
                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Оцените договор онлайн' : '1. Evaluate Contract Online'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Введите параметры ДДУ в калькуляторе и мгновенно зафиксируйте сумму 100% возврата денег без штрафа девелопера (10%–15%).'
                        : 'Input contract terms into calculator to lock 100% refund without 10%-15% penalty.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Загрузите документы' : '2. Upload Documents'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Безопасная передача скана ДДУ и справки о взаиморасчетах через закрытый шлюз по 152-ФЗ. Юристы проводят экспресс-аудит за 2 часа.'
                        : 'Encrypted transfer under 152-FZ. Attorneys run express compliance check in 2 hours.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Упаковка лота и конфиденциальность' : '3. Packaging & Confidentiality'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Скрываем точный этаж и номер квартиры во избежание санкций девелопера. Применяем AI-маскирование персональных печатей на планировке.'
                        : 'Mask exact floor and personal data. AI anonymization of floorplans.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Мгновенный подбор покупателя' : '4. Buyer Matching'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Публикация в закрытом VIP Telegram-клубе инвесторов с гандикапом 48 часов. Фиксация брони с подтвержденным кэшем.'
                        : 'Broadcast to VIP TG investor club with 48h head start. Verified cash reservations.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                    5
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Перевод договора и выплата 100%' : '5. Assignment & 100% Payout'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Подписание договора уступки (цессии) с ЭЦП. Внесение средств покупателем на банковский аккредитив и выплата продавцу за 10 минут после Росреестра.'
                        : 'Digital assignment agreement signing. Buyer deposits in escrow; seller paid in 10 minutes after EGRN.'}
                    </p>
                  </div>
                </div>

              </div>

            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/sellers"
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <span>{language === 'ru' ? 'Начать оценку договора (0%) ->' : 'Start Contract Evaluation (0%) ->'}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </Link>
            </div>
          </div>

          {/* Right Column: Buyer / Investor Path (5 numbered steps) */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600" />
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'ru' ? 'Путь инвестора / Покупателя' : 'Buyer / Investor Path'}
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                  {language === 'ru' ? 'Скидка до 30%' : 'Discount up to 30%'}
                </span>
              </div>

              {/* 5 Steps */}
              <div className="space-y-4 text-xs">
                
                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Выберите лот в каталоге' : '1. Choose Lot in Catalog'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Все объекты зафиксированы строго по старым ценам договоров ДДУ без риелторских наценок и скрытых комиссий.'
                        : 'All properties strictly priced at historical DDU prices with 0% markup.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Проверьте юридическую чистоту' : '2. Legal Passport Audit'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Изучите паспорт лота: 42 параметра проверки, антибанкротный индекс продавца 98/100, справки об отсутствии обременений.'
                        : 'Review 42-point checklist, anti-bankruptcy score 98/100, and debt clearance.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Бесплатная бронь лота' : '3. Free Unit Reservation'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Фиксация объекта за 0 ₽ без задатков. Юристы DomExit закрепляют за вами персонального куратора и готовят проект цессии.'
                        : 'Zero deposit hold. Dedicated curator assigned to prepare assignment package.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Согласование цессии' : '4. Developer Assignment Consent'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Мы берем на себя взаимодействие с застройщиком (Setl Group, ПИК, ЛСР). Получаем официальное согласие девелопера на уступку.'
                        : 'We obtain formal written approval directly from the developer.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-900 font-black flex items-center justify-center shrink-0">
                    5
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {language === 'ru' ? 'Росреестр, раскрытие и ключи' : '5. Rosreestr & Keys'}
                    </h4>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">
                      {language === 'ru'
                        ? 'Деньги заморожены на аккредитиве Сбербанка/ВТБ. Вы оплачиваете комиссию 2.5% только после подтверждения перехода права в ЕГРН.'
                        : 'Escrow release occurs only after EGRN title verification. Buyer pays 2.5% fee.'}
                    </p>
                  </div>
                </div>

              </div>

            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                to="/opportunities"
                className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <span>{language === 'ru' ? 'Смотреть проверенные лоты ->' : 'Explore Verified Units ->'}</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </Link>
            </div>
          </div>

        </div>

      </section>

      {/* 3. Banking Money Flow Diagram */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">
              {language === 'ru' ? 'Куда идут деньги при цессии?' : 'Where Does the Money Go During Assignment?'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {language === 'ru'
                ? 'Полный запрет расчетов «наличными на руки». Защита обеих сторон через банковский аккредитив'
                : 'Zero cash-in-hand handovers. Full protection via banking letter of credit'}
            </p>
          </div>

          {/* 4-Step Flowchart Container */}
          <div className="bg-slate-50 border border-slate-200 text-slate-900 rounded-3xl p-6 sm:p-10 shadow-sm space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-black flex items-center justify-center text-xs">
                  01
                </span>
                <h4 className="text-sm font-bold text-slate-900">Покупатель</h4>
                <p className="text-xs text-slate-600">
                  Открытие безопасного безотзывного аккредитива в Сбербанке или ВТБ.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 font-black flex items-center justify-center text-xs">
                  02
                </span>
                <h4 className="text-sm font-bold text-slate-900">Банк РФ (Эскроу)</h4>
                <p className="text-xs text-slate-600">
                  Сумма блокируется на специальном номинальном счете до выполнения условий сделки.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                  03
                </span>
                <h4 className="text-sm font-bold text-slate-900">Росреестр</h4>
                <p className="text-xs text-slate-600">
                  Электронная регистрация перехода прав по 214-ФЗ с усиленной ЭЦП в течение 48 часов.
                </p>
              </div>

              <div className="bg-emerald-50/80 rounded-2xl p-5 border-2 border-emerald-500 shadow-xs space-y-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-xs">
                  04
                </span>
                <h4 className="text-sm font-bold text-emerald-800">Продавец (100% Выплата)</h4>
                <p className="text-xs text-emerald-700">
                  Автоматическое раскрытие аккредитива и выплата денег за 10 минут по факту выписки ЕГРН.
                </p>
              </div>

            </div>

            {/* Bank Logos Bar */}
            <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-center gap-8 text-xs font-bold text-slate-600">
              <span className="text-slate-500">Институциональные банковские партнеры:</span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-emerald-700 font-black shadow-xs">ПАО СБЕРБАНК</span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sky-700 font-black shadow-xs">БАНК ВТБ</span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-rose-700 font-black shadow-xs">АЛЬФА-БАНК</span>
            </div>
          </div>

        </div>
      </section>

      {/* 4. Fair Exit Standards Grid (2x2) */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">
            {language === 'ru' ? 'Стандарты честного выхода DomExit' : 'DomExit Fair Exit Standards'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            {language === 'ru'
              ? '4 базовых принципа, на которых строится каждая сделка на платформе'
              : '4 fundamental principles governing every transaction on the platform'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Каждая цифра подтверждена документально</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Мы не принимаем на платформу объекты без официальной справки девелопера о взаиморасчетах и выписки из ЕИСЖС.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">0% комиссии для продавца</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Человек в трудной финансовой ситуации не должен платить за выход. Комиссию сервиса 2.5% оплачивает покупатель за найденную выгоду.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">100% конфиденциальность</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Персональные данные изолированы по стандарту ГОСТ Р 57580. Номер квартиры и этаж скрываются от публичного доступа.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Landmark className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Полная защита от банкротства</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Формируем официальную правовую справку добросовестного приобретателя по ст. 61.2 ФЗ-127, исключая любые риски оспаривания.
            </p>
          </div>

        </div>

        {/* Bottom Consultation Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-xl font-bold text-slate-900">
              {language === 'ru' ? 'Остались вопросы по регламенту цессии?' : 'Questions About Assignment Protocol?'}
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              {language === 'ru'
                ? 'Дежурный юрист платформы проконсультирует вас по материнскому капиталу, военной ипотеке или сложным случаям с девелопером.'
                : 'Our duty attorney will advise on maternal capital, military mortgage or complex developer terms.'}
            </p>
          </div>
          <a
            href="https://t.me/domexit_ru"
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-2 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>{language === 'ru' ? 'Задать вопрос юристу в Telegram' : 'Ask Attorney in Telegram'}</span>
          </a>
        </div>

      </section>

    </div>
  );
};
