/**
 * backend/src/modules/legal-core/buyerProofAiService.ts
 *
 * Dedicated AI verification service for buyer solvency proofs (Gold Tier & Matchmaker).
 * Combines Yandex Vision OCR + YandexGPT Lite for fast, low-cost document parsing.
 * Performs deterministic validation: expiry, name match, amount sufficiency.
 *
 * Compliance: 152-FZ - strictly within ru-central1.
 * Human-in-the-Loop: Advisory only. Never auto-approves Gold tier or selects Matchmaker winner.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../../lib/s3Client.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { getConfig } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';
import { recognizeDocumentWithYandexVision } from './yandexVisionOcrClient.js';
import { completeJson } from './yandexGptClient.js';

export interface BuyerVerificationExtractedData {
  detectedDocType: 'bank_statement' | 'mortgage_approval' | 'other';
  holderFullName?: string;
  bankName?: string;
  confirmedAmountRub?: number;
  currency?: string;
  issueDate?: string;
  expiryDate?: string;
  isExpired: boolean;
  nameMatchStatus: 'exact' | 'partial' | 'mismatch' | 'unknown';
  amountSufficient?: boolean;
  confidence: number;
  warningFlags: string[];
  summaryRu: string;
}

export interface AiBuyerVerificationRecord {
  id: string;
  targetType: 'tier_request' | 'buyer_application';
  targetId: string;
  lotCode?: string;
  userId: string;
  objectKey: string;
  modelUri: string;
  status: 'completed' | 'failed';
  inputTokens: number;
  outputTokens: number;
  estimatedCostRub: number;
  extracted: BuyerVerificationExtractedData;
  createdBy: string;
  createdAt: string;
  isCached?: boolean;
}

const SYSTEM_PROMPT = `Ты — финансовый контролер платформы недвижимости.
Твоя задача — извлечь строго факты из документа подтверждения платежеспособности покупателя (банковская выписка об остатке, справка о счетах, кредитное решение / одобрение ипотеки).

ТРЕБОВАНИЯ К ИЗВЛЕЧЕНИЮ:
1. detectedDocType: "bank_statement" (выписка/справка о счетах), "mortgage_approval" (одобрение ипотеки/кредита) или "other".
2. holderFullName: ФИО владельца счета или заемщика, на чье имя выдан документ.
3. bankName: название банка (например, ПАО Сбербанк, ВТБ, Альфа-Банк, Т-Банк, ДОМ.РФ).
4. confirmedAmountRub: итоговая подтвержденная сумма денежных средств или одобренного кредита в рублях (число).
5. currency: валюта (RUB, USD, EUR и т.д.).
6. issueDate: дата выдачи документа (в формате ГГГГ-ММ-ДД или ДД.ММ.ГГГГ).
7. expiryDate: срок действия одобрения или справки (если указан).
8. summaryRu: краткое резюме документа на русском языке (1-2 предложения).

Выведи ответ СТРОГО в формате валидного JSON без markdown:
{
  "detectedDocType": "bank_statement",
  "holderFullName": "Иванов Иван Иванович",
  "bankName": "ПАО Сбербанк",
  "confirmedAmountRub": 5000000,
  "currency": "RUB",
  "issueDate": "2024-03-15",
  "expiryDate": null,
  "summaryRu": "Справка Сбербанка об остатке денежных средств на текущем счете."
}`;

function normalizeName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^а-яёa-z\s]/gi, ' ')
    .split(/\s+/)
    .filter((part) => part.length >= 2);
}

function checkNameMatch(
  extractedName?: string,
  applicantName?: string
): 'exact' | 'partial' | 'mismatch' | 'unknown' {
  if (!extractedName || !applicantName) return 'unknown';

  const extParts = normalizeName(extractedName);
  const appParts = normalizeName(applicantName);

  if (extParts.length === 0 || appParts.length === 0) return 'unknown';

  // Compare sets of name parts
  const matchingParts = extParts.filter((p) => appParts.includes(p));

  // If last name + first name match
  if (matchingParts.length >= 2 && extParts.length === appParts.length) {
    return 'exact';
  }
  if (matchingParts.length >= 1) {
    return 'partial';
  }
  return 'mismatch';
}

function parseDateIso(str?: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD.MM.YYYY
  const ruMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ruMatch) {
    const d = new Date(Number(ruMatch[3]), Number(ruMatch[2]) - 1, Number(ruMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function verifyBuyerProofDocument(params: {
  targetType: 'tier_request' | 'buyer_application';
  targetId: string;
  objectKey: string;
  applicantName: string;
  declaredAmountRub: number;
  lotCode?: string;
  userId: string;
  requestedBy: string;
  forceReanalyze?: boolean;
  overrideIamToken?: string;
}): Promise<AiBuyerVerificationRecord> {
  const ydb = getYdbClient();
  const s3 = getS3Client();
  const cfg = getConfig();
  const privateBucket = cfg.S3_PRIVATE_BUCKET;

  logger.info('[BuyerProofAi] Starting buyer proof document verification', {
    meta: { targetType: params.targetType, targetId: params.targetId, key: params.objectKey },
  });

  // 1. Idempotency Cache lookup in ai_buyer_verifications_v2
  if (!params.forceReanalyze) {
    try {
      const cachedList = await ydb.queryAllByIndex<AiBuyerVerificationRecord>({
        tableName: 'ai_buyer_verifications',
        indexName: 'targetId-createdAt-index',
        hashKey: 'targetId',
        hashValue: params.targetId,
        limit: 5,
      });

      const matching = cachedList.find(
        (c) => c.objectKey === params.objectKey && c.status === 'completed'
      );
      if (matching) {
        logger.info('[BuyerProofAi] Returning cached verification', { meta: { id: matching.id } });
        return { ...matching, isCached: true };
      }
    } catch (cacheErr: any) {
      logger.warn('[BuyerProofAi] Cache lookup failed, proceeding to fresh run', {
        meta: { error: cacheErr.message },
      });
    }
  }

  // 2. Download File from S3
  const s3Res = await s3.send(
    new GetObjectCommand({
      Bucket: privateBucket,
      Key: params.objectKey,
    })
  );

  const bytes = await s3Res.Body?.transformToByteArray();
  if (!bytes || bytes.length === 0) {
    throw new Error('Файл подтверждения ملاءة отсутствует в S3 хранилище.');
  }

  // 10 MB limit for financial proofs
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (bytes.length > MAX_FILE_SIZE) {
    throw new Error('Размер файла превышает допустимый лимит 10 МБ.');
  }

  const fileBuffer = Buffer.from(bytes);
  const ext = params.objectKey.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf';
  const mimeType = isPdf
    ? 'application/pdf'
    : ext === 'png'
    ? 'image/png'
    : ext === 'webp'
    ? 'image/webp'
    : 'image/jpeg';

  // 3. Extract Text via Yandex Vision OCR (max 3 pages for statements)
  logger.info('[BuyerProofAi] Running Yandex Vision OCR on proof doc', {
    meta: { sizeBytes: fileBuffer.length, isPdf },
  });

  const ocrPages = await recognizeDocumentWithYandexVision(fileBuffer, mimeType, {
    maxPages: 3,
    iamToken: params.overrideIamToken,
  });

  const fullOcrText = ocrPages.map((p) => p.fullText).join('\n');

  if (!fullOcrText || fullOcrText.trim().length === 0) {
    throw new Error('Текст в документе не распознан. Возможно, скан низкого качества или размыт.');
  }

  // 4. Invoke YandexGPT Lite (Tier: lite, temperature: 0.05, maxTokens: 900)
  logger.info('[BuyerProofAi] Invoking YandexGPT Lite for financial extraction');

  const gptRes = await completeJson<any>({
    tier: 'lite',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `ТЕКСТ ФИНАНСОВОГО ДОКУМЕНТА:\n${fullOcrText.slice(0, 10000)}`,
    temperature: 0.05,
    maxTokens: 900,
    overrideIamToken: params.overrideIamToken,
  });

  const gptData = gptRes.data;

  // 5. Deterministic Validations
  const warningFlags: string[] = [];
  const now = new Date();

  // Check Expiry Date
  let isExpired = false;
  const expiryDateObj = parseDateIso(gptData.expiryDate);
  if (expiryDateObj) {
    if (expiryDateObj.getTime() < now.getTime()) {
      isExpired = true;
      warningFlags.push('Срок действия документа/одобрения истёк!');
    }
  }

  // Check statement recency (> 30 days old)
  const issueDateObj = parseDateIso(gptData.issueDate);
  if (issueDateObj && gptData.detectedDocType === 'bank_statement') {
    const diffDays = (now.getTime() - issueDateObj.getTime()) / (1000 * 3600 * 24);
    if (diffDays > 30) {
      warningFlags.push(`Справка выдана более 30 дней назад (${Math.round(diffDays)} дн.)`);
    }
  }

  // Check Name Match
  const nameMatchStatus = checkNameMatch(gptData.holderFullName, params.applicantName);
  if (nameMatchStatus === 'mismatch') {
    warningFlags.push(
      `ФИО в документе («${gptData.holderFullName || 'не указано'}») не совпадает с заявителем («${params.applicantName}»)`
    );
  } else if (nameMatchStatus === 'partial') {
    warningFlags.push('ФИО заявителя совпадает лишь частично — проверьте вручную');
  }

  // Check Amount Sufficiency
  let amountSufficient: boolean | undefined = undefined;
  const confirmedAmount =
    typeof gptData.confirmedAmountRub === 'number' ? gptData.confirmedAmountRub : undefined;
  if (confirmedAmount !== undefined && params.declaredAmountRub > 0) {
    amountSufficient = confirmedAmount >= params.declaredAmountRub;
    if (!amountSufficient) {
      warningFlags.push(
        `Подтвержденная сумма (${confirmedAmount.toLocaleString('ru-RU')} ₽) меньше заявленной (${params.declaredAmountRub.toLocaleString('ru-RU')} ₽)`
      );
    }
  }

  let confidence = 40;
  if (gptData.bankName) confidence += 20;
  if (confirmedAmount !== undefined && confirmedAmount > 0) confidence += 20;
  if (nameMatchStatus === 'exact') confidence += 20;
  confidence = Math.min(100, confidence);

  const verificationId = `bvf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = now.toISOString();

  const record: AiBuyerVerificationRecord = {
    id: verificationId,
    targetType: params.targetType,
    targetId: params.targetId,
    lotCode: params.lotCode,
    userId: params.userId,
    objectKey: params.objectKey,
    modelUri: gptRes.modelUri,
    status: 'completed',
    inputTokens: gptRes.usage.inputTextTokens,
    outputTokens: gptRes.usage.completionTokens,
    estimatedCostRub: gptRes.usage.estimatedCostRub,
    extracted: {
      detectedDocType: gptData.detectedDocType || 'other',
      holderFullName: gptData.holderFullName,
      bankName: gptData.bankName,
      confirmedAmountRub: confirmedAmount,
      currency: gptData.currency || 'RUB',
      issueDate: gptData.issueDate,
      expiryDate: gptData.expiryDate,
      isExpired,
      nameMatchStatus,
      amountSufficient,
      confidence,
      warningFlags,
      summaryRu: gptData.summaryRu || 'Анализ документа завершен.',
    },
    createdBy: params.requestedBy,
    createdAt: nowIso,
  };

  await ydb.putItem('ai_buyer_verifications', record);

  // Audit log
  try {
    await ydb.putItem('audit_logs', {
      id: `audit-bvf-${Date.now()}`,
      action: 'AI_BUYER_PROOF_VERIFIED',
      targetId: params.targetId,
      actorId: params.requestedBy,
      timestamp: nowIso,
      details: JSON.stringify({
        targetType: params.targetType,
        nameMatchStatus,
        isExpired,
        amountSufficient,
        tokens: gptRes.usage.totalTokens,
      }),
    });
  } catch (err: any) {
    logger.warn('[BuyerProofAi] Non-fatal: failed audit log', { meta: { error: err.message } });
  }

  logger.info('[BuyerProofAi] Verification complete', {
    meta: { verificationId, nameMatchStatus, isExpired, amountSufficient },
  });

  return record;
}

export async function getBuyerVerifications(targetId: string): Promise<AiBuyerVerificationRecord[]> {
  const ydb = getYdbClient();
  try {
    const list = await ydb.queryAllByIndex<AiBuyerVerificationRecord>({
      tableName: 'ai_buyer_verifications',
      indexName: 'targetId-createdAt-index',
      hashKey: 'targetId',
      hashValue: targetId,
      limit: 10,
    });
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err: any) {
    logger.error('[BuyerProofAi] Failed fetching verifications', { meta: { targetId, error: err.message } });
    return [];
  }
}
