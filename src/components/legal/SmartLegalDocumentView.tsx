import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  History,
  Lock,
  ExternalLink,
  BookOpen,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { LegalDocument, LegalRevision, LegalSettings } from '../../types/legal';
import { substituteLegalVariables } from '../../dal/repositories/LegalRepository';

interface SmartLegalDocumentViewProps {
  document: LegalDocument;
  revision: LegalRevision;
  settings: LegalSettings;
  isHistoricalSnapshot?: boolean;
}

interface ParsedSection {
  id: string;
  title: string;
  number?: string;
}

export const SmartLegalDocumentView: React.FC<SmartLegalDocumentViewProps> = ({
  document,
  revision,
  settings,
  isHistoricalSnapshot = false,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [sections, setSections] = useState<ParsedSection[]>([]);

  // Substitute tags into raw content or use frozen rendered_snapshot
  const renderedText = isHistoricalSnapshot
    ? revision.rendered_snapshot || substituteLegalVariables(revision.raw_content, settings)
    : substituteLegalVariables(revision.raw_content, settings);

  // Extract sections for Table of Contents
  useEffect(() => {
    const lines = renderedText.split('\n');
    const parsed: ParsedSection[] = [];
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      // Match markdown ## 1. or plain 1. CHAPTER
      const h2Match = trimmed.match(/^##\s*(\d+[\.\d]*)\.?\s*(.+)$/i);
      const plainMatch = trimmed.match(/^(\d+)\.\s+([А-ЯA-Z\s\-]{4,})$/);
      if (h2Match) {
        parsed.push({
          id: `section-${h2Match[1].replace(/\./g, '-')}`,
          number: h2Match[1],
          title: h2Match[2],
        });
      } else if (plainMatch) {
        parsed.push({
          id: `section-${plainMatch[1]}`,
          number: plainMatch[1],
          title: plainMatch[2],
        });
      }
    });
    setSections(parsed);
    if (parsed.length > 0) {
      setActiveSectionId(parsed[0].id);
    }
  }, [renderedText]);

  // Scroll spy
  useEffect(() => {
    if (typeof window === 'undefined' || sections.length === 0) return;
    const handleScroll = () => {
      const scrollPos = window.scrollY + 180;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = typeof window !== 'undefined' ? window.document.getElementById(sections[i].id) : null;
        if (el && el.offsetTop <= scrollPos) {
          setActiveSectionId(sections[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const handleCopyHash = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(revision.sha256_hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
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

  // Render markdown-like legal body with hierarchy and tables
  const renderLegalBody = () => {
    const lines = renderedText.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];

    const flushTable = (key: number) => {
      if (inTable && tableHeaders.length > 0) {
        elements.push(
          <div key={`table-${key}`} className="my-6 overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  {tableHeaders.map((th, i) => (
                    <th key={i} className="py-3 px-4 border-b border-slate-700">
                      {th.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-2.5 px-4 text-slate-700 leading-relaxed font-normal">
                        {renderInlineFormatting(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Table row check: | col1 | col2 |
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const rawCells = trimmed.split('|').slice(1, -1);
        // Is separator row like | :--- | :--- |
        if (rawCells.every((c) => /^\s*:?-+:?\s*$/.test(c))) {
          // ignore separator
          return;
        }
        if (!inTable) {
          inTable = true;
          tableHeaders = rawCells;
        } else {
          tableRows.push(rawCells);
        }
        return;
      } else if (inTable) {
        flushTable(index);
      }

      if (!trimmed) {
        return;
      }

      // 1. Chapter Title: ## 1. or 1. CHAPTER TITLE
      const h2Match = trimmed.match(/^##\s*(\d+[\.\d]*)\.?\s*(.+)$/i);
      const plainChapterMatch = trimmed.match(/^(\d+)\.\s+([А-ЯA-Z\s\-]{4,})$/);

      if (h2Match) {
        const num = h2Match[1];
        const title = h2Match[2];
        const secId = `section-${num.replace(/\./g, '-')}`;
        elements.push(
          <div key={`h2-${index}`} id={secId} className="pt-8 pb-3 border-b border-slate-100 scroll-mt-24">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 block mb-1">
              Раздел {num}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title}
            </h2>
          </div>
        );
        return;
      }

      if (plainChapterMatch) {
        const num = plainChapterMatch[1];
        const title = plainChapterMatch[2];
        const secId = `section-${num}`;
        elements.push(
          <div key={`chap-${index}`} id={secId} className="pt-8 pb-3 border-b border-slate-100 scroll-mt-24">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-700 block mb-1">
              Раздел {num}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title}
            </h2>
          </div>
        );
        return;
      }

      // 2. Sub-clause Level 3: 1.1.1. or bullet item
      const subClauseMatch = trimmed.match(/^(\d+\.\d+\.\d+\.?)\s*(.+)$/);
      if (subClauseMatch) {
        elements.push(
          <div key={`subclause-${index}`} className="pl-6 border-l-2 border-emerald-300 py-1 my-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900 mr-2">{subClauseMatch[1]}</span>
            <span>{renderInlineFormatting(subClauseMatch[2])}</span>
          </div>
        );
        return;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        elements.push(
          <div key={`bullet-${index}`} className="pl-6 flex items-start space-x-2 my-1.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <span className="text-emerald-600 font-bold text-base leading-none">•</span>
            <span>{renderInlineFormatting(trimmed.substring(2))}</span>
          </div>
        );
        return;
      }

      // 3. Main Clause Level 2: 1.1. or 2.3.
      const mainClauseMatch = trimmed.match(/^(\d+\.\d+\.?)\s*(.+)$/);
      if (mainClauseMatch) {
        elements.push(
          <p key={`clause-${index}`} className="my-3 text-xs sm:text-sm leading-relaxed text-slate-700">
            <span className="font-black text-slate-900 mr-2 inline-block bg-slate-100 px-1.5 py-0.5 rounded text-xs border border-slate-200">
              {mainClauseMatch[1]}
            </span>
            <span>{renderInlineFormatting(mainClauseMatch[2])}</span>
          </p>
        );
        return;
      }

      // Default paragraph
      elements.push(
        <p key={`p-${index}`} className="my-2.5 text-xs sm:text-sm leading-relaxed text-slate-700">
          {renderInlineFormatting(trimmed)}
        </p>
      );
    });

    if (inTable) {
      flushTable(lines.length);
    }

    return elements;
  };

  // Helper for bold and links
  const renderInlineFormatting = (text: string) => {
    // Replace **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 pt-6 print:bg-white print:p-0 print:m-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Top Breadcrumb & Action Toolbar (Hidden on print) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center space-x-2 text-slate-500 flex-wrap">
            <Link to="/" className="hover:text-emerald-700 flex items-center space-x-1 font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Главная</span>
            </Link>
            <span>/</span>
            <Link to="/legal" className="hover:text-emerald-700 font-medium">
              Правовой центр
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold truncate max-w-xs sm:max-w-md">
              {document.short_title || document.title}
            </span>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/legal/archive"
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center space-x-1.5 shadow-2xs transition-colors"
            >
              <History className="w-3.5 h-3.5 text-indigo-600" />
              <span>Реестр архивных редакций</span>
            </Link>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Скачать / Печать PDF</span>
            </button>
          </div>
        </div>

        {/* Historical Version Warning Banner */}
        {isHistoricalSnapshot && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in print:border-amber-600">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-amber-400 text-slate-950 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <span className="font-black text-sm uppercase tracking-wide text-amber-900 block">
                  Внимание: Вы просматриваете архивную редакцию документа
                </span>
                <p className="text-slate-700 leading-relaxed">
                  Данная редакция действовала в период с{' '}
                  <strong className="text-slate-900">{formatDate(revision.effective_from)}</strong> по{' '}
                  <strong className="text-slate-900">{formatDate(revision.effective_to)}</strong>. Текст зафиксирован
                  в неизменяемом криптографическом виде для подтверждения условий ранее заключенных сделок.
                </p>
              </div>
            </div>

            <Link
              to={`/legal/${document.slug}`}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 shadow-xs transition-colors whitespace-nowrap"
            >
              Перейти к действующей редакции →
            </Link>
          </div>
        )}

        {/* Official Document Passport Card («ПАСПОРТ ДОКУМЕНТА») */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6 print:border-slate-800 print:rounded-none">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {document.subtitle_badge}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Код: {document.code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                  Редакция {revision.version_number}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                {document.title}
              </h1>
            </div>

            <div className="flex flex-col items-start md:items-end text-xs text-slate-500 shrink-0 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Действует с: {formatDate(revision.effective_from)}</span>
              </div>
              {revision.effective_to && (
                <span className="text-amber-700 font-semibold">
                  Утратила силу: {formatDate(revision.effective_to)}
                </span>
              )}
            </div>
          </div>

          {/* Operator Parameters Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 text-xs text-slate-700 space-y-3">
            <div className="flex items-center space-x-2 font-bold text-slate-900 text-xs border-b border-slate-200/80 pb-2">
              <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>ПАСПОРТ ДОКУМЕНТА И РЕКВИЗИТЫ ОПЕРАТОРА</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 leading-relaxed">
              <div>
                <span className="text-slate-500 block text-[11px]">Оператор сервиса:</span>
                <strong className="text-slate-900 font-bold">{settings.company_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Идентификационные коды:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ОГРН: {settings.ogrn} • ИНН: {settings.inn}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Ответственный за защиту данных (DPO):</span>
                <span className="font-semibold text-slate-900">{settings.dpo_name}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block text-[11px]">Юридический адрес оператора:</span>
                <span className="text-slate-800">{settings.legal_address}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Правовое основание:</span>
                <span className="text-emerald-800 font-semibold">{document.legal_basis}</span>
              </div>
            </div>

            {/* Permanent URL & SHA-256 Cryptographic Digest */}
            <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-500 shrink-0">Постоянный адрес:</span>
                <span className="font-mono font-semibold text-indigo-700 truncate">
                  {settings.domain_url}/legal/{document.slug}
                </span>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] font-mono">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span className="text-slate-500">SHA-256:</span>
                  <span className="font-bold text-slate-900">
                    {revision.sha256_hash.slice(0, 10)}...{revision.sha256_hash.slice(-8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  title="Скопировать полную контрольную сумму SHA-256"
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Summary Box (if present) */}
          {document.summary_box_items && document.summary_box_items.length > 0 && (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-2.5 text-xs text-emerald-950">
              <div className="font-black text-sm flex items-center space-x-2 text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>{document.summary_box_title || 'Ключевые условия:'}</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 leading-relaxed">
                {document.summary_box_items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main Document Grid: Left Sticky TOC (Desktop) + Right Document Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sticky Table of Contents (4 cols on lg, hidden on print) */}
          {sections.length > 0 && (
            <aside className="hidden lg:block lg:col-span-4 sticky top-6 print:hidden">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 pb-2 border-b border-slate-100">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>СОДЕРЖАНИЕ ДОКУМЕНТА</span>
                </div>

                <nav className="space-y-1 text-xs max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
                  {sections.map((sec) => {
                    const isActive = activeSectionId === sec.id;
                    return (
                      <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        className={`block px-3 py-2 rounded-xl transition-all font-medium leading-snug ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-200 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        {sec.number && <span className="font-bold mr-1.5">{sec.number}.</span>}
                        <span>{sec.title}</span>
                      </a>
                    );
                  })}
                </nav>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Редакция {revision.version_number}</span>
                  <Link to="/legal/archive" className="text-emerald-700 font-bold hover:underline">
                    История изменений
                  </Link>
                </div>
              </div>
            </aside>
          )}

          {/* Legal Document Text (8 cols on lg or full width if no TOC) */}
          <main className={`${sections.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6 print:border-none print:shadow-none print:p-0`}>
            {renderLegalBody()}

            {/* Official Signature Block at Bottom */}
            <div className="pt-8 border-t border-slate-200 space-y-4 text-xs text-slate-600 leading-relaxed print:page-break-inside-avoid">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Подпись и заверение оператора:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div>
                  <div className="font-bold text-slate-900">{settings.company_name}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Генеральный директор: {settings.dpo_name}
                  </div>
                  <div className="text-slate-400 text-[10px] mt-2">
                    Электронный документ подписан усиленной квалифицированной электронной подписью (УКЭП)
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-center text-[11px] font-mono space-y-1">
                  <span className="text-emerald-700 font-bold">● УКЭП: ВАЛИДНА (КРИПТОПРО CSP)</span>
                  <span className="text-slate-500">Сертификат: 0285-1A90-0399-88BC</span>
                  <span className="text-slate-400 text-[10px]">Хеш: {revision.sha256_hash.slice(0, 16)}...</span>
                </div>
              </div>
            </div>
          </main>

        </div>

      </div>
    </div>
  );
};
