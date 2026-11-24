import React from 'react';
import {
  Sliders,
  CheckCircle2,
  ExternalLink,
  Check,
  Building,
  Home,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Lot, LegalAuditAxis, LegalAuditAxisStatus, SecondaryRiskChecklist } from '../../../types';
import { HONEST_STATUS_CONFIG } from '../../../data/legalAuditAxes';

interface LegalAuditAxesSectionProps {
  lot: Lot;
  axes: LegalAuditAxis[];
  curatorName: string;
  onAxisStatusChange: (axisId: string, status: LegalAuditAxisStatus) => void;
  onAxisNotesChange: (axisId: string, notes: string) => void;
  onSaveAxis: (axisId: string) => void;
  onApplyStandardVerdict?: () => void;
  onUpdateSecondaryChecklist?: (checklist: SecondaryRiskChecklist) => void;
}

export const LegalAuditAxesSection: React.FC<LegalAuditAxesSectionProps> = ({
  lot,
  axes,
  curatorName,
  onAxisStatusChange,
  onAxisNotesChange,
  onSaveAxis,
  onApplyStandardVerdict,
  onUpdateSecondaryChecklist,
}) => {
  const isSecondary = lot.dealTrack === 'secondary_dkp';

  const secondaryChecklist: SecondaryRiskChecklist = lot.secondaryRiskChecklist || {
    egrnExtractVerified: false,
    registeredPersonsCleared: false,
    utilityDebtsCleared: false,
    legalCapacityConfirmed: false,
    bankSettlementMethodSelected: false,
  };

  const handleToggleSecondaryItem = (key: keyof SecondaryRiskChecklist) => {
    if (!onUpdateSecondaryChecklist) return;
    const updated = {
      ...secondaryChecklist,
      [key]: !secondaryChecklist[key],
    };
    onUpdateSecondaryChecklist(updated);
  };

  return (
    <div className="space-y-6">
      {/* Track Badge & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isSecondary ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {isSecondary ? <Home className="w-5 h-5" /> : <Building className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                {isSecondary ? 'РЕЖИМ СДЕЛКИ: ВТОРИЧНОЕ ЖИЛЬЕ (ДКП)' : 'РЕЖИМ СДЕЛКИ: НОВОСТРОЙКА / УСТУПКА (ДДУ)'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isSecondary
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {isSecondary ? 'Вторичка / 218-ФЗ' : 'Цессия / 214-ФЗ'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isSecondary
                ? 'Проверка титула, перехода прав собственности по выписке ЕГРН и отсутствия обременений третьих лиц.'
                : 'Проверка договора уступки прав требования по ДДУ, расчетов с застройщиком и справок СФР.'}
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Specific Checklist (Only shown for secondary_dkp) */}
      {isSecondary && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-6 space-y-4">
          <div className="flex items-center space-x-2 text-amber-900">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
            <h4 className="text-sm font-black uppercase tracking-wider">
              Специфический чек-лист рисков вторичного рынка (ДКП / 218-ФЗ)
            </h4>
          </div>
          <p className="text-xs text-amber-800/80">
            Для перехода прав на готовое жилье куратор обязан верифицировать следующие обязательные маркеры чистоты:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
            <label className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-amber-200/80 cursor-pointer hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={secondaryChecklist.egrnExtractVerified}
                onChange={() => handleToggleSecondaryItem('egrnExtractVerified')}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 accent-amber-600"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">Выписка ЕГРН об основных характеристиках</span>
                <span className="text-slate-500 text-[11px] block">
                  Свежая онлайн-выписка с Госуслуг / Росреестра, совпадение собственника и кадастрового номера
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-amber-200/80 cursor-pointer hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={secondaryChecklist.registeredPersonsCleared}
                onChange={() => handleToggleSecondaryItem('registeredPersonsCleared')}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 accent-amber-600"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">Справка о зарегистрированных лицах (Ф-9 / Ф-12)</span>
                <span className="text-slate-500 text-[11px] block">
                  Отсутствие временно снятых с учета (военнослужащие, осужденные, сохраняющие право проживания)
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-amber-200/80 cursor-pointer hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={secondaryChecklist.utilityDebtsCleared}
                onChange={() => handleToggleSecondaryItem('utilityDebtsCleared')}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 accent-amber-600"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">Справка об отсутствии задолженности по ЖКХ и кап. ремонту</span>
                <span className="text-slate-500 text-[11px] block">
                  Долги по капремонту переходят на нового собственника по ст. 158 ЖК РФ
                </span>
              </div>
            </label>

            <label className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-amber-200/80 cursor-pointer hover:border-amber-400 transition-colors">
              <input
                type="checkbox"
                checked={secondaryChecklist.legalCapacityConfirmed}
                onChange={() => handleToggleSecondaryItem('legalCapacityConfirmed')}
                className="mt-0.5 w-4 h-4 rounded text-amber-600 accent-amber-600"
              />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">Дееспособность продавца и отсутствие органов опеки</span>
                <span className="text-slate-500 text-[11px] block">
                  Если среди собственников есть несовершеннолетние — обязателен приказ органов опеки и нотариат
                </span>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Main Axes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <span>Разделы юридической проверки ({axes.length} ключевых параметров)</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            Проверено: {axes.filter((a) => a.evaluated).length} из {axes.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {axes.map((axis) => (
            <div
              key={axis.id}
              className="bg-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs border border-slate-200 hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-900">{axis.title}</h4>
                  {axis.portalUrl && (
                    <a
                      href={axis.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-emerald-700 transition-colors"
                    >
                      <span>Официальный государственный реестр проверки</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Honest Status Selector */}
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs text-slate-500 font-bold hidden sm:inline">Статус раздела:</span>
                  <select
                    value={axis.status}
                    onChange={(e) => onAxisStatusChange(axis.id, e.target.value as LegalAuditAxisStatus)}
                    className={`px-3.5 py-2 rounded-xl border font-bold text-xs cursor-pointer focus:outline-none transition-colors shadow-2xs ${
                      axis.status === 'verified_safe'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : axis.status === 'required_at_deal'
                        ? 'bg-sky-50 text-sky-800 border-sky-300'
                        : 'bg-slate-100 text-slate-800 border-slate-300'
                    }`}
                  >
                    <option value="verified_safe">✓ Проверено — рисков нет</option>
                    <option value="required_at_deal">⏳ Потребуется на сделке</option>
                    <option value="condition_found">ℹ Выявлено условие</option>
                  </select>
                </div>
              </div>

              {/* Editable Custom Notes for this Axis */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Заключение и комментарий куратора по данному разделу:
                </label>
                <textarea
                  rows={2}
                  value={axis.notes}
                  onChange={(e) => onAxisNotesChange(axis.id, e.target.value)}
                  placeholder="Укажите конкретные результаты проверки по данному разделу..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 bg-slate-50/50"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-slate-500">
                <span className="font-mono text-[11px]">
                  {axis.checkedBy ? `Проверил: ${axis.checkedBy}` : `Куратор: ${curatorName}`}
                  {axis.checkedAt ? ` • ${new Date(axis.checkedAt).toLocaleDateString('ru-RU')}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => onSaveAxis(axis.id)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs self-end sm:self-auto"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Зафиксировать вердикт</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
