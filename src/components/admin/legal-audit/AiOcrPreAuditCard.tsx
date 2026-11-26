import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building,
  DollarSign,
  Maximize2,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Lot } from '../../../types';
import { formatRubles } from '../../../utils/formatters';

export interface AiOcrJobData {
  id: string;
  lotCode: string;
  documentId: string;
  docCategory: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesProcessed?: number;
  estimatedCostRub?: number;
  rawTextS3Key?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  extractedFields?: {
    detectedDocType: string;
    dduNumber?: string;
    dduDate?: string;
    cadastralNumber?: string;
    areaSqm?: number;
    floor?: number;
    fullPriceRub?: number;
    paidAmountRub?: number;
    developerName?: string;
    developerInn?: string;
    escrowBankName?: string;
    registrationNumber?: string;
    confidenceScore: number;
    riskFlags: Array<{
      code: string;
      severity: 'high' | 'medium' | 'info';
      labelRu: string;
      pageNumber: number;
      excerpt: string;
    }>;
    crossCheckWarnings: Array<{
      field: string;
      declaredValue: string;
      extractedValue: string;
      messageRu: string;
    }>;
  };
}

interface AiOcrPreAuditCardProps {
  job: AiOcrJobData;
  lot?: Lot;
  onReprocess?: () => void;
  isReprocessing?: boolean;
}

const DOC_TYPE_TITLES: Record<string, string> = {
  ddu_contract: 'Договор участия в долевом строительстве (ДДУ)',
  developer_payment_cert: 'Справка от застройщика о полной/частичной оплате',
  rosreestr_extract: 'Выписка из ЕГРН',
  buyer_proof: 'Подтверждение покупателя',
  other: 'Документ по сделке',
};

