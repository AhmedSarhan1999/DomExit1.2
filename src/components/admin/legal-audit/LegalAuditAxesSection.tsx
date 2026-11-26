import React from 'react';
import {
  Sliders,
  ExternalLink,
  Check,
  Building,
  Home,
  ShieldCheck,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Lot, LegalAuditAxis, LegalAuditAxisStatus, SecondaryRiskChecklist } from '../../../types';
import { HONEST_STATUS_CONFIG } from '../../../data/legalAuditAxes';

interface LegalAuditAxesSectionProps {
  lot: Lot;
  axes: LegalAuditAxis[];
  curatorName: string;
  uploadingAxisId?: string | null;
  suggestedDrafts?: Record<string, string>;
  onAxisStatusChange: (axisId: string, status: LegalAuditAxisStatus) => void;
  onAxisNotesChange: (axisId: string, notes: string) => void;
  onSaveAxis: (axisId: string) => void;
  onUploadAxisProof?: (axisId: string) => void;
  onOpenProofDoc?: (info: { proofDocKey?: string; proofDocUrl?: string; proofDocName?: string }) => void;
  onUpdateSecondaryChecklist?: (checklist: SecondaryRiskChecklist) => void;
}

const EARLY_AXES_NO_DEFER = new Set(['title_encumbrances', 'bankruptcy_debts', 'developer_settlement']);

export const LegalAuditAxesSection: React.FC<LegalAuditAxesSectionProps> = ({
  lot,
  axes,
  curatorName,
  uploadingAxisId,
  suggestedDrafts,
  onAxisStatusChange,
  onAxisNotesChange,
  onSaveAxis,
  onUploadAxisProof,
  onOpenProofDoc,
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

  const evaluatedCount = axes.filter((a) => a.evaluated && a.status !== 'unverified').length;

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
                : 'Проверка договора уступки прав требования по ДДУ, расчётов с застройщиком и справок СФР. Каждый раздел требует фактической фиксации и комментария юриста.'}
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
          <span className="text-xs text-slate-600 font-mono font-bold">
            Проверено: {evaluatedCount} из {axes.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {axes.map((axis) => {
            const cfg = HONEST_STATUS_CONFIG[axis.status] || HONEST_STATUS_CONFIG.unverified;
            const cannotDefer = EARLY_AXES_NO_DEFER.has(axis.id);
            const hasNotes = Boolean((axis.notes || '').trim().length >= 3);
            const isUploadingThis = uploadingAxisId === axis.id;

            return (
              <div
                key={axis.id}
                className={`bg-white rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs border transition-all ${
                  axis.status === 'critical_risk'
                    ? 'border-rose-300 bg-rose-50/20'
                    : axis.evaluated && axis.status !== 'unverified'
                    ? 'border-emerald-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900">{axis.title}</h4>
                      {!axis.evaluated && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                          Не зафиксирован
                        </span>
                      )}
                    </div>
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
                      className={`px-3.5 py-2 rounded-xl border font-bold text-xs cursor-pointer focus:outline-none transition-colors shadow-2xs ${cfg.badgeClass}`}
                    >
                      <option value="unverified">⏳ Не проверено</option>
                      <option value="verified_safe">✓ Проверено — рисков нет</option>
                      <option value="required_at_deal" disabled={cannotDefer}>
                        📅 Потребуется на сделке{cannotDefer ? ' (недоступно для разд. 1–3)' : ''}
                      </option>
                      <option value="condition_found">ℹ Выявлено условие</option>
                      <option value="critical_risk">⛔ Критический риск — блок</option>
                    </select>
                  </div>
                </div>

                {cannotDefer && axis.status === 'required_at_deal' && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Разделы 1–3 должны быть полностью проверены до перехода к упаковке (нельзя отложить на сделку).</span>
                  </div>
                )}

                {/* AI Draft Suggestion from YandexGPT Legal Copilot */}
                {suggestedDrafts?.[axis.id] && (
                  <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-bold text-indigo-900">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Черновик от YandexGPT Copilot:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAxisNotesChange(axis.id, suggestedDrafts[axis.id])}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-2xs"
                      >
                        Вставить в комментарий
                      </button>
                    </div>
                    <p className="text-[11px] text-indigo-900 leading-relaxed font-sans bg-white/70 p-2.5 rounded-xl border border-indigo-100">
                      {suggestedDrafts[axis.id]}
                    </p>
                  </div>
                )}

                {/* Editable Custom Notes for this Axis */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Заключение и комментарий куратора по данному разделу <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={axis.notes}
                    onChange={(e) => onAxisNotesChange(axis.id, e.target.value)}
                    placeholder="Опишите фактические результаты проверки (даты выписок, номера дел, реквизиты справок)..."
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 bg-slate-50/50"
                  />
                </div>

                {/* Proof Document Upload + Save Verdict */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    {onUploadAxisProof && (
                      <button
                        type="button"
                        disabled={isUploadingThis}
                        onClick={() => onUploadAxisProof(axis.id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-[11px] flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>{isUploadingThis ? 'Загрузка в S3...' : axis.proofDocName ? 'Заменить скан (S3)' : 'Прикрепить скан (S3)'}</span>
                      </button>
                    )}
                    {axis.proofDocName ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenProofDoc?.({
                            proofDocKey: axis.proofDocKey,
                            proofDocUrl: axis.proofDocUrl,
                            proofDocName: axis.proofDocName,
                          })
                        }
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="truncate max-w-[180px]">{axis.proofDocName}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Скан подтверждения не прикреплён</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <span className="font-mono text-[11px] hidden md:inline">
                      {axis.evaluated && axis.checkedBy ? `Проверил: ${axis.checkedBy}` : `Куратор: ${curatorName}`}
                      {axis.evaluated && axis.checkedAt ? ` • ${new Date(axis.checkedAt).toLocaleDateString('ru-RU')}` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={axis.status === 'unverified' || !hasNotes}
                      onClick={() => onSaveAxis(axis.id)}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
                      title={
                        axis.status === 'unverified'
                          ? 'Выберите итоговый статус раздела перед фиксацией'
                          : !hasNotes
                          ? 'Заполните комментарий юриста'
                          : 'Сохранить вердикт по разделу'
                      }
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Зафиксировать вердикт</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
