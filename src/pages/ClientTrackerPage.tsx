import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Lock,
  Download,
  Eye,
  Plus,
  Send,
  AlertTriangle,
  ArrowRight,
  User,
  Check,
  X,
  FileText,
} from 'lucide-react';

export const ClientTrackerPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const { language } = useLanguage();

  const [selectedOffer, setSelectedOffer] = useState<string>('B-409');
  const [offersStatus, setOffersStatus] = useState<Record<string, string>>({
    'B-409': 'selected',
    'B-412': 'reserve',
    'B-415': 'pending',
  });

  const handleSelectOffer = (code: string) => {
    setSelectedOffer(code);
    setOffersStatus({
      ...offersStatus,
      [code]: 'selected',
    });
    alert(`Покупатель #${code} выбран для фиксации сделки на аккредитиве Сбербанка`);
  };

  const handleDeclineOffer = (code: string) => {
    setOffersStatus({
      ...offersStatus,
      [code]: 'declined',
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 pb-20">
      
      {/* 1. Client Topbar - screen_12.jpg */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-black text-slate-950">DomExit</span>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                PRO
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-4 text-xs font-semibold text-slate-600">
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">Мои сделки (1)</span>
              <Link to="/opportunities" className="hover:text-slate-900">Каталог ДДУ</Link>
              <Link to="/investors" className="hover:text-slate-900">Инвесторам</Link>
              <Link to="/how-it-works" className="hover:text-slate-900">Юридический аудит 214-ФЗ</Link>
            </nav>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Шифрование 256-bit</span>
            </span>
            <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs border border-emerald-200">
                АВ
              </div>
              <span className="font-bold text-slate-900 hidden sm:block">
                Александр В. (Продавец ДДУ)
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* 2. Welcome Card & On-Duty Lawyer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Синхронизировано с ЕИСЖС (214-ФЗ)</span>
              </span>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Эскроу Сбербанка</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-950">
              Здравствуйте, Александр! Статус вашего выхода по ЖК «Чистое Небо» (Лот #U-10566)
            </h1>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                Номинал выплаты: 2,485,230 ₽
              </span>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                0% комиссии продавца (100% возврат)
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ID сделки: {dealId || 'DEAL-2025-10566'}
              </span>
            </div>
          </div>

          {/* On-Duty Lawyer Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center space-x-4 shrink-0 w-full lg:w-auto">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
              АС
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-900 block">Алексей Смирнов</span>
              <span className="text-[11px] text-slate-500 block">Дежурный юрист по 214-ФЗ</span>
              <a
                href="https://t.me/domexit_ru"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all"
              >
                <Send className="w-3 h-3 text-white" />
                <span>Связаться в Telegram</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3. Live 5-Step Progress Card & Buyer Offers */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8">
          
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <h2 className="font-bold text-slate-900 uppercase tracking-wider text-sm">
                Текущий статус сделки в реальном времени
              </h2>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg">
                Прогресс ликвидации: 75% завершено • Шаг 4 из 5 в работе
              </span>
            </div>

            {/* 5 Stages Horizontal Row */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-emerald-700 text-xs font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>1. Оценка договора</span>
                </span>
                <span className="text-[11px] text-slate-500 block">Готово (100% возврат)</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-emerald-700 text-xs font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>2. Проверка документов</span>
                </span>
                <span className="text-[11px] text-slate-500 block">Готово (42 параметра)</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                <span className="text-emerald-700 text-xs font-bold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>3. Упаковка и публикация</span>
                </span>
                <span className="text-[11px] text-slate-500 block">Готово (В закрытом пуле)</span>
              </div>

              {/* ACTIVE STAGE 4 in Emerald Border */}
              <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-emerald-950 text-xs font-black flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>4. Подбор покупателя</span>
                </span>
                <span className="text-[11px] text-emerald-800 font-bold block">
                  В РАБОТЕ СЕЙЧАС (3 оффера)
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1 opacity-60">
                <span className="text-slate-500 text-xs font-bold block">
                  5. Сделка и выплата
                </span>
                <span className="text-[11px] text-slate-400 block">Ожидание согласования</span>
              </div>

            </div>
          </div>

          {/* Section: Incoming Buyer Offers (3 Offers) */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Поступившие офферы от проверенных покупателей (3)
              </h3>
              <span className="text-xs text-slate-500">
                Все кандидаты подтвердили наличие средств
              </span>
            </div>

            <div className="space-y-3">
              
              {/* Offer 1: B-409 Priority */}
              <div className="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-black text-sm text-slate-900">Покупатель #B-409</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                      ПРИОРИТЕТ
                    </span>
                    <span className="text-xs font-semibold text-emerald-800">
                      100% собственные средства (кэш) • В течение 48 часов
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Готов депонировать полную сумму <strong>2,485,230 ₽</strong> на аккредитив Сбербанка без ожидания ипотек.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectOffer('B-409')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all shrink-0"
                >
                  ✓ Выбрать для фиксации задатка
                </button>
              </div>

              {/* Offer 2: B-412 Sber Family Mortgage */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-slate-900">Покупатель #B-412</span>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold uppercase">
                      ОДОБРЕНО
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Семейная ипотека Сбербанк • 3–4 рабочих дня
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Первоначальный взнос 2.5 млн ₽ подтвержден справкой. Слот на сделку в отделении Сбера открыт.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectOffer('B-412')}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors shrink-0"
                >
                  Рассмотреть резервный
                </button>
              </div>

              {/* Offer 3: B-415 Installment Transfer */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-sm text-slate-900">Покупатель #B-415</span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                      НА РАССМОТРЕНИИ
                    </span>
                    <span className="text-xs font-semibold text-slate-700">
                      Рассрочка до ввода дома • Статус юриста: Не рекомендован
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Предлагает отсрочку первого взноса на 10 дней. Высокий риск затягивания сроков.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeclineOffer('B-415')}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-semibold text-xs transition-colors shrink-0"
                >
                  Отклонить оффер
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* 4. Bottom 2 Parallel Sections: Documents & Benefit Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Uploaded Documents */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900">Ваши загруженные документы</h3>
                <span className="text-[11px] text-slate-500">152-ФЗ и банковская тайна</span>
              </div>
              <button
                type="button"
                onClick={() => alert('Форма добавления документа')}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить документ</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { name: 'Договор_ДДУ_Чистое_Небо_10566.pdf', size: '2.4 МБ', status: 'Верифицирован' },
                { name: 'Справка_о_расчетах_SetlGroup.pdf', size: '1.1 МБ', status: 'Верифицирован' },
                { name: 'Выписка_ЕФРСБ_ФССП_Александр_В.pdf', size: '640 КБ', status: 'Чисто' },
                { name: 'Согласие_супруги_нотариальное.pdf', size: '890 КБ', status: 'Нотариус ОК' },
              ].map((doc) => (
                <div
                  key={doc.name}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{doc.name}</span>
                    <span className="text-[10px] text-slate-400">({doc.size})</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button type="button" title="Просмотр" className="p-1 text-slate-500 hover:text-slate-800">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Скачать" className="p-1 text-slate-500 hover:text-slate-800">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Benefit Summary & Analytics */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 pb-3 border-b border-slate-100">
              Сводка выгоды и аналитика
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
                <span className="text-[11px] text-emerald-800 font-bold block">СУММА К ВЫПЛАТЕ:</span>
                <span className="text-xl font-black text-emerald-700 block">2,485,230 ₽</span>
                <span className="text-[10px] text-emerald-800/80 block">100% возврат капитала</span>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
                <span className="text-[11px] text-amber-800 font-bold block">СЭКОНОМЛЕННЫЙ ШТРАФ:</span>
                <span className="text-xl font-black text-amber-700 block">+1,500,000 ₽</span>
                <span className="text-[10px] text-amber-800/80 block">Штраф девелопера 15%</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
              <span className="text-slate-600">Активность в VIP Telegram-клубе:</span>
              <span className="font-bold text-slate-900">84 просмотра лота</span>
            </div>

            {/* Visual Comparison Bar */}
            <div className="space-y-1.5 pt-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-rose-600">Потеря при разрыве: -1.5 млн ₽</span>
                <span className="text-emerald-700">Возврат DomExit: +2.48 млн ₽</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                <div className="bg-rose-500 h-full w-[38%]" />
                <div className="bg-emerald-500 h-full w-[62%]" />
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