export const AiOcrPreAuditCard: React.FC<AiOcrPreAuditCardProps> = ({
  job,
  lot,
  onReprocess,
  isReprocessing,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const fields = job.extractedFields;
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isProcessing = job.status === 'processing' || job.status === 'queued';

  if (!isCompleted && !isFailed && !isProcessing) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-linear-to-b from-indigo-50/70 via-white to-slate-50 p-4 sm:p-5 text-xs shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-indigo-950 text-xs sm:text-sm">
                AI Pre-Audit Draft (Yandex Vision OCR — 152-ФЗ РФ)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                {DOC_TYPE_TITLES[fields?.detectedDocType || job.docCategory] || job.docCategory}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-0.5">
              Предварительный разбор ИИ — окончательное решение принимает куратор
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onReprocess && isCompleted && (
            <button
              type="button"
              onClick={onReprocess}
              disabled={isReprocessing}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-[11px] flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Повторить оптическое распознавание"
            >
              <RefreshCw className={`w-3 h-3 ${isReprocessing ? 'animate-spin' : ''}`} />
              <span>Повторить</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-indigo-100/50 cursor-pointer"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-600 shrink-0" />
          <div>
            <p className="font-bold text-xs">Документ в процессе распознавания Yandex Vision...</p>
            <p className="text-[11px] text-amber-700">
              {job.status === 'queued' ? 'Ожидание в очереди YMQ' : 'Обработка страниц и извлечение реквизитов'}
            </p>
          </div>
        </div>
      )}

      {/* Failed State */}
      {isFailed && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold text-xs">Сбой оптического распознавания</p>
            <p className="text-[11px] text-rose-700">{job.errorMessage || 'Не удалось распознать документ'}</p>
          </div>
        </div>
      )}

      {/* Completed Content */}
      {isCompleted && fields && expanded && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Страниц</span>
              <span className="text-sm font-black text-slate-800">{job.pagesProcessed || 1} стр.</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Точность ИИ</span>
              <span className="text-sm font-black text-emerald-600">{fields.confidenceScore}%</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Расход Vision</span>
              <span className="text-sm font-black text-slate-800">{job.estimatedCostRub?.toFixed(2) || '0.20'} ₽</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Флаги рисков</span>
              <span
                className={`text-sm font-black ${
                  fields.riskFlags.length > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {fields.riskFlags.length} обнаружено
              </span>
            </div>
          </div>

          {/* Cross Check Warnings */}
          {fields.crossCheckWarnings && fields.crossCheckWarnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5 animate-fade-in">
              <div className="flex items-center space-x-1.5 text-rose-900 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Обнаружены расхождения с заявкой продавца (&gt; 3%):</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-rose-800 text-[11px]">
                {fields.crossCheckWarnings.map((w, idx) => (
                  <li key={idx}>
                    <strong>{w.field}:</strong> {w.messageRu}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Declared vs Extracted Comparison Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-[11px]">
              Сверка ключевых параметров (Заявлено куратором vs Распознано ИИ)
            </div>
            <div className="divide-y divide-slate-100 text-[11px]">
              <div className="px-3.5 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Кадастровый номер:</span>
                <span className="font-mono font-bold text-slate-900">
                  {fields.cadastralNumber || 'Не найден в документе'}
                </span>
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Номер и дата ДДУ:</span>
                <span className="font-mono font-bold text-slate-900">
                  {fields.dduNumber ? `№ ${fields.dduNumber}` : '—'}{' '}
                  {fields.dduDate ? `от ${fields.dduDate}` : ''}
                </span>
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Площадь квартиры:</span>
                <div className="space-x-2">
                  {lot?.areaM2 && <span className="text-slate-400 line-through">Заявлено: {lot.areaM2} м²</span>}
                  <span className="font-bold text-slate-900">
                    {fields.areaSqm ? `${fields.areaSqm} м²` : '—'}
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Цена договора (ДДУ):</span>
                <div className="space-x-2">
                  {lot?.dduContractPrice && (
                    <span className="text-slate-400 line-through">
                      Заявлено: {formatRubles(lot.dduContractPrice)}
                    </span>
                  )}
                  <span className="font-bold text-slate-900 font-mono">
                    {fields.fullPriceRub ? formatRubles(fields.fullPriceRub) : '—'}
                  </span>
                </div>
              </div>

              <div className="px-3.5 py-2 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Внесено / оплачено:</span>
                <div className="space-x-2">
                  {lot?.cashPaidBySeller && (
                    <span className="text-slate-400 line-through">
                      Заявлено: {formatRubles(lot.cashPaidBySeller)}
                    </span>
                  )}
                  <span className="font-bold text-emerald-700 font-mono">
                    {fields.paidAmountRub ? formatRubles(fields.paidAmountRub) : '—'}
                  </span>
                </div>
              </div>

              {fields.developerName && (
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Застройщик:</span>
                  <span className="font-bold text-slate-900">
                    {fields.developerName} {fields.developerInn ? `(ИНН ${fields.developerInn})` : ''}
                  </span>
                </div>
              )}

              {fields.escrowBankName && (
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Эскроу / Банк:</span>
                  <span className="font-bold text-indigo-700">{fields.escrowBankName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Risk Flags Section */}
          {fields.riskFlags.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                Обнаруженные маркеры юридических рисков:
              </span>
              <div className="space-y-2">
                {fields.riskFlags.map((rf, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border space-y-1 ${
                      rf.severity === 'high'
                        ? 'bg-rose-50/60 border-rose-200 text-rose-900'
                        : 'bg-amber-50/60 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <div className="flex items-center space-x-1.5">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 ${
                            rf.severity === 'high' ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        />
                        <span>{rf.labelRu}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-white text-[10px] font-mono border">
                        Стр. {rf.pageNumber}
                      </span>
                    </div>
                    {rf.excerpt && (
                      <p className="font-mono text-[10px] bg-white/70 p-2 rounded-lg border border-slate-200/50 text-slate-700 italic">
                        «{rf.excerpt}»
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
