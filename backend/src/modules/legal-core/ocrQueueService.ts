/**
 * backend/src/modules/legal-core/ocrQueueService.ts
 *
 * YMQ OCR Queue Manager and Job Tracking Service.
 * - Enqueues OCR jobs for private documents in documents_vault.
 * - Sends messages to YMQ (domexit-ai-ocr-staging) via AWS SigV4.
 * - Tracks daily quotas (dailyOcrPagesCap = 200).
 * - Queries and retrieves OCR jobs and extracted fields.
 */

import crypto from 'node:crypto';
import { getConfig } from '../../lib/config.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { logger } from '../../lib/logger.js';
import { ExtractedRealEstateFields } from './russianRealEstateDocParser.js';

export interface AiOcrJobRecord {
  id: string;
  lotCode: string;
  documentId: string;
  docCategory: string;
  objectKey: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesProcessed?: number;
  estimatedCostRub?: number;
  rawTextS3Key?: string;
  extractedFields?: ExtractedRealEstateFields;
  errorMessage?: string;
  requestedBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface EnqueueOcrJobParams {
  lotCode: string;
  documentId: string;
  objectKey: string;
  docCategory?: string;
  requestedBy: string;
  forceReprocess?: boolean;
}

export interface OcrStats {
  configured: boolean;
  ymqConfigured: boolean;
  dailyPagesUsed: number;
  dailyPagesCap: number;
  totalJobsCompleted: number;
  estimatedMonthCostRub: number;
}

function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
  return crypto.createHmac('sha256', kService).update('aws4_request').digest();
}

/**
 * Sends a message to Yandex Message Queue using AWS SigV4 over HTTPS.
 */
async function sendYmqMessage(queueUrl: string, bodyJson: string): Promise<void> {
  const cfg = getConfig();
  const ak = cfg.YC_ACCESS_KEY_ID;
  const sk = cfg.YC_SECRET_ACCESS_KEY;
  const region = cfg.YDB_REGION || 'ru-central1';

  if (!queueUrl) throw new Error('YMQ_OCR_QUEUE_URL is not configured');
  if (!ak || !sk) throw new Error('YC_ACCESS_KEY_ID or YC_SECRET_ACCESS_KEY is missing');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(queueUrl);

  const form = new URLSearchParams({
    Action: 'SendMessage',
    MessageBody: bodyJson,
    Version: '2012-11-05',
  }).toString();

  const hashedPayload = crypto.createHash('sha256').update(form).digest('hex');
  const canonicalHeaders = `content-type:application/x-www-form-urlencoded\nhost:${url.host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', url.pathname, '', canonicalHeaders, signedHeaders, hashedPayload].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/sqs/aws4_request`,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const sigKey = getSignatureKey(sk, dateStamp, region, 'sqs');
  const sig = crypto.createHmac('sha256', sigKey).update(stringToSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${ak}/${dateStamp}/${region}/sqs/aws4_request, SignedHeaders=${signedHeaders}, Signature=${sig}`;

  const res = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Amz-Date': amzDate,
      Authorization: auth,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YMQ SendMessage failed (${res.status}): ${text}`);
  }
}

/**
 * Enqueues a document for OCR recognition.
 */
