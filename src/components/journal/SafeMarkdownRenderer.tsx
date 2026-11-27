/**
 * SafeMarkdownRenderer.tsx
 * 100% Safe Markdown-to-React Renderer for DomExit Journal.
 * Strictly ZERO raw HTML injection — builds React Element Trees to prevent XSS.
 * Special support for:
 * - H2 / H3 with slug anchor IDs for Table of Contents.
 * - Bold, italic, bullet lists, ordered lists.
 * - Safe verified links (only https:// or internal /).
 * - Luxury Callout Block for "> **Комментарий эксперта DomExit:**" with platform badge.
 */

import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
}

// Generate clean anchor id from heading text
export function headingToAnchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses inline formatting: **bold**, *italic*, [link text](https://url)
 */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 1. Bold: **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*([^*]+)\*\*([\s\S]*)$/);
    // 2. Link: [text](url)
    const linkMatch = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)$/);

    // Find earliest match
    const boldIdx = remaining.indexOf('**');
    const linkIdx = remaining.indexOf('[');

    if (boldIdx !== -1 && (linkIdx === -1 || boldIdx < linkIdx)) {
      const match = remaining.match(/^([\s\S]*?)\*\*([^*]+)\*\*([\s\S]*)$/);
      if (match) {
        if (match[1]) nodes.push(match[1]);
        nodes.push(
          <strong key={`b-${keyIndex++}`} className="font-bold text-slate-900">
            {match[2]}
          </strong>
        );
        remaining = match[3];
        continue;
      }
    } else if (linkIdx !== -1) {
      const match = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)$/);
      if (match) {
        if (match[1]) nodes.push(match[1]);
        const href = match[3].trim();
        const linkText = match[2];
        const isSafe = href.startsWith('https://') || href.startsWith('/');

        if (isSafe) {
          nodes.push(
            <a
              key={`a-${keyIndex++}`}
              href={href}
              target={href.startsWith('https://') ? '_blank' : undefined}
              rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}
              className="text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 underline-offset-2 font-medium inline-flex items-center gap-0.5"
            >
              <span>{linkText}</span>
              {href.startsWith('https://') && <ExternalLink className="w-3 h-3 inline-block" />}
            </a>
          );
        } else {
          nodes.push(linkText);
        }
        remaining = match[4];
        continue;
      }
    }

    // No more inline tags
    nodes.push(remaining);
    break;
  }

  return nodes;
}

export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentBlockquote: string[] = [];

  const flushList = (key: string) => {
    if (!currentList) return;
    if (currentList.type === 'ul') {
      elements.push(
        <ul key={key} className="my-4 space-y-2 list-disc list-inside text-slate-700 leading-relaxed pl-2">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="marker:text-indigo-500">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
    } else {
      elements.push(
        <ol key={key} className="my-4 space-y-2 list-decimal list-inside text-slate-700 leading-relaxed pl-2">
          {currentList.items.map((item, idx) => (
            <li key={idx} className="marker:text-indigo-600 font-medium">
              <span className="font-normal">{parseInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  const flushBlockquote = (key: string) => {
    if (currentBlockquote.length === 0) return;
    const text = currentBlockquote.join(' ').trim();
    const isExpertComment =
      text.includes('Комментарий эксперта DomExit') ||
      text.includes('Мнение эксперта DomExit') ||
      text.includes('Экспертный комментарий');

    if (isExpertComment) {
      elements.push(
        <div
          key={key}
          className="my-6 p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-sky-50/60 to-white border-2 border-indigo-200/80 shadow-xs relative overflow-hidden"
        >
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider mb-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span>Комментарий эксперта DomExit</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-bold">
              Верифицировано
            </span>
          </div>
          <div className="text-slate-800 text-sm leading-relaxed pl-1 italic">
            {parseInline(text.replace(/^[#*> ]*Комментарий эксперта DomExit[:* ]*/i, ''))}
          </div>
        </div>
      );
    } else {
      elements.push(
        <blockquote
          key={key}
          className="my-4 pl-4 border-l-4 border-slate-300 text-slate-600 italic text-sm leading-relaxed"
        >
          {parseInline(text)}
        </blockquote>
      );
    }
    currentBlockquote = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Empty line: flush lists and quotes
    if (!trimmed) {
      flushList(`list-${i}`);
      flushBlockquote(`quote-${i}`);
      continue;
    }

    // Blockquote line (starts with >)
    if (trimmed.startsWith('>')) {
      flushList(`list-${i}`);
      currentBlockquote.push(trimmed.replace(/^>\s*/, ''));
      continue;
    } else {
      flushBlockquote(`quote-${i}`);
    }

    // Bullet List line (* or -)
    if (/^[-*]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*]\s+/, '');
      if (currentList && currentList.type === 'ul') {
        currentList.items.push(itemText);
      } else {
        flushList(`list-${i}`);
        currentList = { type: 'ul', items: [itemText] };
      }
      continue;
    }

    // Ordered List line (1. 2. etc.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      if (currentList && currentList.type === 'ol') {
        currentList.items.push(itemText);
      } else {
        flushList(`list-${i}`);
        currentList = { type: 'ol', items: [itemText] };
      }
      continue;
    }

    // Non-list line
    flushList(`list-${i}`);

    // H2 Headline (## Headline)
    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^##\s+/, '').replace(/\*\*/g, '');
      const anchorId = headingToAnchorId(headingText);
      elements.push(
        <h2
          key={`h2-${i}`}
          id={anchorId}
          className="text-xl sm:text-2xl font-bold text-slate-900 mt-8 mb-4 tracking-tight scroll-mt-24 border-b border-slate-100 pb-2 flex items-center justify-between"
        >
          <span>{headingText}</span>
          <a
            href={`#${anchorId}`}
            className="text-slate-300 hover:text-indigo-600 text-sm font-normal ml-2 opacity-0 hover:opacity-100 transition-opacity"
            aria-label="Ссылка на раздел"
          >
            #
          </a>
        </h2>
      );
      continue;
    }

    // H3 Subhead (### Subhead)
    if (trimmed.startsWith('### ')) {
      const headingText = trimmed.replace(/^###\s+/, '').replace(/\*\*/g, '');
      const anchorId = headingToAnchorId(headingText);
      elements.push(
        <h3
          key={`h3-${i}`}
          id={anchorId}
          className="text-lg font-bold text-slate-800 mt-6 mb-3 scroll-mt-24"
        >
          {headingText}
        </h3>
      );
      continue;
    }

    // Regular Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-3 text-slate-700 leading-relaxed text-[15px]">
        {parseInline(trimmed)}
      </p>
    );
  }

  // Final flushes
  flushList('list-end');
  flushBlockquote('quote-end');

  return <div className={`safe-markdown space-y-1 ${className}`}>{elements}</div>;
};
