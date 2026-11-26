/**
 * backend/src/modules/legal-core/dduLegalCopilotService.ts
 *
 * YandexGPT Pro Legal Copilot for Russian DDU contracts.
 * Analyzes clauses: developer cession consent, penalties, maternal capital, escrow, encumbrances.
 * Generates advisory drafts for the 5 legal audit axes and protection memo under art. 61.2 127-FZ / art. 302 GK RF.
 *
 * Compliance: 152-FZ strictly ru-central1.
 * Human-in-the-Loop: Output is strictly advisory draft. Never auto-approves or marks evaluated: true.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../../lib/s3Client.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { getConfig } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { completeJson, GptUsageStats } from './yandexGptClient.js';

export interface KeyClauseItem {
  topic: 'developer_consent' | 'penalty' | 'matkap' | 'escrow' | 'encumbrance' | 'other';
  pageNumber: number;
  quote: string;
  riskLevel: 'high' | 'medium' | 'low' | 'info';
  explanationRu: string;
}

export interface SuggestedAxisItem {
  axisId:
    | 'title_encumbrances'
    | 'bankruptcy_debts'
    | 'developer_settlement'
    | 'family_matkap'
    | 'cession_escrow';
  suggestedStatus: 'verified_safe' | 'needs_attention' | 'high_risk';
  draftNoteRu: string;
  pageRefs: number[];
  confidence: number;
}

export interface AiLegalAnalysisRecord {
  id: string;
  lotCode: string;
  ocrJobId: string;
  modelUri: string;
  status: 'completed' | 'failed';
  inputTokens: number;
  outputTokens: number;
  estimatedCostRub: number;
  contractSummaryRu: string;
  developerPenaltyPct?: number;
  developerConsentFeeRub?: number;
  developerConsentRequired: boolean;
  maternalCapitalRisk: 'none' | 'suspected' | 'confirmed';
  encumbranceRisk: 'none' | 'mortgage' | 'arrest' | 'other';
  keyClauses: KeyClauseItem[];
  suggestedAxes: SuggestedAxisItem[];
  draftProtectionMemo612Ru: string;
  missingDocsRecommendationRu: string[];
  createdBy: string;
  createdAt: string;
  isCached?: boolean;
}

interface RawOcrTranscriptPage {
  pageNumber: number;
  fullText: string;
}

interface RawOcrTranscript {
  jobId: string;
  lotCode: string;
  pages: RawOcrTranscriptPage[];
}

/**
 * Smart assembly of text context for DDU analysis, prioritizing risk pages (FinOps <= 24k chars).
 */
function assembleSmartContext(pages: RawOcrTranscriptPage[], lotMeta: any, riskFlags: any[]): string {
  const selectedPages = new Set<number>();

  // Always include first 3 pages (parties, subject, price, escrow)
  for (const p of pages) {
    if (p.pageNumber <= 3) selectedPages.add(p.pageNumber);
  }

  // Include pages flagged by OCR risk scanner
  if (Array.isArray(riskFlags)) {
    for (const rf of riskFlags) {
      if (rf.pageNumber) selectedPages.add(rf.pageNumber);
    }
  }

  // Scan for key risk keywords on other pages
  const KEYWORD_REGEX = /(?:согласи[а-яё]*\s+застройщик[а-яё]*|комисси[а-яё]*\s+уступк[а-яё]*|штраф\s+за\s+расторжени[а-яё]*|материнск[а-яё]*|семейн[а-яё]*\s+капитал|ипотек[а-яё]*|залог|обременени[а-яё]*|эскроу|неустойк[а-яё]*)/iu;
  for (const p of pages) {
    if (KEYWORD_REGEX.test(p.fullText)) {
      selectedPages.add(p.pageNumber);
    }
  }

  // Build text chunks in page order
  const chunks: string[] = [];
  const sortedPageNumbers = Array.from(selectedPages).sort((a, b) => a - b);

  let currentLength = 0;
  const MAX_CHAR_LIMIT = 22000;

  for (const pageNum of sortedPageNumbers) {
    const pageObj = pages.find((p) => p.pageNumber === pageNum);
    if (!pageObj) continue;

    const pageHeader = `\n\n--- СТРАНИЦА ${pageNum} ---\n`;
    const textToAdd = pageHeader + pageObj.fullText.trim();

    if (currentLength + textToAdd.length > MAX_CHAR_LIMIT) {
      const remaining = MAX_CHAR_LIMIT - currentLength;
      if (remaining > 200) {
        chunks.push(textToAdd.slice(0, remaining) + '\n[Обрезано по лимиту контекста]');
      }
      break;
    }

    chunks.push(textToAdd);
    currentLength += textToAdd.length;
  }

  const lotSummaryHeader = `СВЕДЕНИЯ ПО ОБЪЕКТУ ИЗ БАЗЫ:
- Код лота: #${lotMeta?.lotCode || 'Н/Д'}
- Заявленная цена: ${lotMeta?.priceRub ? Number(lotMeta.priceRub).toLocaleString('ru-RU') + ' ₽' : 'Н/Д'}
- Проектная площадь: ${lotMeta?.areaSqm || 'Н/Д'} кв.м
- Трек сделки: ${lotMeta?.dealTrack || 'primary_ddu'}
`;

  return `${lotSummaryHeader}\nИЗВЛЕЧЕННЫЙ ТЕКСТ ДОГОВОРА УЧАСТИЯ В ДОЛЕВОМ СТРОИТЕЛЬСТВЕ (ДДУ):${chunks.join('')}`;
}

