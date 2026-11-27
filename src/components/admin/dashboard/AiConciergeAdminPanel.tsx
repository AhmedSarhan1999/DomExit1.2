/**
 * AiConciergeAdminPanel.tsx — AI Лаборатория (Beta)
 * Admin Panel for DomExit AI Concierge & Zero-Cost S3 Vector RAG.
 *
 * Features:
 * 1. S3 RAG Index Status (chunks count, S3 compressed size, sources breakdown).
 * 2. Manual Incremental Reindex trigger button.
 * 3. Interactive Testing Box for the Owner.
 * 4. Pending Warm Handoffs Queue with "Отметить обработанным" button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Database,
  RefreshCw,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  FileText,
  Building,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

interface AiConciergeAdminPanelProps {
  connectors?: any;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const AiConciergeAdminPanel: React.FC<AiConciergeAdminPanelProps> = ({
  connectors,
  showToast,
  showError,
}) => {
  const ragConnector = connectors?.conciergeRag;

  const [reindexing, setReindexing] = useState(false);
  const [indexMeta, setIndexMeta] = useState<any>(ragConnector || null);

  // Testing Sandbox
  const [testQuery, setTestQuery] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Warm Handoffs
  const [handoffs, setHandoffs] = useState<any[]>([]);
  const [loadingHandoffs, setLoadingHandoffs] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadHandoffs = useCallback(async () => {
    try {
      setLoadingHandoffs(true);
      const res = await apiClient.aiLab.getConciergeHandoffs();
      if (res.ok) {
        setHandoffs(res.handoffs || []);
      }
    } catch (err: any) {
      showError('Ошибка загрузки очереди куратора: ' + err.message);
    } finally {
      setLoadingHandoffs(false);
    }
  }, [showError]);

  useEffect(() => {
    loadHandoffs();
  }, [loadHandoffs]);

  const handleReindex = async () => {
    try {
      setReindexing(true);
      const res = await apiClient.aiLab.rebuildRagIndex();
      if (res.ok) {
        setIndexMeta(res.meta);
        showToast(
          `Фهرس RAG обновлен: ${res.meta.chunksCount} مقاطع (جديد: ${res.meta.embeddedNewCount}, معاد استخدامه: ${res.meta.reusedCachedCount}, حجم: ${res.meta.compressedSizeKb} KB)`
        );
      }
    } catch (err: any) {
      showError('Ошибка переиндексации: ' + err.message);
    } finally {
      setReindexing(false);
    }
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim() || testing) return;

    try {
      setTesting(true);
      setTestResult(null);
      const res = await apiClient.aiLab.sendConciergeMessage({
        messageText: testQuery.trim(),
      });
      if (res.ok) {
        setTestResult(res);
      }
    } catch (err: any) {
      showError('Ошибка тестирования RAG: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleResolveHandoff = async (sessionId: string) => {
    try {
      setResolvingId(sessionId);
      const res = await apiClient.aiLab.resolveConciergeHandoff(sessionId);
      if (res.ok) {
        showToast('Запрос куратора отмечен как обработанный');
        setHandoffs((prev) => prev.filter((h) => h.id !== sessionId));
      }
    } catch (err: any) {
      showError('Ошибка закрытия запроса: ' + err.message);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
      {/* Panel Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/50 via-white to-slate-50/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">AI-Консьерж & S3 Vector RAG (Этап 09)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                0 ₽ Vector DB
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Векторная база в S3 (_ai_rag) + YandexGPT Embeddings (256-dim) + Guided Buy-Box + Warm Human Handoff
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReindex}
          disabled={reindexing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50 shadow-xs"
        >
          {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{reindexing ? 'Индексация...' : 'Обновить базу знаний (RAG Reindex)'}</span>
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500">Количество чанков в S3</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {indexMeta?.chunksCount || indexMeta?.indexChunksCount || 0}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">4 одобренных источника</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500">Сжатый размер индекса (Gzip)</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {indexMeta?.compressedSizeKb ? `${indexMeta.compressedSizeKb} KB` : '—'}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Кэш в памяти appCache (10 мин)</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500">Запросов сегодня</span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {ragConnector?.dailyMessagesUsed || 0} / {ragConnector?.dailyMessagesCap || 200}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Защита от перерасхода токенов</span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500">Вызовы куратора в очереди</span>
            <p className="text-xl font-bold text-amber-600 mt-1">{handoffs.length}</p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Warm Handoffs ожидают связи</span>
          </div>
        </div>

        {/* 152-FZ Zero-PII Guarantee Banner */}
        <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-xl flex items-start space-x-3 text-xs text-emerald-900">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Гарантия суверенности и 152-ФЗ Zero-PII RAG:</p>
            <p className="text-emerald-800 mt-0.5">
              В индекс S3 категорически запрещено попадание персональных данных продавцов, покупателей, сделок и документов.
              Индексируются исключительно 4 открытых источника: база знаний DomExit, официальные регламенты, опубликованные статьи и открытые параметры свободных лотов.
            </p>
          </div>
        </div>

        {/* Interactive RAG Tester */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900">Тестирование AI-Консьержа (Песочница владельца)</h4>
          </div>

          <form onSubmit={handleRunTest} className="flex gap-2">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Введите тестовый вопрос (например: Как защищены деньги при переуступке? или Нужна 2ккв до 14 млн)"
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={!testQuery.trim() || testing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-40"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Спросить</span>
            </button>
          </form>

          {/* Test Results Output */}
          {testResult && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 text-xs animate-in fade-in duration-200">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ответ AI-Консьержа:</span>
                <p className="mt-1 text-slate-800 leading-relaxed whitespace-pre-wrap">{testResult.replyRu}</p>
              </div>

              {testResult.citations && testResult.citations.length > 0 && (
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">Найденные источники:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {testResult.citations.map((c: any, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-medium flex items-center space-x-1"
                      >
                        <FileText className="w-2.5 h-2.5 text-slate-400" />
                        <span>{c.title} ({c.url})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {testResult.suggestedBuyBox && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900">
                  <span className="font-bold">✓ Распознан Buy-Box: </span>
                  <pre className="mt-1 font-mono text-[10px] overflow-x-auto">
                    {JSON.stringify(testResult.suggestedBuyBox, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pending Warm Handoffs Queue */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-amber-500" />
              <span>Очередь вызовов куратора (Warm Handoffs)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {handoffs.length} {handoffs.length === 1 ? 'запрос' : 'запросов'}
            </span>
          </div>

          {loadingHandoffs ? (
            <div className="py-6 flex items-center justify-center text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500 mr-2" />
              Загрузка очереди...
            </div>
          ) : handoffs.length === 0 ? (
            <div className="py-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs">
              Все диалоги обработаны. Активных вызовов куратора нет.
            </div>
          ) : (
            <div className="space-y-3">
              {handoffs.map((h) => (
                <div
                  key={h.id}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                        {h.channel === 'telegram' ? 'Telegram OS' : 'Web-виджет'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">id: {h.id}</span>
                      <span className="text-[11px] text-slate-400">{h.handoffRequestedAt?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="font-semibold text-slate-800">{h.handoffSummaryRu || 'Запрос живого куратора из чата'}</p>
                    {h.extractedBuyBoxDraft && (
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg font-mono">
                        Бюджет: {h.extractedBuyBoxDraft.maxBudgetRub ? `${(h.extractedBuyBoxDraft.maxBudgetRub / 1000000).toFixed(1)} млн ₽` : 'Не указан'} | Районы: {JSON.stringify(h.extractedBuyBoxDraft.districts || [])}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleResolveHandoff(h.id)}
                    disabled={resolvingId === h.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {resolvingId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Отметить обработанным</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
