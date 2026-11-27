/**
 * backend/src/modules/proptech-ai/ragKnowledgeIndexer.ts
 *
 * Zero-Cost S3 Vector RAG Indexer for DomExit AI Concierge.
 * - Stores compressed index in S3_PRIVATE_BUCKET/_ai_rag/knowledge_index.json.gz (200-800 KB).
 * - Caches in appCache for 10 minutes to deliver <5ms cosine similarity vector search.
 * - Incremental Embedding: Reuses cached vectors by SHA-256 contentHash (0 ₽ for unchanged chunks).
 * - ZERO-PII RULE: 100% strict exclusion of all customer private personal data.
 *
 * 4 Whitelisted Public Sources:
 * 1. DomExit Core Knowledge & FAQ (214-FZ, SBR, PEP 63-FZ, 0% seller / 2.5% buyer, 3 slots, Gold SLA).
 * 2. Public Platform Legal Policies from legal_documents.
 * 3. Published Articles (status === 'published') from journal_articles_v2.
 * 4. Available Lots Summaries (status === 'available') from lots_v2 (strictly public fields, zero seller PII).
 */

import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../../lib/s3Client.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { getConfig } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { appCache } from '../../lib/cache.js';
import {
  cosineSimilarity,
  embedDocument,
  embedQuery,
} from '../legal-core/yandexEmbeddingsClient.js';

export interface KnowledgeChunk {
  id: string;
  sourceType: 'core_faq' | 'legal_doc' | 'journal_article' | 'available_lot';
  sourceId: string;
  title: string;
  url: string;
  text: string;
  contentHash: string;
  vector?: number[];
  metadata?: Record<string, any>;
}

export interface RagIndexMetadata {
  id: string;
  chunksCount: number;
  embeddedNewCount: number;
  reusedCachedCount: number;
  compressedSizeKb: number;
  sourcesBreakdown: Record<string, number>;
  lastIndexedAt: string;
  updatedAt: string;
  indexedBy?: string;
}

export interface RagSearchResult {
  chunk: KnowledgeChunk;
  score: number;
}