const SYSTEM_PROMPT = `Ты — ведущий юрист по недвижимости РФ и эксперт по банкротному праву (214-ФЗ, 127-ФЗ «О несостоятельности», ст. 302 ГК РФ, Постановление Пленума ВАС РФ № 63 от 23.12.2010).
Твоя задача — провести глубокий предварительный правовой аудит договора участия в долевом строительстве (ДДУ) для закрытой инвестиционной платформы DomExit.

ПРАВИЛА И СТРОГИЕ ОГРАНИЧЕНИЯ:
1. Выдели все существенные условия и рисковые пункты:
   - Требуется ли согласие застройщика на уступку прав требований (цессию)? Есть ли плата/комиссия за согласие?
   - Штрафы или неустойки за расторжение договора дольщиком (developerPenaltyPct).
   - Риск использования материнского (семейного) капитала (maternalCapitalRisk: "none" | "suspected" | "confirmed"). Если упомянут — "confirmed", если есть сомнения в источниках оплаты — "suspected".
   - Ипотечные обременения или залог прав (encumbranceRisk: "none" | "mortgage" | "arrest" | "other").
2. СТРОГОЕ ПРАВИЛО ДЛЯ 5 ОСЕЙ ПРОВЕРКИ (suggestedAxes):
   - title_encumbrances (Титул и обременения)
   - bankruptcy_debts (Банкротство и задолженности): ЗАПРЕЩЕНО указывать "verified_safe", так как договор не доказывает отсутствие банкротства! Всегда указывай "needs_attention" с пояснением «По договору рисков не выявлено, требуется обязательная проверка продавца по базам ЕФРСБ, ФССП и КАД Арбитр».
   - developer_settlement (Расчеты с застройщиком и эскроу): проверяй наличие справки об оплате и раскрытие эскроу-счета.
   - family_matkap (Семейный статус и маткапитал): проверяй привлечение маткапитала и необходимость согласия супруга.
   - cession_escrow (Уступка прав и перевод долга): отражай требования согласия застройщика.
3. МЕМОРАНДУМ 61.2 ФЗ-127 (draftProtectionMemo612Ru):
   Сформируй четкое юридическое обоснование добросовестности будущего приобретателя (ст. 302 ГК РФ, п. 1 и п. 2 ст. 61.2 ФЗ-127) с указанием рыночности цены, отсутствия аффилированности и обязательной полноты безналичных расчетов.
4. Выведи ответ СТРОГО в формате JSON по следующей схеме:
{
  "contractSummaryRu": "Краткое резюме договора (стороны, объект, цена, сроки сдачи)",
  "developerPenaltyPct": 10,
  "developerConsentFeeRub": 0,
  "developerConsentRequired": true,
  "maternalCapitalRisk": "none",
  "encumbranceRisk": "mortgage",
  "keyClauses": [
    {
      "topic": "developer_consent",
      "pageNumber": 5,
      "quote": "дословная короткая цитата из договора",
      "riskLevel": "medium",
      "explanationRu": "пояснение для юриста"
    }
  ],
  "suggestedAxes": [
    {
      "axisId": "title_encumbrances",
      "suggestedStatus": "needs_attention",
      "draftNoteRu": "Текст предварительного замечания",
      "pageRefs": [1, 2],
      "confidence": 85
    }
  ],
  "draftProtectionMemo612Ru": "Юридический проект мотивировочной части заключения добросовестности...",
  "missingDocsRecommendationRu": [
    "Справка от застройщика о полной оплате цены договора",
    "Справка из банка об остатке задолженности по ипотеке"
  ]
}`;

