import React, { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface GosuslugiEgrnGuideProps {
  cadastralNumber?: string;
  className?: string;
}

export const GosuslugiEgrnGuide: React.FC<GosuslugiEgrnGuideProps> = ({
  cadastralNumber,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCadastral = () => {
    if (!cadastralNumber) return;
    navigator.clipboard?.writeText(cadastralNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className={`rounded-2xl border border-sky-200 bg-sky-50/60 overflow-hidden transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-sky-100/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase text-sky-950 tracking-wide">
                Бесплатная онлайн-выписка ЕГРН (0 ₽)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Госуслуги 218-ФЗ
              </span>
            </div>
            <p className="text-xs text-sky-900/80">
              Пошаговая инструкция получения официальной выписки Росреестра за 1 минуту
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-sky-700">
          <span className="text-xs font-bold hidden sm:inline">
            {isOpen ? 'Скрыть руководство' : 'Как получить'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 sm:p-5 border-t border-sky-200/70 bg-white space-y-4 text-xs animate-fade-in font-sans">
          <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 flex items-start space-x-2.5 text-sky-900">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              В соответствии с законодательством РФ собственник объекта недвижимости имеет право получать
              онлайн-выписку из ЕГРН об основных характеристиках и зарегистрированных правах{' '}
              <strong>совершенно бесплатно (0 ₽)</strong> неограниченное число раз через портал «Госуслуги».
            </p>
          </div>

          {cadastralNumber && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-600">Кадастровый номер объекта:</span>
              <div className="flex items-center space-x-2">
                <code className="font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200">
                  {cadastralNumber}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCadastral}
                  className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>4 простых шага для получения выписки:</span>
            </h4>

            <ol className="space-y-2.5 list-none pl-0">
              <li className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">Авторизуйтесь на Госуслугах</span>
                  <p className="text-slate-600 text-[11px]">
                    Войдите в свою подтвержденную учетную запись на портале{' '}
                    <a
                      href="https://www.gosuslugi.ru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline font-bold inline-flex items-center space-x-0.5"
                    >
                      <span>gosuslugi.ru</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">Перейдите к услуге Росреестра</span>
                  <p className="text-slate-600 text-[11px]">
                    Выберите услугу <strong>«Онлайн-выписка из ЕГРН»</strong> или воспользуйтесь прямой ссылкой на{' '}
                    <a
                      href="https://www.gosuslugi.ru/600359/1/form"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline font-bold inline-flex items-center space-x-0.5"
                    >
                      <span>форму заказа выписки</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    .
                  </p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">Подтвердите выбор объекта</span>
                  <p className="text-slate-600 text-[11px]">
                    Ваша недвижимость подгрузится автоматически. Выберите нужную квартиру и нажмите «Отправить запрос».
                    Формирование занимает от 1 до 5 минут.
                  </p>
                </div>
              </li>

              <li className="flex items-start space-x-3">
                <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">Скачайте документ и прикрепите в DomExit</span>
                  <p className="text-slate-600 text-[11px]">
                    В личный кабинет придет файл PDF с усиленной квалифицированной электронной подписью Росреестра
                    (.sig). Загрузите файл в форму заявки для мгновенного прохождения верификации.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
