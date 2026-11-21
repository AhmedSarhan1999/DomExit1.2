import React, { useState } from 'react';
import {
  Landmark,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  Info,
  DollarSign,
} from 'lucide-react';
import { formatRubles } from '../../utils/formatters';

interface BankSettlementAssistantProps {
  dealPriceRub?: number;
  dealTrack?: 'ddu_cession' | 'secondary_dkp';
  className?: string;
  onSelectMethod?: (methodId: string) => void;
}

interface SettlementMethod {
  id: 'sbr' | 'letter_of_credit' | 'notary_deposit';
  title: string;
  provider: string;
  commissionRu: string;
  calcCost: (price: number) => number;
  timeToRelease: string;
  releaseCondition: string;
  recommendedFor: string;
  advantages: string[];
}

const METHODS: SettlementMethod[] = [
  {
    id: 'sbr',
    title: 'Сервис безопасных расчетов (СБР)',
    provider: 'Сбербанк (ДомКлик) / Банк ВТБ (М2)',
    commissionRu: 'от 2 000 до 3 400 ₽ (фиксированная)',
    calcCost: () => 3400,
    timeToRelease: '1–2 рабочих дня после регистрации в Росреестре',
    releaseCondition: 'Электронное уведомление от Росреестра о регистрации перехода права или договора уступки ДДУ',
    recommendedFor: 'Ипотечные сделки, электронная регистрация, типовая вторичка и ДДУ',
    advantages: [
      'Полная автоматизация без необходимости посещать банк после сделки',
      'Деньги зачисляются на номинальный счет с защитой от списаний по долгам',
      'Если сделка не состоялась — 100% возврат средств покупателю',
    ],
  },
  {
    id: 'letter_of_credit',
    title: 'Безотзывный покрытый аккредитив',
    provider: 'Сбер, ВТБ, Альфа-Банк, ДОМ.РФ, Газпромбанк',
    commissionRu: 'от 1 500 до 3 000 ₽',
    calcCost: () => 2000,
    timeToRelease: 'В день предъявления документов в банк',
    releaseCondition: 'Предоставление выписки ЕГРН с отметкой о новом собственнике или зарегистрированного ДДУ',
    recommendedFor: 'Сделки с наличными покупателя, альтернативные цепочки, нестандартные условия',
    advantages: [
      'Регулируется ЦБ РФ и Гражданским кодексом РФ (ст. 867 ГК РФ)',
      'Гибкие условия раскрытия (можно добавить акт приема-передачи или выписку из домовой книги)',
      'Деньги депонированы и заморожены до выполнения условий',
    ],
  },
  {
    id: 'notary_deposit',
    title: 'Публичный депозитный счет нотариуса',
    provider: 'Федеральная нотариальная палата РФ',
    commissionRu: '0.5% (но не менее 1 500 ₽, при нотариальной сделке фикс ~1 500–3 000 ₽)',
    calcCost: (price: number) => Math.min(20000, Math.max(1500, Math.round(price * 0.005))),
    timeToRelease: 'Мгновенно по распоряжению нотариуса',
    releaseCondition: 'Получение нотариусом подтверждения государственной регистрации из Росреестра по защищенным каналам',
    recommendedFor: 'Сделки с долями, супружеским имуществом, несовершеннолетними или повышенным риском оспаривания',
    advantages: [
      'Максимальная юридическая защита: нотариус несет полную имущественную ответственность',
      'Защита от банкротства самого банка (ст. 87.1 Основ законодательства о нотариате)',
      'Удобно при нотариальном удостоверении договора',
    ],
  },
];

export const BankSettlementAssistant: React.FC<BankSettlementAssistantProps> = ({
  dealPriceRub = 10000000,
  dealTrack = 'ddu_cession',
  className = '',
  onSelectMethod,
}) => {
  const [selectedMethodId, setSelectedMethodId] = useState<string>('sbr');
  const [customPrice, setCustomPrice] = useState<number>(dealPriceRub);

  const selectedMethod = METHODS.find((m) => m.id === selectedMethodId) || METHODS[0];
  const cost = selectedMethod.calcCost(customPrice);

  const handleSelect = (id: string) => {
    setSelectedMethodId(id);
    if (onSelectMethod) onSelectMethod(id);
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-indigo-700">
            <Landmark className="w-5 h-5 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">
              ПОМОЩНИК БЕЗОПАСНЫХ РАСЧЕТОВ (ФИНАНСОВЫЙ ГАРАНТ)
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-900">
            Выбор и калькулятор безопасного способа расчетов
          </h3>
          <p className="text-xs text-slate-500">
            Все расчеты в DomExit производятся строго через номинальные счета, защищенные от рисков банкротства сторон.
          </p>
        </div>

        {/* Price Input / Indicator */}
        <div className="flex items-center space-x-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold">Сумма сделки:</span>
          <span className="text-sm font-black font-mono text-slate-900">
            {formatRubles(customPrice)}
          </span>
        </div>
      </div>

      {/* Methods Comparison Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {METHODS.map((method) => {
          const isSelected = method.id === selectedMethodId;
          const estCost = method.calcCost(customPrice);

          return (
            <button
              key={method.id}
              type="button"
              onClick={() => handleSelect(method.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-indigo-50/70 border-indigo-400 shadow-xs ring-2 ring-indigo-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {method.id === 'sbr' ? 'Электронный' : method.id === 'letter_of_credit' ? 'Классический' : 'Нотариальный'}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
                <h4 className="text-xs font-black text-slate-900">{method.title}</h4>
                <p className="text-[11px] text-slate-500">{method.provider}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[10px] text-slate-400">Стоимость:</span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  ≈ {formatRubles(estCost)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Method Deep Dive */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h4 className="text-sm font-black text-slate-900">{selectedMethod.title}</h4>
            <span className="text-xs text-indigo-700 font-medium">{selectedMethod.recommendedFor}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Срок перечисления продавцу:</span>
            <span className="text-xs font-bold text-slate-800">{selectedMethod.timeToRelease}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-slate-700">
              <strong className="text-slate-900">Условие раскрытия платежа:</strong> {selectedMethod.releaseCondition}
            </p>
          </div>

          <div className="space-y-1 pt-2">
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider">
              Ключевые преимущества безопасности:
            </span>
            <ul className="space-y-1 pl-0 list-none">
              {selectedMethod.advantages.map((adv, idx) => (
                <li key={idx} className="flex items-center space-x-2 text-slate-600 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
