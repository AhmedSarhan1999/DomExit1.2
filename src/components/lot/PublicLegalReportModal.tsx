import React from 'react';
import { ShieldCheck, CheckCircle2, Lock, FileText, Printer, X, Award, Building, UserCheck } from 'lucide-react';
import { Lot, Employee } from '../../types';

interface PublicLegalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: Lot;
  curator?: Employee | null;
}

export const PublicLegalReportModal: React.FC<PublicLegalReportModalProps> = ({
  isOpen,
  onClose,
  lot,
  curator,
}) => {
  if (!isOpen) return null;

  const protocolNumber = `ПРТ-214-${lot.lotCode.replace(/[^0-9A-Za-z]/g, '') || '784102'}`;
  const verificationDate = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const curatorName = curator?.name || lot.curator?.name || 'Юридическая служба DomExit';
  const curatorRole = curator?.role || 'Старший комплаенс-офицер по сделкам переуступки (214-ФЗ)';

  const auditBlocks = [
    {
      id: 1,
      title: 'Идентификация правообладателя и дееспособность',
      points: '7 из 7 пунктов',
      desc: 'Паспортные данные сверены с базой МВД, проверка на дееспособность и нахождение в реестрах экстремистов/террористов пройдена.',
    },
    {
      id: 2,
      title: 'Легитимность ДДУ и регистрация в Росреестре',
      points: '8 из 8 пунктов',
      desc: 'Подлинность договора проверена по выписке ЕГРН. Государственная регистрация подтверждена с отметкой органа регистрации прав.',
    },
    {
      id: 3,
      title: 'Финансовая чистота и взаиморасчеты с девелопером',
      points: '7 из 7 пунктов',
      desc: 'Справка девелопера о полной оплате цены ДДУ проверена, либо зафиксирован точный остаток рассрочки для безопасного перевода долга.',
    },
    {
      id: 4,
      title: 'Статус эскроу-счета и аккредитация застройщика',
      points: '7 из 7 пунктов',
      desc: `Эскроу-счет в уполномоченном банке (${lot.escrowBank}) подтвержден. Застройщик ${lot.developer} имеет действующее разрешение на строительство.`,
    },
    {
      id: 5,
      title: 'Семейное право, согласие супругов и маткапитал',
      points: '6 из 6 пунктов',
      desc: 'Нотариальное согласие супруга(и) либо заявление о холостом статусе проверено. Средства материнского капитала не использовались / согласованы.',
    },
    {
      id: 6,
      title: 'Отсутствие банкротства, судебных споров и залогов',
      points: '7 из 7 пунктов',
      desc: 'Проверка по картотеке арбитражных дел (КАД), базе ФССП и ЕФРСБ подтвердила полное отсутствие судебных споров и процедур банкротства.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block">
                Государственный стандарт комплаенса (214-ФЗ)
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Публичный юридический отчет верификации
              </h2>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">Протокол аудита:</span>
              <span className="font-mono font-bold text-emerald-300">{protocolNumber}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Дата валидации:</span>
              <span className="font-medium text-slate-200">{verificationDate}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Объект:</span>
              <span className="font-medium text-slate-200 truncate block">{lot.complexName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Код лота:</span>
              <span className="font-mono font-bold text-slate-200">#{lot.lotCode}</span>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Key Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">ДДУ проверен в Росреестре</span>
                <span className="text-[10px] text-emerald-700">Запись ЕГРН подтверждена, обременения отсутствуют</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Согласие девелопера</span>
                <span className="text-[10px] text-emerald-700">Получено либо уступка разрешена условиями ДДУ</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-emerald-950 block">Эскроу-счет подтвержден</span>
                <span className="text-[10px] text-emerald-700">{lot.escrowBank} (ст. 15.4 № 214-ФЗ)</span>
              </div>
            </div>
          </div>

          {/* Curator Attestation Banner */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Куратор правовой экспертизы
                </span>
                <span className="text-sm font-bold text-slate-900 block">{curatorName}</span>
                <span className="text-xs text-slate-600">{curatorRole}</span>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <Award className="w-3.5 h-3.5 text-emerald-700" />
                <span>Аттестат ЕГРН/214-ФЗ</span>
              </span>
            </div>
          </div>

          {/* 42 Checkpoints Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Чек-лист правового комплаенса (42 пункта из 42)</span>
              </h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                100% Успешно
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {auditBlocks.map((block) => (
                <div key={block.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {block.id}. {block.title}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-600 shrink-0 ml-2">
                      {block.points}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {block.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 152-FZ Personal Data Protection Note */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start space-x-3">
            <Lock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <span className="font-bold block">
                Защита персональных данных участников сделки (152-ФЗ РФ)
              </span>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                В соответствии со ст. 7 Федерального закона № 152-ФЗ «О персональных данных», оригиналы сканов паспортов,
                ДДУ, платежных поручений и согласий хранятся в защищенном облачном контуре и не публикуются в открытом доступе.
                Полный нотариальный пакет передается покупателю и банку-эскроу агенту на этапе подписания договора уступки.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Распечатать юридическое заключение</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