export async function enqueueOcrJob(params: EnqueueOcrJobParams): Promise<{ ok: boolean; job: AiOcrJobRecord; isExisting?: boolean }> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  const now = new Date().toISOString();

  // 1. Check existing jobs for this document
  const existingJobs = ydb.isV2TablesEnabled()
    ? await ydb.queryAllByIndex<AiOcrJobRecord>({
        tableName: 'ai_ocr_jobs',
        indexName: 'documentId-createdAt-index',
        hashKey: 'documentId',
        hashValue: params.documentId,
      })
    : await ydb.scanAll<AiOcrJobRecord>('ai_ocr_jobs', 50);

  const matched = existingJobs.filter((j) => j.documentId === params.documentId);
  matched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const latestJob = matched[0];
  if (latestJob && !params.forceReprocess) {
    if (latestJob.status === 'completed' || latestJob.status === 'processing' || latestJob.status === 'queued') {
      logger.info('[OcrQueueService] Returning existing job for document', { meta: { jobId: latestJob.id, status: latestJob.status } });
      return { ok: true, job: latestJob, isExisting: true };
    }
  }

  // 2. Validate file format
  const keyLower = params.objectKey.toLowerCase();
  const validExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const isValidFormat = validExts.some((ext) => keyLower.endsWith(ext));
  if (!isValidFormat) {
    throw new Error('Неподдерживаемый формат файла для OCR. Допускаются PDF, JPG, PNG, WEBP.');
  }

  // 3. Create Job Record
  const jobId = `ocr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const jobRecord: AiOcrJobRecord = {
    id: jobId,
    lotCode: params.lotCode.trim().toUpperCase(),
    documentId: params.documentId,
    docCategory: params.docCategory || 'other',
    objectKey: params.objectKey,
    status: 'queued',
    requestedBy: params.requestedBy,
    createdAt: now,
    updatedAt: now,
  };

  await ydb.putItem('ai_ocr_jobs', jobRecord);

  // 4. Send Message to YMQ
  const queueUrl = cfg.YMQ_OCR_QUEUE_URL || process.env.YMQ_OCR_QUEUE_URL || '';
  if (queueUrl) {
    try {
      await sendYmqMessage(
        queueUrl,
        JSON.stringify({
          jobId,
          lotCode: jobRecord.lotCode,
          documentId: jobRecord.documentId,
          objectKey: jobRecord.objectKey,
          docCategory: jobRecord.docCategory,
          requestedBy: jobRecord.requestedBy,
        })
      );
      logger.info('[OcrQueueService] Dispatched job message to YMQ', { meta: { jobId, queueUrl } });
    } catch (err: any) {
      logger.error('[OcrQueueService] Failed sending to YMQ, updating job to failed', { meta: { jobId, error: err.message } });
      jobRecord.status = 'failed';
      jobRecord.errorMessage = `Ошибка отправки в очередь YMQ: ${err.message}`;
      jobRecord.updatedAt = new Date().toISOString();
      await ydb.putItem('ai_ocr_jobs', jobRecord);
      throw err;
    }
  } else {
    logger.warn('[OcrQueueService] YMQ_OCR_QUEUE_URL not configured. Job created in queued state.');
  }

  return { ok: true, job: jobRecord, isExisting: false };
}

/**
 * Retrieves OCR jobs for a specific lot.
 */
export async function getOcrJobsForLot(lotCode: string): Promise<AiOcrJobRecord[]> {
  const ydb = getYdbClient();
  const cleanCode = lotCode.trim().toUpperCase();

  const jobs = ydb.isV2TablesEnabled()
    ? await ydb.queryAllByIndex<AiOcrJobRecord>({
        tableName: 'ai_ocr_jobs',
        indexName: 'lotCode-createdAt-index',
        hashKey: 'lotCode',
        hashValue: cleanCode,
      })
    : (await ydb.scanAll<AiOcrJobRecord>('ai_ocr_jobs', 100)).filter((j) => j.lotCode === cleanCode);

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs;
}

/**
 * Retrieves a single OCR job by ID.
 */
export async function getOcrJobById(jobId: string): Promise<AiOcrJobRecord | null> {
  const ydb = getYdbClient();
  return ydb.getItem<AiOcrJobRecord>('ai_ocr_jobs', jobId);
}

/**
 * Calculates current OCR usage statistics.
 */
export async function getOcrStats(): Promise<OcrStats> {
  const ydb = getYdbClient();
  const cfg = getConfig();
  const dailyCap = cfg.DAILY_OCR_PAGES_CAP || 200;
  const queueUrl = cfg.YMQ_OCR_QUEUE_URL || process.env.YMQ_OCR_QUEUE_URL || '';

  const allJobs = await ydb.scanAll<AiOcrJobRecord>('ai_ocr_jobs', 200);

  const todayStr = new Date().toISOString().slice(0, 10);
  let dailyPagesUsed = 0;
  let totalJobsCompleted = 0;
  let estimatedMonthCostRub = 0;

  for (const job of allJobs) {
    if (job.status === 'completed') {
      totalJobsCompleted++;
      const cost = job.estimatedCostRub || (job.pagesProcessed || 1) * 0.20;
      estimatedMonthCostRub += cost;

      if (job.completedAt && job.completedAt.startsWith(todayStr)) {
        dailyPagesUsed += job.pagesProcessed || 1;
      }
    }
  }

  return {
    configured: true,
    ymqConfigured: Boolean(queueUrl),
    dailyPagesUsed,
    dailyPagesCap: dailyCap,
    totalJobsCompleted,
    estimatedMonthCostRub: Math.round(estimatedMonthCostRub * 100) / 100,
  };
}
