import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { formatRubles } from '../utils/formatters';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FileCheck,
  Download,
  RefreshCw,
  Lock,
  Layers,
  Check,
} from 'lucide-react';

export const AdminClosingPage: React.FC = () => {
  const { dealId } = useParams<{ dealId: string }>();
  const { language } = useLanguage();

  const [rosreestrProgress, setRosreestrProgress] = useState<number>(75);
  const [dealFinalized, setDealFinalized] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const handleRefreshWebhook = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      alert('Шлюз Росреестра: Пакет #РР-78-01/9924-2025 находится на финальной электронной подписи регистратора.');
    }, 800);
  };

  const handleManualOverride = () => {
    setRosreestrProgress(100);
    setDealFinalized(true);
    alert('Сделка успешно завершена вручную! Аккредитив раскрыт, транши А, Б, В зачислены адресатам.');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title={`Финальное закрытие сделки и расчеты — Лот #U-10566`}
          subtitle="Интеграция со шлюзом Сбербанк Domclick API и Росреестром"
        />

        <div className="p-6 space-y-6 max-w-[1500px] w-full">
          
          {/* Top Status Bar & Gateway Badges */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Статус: На регистрации в Росреестре (ЭЦП)</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono text-xs font-semibold">
                  Шлюз: Domclick API Pro — Соединение активно
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono text-xs">
                  Аккредитив: № АК-78401/2025-СБЕР
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => alert('Протокол расчетов с ЭЦП экспортирован (PDF)')}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center space-x-1 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Экспорт протокола (PDF с ЭЦП)</span>
              </button>
              <button
                type="button"
                onClick={() => alert('Связь с персональным куратором Сбербанка')}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-emerald-700 font-bold text-xs hover:bg-slate-50 shadow-xs"
              >
                Менеджер Сбера
              </button>
            </div>
          </div>

          {/* 2. 3-Party Settlement Flow Diagram */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100">
              3-Party Settlement Flow Diagram (Трехсторонняя схема расчетов)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Side: Incoming Pool SBR */}
              <div className="lg:col-span-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 space-y-3 relative shadow-xs">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] uppercase shadow-xs">
                  ВХОДЯЩИЙ ПУЛ СБР — Задепонировано
                </span>
                
                <div>
                  <span className="text-xs text-slate-600 block">Общая сумма на счете аккредитива:</span>
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 font-mono mt-1">
                    2,759,530 ₽
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700 shadow-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Плательщик:</span>
                    <span className="font-bold text-slate-900">Дмитрий К. (Покупатель #B-409)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Банк-депозитарий:</span>
                    <span className="font-bold text-emerald-700">ПАО Сбербанк</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  🔒 100% средств заблокировано на номинальном счете до поступления выписки ЕГРН.
                </p>
              </div>

              {/* Right Side: 3 Tranches Cards */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Tranche A: Seller Return */}
                <div className="p-4 bg-white rounded-2xl border-2 border-emerald-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш А — Возврат продавцу (Цеденту)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                        0% УДЕРЖАНИЯ
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Получатель: Александр В. (Счет в Сбере) • Выплата за 10 мин после ЕГРН
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    2,485,230 ₽
                  </div>
                </div>

                {/* Tranche B: Developer Installment Balance */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш Б — Обязательство по рассрочке (Застройщик)</span>
                      <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                        СОГЛАСИЕ № СГ-УСТ-492
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Перевод долга в Setl Group по графику рассрочки покупателя
                    </span>
                  </div>
                  <div className="text-xl font-bold text-slate-700 font-mono">
                    8,486,770 ₽
                  </div>
                </div>

                {/* Tranche C: DomExit Success Fee */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900">Транш В — Комиссия платформы DomExit (2.5%)</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                        SUCCESS FEE
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Оплачивает покупатель • ООО «ДомЭкзит Технологии»
                    </span>
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono">
                    274,300 ₽
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* 3. Bottom 2 Sections: Closing Checklist & Digital Vault */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left (7 cols): Closing Checklist & Escrow Release Steps */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-xs">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Чек-лист закрытия и этапы раскрытия эскроу (Шаг {dealFinalized ? 5 : 4} из 5)
                </h3>
                <span className="text-emerald-700 font-bold font-mono text-xs">{rosreestrProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-500"
                  style={{ width: `${rosreestrProgress}%` }}
                />
              </div>

              {/* 5 Vertical Steps */}
              <div className="space-y-3 text-xs">
                
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>1. Письменное согласие девелопера Setl Group получено</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">Готово ✓</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>2. Договор уступки прав требования подписан сторонами ЭЦП</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">Готово ✓</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>3. СБР в ПАО Сбербанк открыт и профинансирован (2,759,530 ₽)</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">Готово ✓</span>
                </div>

                {/* Step 4: Active */}
                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                  dealFinalized
                    ? 'bg-slate-50 border-slate-200 text-emerald-700 font-semibold'
                    : 'bg-emerald-50 border-2 border-emerald-400 text-emerald-800'
                }`}>
                  <div className="flex items-center space-x-2.5">
                    {dealFinalized ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4 text-emerald-600 animate-spin" />}
                    <span>4. Электронная регистрация в Росреестре (#РР-78-01/9924-2025)</span>
                  </div>
                  <span className="font-mono text-emerald-700 font-bold">
                    {dealFinalized ? 'Зарегистрировано ✓' : 'В процессе (75%)'}
                  </span>
                </div>

                {/* Step 5 */}
                <div className={`p-3 rounded-xl flex items-center justify-between border ${
                  dealFinalized ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <div className="flex items-center space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>5. Раскрытие аккредитива и выплата сторонам (АВТОМАТИЧЕСКИ)</span>
                  </div>
                  <span className="font-mono text-[11px]">
                    {dealFinalized ? 'Выплачено 100%' : 'Ожидание выписки'}
                  </span>
                </div>

              </div>
            </div>

            {/* Right (5 cols): Digital Vault (5 files) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Digital Vault (5 файлов)
                </h3>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] border border-slate-200">
                  SHA-256 Valid
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { name: 'Согласие_SetlGroup_СГ_УСТ_492.pdf', hash: '#SHA-9142' },
                  { name: 'Договор_цессии_ЭЦП_Сбербанк.pdf', hash: '#SHA-8812' },
                  { name: 'Заявление_Росреестр_РР_78_01.pdf', hash: '#SHA-3341' },
                  { name: 'Платежное_поручение_депонирования.pdf', hash: '#SHA-7720' },
                  { name: 'Выписка_ЕГРН_промежуточная.pdf', hash: '#SHA-0021' },
                ].map((f) => (
                  <div
                    key={f.name}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-700 truncate">{f.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert(`Скачивание файла ${f.name}`)}
                      className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Officer Bar */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                    МС
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">Мария Соколова</span>
                    <span className="text-[10px] text-emerald-700 font-semibold block">Fintech Escrow Desk</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshWebhook}
                    disabled={isRefreshing}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-1 border border-slate-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Обновить статус Росреестра (Webhook)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManualOverride}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    ✓ Завершить (Оверрайд)
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
