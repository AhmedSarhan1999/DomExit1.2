/**
 * backend/src/modules/legal-core/yandexVisionOcrClient.ts
 *
 * Yandex Vision OCR API Client (152-FZ Compliant - 100% in ru-central1).
 * Supports sync recognition for images/single-page and async polling for multi-page PDFs.
 */

import { execSync } from 'node:child_process';
import { logger } from '../../lib/logger.js';
import { getConfig } from '../../lib/config.js';

export interface OcrPageResult {
  pageNumber: number;
  fullText: string;
  blocksCount: number;
  width?: number;
  height?: number;
}

export interface VisionOcrClientOptions {
  iamToken?: string;
  folderId?: string;
  maxPages?: number;
}

// In-memory cached IAM token for CLI / local runs
let cachedCliToken: { token: string; expiresAt: number } | null = null;

export async function resolveVisionIamToken(overrideToken?: string): Promise<string> {
  if (overrideToken && overrideToken.trim()) return overrideToken.trim();

  const cfg = getConfig();
  if (process.env.YC_AI_IAM_TOKEN) return process.env.YC_AI_IAM_TOKEN.trim();
  if (process.env.YC_IAM_TOKEN) return process.env.YC_IAM_TOKEN.trim();
  if (cfg.YC_AI_IAM_TOKEN) return cfg.YC_AI_IAM_TOKEN.trim();

  // 1. Try compute metadata (when running inside Yandex Cloud Functions / Compute)
  try {
    const metaRes = await fetch('http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(1500),
    });
    if (metaRes.ok) {
      const data = await metaRes.json() as any;
      if (data?.access_token) return data.access_token;
    }
  } catch {
    // Ignore metadata failure outside compute
  }

  // 2. Try yc CLI token (cached 10 min)
  if (cachedCliToken && Date.now() < cachedCliToken.expiresAt) {
    return cachedCliToken.token;
  }

  try {
    const token = execSync('yc iam create-token', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 8000,
    }).trim();
    if (token) {
      cachedCliToken = { token, expiresAt: Date.now() + 10 * 60 * 1000 };
      return token;
    }
  } catch {
    // CLI not available
  }

  throw new Error(
    'Yandex Vision IAM Token could not be resolved. Ensure function context token, YC_AI_IAM_TOKEN or yc CLI is configured.'
  );
}

/**
 * Extracts full text from Yandex Vision textAnnotation response object.
 */
function extractTextFromAnnotation(annotation: any): { fullText: string; blocksCount: number } {
  if (!annotation) return { fullText: '', blocksCount: 0 };

  const blocks = annotation.blocks || [];
  const lines: string[] = [];

  for (const block of blocks) {
    for (const line of block.lines || []) {
      if (line.text) {
        lines.push(line.text);
      } else if (Array.isArray(line.words)) {
        const lineText = line.words.map((w: any) => w.text || '').filter(Boolean).join(' ');
        if (lineText) lines.push(lineText);
      }
    }
  }

  return {
    fullText: lines.join('\n').trim(),
    blocksCount: blocks.length,
  };
}

/**
 * Recognizes a document (image or PDF) using Yandex Vision OCR.
 */
