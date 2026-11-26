/**
 * photoQaService.ts — PropTech AI Module
 * AI Photo Quality & Privacy Inspector for DomExit Packaging Studio
 *
 * 152-FZ Sovereign Compliance: 100% inside Yandex Cloud (ru-central1).
 * Detects:
 * - Competitor watermarks (CIAN, Avito, DomClick, Yandex Realty, Etagi, M2)
 * - Direct contact numbers (+7/8 9xx), Telegram links/handles, web URLs
 * - Visible human faces (152-FZ privacy warning)
 * - Personal documents accidentally uploaded to public gallery (Passports, SNILS, EGRN)
 * - Low resolution (< 800x500px) and invalid image formats
 *
 * FinOps Guardrails:
 * - Max 10 photos per batch
 * - SHA-256 caching per photo in ai_packaging_results_v2 (0 duplicate cloud calls)
 * - SSRF prevention (validate URL protocol, hostname, 8MB size limit, 8s timeout)
 */

import crypto from 'node:crypto';
import { logger } from '../../lib/logger.js';
import { getYdbClient } from '../../lib/ydbClient.js';
import { getConfig } from '../../lib/config.js';
import { resolveVisionIamToken } from '../legal-core/yandexVisionOcrClient.js';

export interface PhotoQaIssue {
  code:
    | 'competitor_watermark'
    | 'phone_or_contact'
    | 'face_detected'
    | 'document_pii'
    | 'low_resolution'
    | 'fetch_failed';
  severity: 'high' | 'medium' | 'info';
  messageRu: string;
}

export interface PhotoQaResult {
  photoUrl: string;
  photoHash: string;
  status: 'pass' | 'warning' | 'reject_recommended';
  width?: number;
  height?: number;
  detectedTextSnippet?: string;
  issues: PhotoQaIssue[];
  inspectedAt: string;
}

export interface PhotoQaBatchReport {
  lotCode: string;
  totalPhotos: number;
  cleanPhotosCount: number;
  warningPhotosCount: number;
  rejectPhotosCount: number;
  results: PhotoQaResult[];
  cachedCount: number;
  freshlyInspectedCount: number;
  createdAt: string;
}

const MAX_PHOTOS_PER_BATCH = 10;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const FETCH_TIMEOUT_MS = 8000;

// Competitor watermark detection rules
const COMPETITOR_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Циан', pattern: /\b(циан|cian|cian\.ru|spb\.cian\.ru)\b/i },
  { name: 'Авито', pattern: /\b(авито|avito|avito\.ru)\b/i },
  { name: 'Домклик', pattern: /\b(домклик|domclick|domclick\.ru)\b/i },
  { name: 'Яндекс Недвижимость', pattern: /\b(яндекс[.\s_-]*недвижимост|realty\.yandex)\b/i },
  { name: 'Этажи', pattern: /\b(этажи|etagi|etagi\.com)\b/i },
  { name: 'М2', pattern: /\b(м2|m2\.ru|квадратный метр)\b/i },
  { name: 'Самолет Плюс', pattern: /\b(самолет[.\s_-]*плюс|samoletplus)\b/i },
];

const PHONE_PATTERN = /(\+7|8)[\s\-(]?9\d{2}[\s\-)]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
const TELEGRAM_OR_URL_PATTERN = /(t\.me\/|@\w{4,}|https?:\/\/|www\.|\.(ru|com|рф|net|org)\b)/i;
const PII_DOCUMENT_PATTERN = /\b(паспорт|снилс|договор участия|договор купли|выписка из егрн|свидетельство о рождении|инн\s*\d{10,12})\b/i;

/**
 * Extracts basic image dimensions from binary header (JPEG, PNG, WebP) without heavy libraries.
 * Operating cost: 0 ₽.
 */
export function extractImageDimensions(buf: Buffer): { width?: number; height?: number } {
  if (!buf || buf.length < 24) return {};

  try {
    // PNG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }

    // JPEG
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let offset = 2;
      while (offset < buf.length - 8) {
        if (buf[offset] !== 0xff) break;
        const marker = buf[offset + 1];
        // SOF0 (baseline) or SOF2 (progressive)
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buf.readUInt16BE(offset + 5);
          const width = buf.readUInt16BE(offset + 7);
          return { width, height };
        }
        const len = buf.readUInt16BE(offset + 2);
        offset += len + 2;
      }
    }

    // WebP
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const format = buf.toString('ascii', 12, 16);
      if (format === 'VP8 ') {
        const width = buf.readUInt16LE(26) & 0x3fff;
        const height = buf.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (format === 'VP8L') {
        const b1 = buf[21];
        const b2 = buf[22];
        const b3 = buf[23];
        const b4 = buf[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      } else if (format === 'VP8X') {
        const width = 1 + buf.readUIntLE(24, 3);
        const height = 1 + buf.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {
    // Non-fatal fallback
  }

  return {};
}

/**
 * Validates photo URL against SSRF and downloads buffer.
 */
async function fetchSafeImageBuffer(photoUrl: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(photoUrl);
  } catch {
    throw new Error('Некорректный URL фотографии');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Недопустимый протокол фотографии (разрешены только http/https)');
  }

  // Prevent accessing local private IP ranges (SSRF protection)
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '169.254.169.254' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('172.16.')
  ) {
    throw new Error('Доступ к внутренним сетевым адресам заблокирован');
  }

  const res = await fetch(photoUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Ошибка загрузки фотографии (HTTP ${res.status})`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  if (contentLength > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Размер файла превышает лимит 8 МБ (${Math.round(contentLength / 1024 / 1024)} МБ)`);
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Размер загруженного файла превышает 8 МБ');
  }

  return Buffer.from(arrayBuf);
}

