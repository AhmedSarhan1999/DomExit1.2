/**
 * journalSeoService.ts — PropTech AI Module
 * DomExit Journal SEO Engine, YMYL Quality Gate & Unified Telegram Publisher
 *
 * Compliance & FinOps:
 * - Yandex Proxima / YMYL Quality Gate: Rejects unedited template text ([Добавьте...] / TODO:).
 * - Dynamic sitemap.xml & RSS 2.0 with 3600s/1800s caching (zero table full scans!).
 * - Social Share Preview: OpenGraph + Schema.org Article JSON-LD with instant human redirect.
 * - Unified 1-click publishing to DomExit website and Telegram channel.
 */

import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { memoryCache } from '../../lib/memoryCache.js';
import { callTelegramApi, escapeHtml } from '../../lib/telegramClient.js';
import { JournalArticleRecord, transliterateToSlug } from './contentDraftService.js';

export interface YmylValidationResult {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Gate 1: Yandex Proxima / YMYL Quality Validation.
 * Strictly prevents publishing articles with unedited template placeholders.
 */
export function validateArticleForPublish(article: JournalArticleRecord): YmylValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // 1. Mandatory Fields & Lengths
  if (!article.titleRu || article.titleRu.trim().length < 15) {
    blockers.push('Заголовок статьи (titleRu) должен содержать не менее 15 символов.');
  }

  if (!article.slug || !/^[a-z0-9-]+$/.test(article.slug) || article.slug.length < 3) {
    blockers.push('Slug статьи должен быть в латинице и содержать только символы a-z, 0-9 и дефис.');
  }

  if (!article.markdownBodyRu || article.markdownBodyRu.trim().length < 400) {
    blockers.push('Текст статьи (markdownBodyRu) должен содержать не менее 400 символов.');
  }

  // 2. Strict Check for Unfinished Template Placeholders (YMYL Anti-Spam Gate)
  const body = article.markdownBodyRu || '';
  if (
    body.includes('[Добавьте') ||
    body.includes('TODO:') ||
    body.includes('PLACEHOLDER') ||
    body.includes('[Вставьте')
  ) {
    blockers.push(
      'ARTICLE_YMYL_PLACEHOLDER_UNEDITED: В статье остался шаблонный текст "[Добавьте...]" или "TODO:". Добавьте реальный комментарий эксперта DomExit перед публикацией.'
    );
  }

  // 3. SEO Metadata Warnings
  if (!article.humanEdited) {
    warnings.push('Статья не помечена как отредактированная экспертом (humanEdited: false).');
  }

  if (article.seoTitleRu && article.seoTitleRu.length > 65) {
    warnings.push(`SEO Title (${article.seoTitleRu.length} симв.) превышает рекомендуемые 65 символов.`);
  }

