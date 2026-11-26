/**
 * aiListingCopyService.ts — PropTech AI Module
 * AI Investment Copywriter & Telegram Card Generator for DomExit Packaging Studio
 * Powered by YandexGPT Pro (ru-central1).
 *
 * Sovereign 152-FZ Compliance:
 * - 100% inside Yandex Cloud ru-central1.
 * - Zero PII: Only confirmed lot facts (no seller name, phone or passport data).
 * - Zero Hallucination: Strict system prompt forbidding inventing prices or amenities.
 * - Deterministic inputHash caching to save tokens and FinOps budget.
 */

import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { completeJson } from '../legal-core/yandexGptClient.js';

export interface ListingCopyInput {
  lotCode: string;
  complexName: string;
  developerName?: string;
  region: string;
  district?: string;
  address?: string;
  areaSqm: number;
  rooms?: number | string;
  floor?: number;
  totalFloors?: number;
  handoverQuarter?: string;
  // Financial truth engine facts
  dduPriceRub: number;
  cashToSellerRub: number;
  debtToDevRub: number;
  todayDeveloperPriceRub?: number;
  buyerNetSavingsRub?: number;
  sellerCommissionPct?: number; // 0% on DomExit
  isNegotiable?: boolean;
  // Geo / Metro facts
  nearestMetroName?: string;
  nearestMetroDistanceKm?: number;
  nearestMetroWalkMinutes?: number;
  nearestMetroTransportMinutes?: number;
  infraTags?: string[];
  // Tone & Control
  tone?: 'investor' | 'family' | 'balanced';
  forceReprocess?: boolean;
  operatorId?: string;
}

export interface ListingCopyDraft {
  lotCode: string;
  tone: 'investor' | 'family' | 'balanced';
  headlineRu: string;
  investmentDescriptionRu: string;
  highlightsRu: string[]; // exactly 5 bullet points
  seoTitleRu: string;
  seoDescriptionRu: string;
  telegramPromoPostRu: string;
  inputHash: string;
  modelUri: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostRub: number;
  generatedAt: string;
}

function formatRub(val: number): string {
  return Math.round(val).toLocaleString('ru-RU') + ' ₽';
}

