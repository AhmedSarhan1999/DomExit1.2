import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  Save,
  UploadCloud,
  History,
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Code,
  Sparkles,
  RefreshCw,
  Lock,
  Layers,
  Table,
  Bold,
  Italic,
  List,
  Heading,
  Tag,
  Radio,
  FileCheck2,
  Building2,
  CheckSquare,
} from 'lucide-react';
import {
  LegalSettings,
  LegalDocument,
  LegalRevision,
  UserConsentLog,
} from '../../types/legal';
import {
  LegalRepository,
  DEFAULT_LEGAL_SETTINGS,
  substituteLegalVariables,
} from '../../dal/repositories/LegalRepository';
import { computeSha256 } from '../../utils/crypto';

function parseCode(code: string): number {
  const parts = code.split('.').map(Number);
  return (parts[0] || 0) * 100 + (parts[1] || 0);
}

export const LegalCmsManager: React.FC = () => {
  // 4 Functional Sub-Tabs per Directive:
  // 1. Реестр и редактор документов (26 актов)
  // 2. Опубликовать редакцию (SHA-256)
  // 3. Архив редакций SHA-256
  // 4. Тексты чекбоксов и журнал акцептов (152-ФЗ / 38-ФЗ)
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'publish' | 'archive' | 'consents'>('editor');

  // Loading & State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<LegalSettings>(DEFAULT_LEGAL_SETTINGS);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [revisions, setRevisions] = useState<LegalRevision[]>([]);
  const [consentLogs, setConsentLogs] = useState<UserConsentLog[]>([]);

  // Selected Document & Editor State
  const [selectedDocSlug, setSelectedDocSlug] = useState<string>('terms');
  const [editorContent, setEditorContent] = useState<string>('');
  const [activeRevision, setActiveRevision] = useState<LegalRevision | null>(null);
  const [computedSha, setComputedSha] = useState<string>('');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [editorSuccessMsg, setEditorSuccessMsg] = useState<string | null>(null);
  const [editorErrorMsg, setEditorErrorMsg] = useState<string | null>(null);

  // Sub-tab 2: Publish Form State
  const [publishVersionNumber, setPublishVersionNumber] = useState<string>('1.1');
  const [publishChangeNote, setPublishChangeNote] = useState<string>('Плановое обновление формулировок и регламента');
  const [publishChangeType, setPublishChangeType] = useState<'minor' | 'material'>('material');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);

  // Sub-tab 3: Archive Registry Filter
  const [archiveFilterDoc, setArchiveFilterDoc] = useState<string>('all');
  const [archiveSearch, setArchiveSearch] = useState<string>('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Sub-tab 4: Consent Logs Filter & Search
  const [consentSearch, setConsentSearch] = useState<string>('');
  const [consentActionFilter, setConsentActionFilter] = useState<string>('all');

  // Load all initial legal CMS data
  const loadData = async () => {
    setIsLoading(true);
    try {
      await LegalRepository.ensureInitialized();
      const [fetchedSettings, fetchedDocs, fetchedRevs, fetchedLogs] = await Promise.all([
        LegalRepository.getSettings(),
        LegalRepository.getDocuments(),
        LegalRepository.getRevisions(),
        LegalRepository.getUserConsentLogs(),
      ]);

      const sorted = [...fetchedDocs].sort((a, b) => parseCode(a.code) - parseCode(b.code));
      setSettings(fetchedSettings);
      setDocuments(sorted);
      setRevisions(fetchedRevs);
      setConsentLogs(fetchedLogs);

      const targetDoc = sorted.find((d) => d.slug === selectedDocSlug) || sorted[0];
      if (targetDoc) {
        setSelectedDocSlug(targetDoc.slug);
        const activeRev = await LegalRepository.getActiveRevisionForDocument(targetDoc.slug);
        setActiveRevision(activeRev);
        setEditorContent(activeRev ? activeRev.raw_content : '');
      }
    } catch (err) {
      console.error('[LegalCmsManager] Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected document changes
  useEffect(() => {
    if (!selectedDocSlug || documents.length === 0) return;
    const fetchDocContent = async () => {
      try {
        const activeRev = await LegalRepository.getActiveRevisionForDocument(selectedDocSlug);
        setActiveRevision(activeRev);
        if (activeRev) {
          setEditorContent(activeRev.raw_content);
          const parts = activeRev.version_number.split('.');
          if (parts.length === 2 && !isNaN(Number(parts[1]))) {
            setPublishVersionNumber(`${parts[0]}.${Number(parts[1]) + 1}`);
          } else {
            setPublishVersionNumber(`${activeRev.version_number}.1`);
          }
        }
      } catch (err) {
        console.error('Failed to switch document:', err);
      }
    };
    fetchDocContent();
  }, [selectedDocSlug]);

  // Compute live SHA-256 for editor content
  useEffect(() => {
    let isMounted = true;
    const updateSha = async () => {
      if (!editorContent) {
        setComputedSha('');
        return;
      }
      const rendered = substituteLegalVariables(editorContent, settings);
      const hash = await computeSha256(rendered);
      if (isMounted) setComputedSha(hash);
    };
    updateSha();
    return () => {
      isMounted = false;
    };
  }, [editorContent, settings]);

  // Copy SHA-256 helper
  const handleCopySha = (hash: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2500);
    }
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    const doc = documents.find((d) => d.slug === selectedDocSlug);
    if (!doc) return;
    setIsSavingDraft(true);
    setEditorSuccessMsg(null);
    setEditorErrorMsg(null);
    try {
      await LegalRepository.saveDraftRevision({
        documentId: doc.id,
        documentSlug: doc.slug,
        documentTitle: doc.title,
        versionNumber: publishVersionNumber || (activeRevision ? activeRevision.version_number : '1.0'),
        rawContent: editorContent,
        changeNote: 'Черновик изменений (сохранено из CMS)',
        isMaterialChange: publishChangeType === 'material',
        createdBy: 'Администратор DomExit',
      });
      setEditorSuccessMsg('Черновик успешно сохранен в базе (не влияет на публичную версию сайта).');
      const refreshedRevs = await LegalRepository.getRevisions();
      setRevisions(refreshedRevs);
      setTimeout(() => setEditorSuccessMsg(null), 4000);
    } catch (err: any) {
      setEditorErrorMsg(err?.message || 'Ошибка сохранения черновика');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish new revision
  const handlePublishRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishChangeNote.trim()) {
      alert('Укажите краткое описание изменений (Changelog) для Роскомнадзора и пользователей.');
      return;
    }
    setIsPublishing(true);
    setPublishSuccessMsg(null);
    try {
      const result = await LegalRepository.publishNewRevision({
        documentSlug: selectedDocSlug,
        versionNumber: publishVersionNumber.trim() || '1.1',
        changeNote: publishChangeNote.trim(),
        isMaterialChange: publishChangeType === 'material',
        rawContent: editorContent,
        createdBy: 'Генеральный директор / Главный юрист',
      });

      setPublishSuccessMsg(`Новая редакция v${result.revision.version_number} документа успешно опубликована с криптографическим хэшем SHA-256!`);

      const [fetchedDocs, fetchedRevs] = await Promise.all([
        LegalRepository.getDocuments(),
        LegalRepository.getRevisions(),
      ]);
      const sorted = [...fetchedDocs].sort((a, b) => parseCode(a.code) - parseCode(b.code));
      setDocuments(sorted);
      setRevisions(fetchedRevs);
      setActiveRevision(result.revision);
      setTimeout(() => setPublishSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(err?.message || 'Ошибка публикации редакции');
    } finally {
      setIsPublishing(false);
    }
  };

  // Toggle document visibility
  const handleToggleDocVisibility = async (doc: LegalDocument) => {
    try {
      const updated = await LegalRepository.saveDocument({
        ...doc,
        is_visible: !doc.is_visible,
      });
      setDocuments((prev) => prev.map((d) => (d.slug === doc.slug ? updated : d)));
    } catch (err) {
      console.error('Failed to toggle doc visibility:', err);
    }
  };

  // Toggle document show_in_footer
  const handleToggleDocFooter = async (doc: LegalDocument) => {
    try {
      const updated = await LegalRepository.saveDocument({
        ...doc,
        show_in_footer: !doc.show_in_footer,
      });
      setDocuments((prev) => prev.map((d) => (d.slug === doc.slug ? updated : d)));
    } catch (err) {
      console.error('Failed to toggle doc footer:', err);
    }
  };

  // Export User Consent Logs as JSON file
  const handleExportConsentLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(consentLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `domexit_user_consents_audit_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Insert markdown snippet into editor
  const handleInsertSnippet = (snippet: string) => {
    setEditorContent((prev) => prev + '\n' + snippet);
  };

  // Filtered Archive Revisions
  const filteredRevisions = useMemo(() => {
    return revisions.filter((rev) => {
      const matchDoc = archiveFilterDoc === 'all' || rev.document_slug === archiveFilterDoc;
      const matchSearch =
        !archiveSearch ||
        rev.document_title.toLowerCase().includes(archiveSearch.toLowerCase()) ||
        rev.version_number.toLowerCase().includes(archiveSearch.toLowerCase()) ||
        rev.sha256_hash.toLowerCase().includes(archiveSearch.toLowerCase()) ||
        rev.change_note.toLowerCase().includes(archiveSearch.toLowerCase());
      return matchDoc && matchSearch;
    });
  }, [revisions, archiveFilterDoc, archiveSearch]);

  // Filtered Consent Logs
  const filteredConsentLogs = useMemo(() => {
    return consentLogs.filter((log) => {
      const matchAction = consentActionFilter === 'all' || log.action_type === consentActionFilter;
      const q = consentSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.user_name.toLowerCase().includes(q) ||
        log.phone.toLowerCase().includes(q) ||
        log.email.toLowerCase().includes(q) ||
        log.user_id.toLowerCase().includes(q);
      return matchAction && matchSearch;
    });
  }, [consentLogs, consentActionFilter, consentSearch]);

  const selectedDoc = documents.find((d) => d.slug === selectedDocSlug);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-700">Загрузка Legal CMS (26 актов) и реестров...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-Tabs Navigation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-black shadow-xs">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Правовой CMS и Реестр (26 нормативных актов)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  12 Пакетов • 7 Разделов • SHA-256
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Полный нормативный контур платформы «DomExit — Чистый Выход» по 214-ФЗ, 152-ФЗ, 149-ФЗ и 38-ФЗ.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/legal"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <span>Публичный правовой центр (/legal)</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
            <Link
              to="/legal/archive"
              target="_blank"
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              <span>Криптоархив SHA-256</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
            </Link>
          </div>
        </div>

        {/* 4 Functional Sub-Tabs (Strict Directive Structure) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('editor')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'editor'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>1. Реестр и редактор (26 актов)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('publish')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'publish'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-sky-600" />
            <span>2. Опубликовать редакцию</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('archive')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'archive'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-purple-600" />
            <span>3. Архив редакций SHA-256</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('consents')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              activeSubTab === 'consents'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-amber-600" />
            <span>4. Чекбоксы и акцепты 152-ФЗ</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SUB-TAB 1: DOCUMENT REGISTRY & SPLIT-VIEW EDITOR (26 DOCUMENTS)
      ========================================================================= */}
      {activeSubTab === 'editor' && (
        <div className="space-y-6">
          {/* Document Carousel / Full 26 Acts Selector */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Выберите нормативный документ из реестра (26 актов):</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Сортировка: <strong>1.1 — 6.1 (Восходящая по разделам)</strong>
              </span>
            </div>

            {/* Document Select Dropdown for Fast Access */}
            <div className="pb-1">
              <select
                value={selectedDocSlug}
                onChange={(e) => setSelectedDocSlug(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 shadow-xs focus:border-emerald-500"
              >
                {documents.map((doc) => (
                  <option key={doc.slug} value={doc.slug}>
                    #{doc.code} — {doc.title} [{doc.stage === 'stage_1' ? 'Этап 1' : 'B2B Этап 2'}]
                  </option>
                ))}
              </select>
            </div>

            {/* Compact Grid of Document Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-56 overflow-y-auto pr-1">
              {documents.map((doc) => {
                const isSelected = doc.slug === selectedDocSlug;
                return (
                  <div
                    key={doc.slug}
                    onClick={() => setSelectedDocSlug(doc.slug)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-0.5">
                        <span className="font-bold text-slate-800">#{doc.code}</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold ${doc.is_visible ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                          v{doc.active_version}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-900 line-clamp-1">
                        {doc.short_title}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Document Details Bar */}
          {selectedDoc && (
            <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-mono font-bold">
                      Код {selectedDoc.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 truncate max-w-xl">
                      {selectedDoc.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Основание: {selectedDoc.legal_basis}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center space-x-2 text-xs cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedDoc.is_visible}
                      onChange={() => handleToggleDocVisibility(selectedDoc)}
                      className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-slate-700 font-medium">Опубликован на сайте</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedDoc.show_in_footer}
                      onChange={() => handleToggleDocFooter(selectedDoc)}
                      className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-slate-700 font-medium">В подвале сайта</span>
                  </label>

                  <Link
                    to={`/legal/${selectedDoc.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-2xs"
                  >
                    <span>Смотреть</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* SHA-256 Active Fingerprint */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs font-mono">
                <div className="flex items-center space-x-2 text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Активная цифровая подпись (SHA-256):</span>
                </div>
                <div className="flex items-center space-x-2 text-emerald-700">
                  <span className="truncate max-w-md font-bold">{selectedDoc.active_sha256}</span>
                  <button
                    type="button"
                    onClick={() => handleCopySha(selectedDoc.active_sha256)}
                    className="p-1 hover:text-emerald-900 transition-colors cursor-pointer"
                    title="Скопировать хэш"
                  >
                    {copiedHash === selectedDoc.active_sha256 ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback alerts */}
          {editorSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{editorSuccessMsg}</span>
            </div>
          )}
          {editorErrorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{editorErrorMsg}</span>
            </div>
          )}

          {/* Editor Format Toolbar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-xs">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => handleInsertSnippet('## 1. НАЗВАНИЕ РАЗДЕЛА')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Heading className="w-3.5 h-3.5" />
                <span>H2</span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('### 1.1. Название подраздела')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Heading className="w-3 h-3" />
                <span>H3</span>
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('**жирный текст**')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('*курсивный текст*')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleInsertSnippet('- Пункт перечня\n- Второй пункт')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  handleInsertSnippet(
                    '| Категория | Срок хранения | Правовое основание |\n| :--- | :--- | :--- |\n| Идентификационные данные | 5 лет после сделки | 115-ФЗ, 214-ФЗ |\n| Технические cookie | Сессия браузера | 152-ФЗ РФ |'
                  )
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center space-x-1 cursor-pointer"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Таблица</span>
              </button>
            </div>

            {/* Variable Insertion Quick Select */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-bold text-slate-500">Вставить переменную:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleInsertSnippet(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                defaultValue=""
              >
                <option value="" disabled>
                  Выбрать тег...
                </option>
                <option value="{{company.name}}">Название: {'{{company.name}}'}</option>
                <option value="{{company.inn}}">ИНН: {'{{company.inn}}'}</option>
                <option value="{{company.ogrn}}">ОГРН: {'{{company.ogrn}}'}</option>
                <option value="{{company.legal_address}}">Адрес: {'{{company.legal_address}}'}</option>
                <option value="{{company.privacy_email}}">Email: {'{{company.privacy_email}}'}</option>
                <option value="{{company.support_phone}}">Телефон: {'{{company.support_phone}}'}</option>
                <option value="{{company.bank_details}}">Банк: {'{{company.bank_details}}'}</option>
                <option value="{{company.dpo_name}}">DPO: {'{{company.dpo_name}}'}</option>
              </select>
            </div>
          </div>

          {/* Split-View: Left Raw Editor / Right Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Code className="w-4 h-4 text-slate-500" />
                  <span>Исходный текст документа (Markdown)</span>
                </span>
                <span className="text-slate-400 font-mono">
                  Слов: {editorContent.split(/\s+/).filter(Boolean).length}
                </span>
              </div>

              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                rows={22}
                className="w-full flex-1 p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white font-mono text-xs text-slate-900 leading-relaxed focus:border-emerald-500 focus:outline-none resize-none"
                placeholder="Введите или вставьте полный текст нормативного документа в формате Markdown..."
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Живая визуализация (Live Auto-Renderer)</span>
                </span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">
                  Preview
                </span>
              </div>

              <div className="flex-1 max-h-[520px] overflow-y-auto p-4 rounded-2xl bg-slate-50/50 border border-slate-100 prose prose-slate max-w-none text-xs leading-relaxed space-y-3">
                {editorContent.split('\n\n').map((block, idx) => {
                  const rendered = substituteLegalVariables(block, settings);
                  if (rendered.startsWith('## ')) {
                    return (
                      <h2 key={idx} className="text-sm font-black text-slate-900 border-b border-slate-200 pb-1 mt-3">
                        {rendered.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (rendered.startsWith('### ')) {
                    return (
                      <h3 key={idx} className="text-xs font-bold text-slate-800 mt-2">
                        {rendered.replace('### ', '')}
                      </h3>
                    );
                  }
                  if (rendered.startsWith('|')) {
                    return (
                      <div key={idx} className="overflow-x-auto my-2">
                        <pre className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-700">
                          {rendered}
                        </pre>
                      </div>
                    );
                  }
                  if (rendered.startsWith('- ')) {
                    return (
                      <ul key={idx} className="list-disc pl-4 space-y-1 text-slate-700">
                        {rendered.split('\n').map((line, lIdx) => (
                          <li key={lIdx}>{line.replace(/^[-\s*]+/, '')}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={idx} className="text-slate-700">
                      {rendered}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-mono">Расчетный SHA-256 текста:</span>
                <span className="text-emerald-700 font-mono font-bold truncate max-w-xs sm:max-w-md">
                  {computedSha || 'Вычисление...'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Сохраните черновик для работы либо перейдите во вкладку 2 для официальной публикации редакции.
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-600" />
                <span>{isSavingDraft ? 'Сохранение...' : 'Сохранить как черновик'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('publish')}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                <span>Перейти к публикации редакции →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: PUBLISH NEW REVISION FORM (SHA-256 CRYPTO-SEAL)
      ========================================================================= */}
      {activeSubTab === 'publish' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs max-w-4xl mx-auto">
          <div className="pb-4 border-b border-slate-100 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Публикация новой редакции с фиксацией SHA-256
              </h3>
              <p className="text-xs text-slate-500">
                Выпуск обновленной редакции архивирует текущую версию и рассчитывает неизменяемую контрольную сумму.
              </p>
            </div>
          </div>

          {publishSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{publishSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handlePublishRevision} className="space-y-5 text-xs">
            {/* Target Document Picker */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Публикуемый документ из реестра (26 актов) *
              </label>
              <select
                value={selectedDocSlug}
                onChange={(e) => setSelectedDocSlug(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:border-emerald-500"
              >
                {documents.map((doc) => (
                  <option key={doc.slug} value={doc.slug}>
                    #{doc.code} — {doc.title} (текущая версия: v{doc.active_version})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Номер новой версии (Version String) *
                </label>
                <input
                  type="text"
                  value={publishVersionNumber}
                  onChange={(e) => setPublishVersionNumber(e.target.value)}
                  placeholder="Например: 2.2 или 3.0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-900 focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Характер изменений (152-ФЗ / 38-ФЗ) *
                </label>
                <select
                  value={publishChangeType}
                  onChange={(e) => setPublishChangeType(e.target.value as 'minor' | 'material')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:border-emerald-500"
                >
                  <option value="material">Существенные изменения (требует повторного акцепта)</option>
                  <option value="minor">Технические / Редакционные правки (без блокирующего согласия)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Краткое описание изменений (Changelog для надзорных органов и реестра) *
              </label>
              <textarea
                rows={3}
                value={publishChangeNote}
                onChange={(e) => setPublishChangeNote(e.target.value)}
                placeholder="Опишите, какие формулировки, статьи или регламент расчетов были изменены..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 focus:border-emerald-500"
                required
              />
            </div>

            {/* Calculated SHA-256 preview */}
            <div className="bg-slate-50 border border-slate-200 text-slate-900 p-4 rounded-2xl font-mono space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Контрольная сумма текста по стандарту FIPS 180-4:</span>
                <span className="text-emerald-700 font-bold">SHA-256 Verified</span>
              </div>
              <div className="text-emerald-700 text-xs font-bold break-all">
                {computedSha || 'Вычисление...'}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveSubTab('editor')}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                Вернуться к редактору
              </button>
              <button
                type="submit"
                disabled={isPublishing || !publishChangeNote.trim()}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Архивация и выпуск...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Опубликовать редакцию и активировать SHA-256</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: CRYPTOGRAPHIC ARCHIVE REGISTRY (SHA-256)
      ========================================================================= */}
      {activeSubTab === 'archive' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <History className="w-5 h-5 text-purple-600" />
                <span>Реестр архивных редакций и криптографических снимков SHA-256</span>
              </h3>
              <p className="text-xs text-slate-500">
                Неизменяемый журнал всех версий документов с фиксацией контрольной суммы по ГОСТ Р 34.11 / FIPS 180-4.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-purple-800 bg-purple-50 border border-purple-200 px-3 py-1 rounded-xl font-bold">
                Всего записей: {filteredRevisions.length}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Поиск по названию, версии, хэшу или changelog..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-purple-500 focus:outline-none font-medium"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={archiveFilterDoc}
                onChange={(e) => setArchiveFilterDoc(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800"
              >
                <option value="all">Все документы (Полный реестр 26 актов)</option>
                {documents.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    #{d.code} {d.short_title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Revisions Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Документ</th>
                  <th className="py-3 px-3">Версия</th>
                  <th className="py-3 px-3">Статус</th>
                  <th className="py-3 px-4">Срок действия</th>
                  <th className="py-3 px-4">Отпечаток SHA-256</th>
                  <th className="py-3 px-4">Описание изменений</th>
                  <th className="py-3 px-3 text-right">Снимок</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredRevisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Редакций по указанному фильтру не найдено
                    </td>
                  </tr>
                ) : (
                  filteredRevisions.map((rev) => {
                    const isPublished = rev.status === 'published';
                    const isArchived = rev.status === 'archived';
                    const isDraft = rev.status === 'draft';
                    const isCopied = copiedHash === rev.sha256_hash;

                    return (
                      <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rev.document_title}</div>
                          <div className="text-[10px] font-mono text-slate-400">slug: {rev.document_slug}</div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                            v{rev.version_number}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          {isPublished && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ● Активная
                            </span>
                          )}
                          {isArchived && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              Архивная
                            </span>
                          )}
                          {isDraft && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Черновик
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[11px] whitespace-nowrap">
                          <div>
                            С: <span className="font-mono">{new Date(rev.effective_from).toLocaleDateString('ru-RU')}</span>
                          </div>
                          {rev.effective_to ? (
                            <div className="text-slate-400">
                              По: <span className="font-mono">{new Date(rev.effective_to).toLocaleDateString('ru-RU')}</span>
                            </div>
                          ) : (
                            <div className="text-emerald-700 font-bold">Бессрочно</div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                            <span className="truncate max-w-[140px] text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                              {rev.sha256_hash.substring(0, 16)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopySha(rev.sha256_hash)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Скопировать полный SHA-256"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4 max-w-xs truncate text-[11px] text-slate-600" title={rev.change_note}>
                          {rev.change_note}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Link
                            to={`/legal/archive/${rev.document_slug}/${rev.version_number}`}
                            target="_blank"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-100 text-purple-700 font-bold text-[11px] transition-colors"
                          >
                            <span>Снимок</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 4: CHECKBOX TEXTS & CONSENT AUDIT LOGS (152-FZ & 38-FZ)
      ========================================================================= */}
      {activeSubTab === 'consents' && (
        <div className="space-y-6">
          {/* Section A: Standard Checkbox Texts for Compliance */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Стандартные формулировки чекбоксов согласий платформы (152-ФЗ / 38-ФЗ)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>1. Согласие на обработку ПДн (Обязательное)</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  «Я даю согласие на обработку моих персональных данных в соответствии с Согласием на обработку ПД и ознакомлен с Политикой конфиденциальности»
                </p>
                <span className="text-[10px] font-mono text-emerald-700 block">ст. 9 № 152-ФЗ</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span>2. Пользовательское соглашение (Обязательное)</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  «Я принимаю условия Пользовательского соглашения платформы и регламент расчетов через эскроу/СБР»
                </p>
                <span className="text-[10px] font-mono text-sky-700 block">ст. 437 ГК РФ</span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>3. Реклама и рассылки (СТРОГО ОПЦИОНАЛЬНОЕ)</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  «Я согласен получать информационные и рекламные уведомления о новых дисконтных объектах в соответствии со ст. 18 ФЗ-38»
                </p>
                <span className="text-[10px] font-mono text-amber-700 block">ст. 18 № 38-ФЗ (Без чекбокса по умолчанию)</span>
              </div>
            </div>
          </div>

          {/* Section B: User Consent Audit Logs Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <FileCheck2 className="w-5 h-5 text-amber-600" />
                  <span>Журнал юридических акцептов и согласий пользователей (152-ФЗ / 38-ФЗ)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Фиксация согласий на обработку ПДн, рекламу и пользовательские правила с отпечатками SHA-256.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportConsentLogs}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold flex items-center space-x-2 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Экспорт протокола в JSON (Аудит)</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Поиск по имени, телефону, email или идентификатору..."
                  value={consentSearch}
                  onChange={(e) => setConsentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none font-medium"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={consentActionFilter}
                  onChange={(e) => setConsentActionFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold text-slate-800"
                >
                  <option value="all">Все типы событий (Регистрация, Продавец, Бронь, Cookie)</option>
                  <option value="registration">Регистрация в ЛК (registration)</option>
                  <option value="seller_submission">Заявка продавца ДДУ (seller_submission)</option>
                  <option value="buyer_reservation">Бронирование лота покупателем (buyer_reservation)</option>
                  <option value="cookie_consent">Баннер Cookie (cookie_consent)</option>
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Время (МСК)</th>
                    <th className="py-3 px-4">Субъект ПДн</th>
                    <th className="py-3 px-3">Тип формы / События</th>
                    <th className="py-3 px-4">Принятые документы & SHA-256</th>
                    <th className="py-3 px-3 text-center">Реклама (38-ФЗ)</th>
                    <th className="py-3 px-4">IP / Клиентский контур</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredConsentLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Записей согласий не найдено
                      </td>
                    </tr>
                  ) : (
                    filteredConsentLogs.map((log) => {
                      const adsDoc = log.consented_documents.find((d) => d.document_slug === 'consent-ads');
                      const hasAdsConsent = adsDoc ? adsDoc.is_accepted : false;

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-[11px] font-mono text-slate-600">
                            {new Date(log.created_at).toLocaleString('ru-RU')}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{log.user_name}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {log.phone || log.email || log.user_id}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {log.action_type}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {log.consented_documents.map((c, i) => (
                                <span
                                  key={i}
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                    c.is_accepted
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}
                                  title={`v${c.revision_version} • ${c.sha256_hash}`}
                                >
                                  {c.document_slug} v{c.revision_version} {c.is_accepted ? '✓' : '✕'}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {hasAdsConsent ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Согласен
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                ✕ Отклонено
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[10px] font-mono text-slate-500 max-w-xs truncate" title={log.user_agent}>
                            <div>{log.ip_masked}</div>
                            <div className="text-slate-400 truncate">{log.user_agent}</div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