export async function analyzeLotFromOcr(params: {
  lotCode: string;
  ocrJobId?: string;
  requestedBy: string;
  forceReanalyze?: boolean;
  overrideIamToken?: string;
}): Promise<AiLegalAnalysisRecord> {
  const lotCode = params.lotCode.trim().toUpperCase();
  const ydb = getYdbClient();
  const s3 = getS3Client();
  const cfg = getConfig();
  const privateBucket = cfg.S3_PRIVATE_BUCKET;

  logger.info('[DduLegalCopilot] Starting contract legal audit request', {
    meta: { lotCode, ocrJobId: params.ocrJobId, force: params.forceReanalyze },
  });

  // 1. Check Idempotency Cache in ai_legal_analyses_v2
  if (!params.forceReanalyze) {
    try {
      if (params.ocrJobId) {
        const res = await ydb.queryByIndex<AiLegalAnalysisRecord>({
          tableName: 'ai_legal_analyses',
          indexName: 'ocrJobId-index',
          hashKey: 'ocrJobId',
          hashValue: params.ocrJobId,
        });
        const cached = res?.items?.[0];
        if (cached && cached.status === 'completed') {
          logger.info('[DduLegalCopilot] Returning cached analysis by ocrJobId', { meta: { id: cached.id } });
          return { ...cached, isCached: true };
        }
      } else {
        const res = await ydb.queryByIndex<AiLegalAnalysisRecord>({
          tableName: 'ai_legal_analyses',
          indexName: 'lotCode-createdAt-index',
          hashKey: 'lotCode',
          hashValue: lotCode,
          limit: 1,
        });
        const cachedByLot = res?.items?.[0];
        if (cachedByLot && cachedByLot.status === 'completed') {
          logger.info('[DduLegalCopilot] Returning cached analysis by lotCode', { meta: { id: cachedByLot.id } });
          return { ...cachedByLot, isCached: true };
        }
      }
    } catch (cacheErr: any) {
      logger.warn('[DduLegalCopilot] Cache lookup failed, proceeding to fresh analysis', {
        meta: { error: cacheErr.message },
      });
    }
  }

  // 2. Fetch OCR Job
  let ocrJob: any = null;
  if (params.ocrJobId) {
    ocrJob = await ydb.getItem('ai_ocr_jobs', params.ocrJobId);
  } else {
    const jobs = await ydb.queryAllByIndex<any>({
      tableName: 'ai_ocr_jobs',
      indexName: 'lotCode-createdAt-index',
      hashKey: 'lotCode',
      hashValue: lotCode,
      limit: 5,
    });
    ocrJob = jobs.find((j) => j.status === 'completed');
  }

  if (!ocrJob || ocrJob.status !== 'completed') {
    throw new Error(
      `По лоту #${lotCode} отсутствует завершённая задача OCR. Сначала выполните распознавание ДДУ (Yandex Vision OCR).`
    );
  }

  if (!ocrJob.rawTextS3Key) {
    throw new Error(`В задаче OCR #${ocrJob.id} отсутствует ключ распознанного текста в S3.`);
  }

  // 3. Download Full Transcript from S3
  logger.info('[DduLegalCopilot] Fetching OCR transcript from S3', { meta: { s3Key: ocrJob.rawTextS3Key } });
  const s3Res = await s3.send(
    new GetObjectCommand({
      Bucket: privateBucket,
      Key: ocrJob.rawTextS3Key,
    })
  );

  const rawJsonStr = await s3Res.Body?.transformToString('utf-8');
  if (!rawJsonStr) {
    throw new Error('Пустой файл расшифровки OCR в хранилище S3.');
  }

  const transcript: RawOcrTranscript = JSON.parse(rawJsonStr);
  const pages = transcript.pages || [];
  if (pages.length === 0) {
    throw new Error('В файле расшифровки OCR отсутствуют страницы текста.');
  }

  // Fetch lot details from database
  let lotMeta: any = null;
  try {
    lotMeta = await ydb.getItem('lots', lotCode);
  } catch {
    // non-fatal
  }

  // 4. Assemble Smart Truncated Context
  const smartContext = assembleSmartContext(
    pages,
    lotMeta || { lotCode },
    ocrJob.extractedFields?.riskFlags || []
  );

  // 5. Invoke YandexGPT Pro (Tier: pro, temperature: 0.1, maxTokens: 2200)
  logger.info('[DduLegalCopilot] Invoking YandexGPT Pro for legal extraction', {
    meta: { contextLength: smartContext.length },
  });

  const completionResult = await completeJson<any>({
    tier: 'pro',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: smartContext,
    temperature: 0.1,
    maxTokens: 2200,
    overrideIamToken: params.overrideIamToken,
  });

  const gptData = completionResult.data;

  // 6. Ensure Strict Rule: bankruptcy_debts MUST NOT be verified_safe
  const normalizedAxes: SuggestedAxisItem[] = (gptData.suggestedAxes || []).map((ax: any) => {
    if (ax.axisId === 'bankruptcy_debts' && ax.suggestedStatus === 'verified_safe') {
      return {
        ...ax,
        suggestedStatus: 'needs_attention',
        draftNoteRu:
          ax.draftNoteRu ||
          'По тексту ДДУ обременений не выявлено. Требуется обязательная проверка продавца по базам ЕФРСБ, ФССП и КАД Арбитр.',
      };
    }
    return ax;
  });

  // 7. Save to ai_legal_analyses_v2
  const analysisId = `lga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();

  const record: AiLegalAnalysisRecord = {
    id: analysisId,
    lotCode,
    ocrJobId: ocrJob.id,
    modelUri: completionResult.modelUri,
    status: 'completed',
    inputTokens: completionResult.usage.inputTextTokens,
    outputTokens: completionResult.usage.completionTokens,
    estimatedCostRub: completionResult.usage.estimatedCostRub,
    contractSummaryRu: gptData.contractSummaryRu || 'Анализ договора ДДУ завершён.',
    developerPenaltyPct:
      typeof gptData.developerPenaltyPct === 'number' ? gptData.developerPenaltyPct : undefined,
    developerConsentFeeRub:
      typeof gptData.developerConsentFeeRub === 'number' ? gptData.developerConsentFeeRub : undefined,
    developerConsentRequired: Boolean(gptData.developerConsentRequired),
    maternalCapitalRisk: gptData.maternalCapitalRisk || 'none',
    encumbranceRisk: gptData.encumbranceRisk || 'none',
    keyClauses: Array.isArray(gptData.keyClauses) ? gptData.keyClauses : [],
    suggestedAxes: normalizedAxes,
    draftProtectionMemo612Ru: gptData.draftProtectionMemo612Ru || '',
    missingDocsRecommendationRu: Array.isArray(gptData.missingDocsRecommendationRu)
      ? gptData.missingDocsRecommendationRu
      : [],
    createdBy: params.requestedBy,
    createdAt: nowIso,
  };

  await ydb.putItem('ai_legal_analyses', record);

  // 8. Log Audit Event
  try {
    await ydb.putItem('audit_logs', {
      id: `audit-copilot-${Date.now()}`,
      action: 'AI_LEGAL_COPILOT_ANALYZED',
      lotCode,
      targetId: analysisId,
      actorId: params.requestedBy,
      timestamp: nowIso,
      details: JSON.stringify({
        ocrJobId: ocrJob.id,
        tokens: completionResult.usage.totalTokens,
        costRub: completionResult.usage.estimatedCostRub,
        maternalCapitalRisk: record.maternalCapitalRisk,
      }),
    });
  } catch (auditErr: any) {
    logger.warn('[DduLegalCopilot] Non-fatal: failed writing audit log', { meta: { error: auditErr.message } });
  }

  logger.info('[DduLegalCopilot] Analysis completed and persisted successfully', {
    meta: {
      analysisId,
      lotCode,
      tokens: completionResult.usage.totalTokens,
      costRub: completionResult.usage.estimatedCostRub,
    },
  });

  return record;
}

export async function getLegalAnalysesForLot(lotCode: string): Promise<AiLegalAnalysisRecord[]> {
  const code = lotCode.trim().toUpperCase();
  const ydb = getYdbClient();
  try {
    const list = await ydb.queryAllByIndex<AiLegalAnalysisRecord>({
      tableName: 'ai_legal_analyses',
      indexName: 'lotCode-createdAt-index',
      hashKey: 'lotCode',
      hashValue: code,
      limit: 20,
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err: any) {
    logger.error('[DduLegalCopilot] Failed fetching analyses for lot', { meta: { lotCode, error: err.message } });
    return [];
  }
}
