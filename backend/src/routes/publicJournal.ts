/**
 * publicJournal.ts — Public SEO & Journal API Routes
 * Endpoints for DomExit Journal (/journal), sitemap.xml, RSS feed and Social Share previews.
 *
 * Gated by AI Lab feature flag 'publicJournalSeo':
 * - When 'owner_only': Only authenticated owner can access /journal.
 * - When 'public': Open to all visitors and search engines.
 */

import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, normalizeHeaders } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import {
  getAiLabConfig,
  canUseAiFeature,
  UserRole,
} from '../modules/proptech-ai/aiFeatureFlags.js';
import {
  buildDynamicSitemapXml,
  buildJournalRssXml,
  buildSharePreviewHtml,
} from '../modules/proptech-ai/journalSeoService.js';
import { JournalArticleRecord } from '../modules/proptech-ai/contentDraftService.js';

export async function handlePublicJournal(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const cfg = getConfig();
  const publicBaseUrl = cfg.PUBLIC_BASE_URL || 'https://domexit.ru';
  const ydb = getYdbClient();

  // 1. Sitemap.xml: GET /api/public/sitemap.xml OR GET /sitemap.xml
  if (subPath === '/sitemap.xml' || subPath === '/api/public/sitemap.xml') {
    if (method !== 'GET') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    try {
      const config = await getAiLabConfig();
      const authUser = await getAuthenticatedUser(event).catch(() => null);
      const userRole = (authUser?.role || 'guest') as UserRole;
      const includeJournal = canUseAiFeature(config, 'publicJournalSeo', userRole);

      const xml = await buildDynamicSitemapXml(publicBaseUrl, includeJournal);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
        body: xml,
        isBase64Encoded: false,
      };
    } catch (err: any) {
      logger.error('Failed generating dynamic sitemap.xml', { meta: { error: err.message } });
      return json(event, 500, { error: 'Failed to generate sitemap.xml' });
    }
  }

  // 2. RSS Feed: GET /api/public/journal/rss.xml
  if (subPath === '/journal/rss.xml' || subPath === '/api/public/journal/rss.xml') {
    if (method !== 'GET') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    try {
      const xml = await buildJournalRssXml(publicBaseUrl);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800',
          'Access-Control-Allow-Origin': '*',
        },
        body: xml,
        isBase64Encoded: false,
      };
    } catch (err: any) {
      logger.error('Failed generating journal rss.xml', { meta: { error: err.message } });
      return json(event, 500, { error: 'Failed to generate rss.xml' });
    }
  }

  // 3. Social Share Preview HTML: GET /api/public/journal/share/:slug
  if (subPath.startsWith('/journal/share/')) {
    if (method !== 'GET') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    const slug = subPath.replace('/journal/share/', '').split('?')[0].trim();
    if (!slug) {
      return json(event, 400, { error: 'Slug parameter is required' });
    }

    try {
      let article: JournalArticleRecord | null = null;
      if (ydb.isV2TablesEnabled()) {
        const found = await ydb.queryAllByIndex<JournalArticleRecord>({
          tableName: 'journal_articles',
          indexName: 'slug-index',
          hashKey: 'slug',
          hashValue: slug,
          limit: 1,
        });
        article = found[0] || null;
      }

      if (!article) {
        const all = await ydb.findByField<JournalArticleRecord>('journal_articles', 'slug', slug, 1);
        article = all[0] || null;
      }

      if (!article) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          body: `<!DOCTYPE html><html><body><h2>Статья не найдена</h2><p><a href="${publicBaseUrl}">На главную DomExit</a></p></body></html>`,
          isBase64Encoded: false,
        };
      }

      // If article is not published, only allow preview for authenticated owner
      if (article.status !== 'published') {
        const authUser = await getAuthenticatedUser(event).catch(() => null);
        if (authUser?.role !== 'owner') {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: `<!DOCTYPE html><html><body><h2>Статья не опубликована</h2><p><a href="${publicBaseUrl}">На главную DomExit</a></p></body></html>`,
            isBase64Encoded: false,
          };
        }
      }

      const html = buildSharePreviewHtml(article, publicBaseUrl);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=600',
        },
        body: html,
        isBase64Encoded: false,
      };
    } catch (err: any) {
      logger.error('Failed generating share preview', { meta: { slug, error: err.message } });
      return json(event, 500, { error: 'Failed to generate share preview' });
    }
  }

  // 4. Feature Flag check for public Journal viewing
  const config = await getAiLabConfig();
  const authUser = await getAuthenticatedUser(event).catch(() => null);
  const userRole = (authUser?.role || 'guest') as UserRole;

  if (!canUseAiFeature(config, 'publicJournalSeo', userRole)) {
    return json(event, 403, {
      error: 'JOURNAL_NOT_PUBLIC_YET',
      message: 'Журнал DomExit находится в режиме закрытого наполнения владельцем.',
      feature: 'publicJournalSeo',
    });
  }

  // 5. Public List Articles: GET /api/public/journal
  if (subPath === '/journal' || subPath === '/journal/') {
    if (method !== 'GET') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    const q = event.queryStringParameters || {};
    const category = q.category ? String(q.category).trim() : '';
    const limit = Math.min(30, Math.max(1, parseInt(q.limit || '12', 10)));
    let cursorObj: any = null;
    if (q.cursor) {
      try {
        cursorObj = JSON.parse(Buffer.from(String(q.cursor), 'base64').toString('utf-8'));
      } catch {
        cursorObj = null;
      }
    }

    try {
      let articles: JournalArticleRecord[] = [];
      let lastEvaluatedKey: any = null;

      if (ydb.isV2TablesEnabled()) {
        const queryRes = await ydb.queryByIndex<JournalArticleRecord>({
          tableName: 'journal_articles',
          indexName: category ? 'category-publishedAt-index' : 'status-publishedAt-index',
          hashKey: category ? 'category' : 'status',
          hashValue: category ? category : 'published',
          scanIndexForward: false, // Newest first
          limit,
          exclusiveStartKey: cursorObj,
        });
        articles = queryRes.items;
        lastEvaluatedKey = queryRes.lastEvaluatedKey;
      } else {
        const all = await ydb.findByField<JournalArticleRecord>('journal_articles', 'status', 'published', 50);
        articles = (category ? all.filter((a) => a.category === category) : all).slice(0, limit);
      }

      // Return lightweight card projection (omit heavy markdownBodyRu)
      const lightItems = articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        titleRu: a.titleRu,
        subtitleRu: a.subtitleRu,
        category: a.category,
        tagsRu: a.tagsRu,
        readingTimeMin: a.readingTimeMin,
        publishedAt: a.publishedAt,
        humanEdited: a.humanEdited,
      }));

      const nextCursor = lastEvaluatedKey
        ? Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64')
        : null;

      return json(event, 200, {
        ok: true,
        items: lightItems,
        nextCursor,
        hasMore: Boolean(nextCursor),
      });
    } catch (err: any) {
      logger.error('Failed querying public journal articles', { meta: { error: err.message } });
      return json(event, 500, { error: 'Ошибка получения статей журнала' });
    }
  }

  // 6. Public Single Article: GET /api/public/journal/:slug
  if (subPath.startsWith('/journal/')) {
    if (method !== 'GET') {
      return json(event, 405, { error: 'Method Not Allowed' });
    }

    const slug = subPath.replace('/journal/', '').split('?')[0].trim();
    if (!slug) {
      return json(event, 400, { error: 'Slug parameter is required' });
    }

    const q = event.queryStringParameters || {};
    const isPreview = q.preview === '1' && userRole === 'owner';

    try {
      let article: JournalArticleRecord | null = null;
      if (ydb.isV2TablesEnabled()) {
        const found = await ydb.queryAllByIndex<JournalArticleRecord>({
          tableName: 'journal_articles',
          indexName: 'slug-index',
          hashKey: 'slug',
          hashValue: slug,
          limit: 1,
        });
        article = found[0] || null;
      }

      if (!article) {
        const all = await ydb.findByField<JournalArticleRecord>('journal_articles', 'slug', slug, 1);
        article = all[0] || null;
      }

      if (!article) {
        return json(event, 404, { error: 'Статья не найдена' });
      }

      // Must be published unless owner previewing
      if (article.status !== 'published' && !isPreview) {
        return json(event, 404, { error: 'Статья ещё не опубликована' });
      }

      // Fetch up to 3 related published articles from same category
      let relatedArticles: any[] = [];
      try {
        if (ydb.isV2TablesEnabled()) {
          const catArticles = await ydb.queryAllByIndex<JournalArticleRecord>({
            tableName: 'journal_articles',
            indexName: 'category-publishedAt-index',
            hashKey: 'category',
            hashValue: article.category,
            scanIndexForward: false,
            limit: 4,
          });
          relatedArticles = catArticles
            .filter((a) => a.id !== article!.id && a.status === 'published')
            .slice(0, 3)
            .map((a) => ({
              id: a.id,
              slug: a.slug,
              titleRu: a.titleRu,
              subtitleRu: a.subtitleRu,
              category: a.category,
              readingTimeMin: a.readingTimeMin,
              publishedAt: a.publishedAt,
            }));
        }
      } catch {
        // non-fatal
      }

      // Fetch up to 3 live featured lots (available) to maximize lead conversion
      let featuredLots: any[] = [];
      try {
        if (ydb.isV2TablesEnabled()) {
          const availableLots = await ydb.queryAllByIndex<any>({
            tableName: 'lots',
            indexName: 'status-publishedAt-index',
            hashKey: 'status',
            hashValue: 'available',
            scanIndexForward: false,
            limit: 3,
          });
          featuredLots = availableLots.map((l) => ({
            id: l.id,
            lotCode: l.lotCode,
            complexName: l.complexName,
            city: l.city,
            rooms: l.rooms,
            areaSqm: l.areaSqm,
            priceRub: l.priceRub || l.dduPriceRub,
            discountPercent: l.discountPercent || 0,
            primaryPhotoUrl: l.primaryPhotoUrl || l.photos?.[0] || null,
          }));
        }
      } catch {
        // non-fatal
      }

      return json(event, 200, {
        ok: true,
        article,
        relatedArticles,
        featuredLots,
        isPreview,
      });
    } catch (err: any) {
      logger.error('Failed fetching journal article', { meta: { slug, error: err.message } });
      return json(event, 500, { error: 'Ошибка получения статьи' });
    }
  }

  return json(event, 404, { error: `Endpoint /api/public${subPath} не найден` });
}
