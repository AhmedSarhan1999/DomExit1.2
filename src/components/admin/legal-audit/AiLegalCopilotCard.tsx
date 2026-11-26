import React, { useState } from 'react';
import {
  Bot,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export interface KeyClause {
  topic: string;
  pageNumber: number;
  quote: string;
  riskLevel: 'high' | 'medium' | 'low' | 'info';
  explanationRu: string;
}

export interface SuggestedAxis {
  axisId: string;
  suggestedStatus: 'verified_safe' | 'needs_attention' | 'high_risk';
  draftNoteRu: string;
  pageRefs: number[];
  confidence: number;
}

export interface AiLegalAnalysisData {
  id: string;
  lotCode: string;
  ocrJobId: string;
  modelUri: string;
  status: 'completed' | 'failed';
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostRub?: number;
  contractSummaryRu: string;
  developerPenaltyPct?: number;
  developerConsentFeeRub?: number;
  developerConsentRequired: boolean;
  maternalCapitalRisk: 'none' | 'suspected' | 'confirmed';
  encumbranceRisk: 'none' | 'mortgage' | 'arrest' | 'other';
  keyClauses: KeyClause[];
  suggestedAxes: SuggestedAxis[];
  draftProtectionMemo612Ru: string;
  missingDocsRecommendationRu: string[];
  createdAt: string;
  isCached?: boolean;
}

interface AiLegalCopilotCardProps {
  analysis: AiLegalAnalysisData;
  loading?: boolean;
  onReanalyze?: () => void;
  onApplyAxisDraft?: (axisId: string, note: string) => void;
  onApplyMemo?: (memo: string, penaltyPct?: number) => void;
}

const AXIS_NAMES: Record<string, string> = {
  title_encumbrances: '1. Титул и обременения',
  bankruptcy_debts: '2. Банкротство и долги',
  developer_settlement: '3. Расчёты с застройщиком (Эскроу)',
  family_matkap: '4. Семейный статус и маткапитал',
  cession_escrow: '5. Уступка прав и перевод долга',
};

export const AiLegalCopilotCard: React.FC<AiLegalCopilotCardProps> = ({
  analysis,
  loading = false,
  onReanalyze,
  onApplyAxisDraft,
  onApplyMemo,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const [copiedMemo, setCopiedMemo] = useState<boolean>(false);

  const handleCopyMemo = () => {
    if (!analysis.draftProtectionMemo612Ru) return;
    navigator.clipboard.writeText(analysis.draftProtectionMemo612Ru);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
  };

  const matkapRisk = analysis.maternalCapitalRisk;
  const isMatkapHigh = matkapRisk === 'confirmed' || matkapRisk === 'suspected';

  return (
    <div className="rounded-3xl border border-indigo-200 bg-linear-to-b from-indigo-50/70 via-white to-slate-50 p-5 sm:p-6 text-xs shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm sm:text-base">
                YandexGPT Pro Legal Copilot
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
                152-ФЗ • Pro Tier
              </span>
              {analysis.isCached && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Кэш (0 ₽)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Анализ договора ДДУ #{analysis.lotCode} •{' '}
              {analysis.createdAt ? new Date(analysis.createdAt).toLocaleString('ru-RU') : '—'} •{' '}
              {analysis.inputTokens || 0} вх. / {analysis.outputTokens || 0} вых. токенов
              {analysis.estimatedCostRub !== undefined ? ` • ~${analysis.estimatedCostRub} ₽` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReanalyze && (
            <button
              type="button"
              onClick={onReanalyze}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Перезапустить AI</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
            aria-label="Свернуть/развернуть"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-5">
          {/* Summary Box */}
          <div className="p-4 rounded-2xl bg-white border border-indigo-100 shadow-2xs space-y-2">
            <div className="flex items-center space-x-2 text-indigo-900 font-bold">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Резюме договора участия в долевом строительстве</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              {analysis.contractSummaryRu}
            </p>
          </div>

          {/* Quick Risk Indicator Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Developer Consent */}
            <div
              className={`p-3 rounded-2xl border flex flex-col justify-between ${
                analysis.developerConsentRequired
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-slate-500">Согласие застройщика</span>
              <p className="font-black text-xs mt-1">
                {analysis.developerConsentRequired ? '⚠️ Требуется согласие' : '✓ Не требуется'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {analysis.developerConsentFeeRub && analysis.developerConsentFeeRub > 0
                  ? `Плата: ${analysis.developerConsentFeeRub.toLocaleString('ru-RU')} ₽`
                  : 'Без платы'}
              </p>
            </div>

            {/* Developer Penalty */}
            <div
              className={`p-3 rounded-2xl border flex flex-col justify-between ${
                analysis.developerPenaltyPct && analysis.developerPenaltyPct > 5
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-slate-500">Штраф за расторжение</span>
              <p className="font-black text-xs mt-1">
                {analysis.developerPenaltyPct !== undefined
                  ? `${analysis.developerPenaltyPct}% от цены`
                  : 'Не установлен'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">При отказе дольщика</p>
            </div>

            {/* Maternal Capital */}
            <div
              className={`p-3 rounded-2xl border flex flex-col justify-between ${
                isMatkapHigh
                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                  : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-slate-500">Материнский капитал</span>
              <p className="font-black text-xs mt-1">
                {matkapRisk === 'confirmed'
                  ? '🚨 Подтверждён'
                  : matkapRisk === 'suspected'
                  ? '⚠️ Есть подозрения'
                  : '✓ Не обнаружен'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {isMatkapHigh ? 'Требуется выделение долей' : 'Риск не выявлен'}
              </p>
            </div>

            {/* Encumbrance */}
            <div
              className={`p-3 rounded-2xl border flex flex-col justify-between ${
                analysis.encumbranceRisk !== 'none'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              }`}
            >
              <span className="text-[10px] uppercase font-bold text-slate-500">Обременения / Залог</span>
              <p className="font-black text-xs mt-1">
                {analysis.encumbranceRisk === 'mortgage'
                  ? '🏦 Ипотека банка'
                  : analysis.encumbranceRisk === 'arrest'
                  ? '🚫 Арест/Запрет'
                  : analysis.encumbranceRisk === 'other'
                  ? '⚠️ Обременение'
                  : '✓ Чистый титул'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">По тексту договора</p>
            </div>
          </div>

          {/* Key Clauses Table */}
          {analysis.keyClauses && analysis.keyClauses.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-black text-slate-900 text-xs flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Существенные пункты и рисковые формулировки из договора</span>
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="py-2.5 px-3">Стр.</th>
                      <th className="py-2.5 px-3">Тема / Риск</th>
                      <th className="py-2.5 px-3">Цитата из текста ДДУ</th>
                      <th className="py-2.5 px-3">Юридический комментарий AI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.keyClauses.map((clause, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {clause.pageNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              clause.riskLevel === 'high'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : clause.riskLevel === 'medium'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {clause.topic}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-serif italic max-w-xs">
                          «{clause.quote}»
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-sm">
                          {clause.explanationRu}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Suggested Axes Drafts (Advisory only) */}
          {analysis.suggestedAxes && analysis.suggestedAxes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Проекты замечаний для 5 правовых осей (Advisory Drafts)</span>
                </h4>
                <span className="text-[10px] text-slate-500">Не заменяют ручную проверку</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {analysis.suggestedAxes.map((axis) => {
                  const title = AXIS_NAMES[axis.axisId] || axis.axisId;
                  const isCaution = axis.suggestedStatus !== 'verified_safe';

                  return (
                    <div
                      key={axis.axisId}
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCaution ? 'bg-indigo-50/40 border-indigo-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">{title}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              axis.suggestedStatus === 'verified_safe'
                                ? 'bg-emerald-100 text-emerald-800'
                                : axis.suggestedStatus === 'high_risk'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {axis.suggestedStatus === 'verified_safe'
                              ? 'Чисто'
                              : axis.suggestedStatus === 'high_risk'
                              ? 'Высокий риск'
                              : 'Внимание'}
                          </span>
                          {axis.pageRefs && axis.pageRefs.length > 0 && (
                            <span className="text-[10px] font-mono text-slate-500">
                              (стр. {axis.pageRefs.join(', ')})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-700 leading-normal">
                          {axis.draftNoteRu}
                        </p>
                      </div>

                      {onApplyAxisDraft && (
                        <button
                          type="button"
                          onClick={() => onApplyAxisDraft(axis.axisId, axis.draftNoteRu)}
                          className="px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
                        >
                          <span>Вставить в комментарий</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Protection Memo Draft (art. 61.2 127-FZ / art. 302 GK RF) */}
          {analysis.draftProtectionMemo612Ru && (
            <div className="p-4 rounded-2xl bg-linear-to-r from-amber-50/60 to-white border border-amber-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 font-black text-amber-950 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Проект мотивировки добросовестности (ст. 302 ГК РФ / ст. 61.2 ФЗ-127)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedMemo ? 'Скопировано!' : 'Копировать'}</span>
                  </button>
                  {onApplyMemo && (
                    <button
                      type="button"
                      onClick={() =>
                        onApplyMemo(analysis.draftProtectionMemo612Ru, analysis.developerPenaltyPct)
                      }
                      className="px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[11px] font-bold flex items-center space-x-1 cursor-pointer shadow-2xs"
                    >
                      <span>Применить в меморандум 61.2</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-100 font-serif">
                {analysis.draftProtectionMemo612Ru}
              </p>
            </div>
          )}

          {/* Missing Documents Recommendations */}
          {analysis.missingDocsRecommendationRu &&
            analysis.missingDocsRecommendationRu.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                  <span>Рекомендованные дополнительные документы для запроса у продавца</span>
                </h5>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                  {analysis.missingDocsRecommendationRu.map((docName, i) => (
                    <li key={i}>{docName}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
