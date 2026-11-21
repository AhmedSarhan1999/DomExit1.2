import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, getClientIp } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { createPresignedUploadUrl, createPresignedDownloadUrl } from '../lib/s3Client.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { consumeQuota, recordSecurityIncident } from '../lib/anomalyDetector.js';

const ALLOWED_PHOTO_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_PHOTO_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

export async function handleStorage(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = event.httpMethod.toUpperCase();
  const cfg = getConfig();
  const authUser = await getAuthenticatedUser(event);

  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация' });
  }

  // POST /api/storage/presign-upload
  if (subPath === '/presign-upload' && method === 'POST') {
    const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
    const uploadLimit = isStaff ? 200 : 30;
    const uploadQuota = await consumeQuota({
      scope: 'storage_upload_hour',
      actorKey: authUser.id,
      limit: uploadLimit,
      windowSec: 3600,
    });
    if (!uploadQuota.allowed) {
      return json(
        event,
        429,
        {
          error: `Превышен часовой лимит загрузки файлов (максимум ${uploadLimit} в час).`,
          retryAfter: uploadQuota.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(uploadQuota.retryAfterSec) } }
      );
    }

    const body = parseBody<{
      scope?: 'photo' | 'document';
      lotCode?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    }>(event);

    const scope = body?.scope;
    const lotCode = body?.lotCode?.trim() || 'general';
    const fileName = body?.fileName?.trim();
    const contentType = body?.contentType?.trim().toLowerCase();
    const fileSize = body?.fileSize;

    if (!scope || (scope !== 'photo' && scope !== 'document')) {
      return json(event, 400, { error: 'Некорректная область scope (допустимо photo или document)' });
    }
    if (!fileName || !contentType) {
      return json(event, 400, { error: 'Укажите fileName и contentType' });
    }

    const uuid = crypto.randomUUID().substring(0, 8);
    const safeName = sanitizeFileName(fileName);

    if (scope === 'photo') {
      if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
        return json(event, 400, {
          error: 'Недопустимый формат изображения (разрешены WebP, JPEG, PNG)',
        });
      }
      if (fileSize && fileSize > MAX_PHOTO_SIZE) {
        return json(event, 400, { error: 'Размер фото превышает 15 МБ' });
      }

      const key = `photos/${lotCode}/${uuid}-${safeName}`;
      const uploadUrl = await createPresignedUploadUrl({
        bucket: cfg.S3_PUBLIC_BUCKET,
        key,
        contentType,
        expiresInSeconds: 300,
      });

      const publicUrl = `${cfg.S3_ENDPOINT}/${cfg.S3_PUBLIC_BUCKET}/${key}`;

      return json(event, 200, {
        success: true,
        uploadUrl,
        storageKey: key,
        bucketType: 'public-photos',
        publicUrl,
      });
    }

    // scope === 'document' (Private 100%)
    if (!ALLOWED_DOCUMENT_TYPES.has(contentType)) {
      return json(event, 400, {
        error: 'Недопустимый формат документа (разрешены PDF, Word DOCX, JPEG, PNG)',
      });
    }
    if (fileSize && fileSize > MAX_DOC_SIZE) {
      return json(event, 400, { error: 'Размер документа превышает 25 МБ' });
    }

    const key = `documents/${lotCode}/${uuid}-${safeName}`;
    const uploadUrl = await createPresignedUploadUrl({
      bucket: cfg.S3_PRIVATE_BUCKET,
      key,
      contentType,
      expiresInSeconds: 300,
    });

    return json(event, 200, {
      success: true,
      uploadUrl,
      storageKey: key,
      bucketType: 'private-docs',
      publicUrl: null, // Private documents NEVER have publicUrl
    });
  }

  // GET /api/storage/presign-download?key=...&lotCode=...
  if (subPath === '/presign-download' && method === 'GET') {
    const query = event.queryStringParameters || {};
    const key = query['key'];
    const lotCode = query['lotCode'];
    const filename = query['filename'];

    if (!key) {
      return json(event, 400, { error: 'Укажите параметр key' });
    }

    // Strict Authorization Check: Only owner, staff, or parties to the lot/deal can download private documents
    const isOwner = authUser.role === 'owner';
    const isStaff = isOwner || authUser.role === 'employee';

    if (!isStaff) {
      const downloadQuota = await consumeQuota({
        scope: 'storage_download_hour',
        actorKey: authUser.id,
        limit: 60,
        windowSec: 3600,
      });
      if (!downloadQuota.allowed) {
        return json(
          event,
          429,
          {
            error: 'Превышен часовой лимит скачивания файлов (максимум 60 в час).',
            retryAfter: downloadQuota.retryAfterSec,
          },
          { extraHeaders: { 'Retry-After': String(downloadQuota.retryAfterSec) } }
        );
      }

      if (!lotCode) {
        const clientIp = getClientIp(event);
        await recordSecurityIncident({
          type: 'auth_bruteforce_or_probe',
          severity: 'medium',
          actorUserId: authUser.id,
          actorRole: authUser.role,
          clientIp,
          endpoint: '/api/storage/presign-download',
          summary: `Попытка несанкционированного доступа к приватному документу без lotCode: ${key}`,
        });
        return json(event, 403, { error: 'Доступ к документу ограничен' });
      }

      const ydb = getYdbClient();
      const lot = await ydb.getItem('lots', lotCode);
      const isSeller = lot && lot.sellerId === authUser.id;

      if (!isSeller) {
        const deals = await ydb.scanAll('deals', 200);
        const userDeal = deals.find(
          (d: any) =>
            (d.lotCode === lotCode || d.lotId === lotCode) &&
            (d.buyerId === authUser.id || d.sellerId === authUser.id)
        );

        if (!userDeal) {
          const clientIp = getClientIp(event);
          await recordSecurityIncident({
            type: 'auth_bruteforce_or_probe',
            severity: 'medium',
            actorUserId: authUser.id,
            actorRole: authUser.role,
            clientIp,
            endpoint: '/api/storage/presign-download',
            summary: `Попытка несанкционированного скачивания приватного документа чужого лота/сделки: ${key}`,
            details: { key, lotCode },
          });
          return json(event, 403, { error: 'У вас нет доступа к этому приватному документу' });
        }
      }
    }

    const downloadUrl = await createPresignedDownloadUrl({
      bucket: cfg.S3_PRIVATE_BUCKET,
      key,
      originalFilename: filename,
      expiresInSeconds: 900,
    });

    return json(event, 200, {
      success: true,
      downloadUrl,
      key,
      expiresIn: 900,
    });
  }

  return json(event, 404, { error: 'Storage route not found' });
}
