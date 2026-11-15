import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileText,
  Search,
  History,
  Lock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Scale,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react';
import { LegalDocument, LegalSettings } from '../../types/legal';
import { LegalRepository } from '../../dal/repositories/LegalRepository';

export const LegalIndexPage: React.FC = () => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [settings, setSettings] = useState<LegalSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [d, s] = await Promise.all([
          LegalRepository.getDocuments({ is_visible: true }),
          LegalRepository.getSettings(),
        ]);
        setDocuments(d);
        setSettings(s);
      } catch (err) {
        console.warn('Failed loading legal index', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const categories = [
    { id: 'all', label: 'Все документы' },
    { id: 'section_1', label: '1. Базовые регламенты (1.1–1.5)' },
    { id: 'section_2', label: '2. Сделки и оферты ДДУ (2.1–2.5)' },
    { id: 'section_3', label: '3. Персональные данные 152-ФЗ (3.1–3.7)' },
    { id: 'section_4', label: '4. Партнерские модули B2B (4.1–4.5)' },
    { id: 'section_5_6', label: '5–6. Комплаенс и реквизиты (5.1–6.1)' },
  ];

  function matchesCategory(doc: LegalDocument, catId: string): boolean {
    if (catId === 'all') return true;
    if (catId === 'section_1') return doc.code.startsWith('1.');
    if (catId === 'section_2') return doc.code.startsWith('2.');
    if (catId === 'section_3') return doc.code.startsWith('3.');
    if (catId === 'section_4') return doc.code.startsWith('4.');
    if (catId === 'section_5_6') return doc.code.startsWith('5.') || doc.code.startsWith('6.');
    return doc.category === catId;
  }

  function parseCode(code: string): number {
    const parts = code.split('.').map(Number);
    return (parts[0] || 0) * 100 + (parts[1] || 0);
  }

  const filteredDocs = documents
    .filter((doc) => {
      if (!matchesCategory(doc, selectedCategory)) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.short_title.toLowerCase().includes(q) ||
        doc.code.toLowerCase().includes(q) ||
        doc.legal_basis.toLowerCase().includes(q) ||
        doc.slug.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => parseCode(a.code) - parseCode(b.code));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header Hero Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black shrink-0 shadow-2xs">
                <Scale className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Правовая безопасность сделок по 214-ФЗ
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Реестр 2026 г.
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1">
                  Правовой центр и реестр документов DomExit
                </h1>
                <p className="text-sm text-slate-600 max-w-3xl mt-1.5 leading-relaxed">
                  Официальный реестр действующей нормативно-правовой документации, политик конфиденциальности, согласий на обработку данных и регламентов безопасных расчетов.
                </p>
              </div>
            </div>

            <Link
              to="/legal/archive"
              className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 shadow-md transition-all shrink-0 cursor-pointer self-start md:self-auto"
            >
              <History className="w-4 h-4 text-emerald-400" />
              <span>Архив редакций (SHA-256)</span>
            </Link>
          </div>

          {/* Quick Legal Requisites Bar */}
          {settings && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-slate-800 font-semibold truncate">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">Оператор: {settings.company_name}</span>
                <span className="font-mono text-slate-500 hidden md:inline">
                  (ОГРН: {settings.ogrn}, ИНН: {settings.inn})
                </span>
              </div>
              <div className="flex items-center space-x-3 text-[11px] shrink-0 font-medium">
                <span className="text-emerald-700 font-bold">● Базы данных: РФ (152-ФЗ)</span>
                <span>•</span>
                <a href={`mailto:${settings.privacy_email}`} className="text-indigo-700 hover:underline">
                  {settings.privacy_email}
                </a>
              </div>
            </div>
          )}

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            {/* Category tabs */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Поиск по названию или закону..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Documents Cards Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Загрузка правового реестра документов...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Документы не найдены</h3>
            <p className="text-xs text-slate-500">Попробуйте изменить поисковый запрос или фильтр категорий.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-3xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                      {doc.subtitle_badge}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                      Код {doc.code}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                    <Link to={`/legal/${doc.slug}`}>
                      {doc.title}
                    </Link>
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700">Основание:</span> {doc.legal_basis}
                  </p>

                  {/* Summary Bullets Preview */}
                  {doc.summary_box_items && doc.summary_box_items.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100 line-clamp-2">
                      {doc.summary_box_items.slice(0, 2).map((item, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5 truncate">
                          <span className="text-emerald-600 font-bold">•</span>
                          <span className="truncate">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold text-[10px]">
                      v{doc.active_version}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 hidden sm:inline truncate max-w-[120px]">
                      SHA: {doc.active_sha256?.slice(0, 8)}...
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/legal/archive?doc=${doc.slug}`}
                      className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold text-xs transition-colors flex items-center space-x-1"
                      title="История редакций документа"
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span className="hidden sm:inline">Архив</span>
                    </Link>

                    <Link
                      to={`/legal/${doc.slug}`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                    >
                      <span>Читать</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cryptographic Assurance & Immutability Card */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shrink-0">
                <LockKeyhole className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">
                  Криптографическая неизменяемость редакций (SHA-256)
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  Каждая редакция каждого документа в момент утверждения фиксируется с уникальной цифровой контрольной суммой по алгоритму SHA-256. Изменение условий задним числом технически невозможно. Все версии доступны для судебной и юридической верификации в публичном архиве.
                </p>
              </div>
            </div>

            <Link
              to="/legal/archive"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors shrink-0 shadow-sm flex items-center space-x-1.5"
            >
              <span>Открыть архив SHA-256</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};