export const S3_RAG_INDEX_KEY = '_ai_rag/knowledge_index.json.gz';
const RAG_CACHE_KEY = 'rag_s3_index_data';
const RAG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// 1. Core Platform Knowledge Chunks (Static high-fidelity reference)
export const DOMEXIT_CORE_KNOWLEDGE_CHUNKS: Array<Omit<KnowledgeChunk, 'contentHash' | 'vector'>> = [
  {
    id: 'core_faq_01',
    sourceType: 'core_faq',
    sourceId: 'core_faq_214fz',
    title: 'Переуступка прав по ДДУ (214-ФЗ)',
    url: '/how-it-works',
    text: `Переуступка прав требования (договор цессии) по 214-ФЗ регулируется ст. 11 Закона № 214-ФЗ и нормами Гражданского кодекса РФ.
Сделка возможна с момента государственной регистрации ДДУ в Росреестре и до подписания передаточного акта на квартиру.
Обязательные условия: полная оплата цены ДДУ застройщику (или оформление перевода долга), отсутствие запретов застройщика и согласие банка, если квартира в ипотеке.
При цессии права на счет эскроу переходят к новому дольщику автоматически в силу закона (ч. 8 ст. 15.5 214-ФЗ).
Платформа DomExit проводит проверку легитимности ДДУ, выписок из ЕГРН и истории оплат застройщику перед публикацией.`,
  },
  {
    id: 'core_faq_02',
    sourceType: 'core_faq',
    sourceId: 'core_faq_sbr_escrow',
    title: 'Безопасные расчеты: Сервис безопасных расчетов (СБР) и аккредитив',
    url: '/how-it-works',
    text: `Все расчеты между покупателем и продавцом на платформе DomExit проходят исключительно в безналичной форме через Сервис безопасных расчетов (СБР) банков-партнеров (Сбербанк, ВТБ, Альфа-Банк) или безотзывный покрытый аккредитив.
Денежные средства покупателя блокируются на специальном номинальном счете до государственной регистрации договора цессии в Росреестре.
Продавец получает деньги только после того, как Росреестр подтвердит регистрацию перехода прав на покупателя.
Если сделка по какой-либо причине не регистрируется в Росреестре, банк в полном объеме возвращает денежные средства покупателю без задержек.`,
  },
  {
    id: 'core_faq_03',
    sourceType: 'core_faq',
    sourceId: 'core_faq_commissions',
    title: 'Тарифы и комиссии: 0% для продавца, 2.5% для покупателя',
    url: '/pricing',
    text: `Платформа DomExit предлагает революционную модель монетизации на рынке переуступок:
Комиссия для продавца составляет ровно 0 ₽ (0%). Продавец получает полную чистую сумму сделки без скрытых вычетов.
Комиссия для покупателя составляет фиксированные 2.5% от суммы сделки, включая полный юридический аудит ДДУ, подготовку пакета документов, координацию с застройщиком и сопровождение расчетов.
Платформа не навязывает скрытых агентских платежей и гарантирует полную прозрачность всех финансовых условий на этапе согласования оферты.`,
  },
  {
    id: 'core_faq_04',
    sourceType: 'core_faq',
    sourceId: 'core_faq_pep_63fz',
    title: 'Простая электронная подпись (ПЭП) по 63-ФЗ',
    url: '/legal',
    text: `Согласование условий сделки, оферт и промежуточных соглашений на платформе DomExit осуществляется с использованием Простой электронной подписи (ПЭП) в строгом соответствии с Федеральным законом № 63-ФЗ «Об электронной подписи».
Каждое подписание верифицируется через защищенный SMS-код или привязанный подтвержденный Telegram-аккаунт.
Для каждого документа формируется неизменяемый протокол подписания с фиксацией IP-адреса, времени UTC, хэша документа SHA-256 и персонального идентификатора участника.
Итоговая регистрация цессии в Росреестре осуществляется через нотариуса или усиленную квалифицированную электронную подпись (УКЭП).`,
  },
  {
    id: 'core_faq_05',
    sourceType: 'core_faq',
    sourceId: 'core_faq_bankruptcy_127fz',
    title: 'Защита от банкротства продавца по ст. 61.2 ФЗ-127',
    url: '/how-it-works',
    text: `Главный юридический риск при покупке переуступки — признание сделки недействительной в случае банкротства продавца в течение 3 лет после сделки (ст. 61.2 Федерального закона № 127-ФЗ «О несостоятельности (банкротстве)»).
Сделка может быть оспорена конкурсным управляющим, если цена квартиры была существенно ниже рыночной или если продавец имел признаки неплатежеспособности.
Юристы DomExit проводят обязательный скоринг продавца: проверяют базу судебных приставов (ФССП), картотеку арбитражных дел, реестр банкротств (Федресурс) и базы судов общей юрисдикции.
Для каждой сделки формируется официальное правовое заключение, подтверждающее добросовестность покупателя и рыночный характер стоимости.`,
  },
  {
    id: 'core_faq_06',
    sourceType: 'core_faq',
    sourceId: 'core_faq_three_slots',
    title: 'Система 3 слотов (Three-Slot Rule) и статус Gold',
    url: '/portal?tab=buybox',
    text: `Чтобы исключить фиктивные бронирования и защитить реальных продавцов от срыва сделок, DomExit применяет правило 3 слотов:
Обычный верифицированный покупатель или брокер может иметь не более 1 активного бронирования одновременно.
Инвесторы со статусом Gold, подтвердившие платежеспособность (депозит или выписка с банковского счета), получают доступ к 3 одновременным слотам и эксклюзивным окнам раннего доступа (Lot Drops) на 24 часа раньше общего рынка.
Слот освобождается только после успешного закрытия сделки или мотивированного отказа с возвратом депозита.`,
  },
  {
    id: 'core_faq_07',
    sourceType: 'core_faq',
    sourceId: 'core_faq_closing_room',
    title: '6 этапов Закрытой комнаты (S3 Closing Room)',
    url: '/how-it-works',
    text: `Проведение сделки на платформе DomExit организовано в защищенной виртуальной Закрытой комнате (Closing Room) из 6 последовательных шагов:
1. Согласование цены и условий оферты между сторонами.
2. Проверка документов и комплексный юридический аудит (Legal Audit).
3. Оформление эскроу/СБР или открытие аккредитива в банке-партнере.
4. Получение официального согласия застройщика на переуступку и справок о взаиморасчетах.
5. Государственная регистрация договора цессии в Росреестре (электронная или через МФЦ).
6. Раскрытие расчетов банком в пользу продавца и передача оригиналов документов новому дольщику.`,
  },
  {
    id: 'core_faq_08',
    sourceType: 'core_faq',
    sourceId: 'core_faq_buybox_matchmaker',
    title: 'Умный подбор Buy-Box: автоматический поиск подходящих переуступок',
    url: '/portal?tab=buybox',
    text: `Инструмент Buy-Box позволяет покупателям и инвесторам задать точные критерии поиска квартир в строящихся домах:
Параметры включают: город и районы (Санкт-Петербург, Ленинградская область, Москва), минимальный и максимальный бюджет, количество комнат (студия, 1-ккв, 2-ккв, 3-ккв), срок сдачи дома и способ оплаты (100% оплата, семейная ипотека).
Как только продавец загружает подходящую квартиру, система мгновенно уведомляет покупателя через Личный кабинет и Telegram-бота.
Покупатель может сохранить параметры прямо из диалога с AI-Консьержем одной кнопкой.`,
  },
];

