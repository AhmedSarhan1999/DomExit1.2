import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  FileText,
  History,
  Copy,
  Check,
  Calendar,
  Lock,
  ExternalLink,
  Search,
  BookOpen,
  Filter,
} from 'lucide-react';
import { LegalDocument, LegalRevision, LegalSettings } from '../../types/legal';
import { LegalRepository } from '../../dal/repositories/LegalRepository';

export const LegalArchivePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialDocFilter = searchParams.get('doc') || 'all';

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [revisions, setRevisions] = useState<LegalRevision[]>([]);
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [selectedDocSlug, setSelectedDocSlug] = useState<string>(initialDocFilter);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [docs, revs, setts] = await Promise.all([
          LegalRepository.getDocuments(),
          LegalRepository.getRevisions(),
          LegalRepository.getSettings(),
        ]);
        setDocuments(docs);
        setRevisions(revs);
        setSettings(setts);
      } catch (err) {
        console.warn('Failed loading legal archive', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCopyHash = (hash: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2500);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'По настоящее время';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const filteredRevisions = revisions.filter((rev) => {
    if (selectedDocSlug !== 'all' && rev.document_slug.toLowerCase() !== selectedDocSlug.toLowerCase()) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      rev.document_title.toLowerCase().includes(q) ||
      rev.document_slug.toLowerCase().includes(q) ||
      rev.version_number.toLowerCase().includes(q) ||
      rev.sha256_hash.toLowerCase().includes(q) ||
      (rev.change_note && rev.change_note.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 pt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Link to="/" className="hover:text-emerald-600 flex items-center space-x-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>На главную</span>
          </Link>
          <span>/</span>
          <Link to="/legal" className="hover:text-emerald-600">
            Правовой центр
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">Реестр архивных редакций и SHA-256</span>
        </div>

        {/* Header Hero Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-black shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                Криптографический реестр неизменяемости условий
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                Архив редакций и контрольные суммы SHA-256
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed max-w-4xl">
            Настоящий публичный реестр содержит хронологический перечень всех действующих и архивных редакций юридических документов платформы «DomExit». Для каждой версии вычислена криптографическая контрольная сумма (SHA-256), исключающая возможность одностороннего изменения условий ранее заключенных сделок.
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center space-x-1 font-semibold text-slate-700">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Неизменяемый криптографический реестр</span>
            </span>
            <span>•</span>
            <span>Стандарты доказывания в суде РФ (ст. 71 ГПК РФ / ст. 75 АПК РФ)</span>
            <span>•</span>
            <span>Базы данных: РФ (152-ФЗ)</span>
          </div>
        </div>

        {/* Filter Pills & Search Bar */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter by document */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
              <button
                type="button"
                onClick={() => setSelectedDocSlug('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  selectedDocSlug === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Все документы ({revisions.length})
              </button>

              {documents.map((doc) => {
                const count = revisions.filter((r) => r.document_slug === doc.slug).length;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocSlug(doc.slug)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedDocSlug === doc.slug
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{doc.short_title || doc.title}</span>
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Quick search input */}
            <div className="relative md:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Поиск по хешу или тексту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Revisions Feed */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Загрузка архивных записей и сверка SHA-256...</p>
          </div>
        ) : filteredRevisions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 space-y-2">
            <History className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-bold text-slate-700">Записей в выбранной категории не обнаружено.</p>
            <p className="text-xs">Попробуйте сбросить фильтр или изменить поисковый запрос.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRevisions.map((rev) => {
              const isCurrent = rev.status === 'published';
              return (
                <div
                  key={rev.id}
                  className={`bg-white border rounded-3xl p-6 sm:p-7 shadow-xs hover:border-slate-300 transition-all space-y-4 ${
                    isCurrent ? 'border-emerald-300 ring-1 ring-emerald-500/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {rev.document_title}
                        </span>
                        {isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                            Текущая действующая редакция
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Архивная редакция
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                          Slug: {rev.document_slug}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900 mt-1">
                        Редакция {rev.version_number} • {formatDate(rev.effective_from)}
                        {rev.effective_to && ` — ${formatDate(rev.effective_to)}`}
                      </h3>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {rev.is_material_change && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
                          Существенные изменения (ст. 152-ФЗ)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Change Note */}
                  <div className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 leading-relaxed">
                    <span className="font-bold text-slate-900">Описание изменений: </span>
                    {rev.change_note || 'Базовая редакция документа'}
                  </div>

                  {/* Cryptographic SHA-256 Hash Display */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-4 rounded-2xl font-mono text-xs shadow-inner">
                    <div className="flex items-center space-x-2 overflow-hidden min-w-0">
                      <span className="text-slate-400 font-sans font-bold text-[10px] uppercase shrink-0">
                        SHA-256:
                      </span>
                      <span className="text-emerald-400 truncate font-semibold">
                        {rev.sha256_hash}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyHash(rev.sha256_hash)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        title="Скопировать контрольную сумму SHA-256"
                      >
                        {copiedHash === rev.sha256_hash ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Скопировано</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Скопировать хеш</span>
                          </>
                        )}
                      </button>

                      {isCurrent ? (
                        <Link
                          to={`/legal/${rev.document_slug}`}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center space-x-1"
                        >
                          <span>Действующий текст</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <Link
                          to={`/legal/archive/${rev.document_slug}/${rev.version_number}`}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center space-x-1"
                        >
                          <span>Архивный слепок</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
