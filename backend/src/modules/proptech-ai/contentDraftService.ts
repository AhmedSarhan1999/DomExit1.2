/**
 * contentDraftService.ts — PropTech AI Module
 * AI SEO Article, Telegram Post & Newsletter Draft Generator for DomExit Journal
 * Powered by YandexGPT Pro (ru-central1).
 *
 * 152-FZ Sovereign & Yandex Proxima / YMYL Guardrails:
 * - Articles start strictly as 'ai_draft' with humanEdited: false.
 * - Callout block included for expert commentary (> Комментарий эксперта DomExit:)
 *   reminding the owner to add real-world transaction insight (5 min edit).
 * - Generates synchronized triple output: SEO Markdown article + Telegram channel post + Buy-Box email snippet.
 * - Human-in-the-Loop: ZERO automatic publishing or channel broadcast without owner approval.
 */

import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { completeJson } from '../legal-core/yandexGptClient.js';
import { LegislativeRadarItem } from '../legal-core/legislativeRadarService.js';

export type JournalArticleStatus = 'ai_draft' | 'in_review' | 'published' | 'archived';
export type CtaTarget = 'opportunities' | 'sellers' | 'buybox';

export interface JournalArticleRecord {
  id: string; // art-...
  slug: string;
  titleRu: string;
  subtitleRu: string;
  category: string;
  tagsRu: string[];
  seoTitleRu: string;
  seoDescriptionRu: string;
  readingTimeMin: number;
  markdownBodyRu: string;
  telegramPostDraftRu: string;
  newsletterSnippetRu: string;
  ctaTarget: CtaTarget;
  sourceRadarItemId?: string;
  sourceOriginalUrl?: string;
  status: JournalArticleStatus;
  humanEdited: boolean;
  publishedAt?: string;
  publishedBy?: string;
  telegramPublishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateDraftOptions {
  radarItemId: string;
  customAngleRu?: string;
  requestedBy?: string;
  forceRegenerate?: boolean;
}

/**
 * Clean Cyrillic to Latin transliterator for SEO-friendly URL slugs.
 */
export function transliterateToSlug(text: string): string {
  const ruMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu',
    'я': 'ya',
  };

  return text
    .toLowerCase()
    .split('')
    .map((char) => ruMap[char] !== undefined ? ruMap[char] : char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 75);
}

interface YandexGptArticleOutput {
  titleRu: string;
  subtitleRu: string;
  slugCandidate: string;
  seoTitleRu: string;
  seoDescriptionRu: string;
  tagsRu: string[];
  readingTimeMin: number;
  markdownBodyRu: string;
  telegramPostDraftRu: string;
  newsletterSnippetRu: string;
  ctaTarget: CtaTarget;
}

/**
 * Generate a ready-to-review Journal Article and Telegram post draft from a legislative radar item.
 */