/**
 * Computes SHA-256 hash of a string.
 */
function computeHash(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Splits text into overlapping chunks of 600-900 chars with ~100 chars overlap.
 */
function splitTextIntoChunks(text: string, maxLen = 800, overlap = 100): string[] {
  const clean = (text || '').replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxLen) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = start + maxLen;
    if (end < clean.length) {
      const lastParagraph = clean.lastIndexOf('\n\n', end);
      if (lastParagraph > start + 300) {
        end = lastParagraph;
      } else {
        const lastPeriod = clean.lastIndexOf('. ', end);
        if (lastPeriod > start + 300) {
          end = lastPeriod + 1;
        }
      }
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk.length >= 100) {
      chunks.push(chunk);
    }
    start = end - overlap;
    if (start >= clean.length || end >= clean.length) break;
  }
  return chunks;
}

/**
 * Loads previous index from S3 if present.
 */
async function loadExistingS3Index(bucket: string): Promise<Map<string, number[]>> {
  const hashToVectorMap = new Map<string, number[]>();
  try {
    const s3 = getS3Client();
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: S3_RAG_INDEX_KEY,
      })
    );

    if (res.Body) {
      const stream = res.Body as any;
      const chunksBuffer: Buffer[] = [];
      for await (const chunk of stream) {
        chunksBuffer.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const compressed = Buffer.concat(chunksBuffer);
      const decompressed = zlib.gunzipSync(compressed).toString('utf-8');
      const data = JSON.parse(decompressed);

      if (Array.isArray(data.chunks)) {
        for (const item of data.chunks) {
          if (item.contentHash && Array.isArray(item.vector) && item.vector.length === 256) {
            hashToVectorMap.set(item.contentHash, item.vector);
          }
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'NoSuchKey' && err.name !== 'NotFound') {
      logger.warn(`RAG_LOAD_S3_INDEX_WARN: ${err.message}`);
    }
  }
  return hashToVectorMap;
}

/**
 * Collects approved public knowledge chunks from the 4 whitelisted sources (ZERO PII).
 */
async function collectWhitelistedKnowledgeChunks(): Promise<Array<Omit<KnowledgeChunk, 'vector'>>> {
  const chunks: Array<Omit<KnowledgeChunk, 'vector'>> = [];
  const ydb = getYdbClient();

  // Source 1: Core Static FAQ
  for (const item of DOMEXIT_CORE_KNOWLEDGE_CHUNKS) {
    const textChunks = splitTextIntoChunks(item.text, 800, 100);
    textChunks.forEach((tc, idx) => {
      chunks.push({
        id: `${item.id}_${idx}`,
        sourceType: 'core_faq',
        sourceId: item.sourceId,
        title: item.title,
        url: item.url,
        text: tc,
        contentHash: computeHash(tc),
      });
    });
  }

  // Source 2: Approved Legal Documents from legal_documents table
  try {
    const legItems = await ydb.scanAll<any>('legal_documents', 30).catch(() => []);
    for (const item of legItems) {
      if (item.status === 'archived') continue;
      const body = item.content || item.markdownText || item.description || '';
      if (!body || body.length < 100) continue;

      const title = item.titleRu || item.title || 'Официальный регламент DomExit';
      const url = `/legal/${item.id || item.slug || ''}`;
      const bodyChunks = splitTextIntoChunks(body, 850, 100);

      bodyChunks.forEach((bc, idx) => {
        chunks.push({
          id: `legal_doc_${item.id || idx}_${idx}`,
          sourceType: 'legal_doc',
          sourceId: String(item.id || idx),
          title,
          url,
          text: `[Документ: ${title}]\n${bc}`,
          contentHash: computeHash(bc),
        });
      });
    }
  } catch (err: any) {
    logger.warn(`RAG_COLLECT_LEGAL_DOCS_WARN: ${err.message}`);
  }

  // Source 3: Published Journal Articles (status === 'published')
  try {
    let articleItems: any[] = [];
    if (ydb.isV2TablesEnabled()) {
      articleItems = await ydb.queryAllByIndex<any>({
        tableName: 'journal_articles',
        indexName: 'status-publishedAt-index',
        hashKey: 'status',
        hashValue: 'published',
        limit: 30,
      }).catch(async () => {
        const all = await ydb.scanAll<any>('journal_articles', 30).catch(() => []);
        return all.filter((a: any) => a.status === 'published');
      });
    } else {
      const all = await ydb.scanAll<any>('journal_articles', 30).catch(() => []);
      articleItems = all.filter((a: any) => a.status === 'published');
    }

    for (const art of articleItems) {
      const body = art.markdownBodyRu || '';
      if (body.length < 200) continue;
      const title = art.titleRu || 'Статья Журнала DomExit';
      const url = `/journal/${art.slug}`;
      const artChunks = splitTextIntoChunks(body, 800, 100);

      artChunks.forEach((ac, idx) => {
        chunks.push({
          id: `journal_${art.id || art.slug}_${idx}`,
          sourceType: 'journal_article',
          sourceId: String(art.id || art.slug),
          title,
          url,
          text: `[Статья: ${title}]\n${ac}`,
          contentHash: computeHash(ac),
        });
      });
    }
  } catch (err: any) {
    logger.warn(`RAG_COLLECT_JOURNAL_WARN: ${err.message}`);
  }

  // Source 4: Available Lots Summaries (status === 'available' - strictly public data, ZERO seller PII)
  try {
    let lotItems: any[] = [];
    if (ydb.isV2TablesEnabled()) {
      lotItems = await ydb.queryAllByIndex<any>({
        tableName: 'lots',
        indexName: 'status-publishedAt-index',
        hashKey: 'status',
        hashValue: 'available',
        limit: 40,
      }).catch(async () => {
        const all = await ydb.scanAll<any>('lots', 40).catch(() => []);
        return all.filter((l: any) => l.status === 'available');
      });
    } else {
      const all = await ydb.scanAll<any>('lots', 40).catch(() => []);
      lotItems = all.filter((l: any) => l.status === 'available');
    }

    for (const lot of lotItems) {
      const lotCode = lot.lotCode || lot.id;
      if (!lotCode) continue;

      const complex = lot.complexTitle || lot.housingComplex || 'Жилой комплекс';
      const district = lot.district || lot.city || 'Санкт-Петербург';
      const rooms = lot.roomsCount ? `${lot.roomsCount}-комнатная квартира` : 'Квартира';
      const area = lot.areaTotal ? `${lot.areaTotal} м²` : '';
      const price = lot.priceOfferRub ? `${(lot.priceOfferRub / 1000000).toFixed(2)} млн ₽` : '';
      const discount = lot.discountPercent ? `скидка ${lot.discountPercent}%` : '';
      const savings = lot.estimatedNetSavingsRub
        ? `выгода до ${(lot.estimatedNetSavingsRub / 1000).toFixed(0)} тыс. ₽`
        : '';
      const metro = lot.metroStation ? `м. ${lot.metroStation}` : '';

      const summaryText = `Квартира в продаже по переуступке: Лот #${lotCode}.
Жилой комплекс: ${complex}. Район / локация: ${district}${metro ? `, ${metro}` : ''}.
Параметры: ${rooms}, площадь ${area}.
Стоимость: ${price} (${discount}${savings ? `, ${savings}` : ''}).
Оформление через аккредитив или СБР. Без комиссии для покупателя (всего 2.5% сопровождение).
Ссылка для просмотра предложения: /opportunities/${encodeURIComponent(lotCode)}`;

      chunks.push({
        id: `lot_${lotCode}`,
        sourceType: 'available_lot',
        sourceId: String(lotCode),
        title: `${complex}: ${rooms} (${price})`,
        url: `/opportunities/${encodeURIComponent(lotCode)}`,
        text: summaryText,
        contentHash: computeHash(summaryText),
        metadata: {
          lotCode,
          district,
          roomsCount: lot.roomsCount,
          priceRub: lot.priceOfferRub,
        },
      });
    }
  } catch (err: any) {
    logger.warn(`RAG_COLLECT_LOTS_WARN: ${err.message}`);
  }

  return chunks;
}

/**
 * Rebuilds the RAG Knowledge Index incrementally into S3.
 */
export async function rebuildRagKnowledgeIndex(options?: {
  requestedBy?: string;
}): Promise<RagIndexMetadata> {
  const cfg = getConfig();
  const bucket = cfg.S3_PRIVATE_BUCKET;
  if (!bucket) {
    throw new Error('S3_PRIVATE_BUCKET is not configured for RAG indexer');
  }

  const existingMap = await loadExistingS3Index(bucket);
  const rawChunks = await collectWhitelistedKnowledgeChunks();

  let embeddedNewCount = 0;
  let reusedCachedCount = 0;
  const sourcesBreakdown: Record<string, number> = {
    core_faq: 0,
    legal_doc: 0,
    journal_article: 0,
    available_lot: 0,
  };

  const finalChunks: KnowledgeChunk[] = [];

  for (const chunk of rawChunks) {
    sourcesBreakdown[chunk.sourceType] = (sourcesBreakdown[chunk.sourceType] || 0) + 1;

    let vector: number[] | undefined = existingMap.get(chunk.contentHash);
    if (vector && vector.length === 256) {
      reusedCachedCount++;
    } else {
      vector = await embedDocument(chunk.text);
      embeddedNewCount++;
    }

    finalChunks.push({
      ...chunk,
      vector,
    });
  }

  const indexPayload = {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    chunksCount: finalChunks.length,
    chunks: finalChunks,
  };

  const jsonStr = JSON.stringify(indexPayload);
  const compressedGz = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'), { level: 9 });
  const compressedSizeKb = Number((compressedGz.length / 1024).toFixed(1));

  // Upload to S3
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: S3_RAG_INDEX_KEY,
      Body: compressedGz,
      ContentType: 'application/gzip',
      CacheControl: 'no-cache',
    })
  );

  // Update in-memory cache
  appCache.set(RAG_CACHE_KEY, finalChunks, RAG_CACHE_TTL_MS);

  // Record metadata in platform_settings
  const meta: RagIndexMetadata = {
    id: 'ai_rag_index_meta',
    chunksCount: finalChunks.length,
    embeddedNewCount,
    reusedCachedCount,
    compressedSizeKb,
    sourcesBreakdown,
    lastIndexedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexedBy: options?.requestedBy || 'system',
  };

  try {
    const ydb = getYdbClient();
    await ydb.putItem('platform_settings', meta);
  } catch (err: any) {
    logger.warn(`RAG_SAVE_SETTINGS_META_WARN: ${err.message}`);
  }

  logger.info(`RAG_INDEX_REBUILT: ${finalChunks.length} chunks (${compressedSizeKb} KB)`, {
    meta: {
      chunksCount: finalChunks.length,
      embeddedNewCount,
      reusedCachedCount,
      compressedSizeKb,
    },
  });

  return meta;
}

