/**
 * backend/src/aiWorker.ts
 *
 * Dedicated Background Worker for AI OCR Document Processing.
 * Triggered by YMQ (domexit-ai-ocr-staging) -> Yandex Vision OCR -> Russian Real Estate Parser.
 *
 * Compliance: 152-FZ - runs strictly within ru-central1.
 * File size limit: 15 MB. Max pages per document: 15.
 * Saves full extracted text to S3_PRIVATE_BUCKET/_ai_ocr/{lotCode}/{jobId}.json.
 */

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from './lib/s3Client.js';
import { getYdbClient } from './lib/ydbClient.js';
import { getConfig } from './lib/config.js';
import { logger } from './lib/logger.js';
import { recognizeDocumentWithYandexVision } from './modules/legal-core/yandexVisionOcrClient.js';
import { parseRussianRealEstateDoc, runCrossCheck } from './modules/legal-core/russianRealEstateDocParser.js';
import { AiOcrJobRecord } from './modules/legal-core/ocrQueueService.js';

export interface YmqQueueMessageEvent {
  messages: Array<{
    event_metadata?: {
      event_id: string;
      event_type: string;
      created_at: string;
    };
    details?: {
      queue_id: string;
      message: {
        message_id: string;
        md5_of_body: string;
        body: string;
      };
    };
  }>;
}

/**
 * Processes a single OCR job record.
 */
export async function processOcrJob(
  jobData: {
    jobId: string;
    lotCode: string;
    documentId: string;
    objectKey: string;
    docCategory?: string;
    requestedBy?: string;
  },
  contextToken?: string
): Promise<AiOcrJobRecord> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  const s3 = getS3Client();
  const privateBucket = cfg.S3_PRIVATE_BUCKET;
  const now = new Date().toISOString();

  logger.info('[AiWorker] Starting processing job', { meta: { jobId: jobData.jobId, lotCode: jobData.lotCode, key: jobData.objectKey } });

  // 1. Fetch Job from YDB
  let job = await ydb.getItem<AiOcrJobRecord>('ai_ocr_jobs', jobData.jobId);
  if (!job) {
    job = {
      id: jobData.jobId,
      lotCode: jobData.lotCode,
      documentId: jobData.documentId,
      docCategory: jobData.docCategory || 'other',
      objectKey: jobData.objectKey,
      status: 'queued',
      requestedBy: jobData.requestedBy || 'system',
      createdAt: now,
      updatedAt: now,
    };
  }

  if (job.status === 'completed') {
    logger.info('[AiWorker] Job already completed, skipping', { meta: { jobId: job.id } });
    return job;
  }

  // 2. Mark Processing
  job.status = 'processing';
  job.startedAt = now;
  job.updatedAt = now;
  await ydb.putItem('ai_ocr_jobs', job);

  try {
    // 3. Download Document from S3_PRIVATE_BUCKET
    logger.info('[AiWorker] Fetching document from S3', { meta: { bucket: privateBucket, key: job.objectKey } });
    const s3Res = await s3.send(
      new GetObjectCommand({
        Bucket: privateBucket,
        Key: job.objectKey,
      })
    );

    if (!s3Res.Body) {
      throw new Error(`Документ ${job.objectKey} не найден в приватном хранилище.`);
    }

    const fileBytes = await s3Res.Body.transformToByteArray();
    const fileBuffer = Buffer.from(fileBytes);

    // 4. Validate File Size (<= 15 MB)
    const MAX_SIZE_BYTES = 15 * 1024 * 1024;
    if (fileBuffer.length > MAX_SIZE_BYTES) {
      throw new Error(`Размер файла (${(fileBuffer.length / 1024 / 1024).toFixed(1)} MB) превышает лимит 15 MB.`);
    }

    // Determine MIME type
    const mimeType = s3Res.ContentType || (job.objectKey.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    // 5. Call Yandex Vision OCR
    logger.info('[AiWorker] Calling Yandex Vision OCR', { meta: { jobId: job.id, size: fileBuffer.length, mimeType } });
    const pages = await recognizeDocumentWithYandexVision(fileBuffer, mimeType, {
      iamToken: contextToken,
      folderId: cfg.YC_FOLDER_ID,
      maxPages: cfg.MAX_PAGES_PER_DOC || 15,
    });

    const pagesCount = pages.length;
    logger.info('[AiWorker] Recognition finished', { meta: { jobId: job.id, pagesCount } });

    // 6. Upload Full Text JSON to S3_PRIVATE_BUCKET (avoiding YDB size limits)
    const rawTextS3Key = `_ai_ocr/${job.lotCode}/${job.id}.json`;
    const fullTextPayload = {
      jobId: job.id,
      lotCode: job.lotCode,
      documentId: job.documentId,
      docCategory: job.docCategory,
      recognizedAt: new Date().toISOString(),
      pagesCount,
      fullText: pages.map((p) => p.fullText).join('\n'),
      pages,
    };

    await s3.send(
      new PutObjectCommand({
        Bucket: privateBucket,
        Key: rawTextS3Key,
        Body: JSON.stringify(fullTextPayload, null, 2),
        ContentType: 'application/json; charset=utf-8',
      })
    );
    logger.info('[AiWorker] Uploaded full text transcript to S3', { meta: { rawTextS3Key } });

    // 7. Parse Russian Real Estate Document & Scan Risk Flags
    const extracted = parseRussianRealEstateDoc(pages);

    // 8. Run Cross-check against Lot Data (if lotCode exists)
    try {
      const lot = await ydb.getItem<any>('lots', job.lotCode);
      if (lot) {
        extracted.crossCheckWarnings = runCrossCheck(extracted, lot);
      }
    } catch (lotErr: any) {
      logger.warn('[AiWorker] Could not fetch lot for cross-check', { meta: { lotCode: job.lotCode, error: lotErr.message } });
    }

    // 9. Cost Estimation (pages * 0.20 ₽)
    const estimatedCostRub = Math.round(pagesCount * 0.20 * 100) / 100;

    // 10. Update Job Record as Completed
    const finishedAt = new Date().toISOString();
    job.status = 'completed';
    job.pagesProcessed = pagesCount;
    job.estimatedCostRub = estimatedCostRub;
    job.rawTextS3Key = rawTextS3Key;
    job.extractedFields = extracted;
    job.completedAt = finishedAt;
    job.updatedAt = finishedAt;

    await ydb.putItem('ai_ocr_jobs', job);
    logger.info('[AiWorker] Job successfully completed', { meta: { jobId: job.id, cost: estimatedCostRub, riskFlags: extracted.riskFlags.length } });

    return job;
  } catch (err: any) {
    logger.error('[AiWorker] Job processing failed', { meta: { jobId: job.id, error: err.message } });
    job.status = 'failed';
    job.errorMessage = err.message || 'Ошибка обработки документа';
    job.updatedAt = new Date().toISOString();
    await ydb.putItem('ai_ocr_jobs', job);
    throw err;
  }
}

