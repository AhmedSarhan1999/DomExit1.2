/**
 * AiAgentBridgePanel.tsx — External Agent Research Bridge Panel
 *
 * Manages external AI market research tasks (developer price checks, comparables, news),
 * zero-PII task generation, webhook ingestion, manual review, and market benchmarks storage.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  Copy,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Globe,
  Plus,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
  Building2,
  Layers,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { formatRubles } from '../../../utils/formatters';

interface AiAgentBridgePanelProps {
  connectors?: any;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

const TASK_STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  queued: { label: 'В очереди', badgeClass: 'bg-amber-100 text-amber-800' },
  dispatched: { label: 'Отправлено агенту', badgeClass: 'bg-blue-100 text-blue-800' },
  result_received: { label: 'Ждёт проверки', badgeClass: 'bg-purple-100 text-purple-800 font-black animate-pulse' },
  approved: { label: 'Утверждено', badgeClass: 'bg-emerald-100 text-emerald-800 font-bold' },
  rejected: { label: 'Отклонено', badgeClass: 'bg-rose-100 text-rose-800' },
  failed: { label: 'Ошибка доставки', badgeClass: 'bg-red-100 text-red-800' },
};

const TASK_TYPE_LABELS: Record<string, string> = {
  developer_price_check: 'Цены застройщика',
  district_comparables: 'Аналоги в районе',
  developer_handover_news: 'Статус стройки',
  mortgage_programs: 'Ипотечные программы',
  legislative_topic: 'Правовой вопрос',
};

export const AiAgentBridgePanel: React.FC<AiAgentBridgePanelProps> = ({
  connectors,
  showToast,
  showError,
}) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Task Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    taskType: 'developer_price_check',
    lotCode: '',
    title: '',
    complexName: '',
    developerName: '',
    region: 'Санкт-Петербург',
    district: '',
    rooms: '1-комнатная',
    areaSqm: 40,
    handoverQuarter: '',
    question: '',
    deliveryChannel: 'manual_copy',
    autoDispatch: false,
  });

  // Manual Result Modal State
  const [manualModalTask, setManualModalTask] = useState<any | null>(null);
  const [manualInputText, setManualInputText] = useState<string>('');
  const [submittingManual, setSubmittingManual] = useState<boolean>(false);

  // Review Modal State
  const [reviewModalTask, setReviewModalTask] = useState<any | null>(null);
  const [applyToLotPrice, setApplyToLotPrice] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [reviewing, setReviewing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, benchRes] = await Promise.all([
        apiClient.aiLab.getTasks(),
        apiClient.aiLab.getBenchmarks({ limit: 20 }),
      ]);
      setTasks(tasksRes.tasks || []);
      setBenchmarks(benchRes.benchmarks || []);
    } catch (err: any) {
      showError('Ошибка загрузки данных Agent Bridge: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyPrompt = (task: any) => {
    navigator.clipboard?.writeText(task.generatedAgentPrompt);
    setCopiedId(task.id);
    showToast(`✅ Промпт задачи #${task.id} скопирован в буфер обмена`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDispatch = async (task: any, channel?: string) => {
    try {
      const res = await apiClient.aiLab.dispatchTask(task.id, channel);
      if (res.ok) {
        showToast(`✅ Задача #${task.id} отправлена через ${res.channel || task.deliveryChannel}`);
        loadData();
      } else {
        showError('Ошибка отправки: ' + (res.error || 'Неизвестная ошибка'));
      }
    } catch (err: any) {
      showError('Ошибка отправки: ' + err.message);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        taskType: createForm.taskType,
        lotCode: createForm.lotCode ? createForm.lotCode.trim().toUpperCase() : undefined,
        title: createForm.title || `${TASK_TYPE_LABELS[createForm.taskType] || 'Исследование'}: ${createForm.complexName}`,
        publicQueryPayload: {
          complexName: createForm.complexName,
          developerName: createForm.developerName,
          region: createForm.region,
          district: createForm.district,
          rooms: createForm.rooms,
          areaSqm: Number(createForm.areaSqm) || undefined,
          handoverQuarter: createForm.handoverQuarter,
          question: createForm.question,
        },
        deliveryChannel: createForm.deliveryChannel,
        autoDispatch: createForm.autoDispatch,
      };

      const res = await apiClient.aiLab.createTask(payload);
      if (res.ok) {
        showToast(`✅ Задача #${res.task.id} успешно создана`);
        setShowCreateModal(false);
        setCreateForm({
          taskType: 'developer_price_check',
          lotCode: '',
          title: '',
          complexName: '',
          developerName: '',
          region: 'Санкт-Петербург',
          district: '',
          rooms: '1-комнатная',
          areaSqm: 40,
          handoverQuarter: '',
          question: '',
          deliveryChannel: 'manual_copy',
          autoDispatch: false,
        });
        loadData();
      }
    } catch (err: any) {
      showError(err.message || 'Ошибка создания задачи');
    } finally {
      setCreating(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualModalTask || !manualInputText.trim()) return;
    setSubmittingManual(true);
    try {
      const res = await apiClient.aiLab.submitManualResult(manualModalTask.id, {
        rawResultText: manualInputText.trim(),
      });
      if (res.ok) {
        showToast(`✅ Ответ для задачи #${manualModalTask.id} сохранен и ожидает проверки`);
        setManualModalTask(null);
        setManualInputText('');
        loadData();
      }
    } catch (err: any) {
      showError('Ошибка обработки ответа: ' + err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleReviewDecision = async (decision: 'approve' | 'reject') => {
    if (!reviewModalTask) return;
    setReviewing(true);
    try {
      const res = await apiClient.aiLab.reviewTask(reviewModalTask.id, {
        decision,
        applyToLotPrice,
        reviewNotes,
      });
      if (res.ok) {
        showToast(
          decision === 'approve'
            ? `✅ Результат утвержден и добавлен в базу бенчмарков`
            : `⚠️ Результат задачи отклонен`
        );
        setReviewModalTask(null);
        setReviewNotes('');
        setApplyToLotPrice(false);
        loadData();
      }
    } catch (err: any) {
      showError('Ошибка рассмотрения: ' + err.message);
    } finally {
      setReviewing(false);
    }
  };

  const webhookUrl = connectors?.agentBridge?.webhookUrl || '/api/ai/agent-bridge/webhook/result';

  return (
    <div className="space-y-6">
      {/* Settings & Webhook Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Мост внешних AI-агентов (n8n / Telegram / Webhook)
              </h3>
              <p className="text-xs text-slate-500">
                Автоматическая отправка запросов и защищенный прием структурированных рыночных данных
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Новая задача исследования</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 font-mono">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans flex items-center justify-between">
              <span>Webhook для приема ответов</span>
              <span className="text-emerald-700 font-black">POST</span>
            </div>
            <div className="text-slate-800 break-all select-all font-semibold">
              {webhookUrl}
            </div>
            <div className="text-[11px] text-slate-500 font-sans">
              Заголовки: <code>X-DomExit-Signature: sha256=...</code>, <code>X-DomExit-Timestamp: ISO</code>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 font-sans">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Статус подключения
            </div>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1.5">
                {connectors?.agentBridge?.webhookSecretConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className="font-semibold text-slate-700">HMAC-секрет</span>
              </span>

              <span className="flex items-center space-x-1.5">
                {connectors?.agentBridge?.outboundWebhookConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                )}
                <span className="font-semibold text-slate-700">n8n Webhook</span>
              </span>

              {connectors?.agentBridge?.pendingReviewCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-black text-[11px]">
                  Ждут проверки: {connectors.agentBridge.pendingReviewCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 152-FZ Zero-PII Shield Notice */}
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <b>Шлюз 152-ФЗ активен:</b> во внешние запросы передаются исключительно публичные данные (ЖК, застройщик, комнатность, площадь). Любые телефоны, email или ФИО автоматически блокируются.
          </span>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Очередь задач исследований</h4>
            <p className="text-xs text-slate-500">Все отправленные и полученные от агентов исследования</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Нет активных задач исследований. Нажмите «Новая задача исследования» для запуска.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ID / Тип</th>
                  <th className="py-3 px-4">Объект / ЖК</th>
                  <th className="py-3 px-4">Канал / Статус</th>
                  <th className="py-3 px-4">Результат</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => {
                  const statusInfo = TASK_STATUS_CONFIG[t.status] || {
                    label: t.status,
                    badgeClass: 'bg-slate-100 text-slate-700',
                  };
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900">#{t.id}</div>
                        <div className="text-[11px] text-slate-500 font-sans">
                          {TASK_TYPE_LABELS[t.taskType] || t.taskType}
                        </div>
                        {t.lotCode && (
                          <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                            Лот {t.lotCode}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {t.publicQueryPayload?.complexName || 'Не указан'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t.publicQueryPayload?.region || ''}
                          {t.publicQueryPayload?.areaSqm ? ` • ${t.publicQueryPayload.areaSqm} м²` : ''}
                          {t.publicQueryPayload?.rooms ? ` • ${t.publicQueryPayload.rooms}` : ''}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          {t.deliveryChannel}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {t.structuredResult ? (
                          <div className="space-y-0.5">
                            {t.structuredResult.developerFullPriceRub && (
                              <div className="font-bold text-slate-900">
                                {formatRubles(t.structuredResult.developerFullPriceRub)}
                              </div>
                            )}
                            {t.structuredResult.developerPricePerSqmRub && (
                              <div className="text-[11px] text-emerald-700 font-medium">
                                {formatRubles(t.structuredResult.developerPricePerSqmRub)}/м²
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 truncate max-w-xs">
                              {t.structuredResult.summaryRu}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Ожидание ответа</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(t)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] inline-flex items-center space-x-1"
                          title="Скопировать промпт"
                        >
                          {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Промпт</span>
                        </button>

                        {t.status === 'queued' && (
                          <button
                            type="button"
                            onClick={() => handleDispatch(t)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] inline-flex items-center space-x-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Отправить</span>
                          </button>
                        )}

                        {(t.status === 'dispatched' || t.status === 'queued') && (
                          <button
                            type="button"
                            onClick={() => {
                              setManualModalTask(t);
                              setManualInputText(t.rawResultText || '');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-[11px] inline-flex items-center space-x-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Вставить ответ</span>
                          </button>
                        )}

                        {t.status === 'result_received' && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalTask(t);
                              setApplyToLotPrice(Boolean(t.lotCode));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] inline-flex items-center space-x-1"
                          >
                            <span>Проверить</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {t.status === 'approved' && (
                          <span className="text-[11px] font-bold text-emerald-700 inline-flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Применено</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Benchmarks Section */}
      {benchmarks.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900 text-sm">
              База рыночных цен застройщиков (Market Benchmarks)
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {benchmarks.slice(0, 6).map((b) => (
              <div
                key={b.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 truncate">{b.complexName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(b.verifiedAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
                <div className="flex items-baseline space-x-2">
                  {b.developerPricePerSqmRub && (
                    <span className="font-black text-emerald-800 text-sm">
                      {formatRubles(b.developerPricePerSqmRub)}/м²
                    </span>
                  )}
                  {b.developerFullPriceRub && (
                    <span className="text-slate-500 font-medium">
                      ({formatRubles(b.developerFullPriceRub)})
                    </span>
                  )}
                </div>
                {b.secondaryAvgPricePerSqmRub && (
                  <div className="text-[11px] text-slate-600">
                    Вторичка в районе: {formatRubles(b.secondaryAvgPricePerSqmRub)}/м²
                  </div>
                )}
                {b.sources && b.sources.length > 0 && (
                  <div className="text-[10px] text-slate-500 truncate">
                    Источник: {b.sources[0].name}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-slate-900 text-base">Новая задача исследования рынка</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Тип исследования *</label>
                  <select
                    value={createForm.taskType}
                    onChange={(e) => setCreateForm({ ...createForm, taskType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Код лота (опционально)</label>
                  <input
                    type="text"
                    value={createForm.lotCode}
                    onChange={(e) => setCreateForm({ ...createForm, lotCode: e.target.value })}
                    placeholder="Напр. U-12345"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ЖК / Мраморный комплекс *</label>
                <input
                  type="text"
                  required
                  value={createForm.complexName}
                  onChange={(e) => setCreateForm({ ...createForm, complexName: e.target.value })}
                  placeholder="Например: ЖК «Приморский квартал»"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Застройщик</label>
                  <input
                    type="text"
                    value={createForm.developerName}
                    onChange={(e) => setCreateForm({ ...createForm, developerName: e.target.value })}
                    placeholder="Группа ЛСР / Setl Group"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Регион / Город</label>
                  <input
                    type="text"
                    value={createForm.region}
                    onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
                    placeholder="Санкт-Петербург"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Комнатность</label>
                  <input
                    type="text"
                    value={createForm.rooms}
                    onChange={(e) => setCreateForm({ ...createForm, rooms: e.target.value })}
                    placeholder="1-к. кв."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Площадь (м²)</label>
                  <input
                    type="number"
                    value={createForm.areaSqm}
                    onChange={(e) => setCreateForm({ ...createForm, areaSqm: Number(e.target.value) || 0 })}
                    placeholder="40"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Срок сдачи</label>
                  <input
                    type="text"
                    value={createForm.handoverQuarter}
                    onChange={(e) => setCreateForm({ ...createForm, handoverQuarter: e.target.value })}
                    placeholder="4 кв. 2026"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Уточняющий вопрос агенту</label>
                <textarea
                  rows={2}
                  value={createForm.question}
                  onChange={(e) => setCreateForm({ ...createForm, question: e.target.value })}
                  placeholder="Проверить минимальную цену застройщика в данном корпусе и наличие акций..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900 flex items-start space-x-2 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <b>Защита 152-ФЗ:</b> в задаче запрещено указывать ФИО, контакты, телефоны или паспортные данные. Ввод PII приведет к отклонению запроса.
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={createForm.autoDispatch}
                    onChange={(e) => setCreateForm({ ...createForm, autoDispatch: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span>Отправить сразу через Webhook/Telegram</span>
                </label>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl font-bold"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !createForm.complexName.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center space-x-1.5"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Создать задачу</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL RESULT MODAL */}
      {manualModalTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Вставить ответ агента (#{manualModalTask.id})
                </h3>
                <p className="text-xs text-slate-500">
                  {manualModalTask.publicQueryPayload?.complexName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalTask(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">
                Вставьте сырой текст ответа или JSON из чата агента:
              </label>
              <textarea
                rows={10}
                value={manualInputText}
                onChange={(e) => setManualInputText(e.target.value)}
                placeholder='{"developerPricePerSqmRub": 250000, "developerFullPriceRub": 16000000, "summaryRu": "..."}'
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-[11px] bg-slate-50"
              />
              <p className="text-[11px] text-slate-500">
                Поддерживается как чистый JSON, так и текст Markdown с блоком <code>```json ... ```</code>.
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setManualModalTask(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={submittingManual || !manualInputText.trim()}
                onClick={handleManualSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl flex items-center space-x-1.5"
              >
                {submittingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Разобрать и сохранить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & APPROVE MODAL */}
      {reviewModalTask && reviewModalTask.structuredResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  Проверка исследования (#{reviewModalTask.id})
                </h3>
                <p className="text-slate-500">
                  {reviewModalTask.publicQueryPayload?.complexName} ({reviewModalTask.publicQueryPayload?.region})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalTask(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">Цена застройщика за м²</span>
                  <span className="font-black text-slate-900 text-sm">
                    {reviewModalTask.structuredResult.developerPricePerSqmRub
                      ? `${formatRubles(reviewModalTask.structuredResult.developerPricePerSqmRub)}/м²`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Полная цена застройщика</span>
                  <span className="font-black text-slate-900 text-sm">
                    {reviewModalTask.structuredResult.developerFullPriceRub
                      ? formatRubles(reviewModalTask.structuredResult.developerFullPriceRub)
                      : '—'}
                  </span>
                </div>
              </div>

              {reviewModalTask.structuredResult.secondaryAvgPricePerSqmRub && (
                <div>
                  <span className="text-slate-500 block text-[11px]">Средняя цена вторички в районе</span>
                  <span className="font-bold text-slate-800">
                    {formatRubles(reviewModalTask.structuredResult.secondaryAvgPricePerSqmRub)}/м²
                  </span>
                </div>
              )}

              <div>
                <span className="text-slate-500 block text-[11px] mb-1">Аналитическое резюме</span>
                <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                  {reviewModalTask.structuredResult.summaryRu}
                </p>
              </div>

              {reviewModalTask.structuredResult.comparables?.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[11px] mb-1">
                    Найденные аналоги ({reviewModalTask.structuredResult.comparables.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {reviewModalTask.structuredResult.comparables.map((c: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-medium text-slate-800 truncate mr-2">{c.title}</span>
                        <span className="font-bold text-slate-900 shrink-0">{formatRubles(c.priceRub)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewModalTask.structuredResult.sources?.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[11px] mb-1">Источники</span>
                  <div className="text-[11px] text-slate-600 space-y-0.5">
                    {reviewModalTask.structuredResult.sources.map((s: any, idx: number) => (
                      <div key={idx} className="flex items-center space-x-1">
                        <span>• {s.name}</span>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            <ExternalLink className="w-3 h-3 inline ml-1" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {reviewModalTask.lotCode && (
              <label className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-xl p-3 cursor-pointer text-blue-900 font-bold">
                <input
                  type="checkbox"
                  checked={applyToLotPrice}
                  onChange={(e) => setApplyToLotPrice(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span>
                  Применить цену застройщика ({formatRubles(reviewModalTask.structuredResult.developerFullPriceRub || 0)}) к карточке лота #{reviewModalTask.lotCode}
                </span>
              </label>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Заметка ревьюера</label>
              <input
                type="text"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Проверено по официальному сайту застройщика..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
              />
            </div>

            <div className="flex justify-between items-center pt-2 font-bold">
              <button
                type="button"
                disabled={reviewing}
                onClick={() => handleReviewDecision('reject')}
                className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl"
              >
                Отклонить результат
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setReviewModalTask(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl"
                >
                  Закрыть
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => handleReviewDecision('approve')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center space-x-1.5"
                >
                  {reviewing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Утвердить и применить</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