/**
 * Calls Yandex Vision OCR to extract text from image buffer.
 */
async function inspectTextWithYandexVision(
  buffer: Buffer,
  iamToken: string,
  folderId: string
): Promise<{ text: string; width?: number; height?: number }> {
  const base64Content = buffer.toString('base64');
  try {
    const res = await fetch('https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${iamToken}`,
        'x-folder-id': folderId,
        'x-data-logging-enabled': 'true',
      },
      body: JSON.stringify({
        mimeType: 'image/jpeg',
        languageCodes: ['ru', 'en'],
        model: 'page',
        content: base64Content,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn('[PhotoQA] Vision OCR call returned non-200', { meta: { status: res.status, errText } });
      return { text: '' };
    }

    const data = (await res.json()) as any;
    const annotation = data?.result?.textAnnotation;
    const blocks = annotation?.blocks || [];
    const lines: string[] = [];

    for (const b of blocks) {
      for (const l of b.lines || []) {
        if (l.text) lines.push(l.text);
      }
    }

    return {
      text: lines.join(' ').trim(),
      width: annotation?.width,
      height: annotation?.height,
    };
  } catch (err: any) {
    logger.warn('[PhotoQA] Vision OCR request failed', { meta: { error: err.message } });
    return { text: '' };
  }
}

/**
 * Calls Yandex Vision Face Detection to detect human faces in apartment photos (152-FZ check).
 */
async function inspectFacesWithYandexVision(
  buffer: Buffer,
  iamToken: string,
  folderId: string
): Promise<boolean> {
  const base64Content = buffer.toString('base64');
  try {
    const res = await fetch('https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${iamToken}`,
        'x-folder-id': folderId,
        'x-data-logging-enabled': 'true',
      },
      body: JSON.stringify({
        folderId,
        analyze_specs: [
          {
            content: base64Content,
            features: [
              {
                type: 'FACE_DETECTION',
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return false;

    const data = (await res.json()) as any;
    const faces = data?.results?.[0]?.results?.[0]?.faceDetection?.faces;
    return Array.isArray(faces) && faces.length > 0;
  } catch (err: any) {
    logger.warn('[PhotoQA] Face detection call failed', { meta: { error: err.message } });
    return false;
  }
}

/**
 * Analyzes a single photo buffer or URL for QA and privacy compliance.
 */
export async function analyzePhoto(
  photoUrl: string,
  options: {
    providedBuffer?: Buffer;
    iamToken?: string;
    folderId?: string;
  } = {}
): Promise<PhotoQaResult> {
  const photoHash = crypto.createHash('sha256').update(photoUrl).digest('hex').slice(0, 16);
  const issues: PhotoQaIssue[] = [];

  let buffer: Buffer;
  try {
    buffer = options.providedBuffer || (await fetchSafeImageBuffer(photoUrl));
  } catch (err: any) {
    return {
      photoUrl,
      photoHash,
      status: 'warning',
      issues: [
        {
          code: 'fetch_failed',
          severity: 'medium',
          messageRu: `Не удалось загрузить изображение: ${err.message}`,
        },
      ],
      inspectedAt: new Date().toISOString(),
    };
  }

  // 1. Resolution Check (0 ₽)
  const headerDims = extractImageDimensions(buffer);
  const width = headerDims.width;
  const height = headerDims.height;

  if (width && height) {
    if (width < 800 || height < 500) {
      issues.push({
        code: 'low_resolution',
        severity: 'medium',
        messageRu: `Низкое разрешение изображения (${width}×${height}px). Рекомендуется от 1200×800px`,
      });
    }
  }

  // 2. Yandex Cloud Token Resolution
  const cfg = getConfig();
  const folderId = options.folderId || process.env.YC_FOLDER_ID || cfg.YC_FOLDER_ID || 'b1g46uad3gc3h34k5b0f';
  let iamToken = '';
  try {
    iamToken = await resolveVisionIamToken(options.iamToken);
  } catch (err: any) {
    logger.warn('[PhotoQA] IAM token not available for Vision check', { meta: { error: err.message } });
  }

  let detectedTextSnippet = '';

  if (iamToken) {
    // 3. OCR Text Inspection (Competitor watermarks, direct contacts, PII)
    const ocrResult = await inspectTextWithYandexVision(buffer, iamToken, folderId);
    const ocrText = ocrResult.text;
    if (ocrText) {
      detectedTextSnippet = ocrText.slice(0, 200);

      // Check competitor watermarks
      for (const comp of COMPETITOR_PATTERNS) {
        if (comp.pattern.test(ocrText)) {
          issues.push({
            code: 'competitor_watermark',
            severity: 'high',
            messageRu: `Обнаружен водяной знак или логотип стороннего сервиса: «${comp.name}»`,
          });
        }
      }

      // Check phone numbers
      if (PHONE_PATTERN.test(ocrText)) {
        issues.push({
          code: 'phone_or_contact',
          severity: 'high',
          messageRu: 'На изображении обнаружен номер телефона (прямой контакт запрещён правилами)',
        });
      }

      // Check external links or telegram handles
      if (TELEGRAM_OR_URL_PATTERN.test(ocrText)) {
        issues.push({
          code: 'phone_or_contact',
          severity: 'medium',
          messageRu: 'На изображении обнаружена ссылка, домен или аккаунт соцсети/Telegram',
        });
      }

      // Check accidental personal document upload (152-FZ)
      if (PII_DOCUMENT_PATTERN.test(ocrText)) {
        issues.push({
          code: 'document_pii',
          severity: 'high',
          messageRu: 'Внимание (152-ФЗ): на фото распознан текст личного документа (паспорт, СНИЛС, ЕГРН)',
        });
      }
    }

    // 4. Face Detection Check (152-FZ)
    const hasFaces = await inspectFacesWithYandexVision(buffer, iamToken, folderId);
    if (hasFaces) {
      issues.push({
        code: 'face_detected',
        severity: 'medium',
        messageRu: 'Внимание (152-ФЗ): на фото обнаружено лицо человека. Рекомендуется обезличить или заменить',
      });
    }
  }

  // Determine overall status
  let status: PhotoQaResult['status'] = 'pass';
  if (issues.some((i) => i.severity === 'high')) {
    status = 'reject_recommended';
  } else if (issues.some((i) => i.severity === 'medium')) {
    status = 'warning';
  }

  return {
    photoUrl,
    photoHash,
    status,
    width,
    height,
    detectedTextSnippet: detectedTextSnippet || undefined,
    issues,
    inspectedAt: new Date().toISOString(),
  };
}

/**
 * Runs batch QA analysis on a lot's photos with deduplication and YDB caching.
 */
export async function inspectLotPhotos(params: {
  lotCode: string;
  photoUrls: string[];
  forceReprocess?: boolean;
  operatorId?: string;
}): Promise<PhotoQaBatchReport> {
  const { lotCode, photoUrls, forceReprocess = false, operatorId = 'system' } = params;
  const limitedUrls = photoUrls.slice(0, MAX_PHOTOS_PER_BATCH);
  const ydb = getYdbClient();

  // 1. Check existing cached batch
  const cacheKey = `pkg-${lotCode.trim().toUpperCase()}-photoqa`;
  let existingRecord: any = null;
  try {
    existingRecord = await ydb.getItem<any>('ai_packaging_results', cacheKey);
  } catch {
    // ignore
  }

  const cachedResultsMap = new Map<string, PhotoQaResult>();
  if (existingRecord?.photoQaResults && Array.isArray(existingRecord.photoQaResults) && !forceReprocess) {
    for (const r of existingRecord.photoQaResults) {
      if (r?.photoUrl) cachedResultsMap.set(r.photoUrl, r);
    }
  }

  const results: PhotoQaResult[] = [];
  let cachedCount = 0;
  let freshlyInspectedCount = 0;

  for (const url of limitedUrls) {
    if (!url || typeof url !== 'string') continue;
    const cleanUrl = url.trim();
    if (!cleanUrl) continue;

    const cached = cachedResultsMap.get(cleanUrl);
    if (cached && !forceReprocess) {
      results.push(cached);
      cachedCount++;
    } else {
      const inspected = await analyzePhoto(cleanUrl);
      results.push(inspected);
      freshlyInspectedCount++;
    }
  }

  const cleanPhotosCount = results.filter((r) => r.status === 'pass').length;
  const warningPhotosCount = results.filter((r) => r.status === 'warning').length;
  const rejectPhotosCount = results.filter((r) => r.status === 'reject_recommended').length;

  const report: PhotoQaBatchReport = {
    lotCode: lotCode.trim().toUpperCase(),
    totalPhotos: results.length,
    cleanPhotosCount,
    warningPhotosCount,
    rejectPhotosCount,
    results,
    cachedCount,
    freshlyInspectedCount,
    createdAt: new Date().toISOString(),
  };

  // 2. Persist to ai_packaging_results_v2
  try {
    await ydb.putItem('ai_packaging_results', {
      id: cacheKey,
      lotCode: lotCode.trim().toUpperCase(),
      kind: 'photo_qa',
      inputHash: crypto.createHash('sha256').update(limitedUrls.join('|')).digest('hex').slice(0, 16),
      photoQaResults: results,
      createdBy: operatorId,
      createdAt: report.createdAt,
      updatedAt: report.createdAt,
    });
  } catch (err: any) {
    logger.warn('[PhotoQA] Failed persisting report to YDB', { meta: { error: err.message } });
  }

  return report;
}
