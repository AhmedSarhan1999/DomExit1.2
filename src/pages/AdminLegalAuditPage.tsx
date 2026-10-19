import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { AdminSidebar } from '../components/layout/AdminSidebar';
import { AdminHeader } from '../components/layout/AdminHeader';
import {
  Scale,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Download,
  Copy,
  AlertTriangle,
  ArrowLeft,
  Check,
  X,
  Lock,
} from 'lucide-react';

export const AdminLegalAuditPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const { language } = useLanguage();

  const [includePlenum63, setIncludePlenum63] = useState<boolean>(true);
  const [approvedStatus, setApprovedStatus] = useState<boolean>(false);
  const [memoCopied, setMemoCopied] = useState<boolean>(false);

  const handleCopyMemo = () => {
    setMemoCopied(true);
    setTimeout(() => setMemoCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        <AdminHeader
          title={`Юридический аудит и антибанкротная защита — Лот #${lotId || 'U-10566'}`}
          subtitle="Комплексный скоринг по 42 параметрам, ЕФРСБ, ФССП и обоснование цены по ст. 61.2 ФЗ-127"
        />

        <div className="p-6 space-y-8 max-w-[1500px] w-full">
          
          {/* 1. Legal Summary Card & Anti-Bankruptcy Index */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-emerald-700">
                <Scale className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  ПРОТОКОЛ ПРАВОВОГО СКОРИНГА DOMEXIT #LA-9921
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Аудит продавца: Александр Владимирович Б. (ИНН 781432994102)
              </h2>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>Договор ДДУ: <strong className="text-slate-800">№ ЧН-12/2-10566</strong></span>
                <span>•</span>
                <span>Застройщик: <strong className="text-slate-800">Setl Group</strong></span>
                <span>•</span>
                <span>Росреестр штамп: <strong className="text-emerald-700 font-mono">№ 78:34:0421101:10566</strong></span>
              </div>
            </div>

            {/* Anti-Bankruptcy Index Card */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-right space-y-1 shrink-0 w-full lg:w-auto shadow-xs">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                АНТИБАНКРОТНЫЙ ИНДЕКС:
              </span>
              <div className="text-4xl font-black text-emerald-700 font-mono">
                98 / 100
              </div>
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold shadow-xs">
                <CheckCircle2 className="w-3 h-3" />
                <span>Зеленый коридор (Вероятность оспаривания: &lt; 0.2%)</span>
              </span>
            </div>
          </div>

          {/* 2. Mandatory 4 Audit Boxes (2x2 Grid) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Box 1: EFRSB Bankruptcy Registry */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    1. База банкротств ЕФРСБ / Федресурс
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                  ЧИСТО — Рисков нет
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Сведения о признании гражданина банкротом, реструктуризации долгов или подаче заявлений по ст. 213.4 Федерального закона № 127-ФЗ отсутствуют в картотеке арбитражных дел.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex justify-between items-center">
                <span>API Gateway Response: 200 OK</span>
                <span className="text-emerald-700 font-bold">Hash: #EF-9941-X</span>
              </div>

              <button
                type="button"
                onClick={() => alert('Загрузка протокола проверки ЕФРСБ...')}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать протокол проверки ЕФРСБ (PDF, 640 КБ)</span>
              </button>
            </div>

            {/* Box 2: FSSP Enforcement Proceedings */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    2. Исполнительные производства ФССП
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                  0 ₽ — Долгов нет
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Открытых исполнительных производств, задолженностей по кредитам, коммунальным платежам или налогам не обнаружено. Аресты и запреты на регистрационные действия отсутствуют.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 flex justify-between items-center">
                <span>Аресты недвижимости: Не наложены</span>
                <span className="text-emerald-700 font-bold">Штамп ФССП активен</span>
              </div>

              <button
                type="button"
                onClick={() => alert('Загрузка выписки ФССП...')}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Выписка ФССП с отметкой API (PDF, 420 КБ)</span>
              </button>
            </div>

            {/* Box 3: Credit History NBKI */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    3. Кредитная история и ПДН (НБКИ / ОКБ)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                  Просрочек &gt;30 дней нет
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Балл НБКИ:</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono mt-0.5 block">
                    785 / 850
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">ПДН продавца:</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    24% (Норма)
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Показатель долговой нагрузки находится в зеленой зоне. Риск вынужденного личного дефолта исключен.
              </p>

              <button
                type="button"
                onClick={() => alert('Загрузка отчета БКИ...')}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Сводный отчет БКИ (PDF, 890 КБ)</span>
              </button>
            </div>

            {/* Box 4: Law 214-FZ DDU Audit */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    4. Аудит договора ДДУ и справок — 214-ФЗ
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs">
                  Верифицировано 100%
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Материнский капитал: Справка СФР подтвердила — не использовался</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Согласие супруги: Удостоверено нотариусом г. СПб (Бланк 78 АВ 9912)</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Исполнение оплаты: Setl Group подтвердил 2 485 230 ₽ без штрафа</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Эскроу: ПАО Сбербанк, блокировок и судебных залогов нет</span>
                </div>
              </div>
            </div>

          </div>

          {/* 3. Legal Memo Generator for Bona Fide Purchaser Protection */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900">
                  Генератор правового обоснования цены добросовестного приобретателя
                </h3>
                <span className="text-xs text-emerald-700">
                  Защита сделки по ст. 302 ГК РФ и ст. 61.2 ФЗ-127 от оспаривания цены
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyMemo}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{memoCopied ? 'Скопировано!' : 'Скопировать в договор цессии'}</span>
              </button>
            </div>

            {/* Memo Text Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 leading-relaxed space-y-3">
              <p>
                «Цена уступки права требования в размере 2 485 230 (два миллиона четыреста восемьдесят пять тысяч двести тридцать) рублей строго соответствует сумме фактически внесенных Цедентом денежных средств по Договору участия в долевом строительстве № ЧН-12/2-10566.
              </p>
              <p>
                Стороны констатируют, что установление данной цены экономически обусловлено предотвращением финансовых убытков Цедента в виде контрактного штрафа Застройщика (Setl Group) в размере 15% (1 500 000 рублей) при одностороннем отказе от договора. В силу ст. 302 ГК РФ и ст. 61.2 ФЗ-127 Цессионарий признается добросовестным приобретателем, действовавшим в стандартных условиях делового оборота без цели причинения вреда кредиторам».
              </p>
              {includePlenum63 && (
                <p className="text-emerald-700 font-semibold pt-1 border-t border-slate-200">
                  + Применена правовая позиция Постановления Пленума ВАС РФ № 63: «Экономическая целесообразность предотвращения штрафных санкций подтверждена документально».
                </p>
              )}
            </div>

            <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={includePlenum63}
                onChange={(e) => setIncludePlenum63(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
              />
              <span>Включить ссылку на Постановление Пленума ВАС РФ № 63</span>
            </label>
          </div>

          {/* 4. Fixed Bottom Lawyer Decision Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                АО
              </div>
              <div>
                <span className="font-bold text-xs text-slate-900 block">Алексей Орлов</span>
                <span className="text-[11px] text-slate-500 block">Старший юрист комплаенс 214-ФЗ</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => alert('Сделка отклонена по комплаенс-рискам')}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors"
              >
                ✕ Отклонить (Высокий риск)
              </button>
              <button
                type="button"
                onClick={() => alert('Запрос на доп. документы отправлен продавцу в Telegram')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs border border-slate-200 transition-colors"
              >
                Запросить доп. документы
              </button>
              <button
                type="button"
                onClick={() => {
                  setApprovedStatus(true);
                  alert('Штамп «Документы проверены» выдан! Лот переведен на стадию матчмейкинга.');
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center space-x-2 transition-all"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Утвердить: Выдать штамп «Документы проверены»</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