  if (article.seoDescriptionRu && article.seoDescriptionRu.length > 160) {
    warnings.push(`SEO Description (${article.seoDescriptionRu.length} симв.) превышает рекомендуемые 160 символов.`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

export interface PublishArticleOptions {
  articleId: string;
  actor: { id: string; name?: string; role?: string };
  publishToTelegram?: boolean;
  telegramDryRun?: boolean;
  forceTelegramRepost?: boolean;
  publicBaseUrl?: string;
}

export interface PublishArticleResult {
  ok: boolean;
  article: JournalArticleRecord;
  telegramSent: boolean;
  telegramDryRun?: boolean;
  telegramMessagePreview?: string;
  telegramNotice?: string;
  warnings?: string[];
}

/**
 * Gate 2: Publish Article to Website + Optional Telegram Channel Broadcast.
 */
export async function publishJournalArticle(
  options: PublishArticleOptions
): Promise<PublishArticleResult> {
  const {
    articleId,
    actor,
    publishToTelegram = false,
    telegramDryRun = false,
    forceTelegramRepost = false,
    publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://domexit.ru',
  } = options;

  const ydb = getYdbClient();
  const article = await ydb.getItem<JournalArticleRecord>('journal_articles', articleId);
  if (!article) {
    throw new Error(`Статья с ID ${articleId} не найдена.`);
  }

  // YMYL Quality Gate check
  const validation = validateArticleForPublish(article);
  if (!validation.ready) {
    const err = new Error(validation.blockers.join(' | '));
    (err as any).statusCode = 400;
    (err as any).errorCode = 'ARTICLE_YMYL_PLACEHOLDER_UNEDITED';
    (err as any).blockers = validation.blockers;
    throw err;
  }

  const nowIso = new Date().toISOString();
  let telegramSent = false;
  let telegramMessagePreview: string | undefined;
  let telegramNotice: string | undefined;

  // Prepare Telegram broadcast if requested
  if (publishToTelegram && (!article.telegramPublishedAt || forceTelegramRepost)) {
    const previewUrl = `${publicBaseUrl}/api/public/journal/share/${article.slug}`;
    const channelId = process.env.TELEGRAM_JOURNAL_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID;

    telegramMessagePreview =
      `📰 <b>${escapeHtml(article.titleRu)}</b>\n\n` +
      `${escapeHtml(article.telegramPostDraftRu || article.subtitleRu || '')}\n\n` +
      `🔗 <a href="${escapeHtml(previewUrl)}">Читать полный анализ в DomExit Журнале</a>`;

    if (telegramDryRun) {
      telegramSent = false;
    } else if (channelId) {
      try {
        const teleRes = await callTelegramApi('sendMessage', {
          chat_id: channelId,
          text: telegramMessagePreview,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        });
        if (teleRes.ok) {
          telegramSent = true;
          article.telegramPublishedAt = nowIso;
        } else {
          telegramNotice = `Telegram send failed: ${teleRes.description || 'Unknown error'}`;
        }
      } catch (err: any) {
        logger.warn('[JournalSeoService] Telegram broadcast failed', { meta: { error: err.message } });
        telegramNotice = `Telegram send error: ${err.message}`;
      }
    } else {
      telegramNotice = 'TELEGRAM_CHANNEL_NOT_CONFIGURED (TELEGRAM_JOURNAL_CHANNEL_ID missing)';
    }
  }

  // Update article record
  const updatedArticle: JournalArticleRecord = {
    ...article,
    status: 'published',
    publishedAt: article.publishedAt || nowIso,
    publishedBy: actor.name || actor.id,
    updatedAt: nowIso,
  };

  await ydb.putItem('journal_articles', updatedArticle);

  // Invalidate memory caches
  memoryCache.delete('seo:sitemap:true');
  memoryCache.delete('seo:sitemap:false');
  memoryCache.delete('seo:journal:rss');

  // Record audit log
  try {
    await ydb.putItem('audit_logs', {
      id: `aud-${crypto.randomBytes(8).toString('hex')}`,
      entityType: 'journal_article',
      entityId: article.id,
      action: 'ARTICLE_PUBLISHED',
      actorId: actor.id,
      actorRole: actor.role || 'owner',
      details: {
        slug: article.slug,
        publishToTelegram,
        telegramSent,
        telegramDryRun,
      },
      createdAt: nowIso,
    });
  } catch (err: any) {
    logger.warn('[JournalSeoService] Failed to write publish audit log', { meta: { error: err.message } });
  }

  return {
    ok: true,
    article: updatedArticle,
    telegramSent,
    telegramDryRun,
    telegramMessagePreview,
    telegramNotice,
    warnings: validation.warnings,
  };
}

/**
 * Unpublish an article (returns to 'in_review').
 */
export async function unpublishJournalArticle(
  articleId: string,
  actor: { id: string; role?: string }
): Promise<JournalArticleRecord> {
  const ydb = getYdbClient();
  const article = await ydb.getItem<JournalArticleRecord>('journal_articles', articleId);
  if (!article) {
    throw new Error(`Статья с ID ${articleId} не найдена.`);
  }

  const nowIso = new Date().toISOString();
  const updated: JournalArticleRecord = {
    ...article,
    status: 'in_review',
    updatedAt: nowIso,
  };

  await ydb.putItem('journal_articles', updated);

  memoryCache.delete('seo:sitemap:true');
  memoryCache.delete('seo:sitemap:false');
  memoryCache.delete('seo:journal:rss');

  return updated;
}

/**
 * Create a manual journal article directly.
 */
export async function createManualJournalArticle(
  data: Partial<JournalArticleRecord>,
  actor: { id: string; name?: string }
): Promise<JournalArticleRecord> {
  const ydb = getYdbClient();
  const nowIso = new Date().toISOString();
  const articleId = `art-${crypto.randomBytes(6).toString('hex')}`;

  const title = (data.titleRu || '').trim();
  const slugCandidate = data.slug ? String(data.slug).trim() : transliterateToSlug(title);
  const slug = slugCandidate || `article-${Date.now()}`;

  const article: JournalArticleRecord = {
    id: articleId,
    slug,
    titleRu: title,
    subtitleRu: (data.subtitleRu || '').trim(),
    category: data.category || 'ddu_214fz',
    tagsRu: Array.isArray(data.tagsRu) ? data.tagsRu : ['Переуступка', '214-ФЗ'],
    seoTitleRu: (data.seoTitleRu || title).slice(0, 65),
    seoDescriptionRu: (data.seoDescriptionRu || data.subtitleRu || '').slice(0, 160),
    readingTimeMin: data.readingTimeMin || 5,
    markdownBodyRu: data.markdownBodyRu || `# ${title}\n\nТекст статьи...`,
    telegramPostDraftRu: data.telegramPostDraftRu || `${title}\n\n${data.subtitleRu || ''}`,
    newsletterSnippetRu: data.newsletterSnippetRu || data.subtitleRu || '',
    ctaTarget: data.ctaTarget || 'opportunities',
    status: 'in_review',
    humanEdited: true, // Manual creation is marked as human edited
    createdBy: actor.id,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await ydb.putItem('journal_articles', article);
  return article;
}

/**
 * Build dynamic sitemap.xml with 3600s cache.
 * Collects static pages + available lots (via index) + published articles (via index).
 */
export async function buildDynamicSitemapXml(
  baseUrl: string = 'https://domexit.ru',
  includeJournal: boolean = true
): Promise<string> {
  const cacheKey = `seo:sitemap:${includeJournal}:${baseUrl}`;
  const cached = memoryCache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const ydb = getYdbClient();
  const now = new Date().toISOString().slice(0, 10);

  // 1. Static Core Pages
  const staticPages = [
    { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/opportunities`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${baseUrl}/sellers`, priority: '0.8', changefreq: 'daily' },
    { loc: `${baseUrl}/how-it-works`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/knowledge`, priority: '0.6', changefreq: 'weekly' },
  ];

  if (includeJournal) {
    staticPages.push({ loc: `${baseUrl}/journal`, priority: '0.9', changefreq: 'daily' });
  }

  // 2. Available Lots via status-publishedAt-index (Zero scanAll!)
  let lotUrls: Array<{ loc: string; lastmod: string; priority: string }> = [];
  try {
    const lots = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<any>({
          tableName: 'lots',
          indexName: 'status-publishedAt-index',
          hashKey: 'status',
          hashValue: 'available',
          limit: 100,
        })
      : await ydb.findByField<any>('lots', 'status', 'available', 100);

    lotUrls = (lots || []).map((l) => ({
      loc: `${baseUrl}/lots/${l.lotCode || l.id}`,
      lastmod: (l.publishedAt || l.createdAt || now).slice(0, 10),
      priority: '0.8',
    }));
  } catch (err: any) {
    logger.warn('[Sitemap] Failed querying available lots for sitemap', { meta: { error: err.message } });
  }

  // 3. Published Journal Articles via status-publishedAt-index
  let articleUrls: Array<{ loc: string; lastmod: string; priority: string }> = [];
  if (includeJournal) {
    try {
      const articles = ydb.isV2TablesEnabled()
        ? await ydb.queryAllByIndex<JournalArticleRecord>({
            tableName: 'journal_articles',
            indexName: 'status-publishedAt-index',
            hashKey: 'status',
            hashValue: 'published',
            limit: 100,
          })
        : await ydb.findByField<JournalArticleRecord>('journal_articles', 'status', 'published', 100);

      articleUrls = (articles || []).map((a) => ({
        loc: `${baseUrl}/journal/${a.slug}`,
        lastmod: (a.updatedAt || a.publishedAt || a.createdAt || now).slice(0, 10),
        priority: '0.8',
      }));
    } catch (err: any) {
      logger.warn('[Sitemap] Failed querying published articles for sitemap', { meta: { error: err.message } });
    }
  }

  // Combine into standard XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const p of staticPages) {
    xml += `  <url>\n    <loc>${escapeXml(p.loc)}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
  }

  for (const l of lotUrls) {
    xml += `  <url>\n    <loc>${escapeXml(l.loc)}</loc>\n    <lastmod>${l.lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${l.priority}</priority>\n  </url>\n`;
  }

  for (const a of articleUrls) {
    xml += `  <url>\n    <loc>${escapeXml(a.loc)}</loc>\n    <lastmod>${a.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${a.priority}</priority>\n  </url>\n`;
  }

  xml += '</urlset>';

  memoryCache.set(cacheKey, xml, 3600);
  return xml;
}

/**
 * Build official RSS 2.0 feed for Yandex Webmaster / Readers with 1800s cache.
 */
export async function buildJournalRssXml(baseUrl: string = 'https://domexit.ru'): Promise<string> {
  const cacheKey = `seo:journal:rss:${baseUrl}`;
  const cached = memoryCache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  const ydb = getYdbClient();
  let articles: JournalArticleRecord[] = [];
  try {
    articles = ydb.isV2TablesEnabled()
      ? await ydb.queryAllByIndex<JournalArticleRecord>({
          tableName: 'journal_articles',
          indexName: 'status-publishedAt-index',
          hashKey: 'status',
          hashValue: 'published',
          scanIndexForward: false,
          limit: 25,
        })
      : await ydb.findByField<JournalArticleRecord>('journal_articles', 'status', 'published', 25);
  } catch (err: any) {
    logger.warn('[Rss] Failed querying published articles for RSS', { meta: { error: err.message } });
  }

  const pubDateNow = new Date().toUTCString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  xml += `    <title>DomExit Журнал — Переуступка ДДУ и недвижимость</title>\n`;
  xml += `    <link>${escapeXml(baseUrl)}/journal</link>\n`;
  xml += `    <description>Аналитика, юридическая практика и инструкции по сделкам с переуступками ДДУ в Санкт-Петербурге и Москве.</description>\n`;
  xml += `    <language>ru</language>\n`;
  xml += `    <lastBuildDate>${pubDateNow}</lastBuildDate>\n`;
  xml += `    <atom:link href="${escapeXml(baseUrl)}/api/public/journal/rss.xml" rel="self" type="application/rss+xml" />\n`;

  for (const a of articles) {
    const pubDate = a.publishedAt ? new Date(a.publishedAt).toUTCString() : pubDateNow;
    const link = `${baseUrl}/journal/${a.slug}`;
    xml += '    <item>\n';
    xml += `      <title>${escapeXml(a.titleRu)}</title>\n`;
    xml += `      <link>${escapeXml(link)}</link>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(link)}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <description>${escapeXml(a.subtitleRu || a.titleRu)}</description>\n`;
    if (a.category) {
      xml += `      <category>${escapeXml(a.category)}</category>\n`;
    }
    xml += '    </item>\n';
  }

  xml += '  </channel>\n';
  xml += '</rss>';

  memoryCache.set(cacheKey, xml, 1800);
  return xml;
}

/**
 * Build lightweight HTML preview with OpenGraph and Schema.org Article JSON-LD for Telegram & VK crawlers.
 * Immediately redirects human browsers to the SPA page /journal/:slug.
 */
export function buildSharePreviewHtml(
  article: JournalArticleRecord,
  baseUrl: string = 'https://domexit.ru'
): string {
  const canonicalUrl = `${baseUrl}/journal/${article.slug}`;
  const title = escapeHtml(`${article.seoTitleRu || article.titleRu} | DomExit Журнал`);
  const description = escapeHtml(article.seoDescriptionRu || article.subtitleRu || article.titleRu);
  const publishedDate = article.publishedAt || article.createdAt;
  const modifiedDate = article.updatedAt || publishedDate;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.titleRu,
    description: article.subtitleRu || article.seoDescriptionRu,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: {
      '@type': 'Organization',
      name: 'DomExit Эксперты',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DomExit',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo-mark.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
  });

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- OpenGraph Metadata for Telegram, VK & Yandex -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="DomExit">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">

  <!-- Schema.org Article Structured Data -->
  <script type="application/ld+json">
  ${jsonLd}
  </script>

  <!-- Instant Human Browser Redirect to SPA -->
  <script>
    window.location.replace('${canonicalUrl}');
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; text-align: center; color: #334155;">
  <h2>${escapeHtml(article.titleRu)}</h2>
  <p>${description}</p>
  <p>Перенаправление в журнал DomExit... <a href="${canonicalUrl}">Нажмите сюда, если переход не произошел автоматически</a>.</p>
</body>
</html>`;
}