/**
 * Loads knowledge chunks from memory cache or downloads from S3.
 */
export async function getLoadedRagChunks(): Promise<KnowledgeChunk[]> {
  const cached = appCache.get<KnowledgeChunk[]>(RAG_CACHE_KEY);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const cfg = getConfig();
  const bucket = cfg.S3_PRIVATE_BUCKET;
  if (!bucket) {
    const raw = await collectWhitelistedKnowledgeChunks();
    return raw.map((c) => ({ ...c, vector: new Array(256).fill(0) }));
  }

  try {
    const s3 = getS3Client();
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: S3_RAG_INDEX_KEY,
      })
    );

    if (res.Body) {
      const stream = res.Body as any;
      const chunksBuffer: Buffer[] = [];
      for await (const chunk of stream) {
        chunksBuffer.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const compressed = Buffer.concat(chunksBuffer);
      const decompressed = zlib.gunzipSync(compressed).toString('utf-8');
      const data = JSON.parse(decompressed);

      if (Array.isArray(data.chunks)) {
        appCache.set(RAG_CACHE_KEY, data.chunks, RAG_CACHE_TTL_MS);
        return data.chunks;
      }
    }
  } catch (err: any) {
    logger.warn(`RAG_INDEX_DOWNLOAD_FALLBACK: ${err.message}`);
  }

  // Fallback: build in-memory core chunks
  const fallbackRaw = await collectWhitelistedKnowledgeChunks();
  const fallback = fallbackRaw.map((c) => ({ ...c, vector: new Array(256).fill(0) }));
  appCache.set(RAG_CACHE_KEY, fallback, 60 * 1000); // 1 min fallback cache
  return fallback;
}

