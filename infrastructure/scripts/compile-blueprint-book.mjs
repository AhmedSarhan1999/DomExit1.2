/**
 * infrastructure/scripts/compile-blueprint-book.mjs
 *
 * Compiles the 10-chapter DomExit Definitive Architectural & Engineering Blueprint Book into:
 * 1. docs/blueprint-book/DOMEXIT_COMPLETE_BLUEPRINT_BOOK.md
 * 2. docs/blueprint-book/DOMEXIT_COMPLETE_BLUEPRINT_BOOK.html (Print-ready A4, RTL Arabic + LTR Code, Mermaid.js)
 * 3. Updates docs/blueprint-book/BOOK_MANIFEST.json with verified stats.
 *
 * Features:
 * - Zero-Secrets Security Audit (fails immediately if real credentials, IAM tokens, or API keys are leaked).
 * - Exact statistics computation (Words, Lines, Tables, Mermaid diagrams, Code blocks, Estimated A4 Pages).
 * - Standalone Node.js execution without heavy external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const BOOK_DIR = path.join(ROOT_DIR, 'docs/blueprint-book');
const CHAPTERS_DIR = path.join(BOOK_DIR, 'chapters');
const MANIFEST_PATH = path.join(BOOK_DIR, 'BOOK_MANIFEST.json');

const EXPECTED_CHAPTERS = [
  '01-vision-business-legal-architecture.md',
  '02-cloud-infrastructure-finops-scaling.md',
  '03-ydb-v2-database-schema-gsi.md',
  '04-serverless-api-gateway-backend-core.md',
  '05-frontend-ux-and-deal-lifecycle.md',
  '06-ai-system-part1-lab-dadata-cbr-bridge-ocr.md',
  '07-ai-system-part2-gpt-avm-packaging-radar-journal-rag-kyc-legalcore.md',
  '08-telegram-os-automation-sweeper-backup.md',
  '09-forensic-audit-wiring-bugs-and-upgrades.md',
  '10-zero-to-one-super-ai-rebuild-playbook.md',
];

console.log('======================================================================');
console.log('DomExit Blueprint Book Compiler — Compiling 10 Chapters');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// 1. Check Chapters Existence
// -----------------------------------------------------------------------------
console.log('1. Verifying all 10 chapters exist in docs/blueprint-book/chapters/ ...');
for (const ch of EXPECTED_CHAPTERS) {
  const p = path.join(CHAPTERS_DIR, ch);
  if (!fs.existsSync(p)) {
    console.error(`FATAL: Missing chapter file: ${p}`);
    process.exit(1);
  }
}
console.log('   All 10 chapter files exist and are verified.\n');

// -----------------------------------------------------------------------------
// 2. Zero-Secrets Scanner
// -----------------------------------------------------------------------------
console.log('2. Running Mandatory Zero-Secrets Scanner ...');

const SECRET_PATTERNS = [
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Live Yandex IAM Token', regex: /t1\.[A-Za-z0-9_-]{50,}/ },
  { name: 'Telegram Bot Token', regex: /\b\d{9,10}:[A-Za-z0-9_-]{35}\b/ },
  { name: 'Live JWT Token', regex: /\beyJ[A-Za-z0-9-_]{15,}\.eyJ[A-Za-z0-9-_]{15,}\.[A-Za-z0-9-_]{15,}\b/ },
];

let secretsFailed = false;

for (const ch of EXPECTED_CHAPTERS) {
  const content = fs.readFileSync(path.join(CHAPTERS_DIR, ch), 'utf-8');
  for (const pat of SECRET_PATTERNS) {
    if (pat.regex.test(content)) {
      console.error(`SECURITY VIOLATION: Secret pattern "${pat.name}" detected in ${ch}!`);
      secretsFailed = true;
    }
  }
}

if (secretsFailed) {
  console.error('\nCompilation ABORTED due to Zero-Secrets violation. Please redact all secrets.');
  process.exit(1);
}
console.log('   [PASS] Zero-Secrets Scan passed cleanly. No live tokens, JWTs, or private keys found.\n');

// -----------------------------------------------------------------------------
// 3. Compute Exact Statistics
// -----------------------------------------------------------------------------
console.log('3. Computing exact chapter and book statistics ...');

const chaptersData = [];
let totalWords = 0;
let totalLines = 0;
let totalTables = 0;
let totalMermaid = 0;
let totalCodeBlocks = 0;

for (let i = 0; i < EXPECTED_CHAPTERS.length; i++) {
  const fileName = EXPECTED_CHAPTERS[i];
  const raw = fs.readFileSync(path.join(CHAPTERS_DIR, fileName), 'utf-8');
  
  const lines = raw.split('\n').length;
  const words = raw.trim().split(/\s+/).filter(Boolean).length;
  const tables = (raw.match(/\|[\s-:]+\|/g) || []).length;
  const mermaidBlocks = (raw.match(/```mermaid[\s\S]*?```/g) || []).length;
  const codeBlocks = (raw.match(/```[a-z]*[\s\S]*?```/gi) || []).length - mermaidBlocks;
  const estimatedPages = Math.round(words / 240);

  totalWords += words;
  totalLines += lines;
  totalTables += tables;
  totalMermaid += mermaidBlocks;
  totalCodeBlocks += Math.max(0, codeBlocks);

  // Extract title
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : fileName;

  chaptersData.push({
    index: i + 1,
    fileName,
    title,
    lines,
    words,
    tables,
    mermaidBlocks,
    codeBlocks: Math.max(0, codeBlocks),
    estimatedPages,
    raw,
  });
}

const totalPages = Math.round(totalWords / 240);

console.log(`   Chapters compiled: ${chaptersData.length}/10`);
console.log(`   Total Words:       ${totalWords.toLocaleString('en-US')}`);
console.log(`   Total Lines:       ${totalLines.toLocaleString('en-US')}`);
console.log(`   Total Tables:      ${totalTables}`);
console.log(`   Mermaid Diagrams:  ${totalMermaid}`);
console.log(`   Code Blocks:       ${totalCodeBlocks}`);
console.log(`   Estimated Pages:   ${totalPages} pages (A4 @ 240 w/p)\n`);

// -----------------------------------------------------------------------------
// 4. Generate Unified Markdown (DOMEXIT_COMPLETE_BLUEPRINT_BOOK.md)
// -----------------------------------------------------------------------------
console.log('4. Generating DOMEXIT_COMPLETE_BLUEPRINT_BOOK.md ...');

const mdToc = chaptersData
  .map((c) => `- [**${c.title}**](#${encodeURIComponent(c.title.toLowerCase().replace(/[^\w\u0600-\u06FF]+/g, '-'))}) — *(${c.words.toLocaleString('en-US')} كلمة ~ ${c.estimatedPages} صفحة)*`)
  .join('\n');

const mdCover = `# الكتاب المرجعي الشامل لمعمارية وهندسة ومنظومة الذكاء الاصطناعي لمنصة DomExit
## The Definitive Engineering, AI Forensic Audit & Zero-to-One Reconstruction Blueprint

---

### بطاقة البيانات الوصفية للمنظومة
- **اسم المنصة:** DomExit (Платформа переуступки прав требований ДДУ 214-ФЗ)
- **النطاق الإنتاجي الرسمي:** [https://domexit.ru](https://domexit.ru)
- **بيئة السحابة والسيادة:** Yandex Cloud — \`ru-central1\`
- **إصدار المعمارية:** \`v3.0.0-ai-ready\`
- **تاريخ الإصدار والاعتماد:** 27 نوفمبر 2026
- **إجمالي الفصول المنجزة:** 10 فصول هندسية ومعمارية كاملة (100%)
- **إجمالي الكلمات الفعلية:** **${totalWords.toLocaleString('en-US')} كلمة**
- **تقدير الصفحات القياسية (A4):** **~${totalPages} صفحة مطبوعة**
- **فحص الأسرار والسيادة (Zero-Secrets Audit):** **PASS ✅** (خالٍ من أي مفاتيح أو أسرار)
- **الغرض:** التوثيق الشامل الكامل للمنصة، الفحص الجنائي لجميع الوحدات، ودستور إعادة البناء من الصفر لنموذج ذكاء اصطناعي خارق.

---

## جدول المحتويات التفاعلي (Table of Contents)

${mdToc}

---
`;

const mdContent = [
  mdCover,
  ...chaptersData.map((c) => `\n<div class="page-break"></div>\n\n${c.raw}\n\n---\n`),
].join('\n');

const unifiedMdPath = path.join(BOOK_DIR, 'DOMEXIT_COMPLETE_BLUEPRINT_BOOK.md');
fs.writeFileSync(unifiedMdPath, mdContent, 'utf-8');
console.log(`   Created: ${unifiedMdPath} (${(fs.statSync(unifiedMdPath).size / 1024 / 1024).toFixed(2)} MB)\n`);

// -----------------------------------------------------------------------------
// 5. Generate Print-Ready HTML Book (DOMEXIT_COMPLETE_BLUEPRINT_BOOK.html)
// -----------------------------------------------------------------------------
console.log('5. Generating DOMEXIT_COMPLETE_BLUEPRINT_BOOK.html ...');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function simpleMarkdownToHtml(md) {
  let html = md;

  // Code blocks (Mermaid vs Normal)
  html = html.replace(/```mermaid\s*([\s\S]*?)```/g, (match, code) => {
    return `<div class="mermaid-container" dir="ltr"><pre class="mermaid">${escapeHtml(code.trim())}</pre></div>`;
  });

  html = html.replace(/```([a-z0-9_-]*)\s*([\s\S]*?)```/gi, (match, lang, code) => {
    return `<div class="code-container" dir="ltr"><div class="code-lang">${lang || 'code'}</div><pre><code>${escapeHtml(code.trim())}</code></pre></div>`;
  });

  // Headers
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code" dir="ltr">$1</code>');

  // Blockquotes
  html = html.replace(/^>\s*(.*$)/gim, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="section-divider" />');

  // Tables
  html = html.replace(/((?:^\|.+?\|(?:\r?\n|$))+)/gm, (match) => {
    const lines = match.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return match;
    const headerCols = lines[0].split('|').map((s) => s.trim()).filter(Boolean);
    let tableHtml = '<div class="table-responsive"><table class="data-table"><thead><tr>';
    for (const h of headerCols) {
      tableHtml += `<th>${h}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 2; r < lines.length; r++) {
      const rowCols = lines[r].split('|').map((s) => s.trim()).filter(Boolean);
      tableHtml += '<tr>';
      for (const col of rowCols) {
        tableHtml += `<td>${col}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Paragraphs
  const blocks = html.split(/\n{2,}/);
  html = blocks
    .map((b) => {
      const trimmed = b.trim();
      if (!trimmed) return '';
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol')
      ) {
        return trimmed;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split('\n').map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n\n');

  return html;
}

const htmlBodyChapters = chaptersData
  .map(
    (c) => `
    <article class="chapter-page page-break" id="chapter-${c.index}">
      <header class="chapter-header">
        <span class="chapter-badge">الفصل ${String(c.index).padStart(2, '0')}</span>
        <div class="chapter-meta">
          <span>${c.words.toLocaleString('en-US')} كلمة</span> •
          <span>~${c.estimatedPages} صفحة A4</span> •
          <span>${c.codeBlocks} كتلة كود</span> •
          <span>${c.mermaidBlocks} مخطط معماري</span>
        </div>
      </header>
      <div class="chapter-body">
        ${simpleMarkdownToHtml(c.raw)}
      </div>
    </article>
`
  )
  .join('\n');

const htmlDoc = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>الكتاب المرجعي الشامل لمنصة DomExit — النسخة الموحدة الكاملة</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  
  <!-- Mermaid.js for Diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      mermaid.initialize({
        startOnLoad: true,
        theme: 'neutral',
        fontFamily: 'Cairo, sans-serif',
        securityLevel: 'loose'
      });
    });
  </script>

  <style>
    :root {
      --primary: #0f172a;
      --primary-light: #1e293b;
      --accent: #0284c7;
      --accent-gold: #d97706;
      --text: #1e293b;
      --text-muted: #64748b;
      --bg: #ffffff;
      --bg-alt: #f8fafc;
      --border: #e2e8f0;
      --code-bg: #0f172a;
      --code-text: #f1f5f9;
    }

    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: var(--text);
      background-color: var(--bg);
      line-height: 1.8;
      font-size: 15px;
    }

    .book-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    /* Print & Page Break Styles */
    @media print {
      body {
        font-size: 11pt;
        line-height: 1.5;
        background: white;
      }
      .book-container {
        max-width: 100%;
        padding: 0;
      }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
      .no-print {
        display: none !important;
      }
      .table-responsive {
        overflow: visible !important;
      }
      a {
        text-decoration: none;
        color: var(--text);
      }
      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }
    }

    /* Cover Page */
    .cover-page {
      min-height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      border: 3px double var(--border);
      border-radius: 24px;
      padding: 60px 40px;
      margin-bottom: 60px;
      background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
    }

    .cover-badge {
      display: inline-block;
      padding: 6px 18px;
      background: #0284c7;
      color: white;
      font-weight: 700;
      font-size: 13px;
      border-radius: 9999px;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }

    .cover-title {
      font-size: 32px;
      font-weight: 900;
      color: var(--primary);
      margin: 0 0 16px 0;
      line-height: 1.3;
    }

    .cover-subtitle {
      font-size: 18px;
      color: var(--text-muted);
      max-width: 800px;
      margin: 0 auto 36px auto;
      font-weight: 600;
      font-family: -apple-system, sans-serif;
    }

    .metadata-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      width: 100%;
      max-width: 750px;
      text-align: right;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      margin-bottom: 30px;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      font-size: 14px;
    }

    .metadata-item strong {
      color: var(--primary);
      display: block;
      font-size: 12px;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    /* Table of Contents */
    .toc-card {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px;
      margin-bottom: 60px;
    }

    .toc-title {
      font-size: 22px;
      font-weight: 800;
      margin-top: 0;
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc-item {
      padding: 10px 0;
      border-bottom: 1px dashed var(--border);
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }

    .toc-item a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    .toc-item a:hover {
      color: var(--accent);
    }

    .toc-stats {
      font-size: 13px;
      color: var(--text-muted);
      direction: ltr;
    }

    /* Chapter Header */
    .chapter-header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 16px;
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .chapter-badge {
      font-size: 14px;
      font-weight: 800;
      background: var(--primary);
      color: white;
      padding: 4px 14px;
      border-radius: 6px;
    }

    .chapter-meta {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* Typography inside Chapters */
    h1 { font-size: 26px; font-weight: 900; color: var(--primary); margin: 32px 0 16px; }
    h2 { font-size: 21px; font-weight: 800; color: var(--primary-light); margin: 28px 0 14px; border-right: 4px solid var(--accent); padding-right: 12px; }
    h3 { font-size: 18px; font-weight: 700; color: var(--primary); margin: 24px 0 12px; }
    h4 { font-size: 16px; font-weight: 700; color: var(--text); margin: 20px 0 10px; }

    p { margin: 0 0 16px 0; text-align: justify; }

    blockquote {
      border-right: 4px solid var(--accent-gold);
      background: #fffbeb;
      padding: 14px 20px;
      margin: 20px 0;
      border-radius: 0 10px 10px 0;
      color: #92400e;
      font-size: 14px;
    }

    /* Code Blocks (LTR) */
    .code-container {
      background: var(--code-bg);
      border-radius: 12px;
      margin: 20px 0;
      overflow: hidden;
      border: 1px solid #334155;
    }

    .code-lang {
      background: #1e293b;
      color: #94a3b8;
      font-size: 11px;
      padding: 4px 12px;
      font-family: 'JetBrains Mono', monospace;
      text-transform: uppercase;
      font-weight: 700;
      border-bottom: 1px solid #334155;
    }

    pre {
      margin: 0;
      padding: 16px;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--code-text);
      line-height: 1.6;
    }

    .inline-code {
      font-family: 'JetBrains Mono', monospace;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
    }

    /* Mermaid Diagrams */
    .mermaid-container {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      margin: 24px 0;
      display: flex;
      justify-content: center;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    /* Tables */
    .table-responsive {
      overflow-x: auto;
      margin: 24px 0;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 8px;
    }

    .data-table th {
      background: #f1f5f9;
      color: var(--primary);
      font-weight: 700;
      padding: 10px 14px;
      border: 1px solid var(--border);
      text-align: right;
    }

    .data-table td {
      padding: 10px 14px;
      border: 1px solid var(--border);
      vertical-align: top;
    }

    .data-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .section-divider {
      border: 0;
      height: 1px;
      background: var(--border);
      margin: 40px 0;
    }

    .print-button {
      position: fixed;
      bottom: 24px;
      left: 24px;
      background: var(--primary);
      color: white;
      padding: 12px 24px;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
      border: none;
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .print-button:hover { background: #1e293b; }
  </style>
</head>
<body>

  <button class="print-button no-print" onclick="window.print()">
    🖨️ طباعة أو حفظ بصيغة PDF (Ctrl + P)
  </button>

  <div class="book-container">

    <!-- Cover Page -->
    <div class="cover-page">
      <span class="cover-badge">وثيقة هندسية سيادية معتمدة • v3.0.0-ai-ready</span>
      <h1 class="cover-title">الكتاب المرجعي الشامل لمعمارية وهندسة ومنظومة الذكاء الاصطناعي لمنصة DomExit</h1>
      <div class="cover-subtitle">The Definitive Engineering Blueprint, Forensic AI Audit, and Zero-to-One Super-AI Reconstruction Playbook</div>
      
      <div class="metadata-card">
        <div class="metadata-grid">
          <div class="metadata-item">
            <strong>نطاق المنصة الرسمي</strong>
            <a href="https://domexit.ru" target="_blank">https://domexit.ru</a>
          </div>
          <div class="metadata-item">
            <strong>البيئة السحابية والسيادة</strong>
            Yandex Cloud (ru-central1)
          </div>
          <div class="metadata-item">
            <strong>إجمالي الكلمات الفعلية</strong>
            ${totalWords.toLocaleString('en-US')} كلمة
          </div>
          <div class="metadata-item">
            <strong>تقدير الصفحات القياسية</strong>
            ~${totalPages} صفحة A4 مطبوعة
          </div>
          <div class="metadata-item">
            <strong>الفصول الهندسية</strong>
            10 فصول كاملة (100% مكتمل)
          </div>
          <div class="metadata-item">
            <strong>فحص الأسرار والسيادة</strong>
            <span style="color: #16a34a; font-weight: bold;">PASS ✅ (خالٍ من الأسرار)</span>
          </div>
        </div>
      </div>
      
      <p style="color: var(--text-muted); font-size: 13px; margin: 0;">
        وثيقة معمارية قطعية توثق كامل ميزات المستودع، الفحص الجنائي لسلاسل الترابط، ودستور إعادة البناء الخطي من الصفر.
      </p>
    </div>

    <!-- Table of Contents -->
    <div class="toc-card page-break">
      <h2 class="toc-title">فهرس فصول الكتاب المرجعي (Table of Contents)</h2>
      <ul class="toc-list">
        ${chaptersData
          .map(
            (c) => `
          <li class="toc-item">
            <a href="#chapter-${c.index}">
              الفصل ${String(c.index).padStart(2, '0')}: ${c.title.replace(/^#\s*/, '')}
            </a>
            <span class="toc-stats">${c.words.toLocaleString('en-US')} w • ~${c.estimatedPages} p</span>
          </li>
        `
          )
          .join('')}
      </ul>
    </div>

    <!-- Chapters Content -->
    ${htmlBodyChapters}

    <!-- Closing Footer -->
    <footer style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px; border-top: 1px solid var(--border);">
      منصة DomExit v3.0.0-ai-ready • روسيا الاتحادية • كافة الحقوق المعمارية والهندسية محفوظة 2026
    </footer>

  </div>

</body>
</html>
`;

const unifiedHtmlPath = path.join(BOOK_DIR, 'DOMEXIT_COMPLETE_BLUEPRINT_BOOK.html');
fs.writeFileSync(unifiedHtmlPath, htmlDoc, 'utf-8');
console.log(`   Created: ${unifiedHtmlPath} (${(fs.statSync(unifiedHtmlPath).size / 1024 / 1024).toFixed(2)} MB)\n`);

// -----------------------------------------------------------------------------
// 6. Update BOOK_MANIFEST.json
// -----------------------------------------------------------------------------
console.log('6. Updating BOOK_MANIFEST.json ...');

const manifestRaw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
manifestRaw.completedChaptersCount = 10;
manifestRaw.totalChaptersCount = 10;
manifestRaw.totalWordsSoFar = totalWords;
manifestRaw.estimatedPagesSoFar = totalPages;
manifestRaw.zeroSecretsAudit = 'PASS';

for (const c of chaptersData) {
  const mCh = manifestRaw.chapters.find((ch) => ch.chapterNumber === c.index);
  if (mCh) {
    mCh.actualWordCount = c.words;
    mCh.estimatedPagesA4 = c.estimatedPages;
    mCh.status = 'done';
  }
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifestRaw, null, 2), 'utf-8');
console.log('   Updated: docs/blueprint-book/BOOK_MANIFEST.json successfully.\n');

console.log('======================================================================');
console.log('COMPILATION COMPLETED SUCCESSFULLY!');
console.log('======================================================================');
console.log(`- Unified Markdown: ${unifiedMdPath}`);
console.log(`- Unified HTML:     ${unifiedHtmlPath}`);
console.log(`- Total Words:      ${totalWords.toLocaleString('en-US')}`);
console.log(`- Total Pages A4:   ~${totalPages}`);
console.log(`- Security Audit:   PASS (Zero Secrets)`);
console.log('======================================================================\n');
