/**
 * AiLegislativeRadarPanel.tsx — AI Лаборатория (Beta)
 * Russian Legislative Radar & Regulatory Compliance Scanner + SEO & Telegram Draft Generator
 *
 * 152-FZ Sovereign & Multi-Stage FinOps Pipeline:
 * - Scans 6 official Russian feeds (CBR, Pravo.gov, Duma, Minstroy, FNS, Supreme Court).
 * - YandexGPT Lite classification (<0.50 ₽ / batch) & high-impact compliance alerts.
 * - YandexGPT Pro SEO Article + Telegram post draft generation.
 * - Human-in-the-Loop: ZERO automatic publishing or policy overwriting.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Radio,
  FileText,
  Send,
  PlusCircle,
  RefreshCw,
  ExternalLink,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  Copy,
  Edit3,
  X,
  Loader2,
  Sparkles,
  ShieldCheck,
  Tag,
  Clock,
  Eye,
  Globe,
} from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

interface AiLegislativeRadarPanelProps {
  connectors?: any;
  showToast: (msg: string) => void;
  showError: (msg: string) => void;
}

export const AiLegislativeRadarPanel: React.FC<AiLegislativeRadarPanelProps> = ({
  connectors,
  showToast,
  showError,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'radar' | 'journal'>('radar');

  // Radar state
  const [radarItems, setRadarItems] = useState<any[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Manual modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualExcerpt, setManualExcerpt] = useState('');
  const [manualCategory, setManualCategory] = useState('ddu_214fz');
  const [submittingManual, setSubmittingManual] = useState(false);

  // Draft generation state
  const [generatingDraftId, setGeneratingDraftId] = useState<string | null>(null);

  // Journal drafts state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [copiedTelegram, setCopiedTelegram] = useState(false);

  // Publish / Unpublish state
  const [publishingArticleId, setPublishingArticleId] = useState<string | null>(null);
  const [modalPublishTelegram, setModalPublishTelegram] = useState(false);
  const [modalTelegramDryRun, setModalTelegramDryRun] = useState(true);

  // Manual article create modal
  const [showManualArticleModal, setShowManualArticleModal] = useState(false);
  const [newArticleTitle, setNewArticleTitle] = useState('');
  const [newArticleSubtitle, setNewArticleSubtitle] = useState('');
  const [newArticleBody, setNewArticleBody] = useState('');
  const [newArticleCategory, setNewArticleCategory] = useState('ddu_214fz');
  const [creatingArticle, setCreatingArticle] = useState(false);

  // 1. Load radar items
  const loadRadarItems = useCallback(async () => {
    try {
      setRadarLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const res = await apiClient.aiLab.getRadarItems(params);
      if (res.ok) {
        setRadarItems(res.items || []);
      }
    } catch (err: any) {
      showError('Ошибка загрузки данных радара: ' + err.message);
    } finally {
      setRadarLoading(false);
    }
  }, [statusFilter, categoryFilter, showError]);

  // 2. Load journal drafts
  const loadJournalDrafts = useCallback(async () => {
    try {
      setDraftsLoading(true);
      const res = await apiClient.aiLab.getJournalDrafts();
      if (res.ok) {
        setDrafts(res.drafts || []);
      }
    } catch (err: any) {
      showError('Ошибка загрузки черновиков статей: ' + err.message);
    } finally {
      setDraftsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (activeSubTab === 'radar') {
      loadRadarItems();
    } else {
      loadJournalDrafts();
    }
  }, [activeSubTab, loadRadarItems, loadJournalDrafts]);

  // Scan 6 official sources
  const handleRunScan = async () => {
    try {
      setScanning(true);
      const res = await apiClient.aiLab.scanRadar();
      if (res.ok) {
        const { totalFetched, totalSaved, highImpactCount } = res.result;
        showToast(
          `Сканирование завершено: проверено ${totalFetched} новостей, сохранено ${totalSaved} релевантных (${highImpactCount} с высоким риском)`
        );
        loadRadarItems();
      }
    } catch (err: any) {
      showError('Ошибка сканирования источников: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  // Submit manual legal item
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showError('Укажите заголовок закона или новости');
      return;
    }

    try {
      setSubmittingManual(true);
      const res = await apiClient.aiLab.ingestManualRadar({
        originalTitle: manualTitle.trim(),
        originalUrl: manualUrl.trim() || undefined,
        excerptRaw: manualExcerpt.trim() || undefined,
        category: manualCategory,
      });

      if (res.ok) {
        showToast('Закон/новость успешно классифицирована и добавлена в радар');
        setShowManualModal(false);
        setManualTitle('');
        setManualUrl('');
        setManualExcerpt('');
        loadRadarItems();
      }
    } catch (err: any) {
      showError('Ошибка добавления: ' + err.message);
    } finally {
      setSubmittingManual(false);
    }
  };

  // Update radar item status (reviewed / applied_to_policy / dismissed)
  const handleUpdateRadarStatus = async (id: string, status: string) => {
    try {
      const res = await apiClient.aiLab.updateRadarItem(id, { status });
      if (res.ok) {
        showToast(status === 'applied_to_policy' ? 'Отмечено: Учтено в политике DomExit' : 'Статус обновлен');
        loadRadarItems();
      }
    } catch (err: any) {
      showError('Ошибка обновления статуса: ' + err.message);
    }
  };

  // Generate article draft via YandexGPT Pro
  const handleGenerateDraft = async (id: string) => {
    try {
      setGeneratingDraftId(id);
      const res = await apiClient.aiLab.generateRadarDraft(id);
      if (res.ok) {
        showToast(
          res.isCached
            ? 'Загружен существующий черновик статьи'
            : `Статья и Telegram-пост созданы (${res.usageTokens || 0} токенов, ~${res.estimatedCostRub || 0} ₽)`
        );
        loadRadarItems();
        setActiveSubTab('journal');
      }
    } catch (err: any) {
      showError('Ошибка генерации статьи YandexGPT Pro: ' + err.message);
    } finally {
      setGeneratingDraftId(null);
    }
  };

  // Save edited journal draft
  const handleSaveDraft = async () => {
    if (!editingDraft) return;
    try {
      setSavingDraft(true);
      const res = await apiClient.aiLab.updateJournalDraft(editingDraft.id, {
        titleRu: editingDraft.titleRu,
        subtitleRu: editingDraft.subtitleRu,
        markdownBodyRu: editingDraft.markdownBodyRu,
        telegramPostDraftRu: editingDraft.telegramPostDraftRu,
        newsletterSnippetRu: editingDraft.newsletterSnippetRu,
        status: editingDraft.status,
      });

      if (res.ok) {
        showToast('Черновик сохранён и помечен как проверенный экспертом (humanEdited: true)');
        setEditingDraft(null);
        loadJournalDrafts();
      }
    } catch (err: any) {
      showError('Ошибка сохранения: ' + err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  // Publish article with YMYL gate check
  const handlePublishArticle = async (
    id: string,
    options: { publishToTelegram?: boolean; telegramDryRun?: boolean } = {}
  ) => {
    try {
      setPublishingArticleId(id);
      const res = await apiClient.aiLab.publishJournalArticle(id, {
        publishToTelegram: options.publishToTelegram ?? modalPublishTelegram,
        telegramDryRun: options.telegramDryRun ?? modalTelegramDryRun,
      });
      if (res.ok) {
        showToast(
          `Статья опубликована в Журнале!${
            res.telegramSent
              ? ' Пост опубликован в Telegram.'
              : res.telegramDryRun
              ? ' (Telegram проверен в режиме dry-run)'
              : ''
          }`
        );
        if (editingDraft && editingDraft.id === id) {
          setEditingDraft(null);
        }
        loadJournalDrafts();
      }
    } catch (err: any) {
      if (err.message?.includes('ARTICLE_YMYL_PLACEHOLDER_UNEDITED')) {
        showError(
          'Защита YMYL: В статье обнаружены неисправленные плейсхолдеры ([Добавьте..., TODO:). Отредактируйте текст перед публикацией!'
        );
      } else {
        showError('Ошибка публикации статьи: ' + err.message);
      }
    } finally {
      setPublishingArticleId(null);
    }
  };

  // Unpublish article
  const handleUnpublishArticle = async (id: string) => {
    try {
      setPublishingArticleId(id);
      const res = await apiClient.aiLab.unpublishJournalArticle(id);
      if (res.ok) {
        showToast('Статья снята с публикации (переведена в статус in_review)');
        loadJournalDrafts();
      }
    } catch (err: any) {
      showError('Ошибка снятия статьи с публикации: ' + err.message);
    } finally {
      setPublishingArticleId(null);
    }
  };

  // Create manual article
  const handleCreateManualArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArticleTitle.trim() || !newArticleBody.trim()) {
      showError('Заполните заголовок и текст статьи');
      return;
    }

    try {
      setCreatingArticle(true);
      const res = await apiClient.aiLab.createJournalArticle({
        titleRu: newArticleTitle.trim(),
        subtitleRu: newArticleSubtitle.trim() || undefined,
        markdownBodyRu: newArticleBody.trim(),
        category: newArticleCategory,
      });

      if (res.ok) {
        showToast('Новая статья успешно создана в статусе черновика!');
        setShowManualArticleModal(false);
        setNewArticleTitle('');
        setNewArticleSubtitle('');
        setNewArticleBody('');
        loadJournalDrafts();
      }
    } catch (err: any) {
      showError('Ошибка создания статьи: ' + err.message);
    } finally {
      setCreatingArticle(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTelegram(true);
    showToast('Пост скопирован в буфер обмена для Telegram!');
    setTimeout(() => setCopiedTelegram(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
      {/* Panel Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-amber-50/50 via-white to-slate-50/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">Радар законодательства РФ (Этап 07)</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                152-ФЗ Sovereign
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Мониторинг 6 официальных источников (ЦБ РФ, pravo.gov.ru, Госдума) + классификация YandexGPT Lite + генератор SEO-статей
            </p>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveSubTab('radar')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'radar' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-amber-500" />
            <span>Лента рисков ({radarItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('journal')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'journal' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-500" />
            <span>Черновики статей ({drafts.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: RADAR ITEMS */}
      {activeSubTab === 'radar' && (
        <div className="p-6 space-y-5">
          {/* Top Actions & Official Sources Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Источники:</span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                🏛️ ЦБ РФ
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                📜 Pravo.gov
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                🏛️ Госдума (СОЗД)
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                🏗️ Минстрой
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                💼 ФНС
              </span>
              <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700">
                ⚖️ Верховный Суд
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowManualModal(true)}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>+ Добавить закон вручную</span>
              </button>
              <button
                type="button"
                onClick={handleRunScan}
                disabled={scanning}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Запустить сканирование</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Статус:</span>
              {['all', 'new', 'reviewed', 'applied_to_policy', 'dismissed'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'Все' : st === 'new' ? 'Новые' : st === 'reviewed' ? 'Просмотренные' : st === 'applied_to_policy' ? 'Учтённые' : 'Скрытые'}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-500">Категория:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1 bg-white text-slate-700 font-medium focus:outline-none"
              >
                <option value="all">Все категории</option>
                <option value="ddu_214fz">214-ФЗ и ДДУ</option>
                <option value="mortgage_cbr">Ипотека и ставка ЦБ</option>
                <option value="tax_ndfl">Налоги и НДФЛ</option>
                <option value="matkapital">Материнский капитал</option>
                <option value="bankruptcy_127fz">Банкротство 127-ФЗ</option>
                <option value="court_practice">Судебная практика</option>
              </select>
            </div>
          </div>

          {/* Radar Items Cards */}
          {radarLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <p className="text-xs">Загрузка данных законодательного радара...</p>
            </div>
          ) : radarItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <Radio className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">В радаре пока нет новостей с выбранными фильтрами</p>
              <p className="text-xs text-slate-400 mt-1">
                Нажмите «Запустить сканирование» или добавьте новость вручную
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {radarItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.complianceImpact === 'high'
                      ? 'bg-rose-50/30 border-rose-200/80 shadow-xs'
                      : item.complianceImpact === 'medium'
                      ? 'bg-amber-50/30 border-amber-200/80'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500">
                          {item.sourceNameRu}
                        </span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] text-slate-400">
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ru-RU') : '—'}
                        </span>
                        {/* Impact Badge */}
                        {item.complianceImpact === 'high' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center space-x-1">
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                            <span>Высокий риск комплаенса</span>
                          </span>
                        ) : item.complianceImpact === 'medium' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Средний риск</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center space-x-1">
                            <Info className="w-3 h-3 text-slate-400" />
                            <span>Информационный</span>
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          Score: {item.relevanceScore}/100
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {item.originalTitle}
                      </h4>
                    </div>

                    <a
                      href={item.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all"
                    >
                      <span>Первоисточник</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Item Body: Summary & Impact Details */}
                  <div className="bg-white/80 border border-slate-100 rounded-xl p-3.5 space-y-2 mb-4 text-xs">
                    <p className="text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-900">Суть изменения: </span>
                      {item.summaryRu}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-bold text-slate-900">Кто затронут: </span>
                      {item.whoIsAffectedRu}
                    </p>
                    {item.complianceActionPlanRu && (
                      <p className="text-amber-800 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        <span className="font-bold">Рекомендация комплаенса: </span>
                        {item.complianceActionPlanRu}
                      </p>
                    )}
                  </div>

                  {/* DomExit Affected Areas & Card Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 mr-1">Зоны DomExit:</span>
                      {item.affectedDomExitAreas?.map((area: string, i: number) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 border border-slate-200/80 rounded-md text-[10px] font-mono text-slate-600"
                        >
                          {area}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.status !== 'applied_to_policy' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateRadarStatus(item.id, 'applied_to_policy')}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✓ Учтено в политике</span>
                        </button>
                      )}

                      {item.status !== 'dismissed' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateRadarStatus(item.id, 'dismissed')}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
                        >
                          Скрыть
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleGenerateDraft(item.id)}
                        disabled={generatingDraftId === item.id}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        {generatingDraftId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>✍ Создать черновик статьи</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: JOURNAL ARTICLES & TELEGRAM DRAFTS */}
      {activeSubTab === 'journal' && (
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl text-xs text-indigo-900">
            <div className="flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Защита Yandex YMYL & Human-in-the-Loop:</p>
                <p className="text-indigo-800 mt-0.5">
                  Все статьи сохраняются в статусе <span className="font-mono font-bold">ai_draft</span> с пометкой{' '}
                  <span className="font-mono font-bold">humanEdited: false</span>. Перед публикацией в Журнале
                  отредактируйте текст и добавьте блок «Комментарий эксперта DomExit» (5 минут) для высокого поискового рейтинга в Яндексе.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowManualArticleModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Написать статью вручную</span>
            </button>
          </div>

          {draftsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs">Загрузка черновиков статей...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Черновиков статей пока нет</p>
              <p className="text-xs text-slate-400 mt-1">
                Перейдите в «Ленту рисков» и нажмите «Создать черновик статьи» у любой важной новости или напишите вручную
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white shadow-xs space-y-3 transition-all"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {draft.status === 'published' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center space-x-1">
                            <Globe className="w-3 h-3 text-emerald-600" />
                            <span>Опубликовано</span>
                          </span>
                        ) : draft.status === 'in_review' ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-amber-600" />
                            <span>На проверке</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-full text-[10px] font-bold flex items-center space-x-1">
                            <Sparkles className="w-3 h-3 text-indigo-600" />
                            <span>AI-черновик</span>
                          </span>
                        )}
                        {draft.humanEdited && draft.status !== 'published' && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-medium">
                            ✓ Проверено экспертом
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                          slug: /{draft.slug}
                        </span>
                        <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>~{draft.readingTimeMin} мин</span>
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900">{draft.titleRu}</h4>
                      <p className="text-xs text-slate-500">{draft.subtitleRu}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/journal/${draft.slug}?preview=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>Предпросмотр</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(draft.telegramPostDraftRu)}
                        className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-sky-600" />
                        <span>{copiedTelegram ? 'Скопировано!' : 'Telegram'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDraft(draft)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Редактировать</span>
                      </button>
                      {draft.status === 'published' ? (
                        <button
                          type="button"
                          disabled={publishingArticleId === draft.id}
                          onClick={() => handleUnpublishArticle(draft.id)}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          {publishingArticleId === draft.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Снять</span>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={publishingArticleId === draft.id}
                          onClick={() =>
                            handlePublishArticle(draft.id, {
                              publishToTelegram: false,
                              telegramDryRun: true,
                            })
                          }
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {publishingArticleId === draft.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                          <span>Опубликовать</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Telegram Snippet Preview */}
                  {draft.telegramPostDraftRu && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600 font-mono line-clamp-3">
                      {draft.telegramPostDraftRu}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    {draft.tagsRu?.map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-medium text-slate-600 flex items-center space-x-1"
                      >
                        <Tag className="w-2.5 h-2.5 text-slate-400" />
                        <span>{tag}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANUAL LEGAL TOPIC INGESTION */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-amber-500" />
                <span>Добавить закон / новость вручную</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Заголовок закона или новости <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Например: Новые правила начисления НДФЛ при переуступке ДДУ с 2026 года..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ссылка на первоисточник (URL):</label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://publication.pravo.gov.ru/..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Краткий текст / выдержка:</label>
                <textarea
                  rows={4}
                  value={manualExcerpt}
                  onChange={(e) => setManualExcerpt(e.target.value)}
                  placeholder="Вставьте фрагмент текста закона или пресс-релиза..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Категория:</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none"
                >
                  <option value="ddu_214fz">214-ФЗ и ДДУ</option>
                  <option value="mortgage_cbr">Ипотека и ставка ЦБ</option>
                  <option value="tax_ndfl">Налоги и НДФЛ</option>
                  <option value="matkapital">Материнский капитал</option>
                  <option value="bankruptcy_127fz">Банкротство 127-ФЗ</option>
                  <option value="court_practice">Судебная практика</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Классифицировать и сохранить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT JOURNAL ARTICLE DRAFT */}
      {editingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Редактор статьи DomExit Журнал</h3>
                <p className="text-[11px] text-slate-500">
                  Сохранение переводит статью в статус «in_review» и выставляет humanEdited: true
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDraft(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/\[(Добавьте|TODO|PLACEHOLDER)/i.test(editingDraft.markdownBodyRu) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex items-start space-x-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Блокиратор YMYL:</span> В тексте статьи есть шаблонные плейсхолдеры{' '}
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">[Добавьте...</code>. Замените их реальным
                    экспертным анализом, иначе публикация будет заблокирована.
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Заголовок статьи (H1):</label>
                <input
                  type="text"
                  value={editingDraft.titleRu}
                  onChange={(e) => setEditingDraft({ ...editingDraft, titleRu: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Подзаголовок:</label>
                <input
                  type="text"
                  value={editingDraft.subtitleRu}
                  onChange={(e) => setEditingDraft({ ...editingDraft, subtitleRu: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Текст статьи (Markdown):</label>
                <textarea
                  rows={12}
                  value={editingDraft.markdownBodyRu}
                  onChange={(e) => setEditingDraft({ ...editingDraft, markdownBodyRu: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3.5 text-slate-900 font-mono text-[11px] leading-relaxed focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">Текст поста для Telegram:</label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editingDraft.telegramPostDraftRu)}
                    className="text-sky-600 hover:text-sky-700 text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Скопировать</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={editingDraft.telegramPostDraftRu}
                  onChange={(e) => setEditingDraft({ ...editingDraft, telegramPostDraftRu: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-[11px] focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
              <span className="text-[11px] text-slate-500 font-mono">
                id: {editingDraft.id} | slug: /{editingDraft.slug}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDraft(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer text-xs"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                >
                  {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Сохранить черновик</span>
                </button>
                <div className="flex items-center space-x-2 border-l border-slate-200 pl-2">
                  <label className="flex items-center space-x-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalPublishTelegram}
                      onChange={(e) => setModalPublishTelegram(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>TG</span>
                  </label>
                  {modalPublishTelegram && (
                    <label className="flex items-center space-x-1 text-[10px] text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modalTelegramDryRun}
                        onChange={(e) => setModalTelegramDryRun(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      <span>DryRun</span>
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={publishingArticleId === editingDraft.id}
                    onClick={() =>
                      handlePublishArticle(editingDraft.id, {
                        publishToTelegram: modalPublishTelegram,
                        telegramDryRun: modalTelegramDryRun,
                      })
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 text-xs shadow-xs"
                  >
                    {publishingArticleId === editingDraft.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span>🚀 Опубликовать</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL ARTICLE CREATION */}
      {showManualArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <span>Написать статью вручную для DomExit Журнал</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowManualArticleModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualArticle} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Заголовок статьи (H1) <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={newArticleTitle}
                  onChange={(e) => setNewArticleTitle(e.target.value)}
                  placeholder="Например: Как безопасно переуступить ДДУ в 2026 году..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Краткий лид / подзаголовок:</label>
                <input
                  type="text"
                  value={newArticleSubtitle}
                  onChange={(e) => setNewArticleSubtitle(e.target.value)}
                  placeholder="Пошаговая инструкция для покупателей и продавцов..."
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Категория:</label>
                <select
                  value={newArticleCategory}
                  onChange={(e) => setNewArticleCategory(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-900 focus:outline-none"
                >
                  <option value="ddu_214fz">214-ФЗ и ДДУ</option>
                  <option value="mortgage_cbr">Ипотека и ставка ЦБ</option>
                  <option value="tax_ndfl">Налоги и НДФЛ</option>
                  <option value="matkapital">Материнский капитал</option>
                  <option value="bankruptcy_127fz">Банкротство 127-ФЗ</option>
                  <option value="court_practice">Судебная практика</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Текст статьи (Markdown) <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={8}
                  required
                  value={newArticleBody}
                  onChange={(e) => setNewArticleBody(e.target.value)}
                  placeholder="## Раздел 1&#10;&#10;Текст статьи с экспертными комментариями...&#10;&#10;> **Комментарий эксперта DomExit:**&#10;> Рекомендация юриста..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-slate-900 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowManualArticleModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creatingArticle}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creatingArticle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Создать статью</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