/**
 * Main Cloud Function Handler for YMQ Trigger.
 */
export async function handler(event: any, context?: any) {
  logger.info('[AiWorker] Received invocation event', { meta: { isYmqEvent: Boolean(event?.messages) } });

  // 1. Direct invocation or HTTP test trigger
  if (event?.jobId || event?.body && typeof event.body === 'string') {
    let payload = event;
    if (typeof event.body === 'string') {
      try {
        payload = JSON.parse(event.body);
      } catch {
        payload = event;
      }
    }
    const token = context?.token?.access_token;
    const result = await processOcrJob(payload, token);
    return { statusCode: 200, body: JSON.stringify({ ok: true, job: result }) };
  }

  // 2. YMQ Message Queue Trigger Event
  const messages = event?.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    logger.warn('[AiWorker] No messages in event payload', { meta: { event } });
    return { statusCode: 200, body: 'No messages to process' };
  }

  const results = [];
  const token = context?.token?.access_token;

  for (const msg of messages) {
    const rawBody = msg?.details?.message?.body;
    if (!rawBody) continue;

    try {
      const parsed = JSON.parse(rawBody);
      logger.info('[AiWorker] Processing YMQ message payload', { meta: { messageId: msg?.details?.message?.message_id, parsed } });
      const jobRes = await processOcrJob(parsed, token);
      results.push({ ok: true, jobId: jobRes.id });
    } catch (msgErr: any) {
      logger.error('[AiWorker] Failed processing single message from YMQ', { meta: { error: msgErr.message, rawBody } });
      // Re-throw so YMQ retries or routes to DLQ after 3 attempts
      throw msgErr;
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, processed: results.length }) };
}