export async function generateArticleDraftFromRadar(
  options: GenerateDraftOptions
): Promise<{
  ok: boolean;
  article: JournalArticleRecord;
  usageTokens: number;
  estimatedCostRub: number;
  isCached?: boolean;
}> {
  const { radarItemId, customAngleRu, requestedBy = 'system', forceRegenerate = false } = options;
  const ydb = getYdbClient();

  // 1. Fetch radar item
  const radarItem = await ydb.getItem<LegislativeRadarItem>('legislative_radar_items', radarItemId);
  if (!radarItem) {
    throw new Error(`Элемент законодательного радара ${radarItemId} не найден`);
  }

  // 2. Check if draft already exists
  if (radarItem.linkedArticleId && !forceRegenerate) {
    const existing = await ydb.getItem<JournalArticleRecord>('journal_articles', radarItem.linkedArticleId);
    if (existing) {
      logger.info('[ContentDraftService] Returning existing article draft from cache', {
        meta: { radarItemId, articleId: existing.id },
      });
      return {
        ok: true,
        article: existing,
        usageTokens: 0,
        estimatedCostRub: 0,
        isCached: true,
      };
    }
  }

  // 3. Build YandexGPT Pro prompt
  const systemPrompt = `Ты — ведущий аналитик и шеф-редактор журнала недвижимости «DomExit Журнал» (Санкт-Петербург и Москва).
Специализация: рынок договоров участия в долевом строительстве (214-ФЗ), переуступки (цессии), эскроу-счета, налоги при продаже прав и льготная/семейная ипотека.

Твоя задача — на основе юридической новости создать профессиональный тройной пакет материалов:
1. SEO-статью для Yandex Search (структурированный Markdown: H2/H3, списки, ясный язык без канцелярита, 700-1100 слов).
   Обязательно включи:
   - В чем суть изменения простыми словами
   - Что это значит для продавца переуступки и для покупателя
   - Реалистичный расчетный пример в рублях (экономия, налог или переплата по ипотеке)
   - Блок экспертной вставки точно в формате:
     > **Комментарий эксперта DomExit:** [Добавьте 2–3 предложения из практики сделок в СПб/Москве перед публикацией]
   - Ссылку и явное упоминание официального первоисточника
2. Пост для Telegram-канала DomExit (700-1000 символов, с эмодзи, структурой из 3-4 ключевых тезисов и призывом перейти к лотам или продавцам на платформе).
3. 3-строчный анонс для e-mail рассылки покупателям из Buy-Box.

Верни строго JSON объект следующей структуры:
{
  "titleRu": "Заголовок статьи (до 75 символов)",
  "subtitleRu": "Подзаголовок с ключевой ценностью (до 140 символов)",
  "slugCandidate": "latin-translit-slug-without-dots",
  "seoTitleRu": "Title для поисковиков (до 65 символов)",
  "seoDescriptionRu": "Description для поисковиков (до 160 символов)",
  "tagsRu": ["Переуступка", "214-ФЗ", "Ипотека", "Налоги"],
  "readingTimeMin": 5,
  "markdownBodyRu": "Текст статьи в формате Markdown...",
  "telegramPostDraftRu": "Текст поста для Telegram...",
  "newsletterSnippetRu": "3 строки для e-mail рассылки...",
  "ctaTarget": "opportunities"
}`;

  const userPrompt = `Юридическая новость для статьи:
Источник: ${radarItem.sourceNameRu}
Заголовок: ${radarItem.originalTitle}
Первоисточник: ${radarItem.originalUrl}
Дата публикации: ${radarItem.publishedAt}
Категория: ${radarItem.category}
Суть и риски: ${radarItem.summaryRu}
Кто затронут: ${radarItem.whoIsAffectedRu}
Затронутые зоны DomExit: ${radarItem.affectedDomExitAreas.join(', ')}
План действий: ${radarItem.complianceActionPlanRu}
${customAngleRu ? `Особый фокус автора: ${customAngleRu}` : ''}

Напиши практичную, убедительную и полезную для реальных людей статью, готовый Telegram-пост и анонс для рассылки.`;

  logger.info('[ContentDraftService] Calling YandexGPT Pro for article generation', {
    meta: { radarItemId, source: radarItem.sourceNameRu },
  });

  const completion = await completeJson<YandexGptArticleOutput>({
    tier: 'pro',
    systemPrompt,
    userPrompt,
    temperature: 0.4,
    maxTokens: 2400,
  });

  if (!completion.ok || !completion.data) {
    throw new Error('YandexGPT Pro не вернул корректный JSON для статьи');
  }

  const d = completion.data;
  const nowIso = new Date().toISOString();
  const articleId = `art-${crypto.randomBytes(6).toString('hex')}`;

  const slug = d.slugCandidate && d.slugCandidate.length > 5
    ? transliterateToSlug(d.slugCandidate)
    : transliterateToSlug(d.titleRu || radarItem.originalTitle);

  // Validate CTA target
  let ctaTarget: CtaTarget = 'opportunities';
  if (['opportunities', 'sellers', 'buybox'].includes(d.ctaTarget)) {
    ctaTarget = d.ctaTarget;
  } else if (radarItem.category === 'tax_ndfl' || radarItem.category === 'ddu_214fz') {
    ctaTarget = 'sellers';
  }

  // 4. Construct Journal Article record
  const article: JournalArticleRecord = {
    id: articleId,
    slug: slug || `article-${Date.now()}`,
    titleRu: d.titleRu || radarItem.originalTitle,
    subtitleRu: d.subtitleRu || radarItem.summaryRu,
    category: radarItem.category,
    tagsRu: Array.isArray(d.tagsRu) && d.tagsRu.length > 0 ? d.tagsRu : ['Переуступка', '214-ФЗ', 'Недвижимость'],
    seoTitleRu: (d.seoTitleRu || d.titleRu).slice(0, 65),
    seoDescriptionRu: (d.seoDescriptionRu || d.subtitleRu).slice(0, 160),
    readingTimeMin: typeof d.readingTimeMin === 'number' ? Math.max(1, Math.min(20, d.readingTimeMin)) : 5,
    markdownBodyRu: d.markdownBodyRu || `# ${radarItem.originalTitle}\n\n${radarItem.summaryRu}`,
    telegramPostDraftRu: d.telegramPostDraftRu || `${radarItem.originalTitle}\n\n${radarItem.summaryRu}`,
    newsletterSnippetRu: d.newsletterSnippetRu || radarItem.summaryRu,
    ctaTarget,
    sourceRadarItemId: radarItem.id,
    sourceOriginalUrl: radarItem.originalUrl,
    status: 'ai_draft', // ALWAYS starts as ai_draft (YMYL protection)
    humanEdited: false, // ALWAYS false until manual editor save
    createdBy: requestedBy,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 5. Persist article to journal_articles_v2
  await ydb.putItem('journal_articles', article);

  // 6. Update legislative radar item with linked article
  await ydb.putItem('legislative_radar_items', {
    ...radarItem,
    linkedArticleId: articleId,
    status: radarItem.status === 'new' ? 'reviewed' : radarItem.status,
    reviewedBy: requestedBy,
    reviewedAt: nowIso,
  });

  // 7. Audit log
  try {
    await ydb.putItem('audit_logs', {
      id: `aud-${crypto.randomBytes(8).toString('hex')}`,
      entityType: 'journal_article',
      entityId: articleId,
      action: 'AI_ARTICLE_DRAFT_GENERATED',
      actorId: requestedBy,
      actorRole: 'owner',
      details: {
        radarItemId,
        modelUri: completion.modelUri,
        tokensTotal: completion.usage.totalTokens,
        costRub: completion.usage.estimatedCostRub,
      },
      createdAt: nowIso,
    });
  } catch (err: any) {
    logger.warn('[ContentDraftService] Failed writing audit log', { meta: { error: err.message } });
  }

  return {
    ok: true,
    article,
    usageTokens: completion.usage.totalTokens,
    estimatedCostRub: completion.usage.estimatedCostRub,
    isCached: false,
  };
}