export async function recognizeDocumentWithYandexVision(
  buffer: Buffer,
  rawMimeType: string,
  options: VisionOcrClientOptions = {}
): Promise<OcrPageResult[]> {
  const cfg = getConfig();
  const folderId = options.folderId || process.env.YC_FOLDER_ID || cfg.YC_FOLDER_ID || 'b1g46uad3gc3h34k5b0f';
  const iamToken = await resolveVisionIamToken(options.iamToken);
  const maxPages = options.maxPages || 15;

  let mimeType = (rawMimeType || '').toLowerCase();
  if (mimeType.includes('pdf')) mimeType = 'application/pdf';
  else if (mimeType.includes('png')) mimeType = 'image/png';
  else if (mimeType.includes('webp')) mimeType = 'image/webp';
  else mimeType = 'image/jpeg';

  const base64Content = buffer.toString('base64');

  // Images & 1-page documents can be processed synchronously
  if (mimeType.startsWith('image/')) {
    logger.info('[VisionOCR] Calling sync recognizeText for image', { meta: { mimeType, sizeBytes: buffer.length } });
    const res = await fetch('https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${iamToken}`,
        'x-folder-id': folderId,
        'x-data-logging-enabled': 'true',
      },
      body: JSON.stringify({
        mimeType,
        languageCodes: ['ru', 'en'],
        model: 'page',
        content: base64Content,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Yandex Vision OCR error (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    const annotation = data?.result?.textAnnotation;
    const { fullText, blocksCount } = extractTextFromAnnotation(annotation);

    return [
      {
        pageNumber: 1,
        fullText,
        blocksCount,
        width: annotation?.width,
        height: annotation?.height,
      },
    ];
  }

  // Multi-page PDF or complex documents: use recognizeTextAsync
  logger.info('[VisionOCR] Calling recognizeTextAsync for PDF', { meta: { sizeBytes: buffer.length } });
  const asyncInitRes = await fetch('https://ocr.api.cloud.yandex.net/ocr/v1/recognizeTextAsync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${iamToken}`,
      'x-folder-id': folderId,
    },
    body: JSON.stringify({
      mimeType: 'application/pdf',
      languageCodes: ['ru', 'en'],
      model: 'page',
      content: base64Content,
    }),
    signal: AbortSignal.timeout(35000),
  });

  if (!asyncInitRes.ok) {
    const errText = await asyncInitRes.text();
    // Fallback: If recognizeTextAsync is unavailable, attempt synchronous recognizeText
    logger.warn('[VisionOCR] recognizeTextAsync returned error, attempting sync recognizeText fallback', { meta: { error: errText } });
    const syncFallback = await fetch('https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${iamToken}`,
        'x-folder-id': folderId,
      },
      body: JSON.stringify({
        mimeType: 'application/pdf',
        languageCodes: ['ru', 'en'],
        model: 'page',
        content: base64Content,
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (syncFallback.ok) {
      const syncData = await syncFallback.json() as any;
      const { fullText, blocksCount } = extractTextFromAnnotation(syncData?.result?.textAnnotation);
      return [{ pageNumber: 1, fullText, blocksCount }];
    }

    throw new Error(`Failed to initiate Yandex Vision async OCR (${asyncInitRes.status}): ${errText}`);
  }

  const asyncInitData = await asyncInitRes.json() as any;
  const operationId = asyncInitData?.id;
  if (!operationId) {
    throw new Error('Yandex Vision OCR did not return an operation ID');
  }

  logger.info('[VisionOCR] Polling async recognition operation', { meta: { operationId } });

  // Poll for completion (up to 120s, interval 2s)
  const startTime = Date.now();
  const timeoutMs = 120000;
  const pollIntervalMs = 2000;

  while (Date.now() - startTime < timeoutMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    // Poll via dms.api.cloud.yandex.net or operation API
    let pollUrl = `https://dms.api.cloud.yandex.net/ocr/v1/getRecognition?operationId=${encodeURIComponent(operationId)}`;
    let pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${iamToken}` },
      signal: AbortSignal.timeout(10000),
    });

    if (pollRes.status === 404 || !pollRes.ok) {
      pollUrl = `https://operation.api.cloud.yandex.net/operations/${encodeURIComponent(operationId)}`;
      pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${iamToken}` },
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!pollRes.ok) continue;

    const opData = await pollRes.json() as any;
    if (opData.done === true) {
      if (opData.error) {
        throw new Error(`Yandex Vision OCR operation failed: ${JSON.stringify(opData.error)}`);
      }

      // Check results structure
      const pages: OcrPageResult[] = [];
      const resp = opData.response || opData.result;

      if (Array.isArray(resp?.results)) {
        for (let i = 0; i < Math.min(resp.results.length, maxPages); i++) {
          const item = resp.results[i];
          const ann = item?.textAnnotation || item;
          const { fullText, blocksCount } = extractTextFromAnnotation(ann);
          pages.push({
            pageNumber: i + 1,
            fullText,
            blocksCount,
            width: ann?.width,
            height: ann?.height,
          });
        }
      } else if (resp?.textAnnotation) {
        const { fullText, blocksCount } = extractTextFromAnnotation(resp.textAnnotation);
        pages.push({ pageNumber: 1, fullText, blocksCount });
      }

      logger.info('[VisionOCR] Recognition completed successfully', {
        meta: { operationId, pagesCount: pages.length, durationMs: Date.now() - startTime },
      });

      return pages.length > 0 ? pages : [{ pageNumber: 1, fullText: '', blocksCount: 0 }];
    }
  }

  throw new Error(`Yandex Vision OCR timed out after 120s for operation: ${operationId}`);
}