function computeCopyInputHash(input: ListingCopyInput): string {
  const payload = [
    input.lotCode,
    input.complexName,
    input.areaSqm,
    input.rooms,
    input.dduPriceRub,
    input.cashToSellerRub,
    input.debtToDevRub,
    input.todayDeveloperPriceRub,
    input.nearestMetroName,
    input.tone || 'balanced',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Generates structured listing copy using YandexGPT Pro.
 */
export async function generateListingCopy(input: ListingCopyInput): Promise<ListingCopyDraft> {
  const tone = input.tone || 'balanced';
  const lotCode = input.lotCode.trim().toUpperCase();
  const inputHash = computeCopyInputHash(input);
  const cacheKey = `pkg-${lotCode}-copy`;
  const ydb = getYdbClient();

  // 1. Check cached draft in ai_packaging_results_v2
  if (!input.forceReprocess) {
    try {
      const existing = await ydb.getItem<any>('ai_packaging_results', cacheKey);
      if (existing?.copyDraft && existing.inputHash === inputHash) {
        logger.info('[AiListingCopy] Returning cached listing copy draft', { meta: { lotCode, inputHash } });
        return existing.copyDraft as ListingCopyDraft;
      }
    } catch {
      // non-fatal
    }
  }

  // 2. Build verified fact sheet (strictly forbidding hallucination)
  const facts: string[] = [
    `Лот: #${lotCode}`,
    `Жилой комплекс: «${input.complexName}»`,
    input.developerName ? `Застройщик: ${input.developerName}` : '',
    `Регион: ${input.region === 'spb' ? 'Санкт-Петербург / Ленинградская область' : 'Москва / Московская область'}`,
    input.district ? `Район: ${input.district}` : '',
    input.address ? `Адрес: ${input.address}` : '',
    `Площадь: ${input.areaSqm} м²`,
    input.rooms !== undefined ? `Комнатность: ${input.rooms}` : '',
    input.floor && input.totalFloors ? `Этаж: ${input.floor} из ${input.totalFloors}` : '',
    input.handoverQuarter ? `Срок сдачи / передачи ключей: ${input.handoverQuarter}` : '',
    `Полная цена переуступки (покупателю): ${formatRub(input.dduPriceRub)} (${Math.round(input.dduPriceRub / input.areaSqm).toLocaleString('ru-RU')} ₽/м²)`,
    `Собственные средства (кэш продавцу): ${formatRub(input.cashToSellerRub)}`,
    input.debtToDevRub > 0 ? `Остаток долга / рассрочки застройщику (переводится покупателю): ${formatRub(input.debtToDevRub)}` : 'ДДУ выплачен застройщику на 100%',
    input.todayDeveloperPriceRub && input.todayDeveloperPriceRub > input.dduPriceRub
      ? `Официальная цена аналогичной квартиры у застройщика сегодня: ${formatRub(input.todayDeveloperPriceRub)}`
      : '',
    input.buyerNetSavingsRub && input.buyerNetSavingsRub > 0
      ? `Чистая финансовая выгода покупателя по сравнению с ценой застройщика: +${formatRub(input.buyerNetSavingsRub)}`
      : '',
    `Комиссия платформы DomExit с продавца: 0% (продавец получает ровно сумму внесенных средств)`,
    input.isNegotiable ? `Статус торга: Возможен обоснованный торг` : `Цена зафиксирована без торга`,
    input.nearestMetroName
      ? `Ближайшее метро: «${input.nearestMetroName}» (${input.nearestMetroWalkMinutes ? `${input.nearestMetroWalkMinutes} мин. пешком` : `${input.nearestMetroTransportMinutes || 10} мин. транспортом`})`
      : '',
    input.infraTags && input.infraTags.length > 0 ? `Преимущества локации: ${input.infraTags.join(', ')}` : '',
    `Юридическая схема: Переуступка прав по ДДУ в строгом соответствии с 214-ФЗ с расчетами через эскроу-счет / СБР. Полная юридическая чистота.`,
  ].filter(Boolean);

  const toneInstructions =
    tone === 'investor'
      ? 'АКЦЕНТ: Инвестиционный. Сделай упор на чистую математическую выгоду (дисконт vs застройщик), ликвидность переуступки, высокую арендную или перепродажную доходность к моменту сдачи дома.'
      : tone === 'family'
      ? 'АКЦЕНТ: Для комфортной жизни / семейный. Сделай упор на удобство планировки, развитость района (школы, сады, парки), надежность по 214-ФЗ и комфортный срок получения ключей.'
      : 'АКЦЕНТ: Сбалансированный. Идеальное сочетание финансовой выгоды переуступки и потребительских преимуществ локации и дома.';

  const systemPrompt = `Ты — ведущий инвестиционный копирайтер и эксперт рынка переуступок жилья DomExit (Санкт-Петербург и Москва).
Твоя задача — составить продающий, статусный, юридически выверенный текст объявления о переуступке квартиры по ДДУ.

СТРОЖАЙШИЕ ПРАВИЛА:
1. НИ В КОЕМ СЛУЧАЕ НЕ ВЫДУМЫВАЙ цифры, площади, этажи или цены, которых нет в исходных фактах! Все финансовые параметры должны строго соответствовать фактам.
2. Никаких шаблонных клише («уникальное предложение», «спешите купить», «шок-цена»). Текст должен звучать экспертно, спокойно, солидно и убедительно.
3. ${toneInstructions}
4. Структура ответа строго в формате JSON со следующими полями:
   - "headlineRu": яркий, профессиональный заголовок объявления (до 80 символов)
   - "investmentDescriptionRu": полный структурированный текст объявления (3-4 логических абзаца с разделением на описание объекта, финансовые выгоды переуступки и локацию)
   - "highlightsRu": массив ровно из 5 ключевых тезисов (bullet points)
   - "seoTitleRu": SEO заголовок для страницы лота (до 60 символов)
   - "seoDescriptionRu": SEO описание для сниппета в поисковиках (до 160 символов)
   - "telegramPromoPostRu": готовый форматированный пост для Telegram-канала DomExit с эмодзи, выделением ключевых цифр и выгоды покупателя, и призывом перейти к бронированию.`;

  const userPrompt = `Составь комплект продающего описания для лота на основе подтвержденных фактов:\n\n${facts.join('\n')}`;

  const completionRes = await completeJson<{
    headlineRu: string;
    investmentDescriptionRu: string;
    highlightsRu: string[];
    seoTitleRu: string;
    seoDescriptionRu: string;
    telegramPromoPostRu: string;
  }>({
    tier: 'pro',
    temperature: 0.35,
    maxTokens: 1400,
    systemPrompt,
    userPrompt,
    validator: (data: any): data is {
      headlineRu: string;
      investmentDescriptionRu: string;
      highlightsRu: string[];
      seoTitleRu: string;
      seoDescriptionRu: string;
      telegramPromoPostRu: string;
    } =>
      Boolean(
        data &&
          typeof data.headlineRu === 'string' &&
          typeof data.investmentDescriptionRu === 'string' &&
          Array.isArray(data.highlightsRu) &&
          typeof data.telegramPromoPostRu === 'string'
      ),
  });

  const draft: ListingCopyDraft = {
    lotCode,
    tone,
    headlineRu: completionRes.data.headlineRu,
    investmentDescriptionRu: completionRes.data.investmentDescriptionRu,
    highlightsRu: Array.isArray(completionRes.data.highlightsRu) ? completionRes.data.highlightsRu.slice(0, 5) : [],
    seoTitleRu: completionRes.data.seoTitleRu || completionRes.data.headlineRu,
    seoDescriptionRu: completionRes.data.seoDescriptionRu || completionRes.data.headlineRu,
    telegramPromoPostRu: completionRes.data.telegramPromoPostRu,
    inputHash,
    modelUri: completionRes.modelUri,
    inputTokens: completionRes.usage.inputTextTokens,
    outputTokens: completionRes.usage.completionTokens,
    estimatedCostRub: Number(completionRes.usage.estimatedCostRub.toFixed(4)),
    generatedAt: new Date().toISOString(),
  };

  // 3. Persist generated draft to ai_packaging_results_v2
  try {
    await ydb.putItem('ai_packaging_results', {
      id: cacheKey,
      lotCode,
      kind: 'copy_draft',
      inputHash,
      copyDraft: draft,
      createdBy: input.operatorId || 'system',
      createdAt: draft.generatedAt,
      updatedAt: draft.generatedAt,
    });
  } catch (err: any) {
    logger.warn('[AiListingCopy] Failed saving copy draft to YDB', { meta: { error: err.message } });
  }

  return draft;
}