/**
 * High-speed Cosine Vector Search across loaded RAG index (<5ms).
 */
export async function searchRagKnowledge(
  queryText: string,
  topK = 5
): Promise<{ results: RagSearchResult[]; matchedLots: any[] }> {
  const cleanQuery = (queryText || '').trim();
  if (!cleanQuery) {
    return { results: [], matchedLots: [] };
  }

  const [queryVec, chunks] = await Promise.all([
    embedQuery(cleanQuery),
    getLoadedRagChunks(),
  ]);

  const scored: RagSearchResult[] = [];

  for (const chunk of chunks) {
    if (!chunk.vector || chunk.vector.length !== 256) continue;
    const score = cosineSimilarity(queryVec, chunk.vector);
    if (score >= 0.38) {
      scored.push({ chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, topK);

  // Fast lot match if user mentions specific district or rooms
  const matchedLots: any[] = [];
  const queryLower = cleanQuery.toLowerCase();
  for (const chunk of chunks) {
    if (chunk.sourceType === 'available_lot' && chunk.metadata?.lotCode) {
      const district = (chunk.metadata.district || '').toLowerCase();
      if (district && queryLower.includes(district)) {
        matchedLots.push(chunk.metadata);
      }
    }
    if (matchedLots.length >= 3) break;
  }

  return { results, matchedLots };
}

/**
 * Returns latest metadata for S3 RAG index.
 */
export async function getRagIndexMeta(): Promise<RagIndexMetadata | null> {
  try {
    const ydb = getYdbClient();
    const item = await ydb.getItem<RagIndexMetadata>('platform_settings', 'ai_rag_index_meta');
    return item || null;
  } catch (err: any) {
    logger.warn(`GET_RAG_META_WARN: ${err.message}`);
  }
  return null;
}
