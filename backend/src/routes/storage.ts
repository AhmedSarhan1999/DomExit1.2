import crypto from 'node:crypto';
import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, getClientIp } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { createPresignedUploadUrl, createPresignedDownloadUrl } from '../lib/s3Client.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { consumeQuota, recordSecurityIncident } from '../lib/anomalyDetector.js';
import { isEmployeeAssignedToRecord } from '../lib/rbac.js';

const ALLOWED_PHOTO_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
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
      purpose?: 'avatar' | 'lot_photo' | 'document';
      lotCode?: string;
      fileName?: string;
      contentType?: string;
      fileSize?: number;
      includeCacheControl?: boolean;
    }>(event);

    const purpose = body?.purpose;
    const scope = body?.scope || (purpose === 'avatar' ? 'photo' : undefined);
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

      const key =
        purpose === 'avatar'
          ? `avatars/${authUser.id}/${uuid}-${safeName || 'avatar.webp'}`
          : `photos/${lotCode}/${uuid}-${safeName || 'photo.webp'}`;
      const cacheControl = body?.includeCacheControl ? 'public, max-age=86400' : undefined;
      const uploadUrl = await createPresignedUploadUrl({
        bucket: cfg.S3_PUBLIC_BUCKET,
        key,
        contentType,
        expiresInSeconds: 300,
        cacheControl,
      });

      const publicUrl = `${cfg.S3_ENDPOINT}/${cfg.S3_PUBLIC_BUCKET}/${key}`;

      return json(event, 200, {
        success: true,
        uploadUrl,
        storageKey: key,
        bucketType: 'public-photos',
        publicUrl,
        ...(cacheControl
          ? {
              uploadHeaders: {
                'Content-Type': contentType,
                'Cache-Control': cacheControl,
              },
            }
          : {}),
      });
    }

    // scope === 'document' (Private 100%)
    if (!ALLOWED_DOCUMENT_TYPES.has(contentType)) {
      return json(event, 400, {
        error: 'Недопустимый формат документа (разрешены PDF, JPG, PNG, WebP, DOCX)',
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

    // Strict Authorization Check: Only owner, assigned employee, or authorized applicant/seller/buyer can download private documents
    const isOwner = authUser.role === 'owner';
    const isStaff = isOwner || authUser.role === 'employee';
    const ydb = getYdbClient();

    if (isStaff && !isOwner && lotCode) {
      let lotForStaff = await ydb.getItem('lots', lotCode);
      if (!lotForStaff) {
        if (ydb.isV2TablesEnabled()) {
          lotForStaff =
            (await ydb.queryAllByIndex<any>({ tableName: 'lots', indexName: 'lotCode-index', hashKey: 'lotCode', hashValue: String(lotCode).trim(), limit: 5 }))[0] ||
            (await ydb.queryAllByIndex<any>({ tableName: 'lots', indexName: 'lotCode-index', hashKey: 'lotCode', hashValue: String(lotCode).trim().toUpperCase(), limit: 5 }))[0] ||
            null;
        } else {
          const allLots = await ydb.scanAll<any>('lots', 500);
          lotForStaff = (allLots || []).find(
            (l: any) => String(l.lotCode || l.id || '').toUpperCase() === String(lotCode).toUpperCase()
          );
        }
      }
      if (lotForStaff && !isEmployeeAssignedToRecord(authUser, lotForStaff)) {
        return json(event, 403, {
          error: 'У вас нет доступа к приватным документам чужого лота',
          code: 'NOT_ASSIGNED_TO_LOT',
        });
      }
    }

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

      const lot = await ydb.getItem('lots', lotCode);
      const isSeller =
        lot && (lot.sellerUserId === authUser.id || lot.sellerId === authUser.id);

      if (!isSeller) {
        const targetCode = String(lotCode).toUpperCase();
        const [deals, apps, vaultDocs] = ydb.isV2TablesEnabled()
          ? await Promise.all([
              Promise.all([
                ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'buyerId-createdAt-index', hashKey: 'buyerId', hashValue: authUser.id }),
                ydb.queryAllByIndex<any>({ tableName: 'deals', indexName: 'sellerId-createdAt-index', hashKey: 'sellerId', hashValue: authUser.id }),
              ]).then(([b, s]) => [...b, ...s]),
              ydb.queryAllByIndex<any>({ tableName: 'buyer_applications', indexName: 'userId-createdAt-index', hashKey: 'userId', hashValue: authUser.id }),
              ydb.queryAllByIndex<any>({ tableName: 'documents_vault', indexName: 'lotId-uploadedAt-index', hashKey: 'lotId', hashValue: targetCode }),
            ])
          : await Promise.all([
              ydb.scanAll<any>('deals', 300),
              ydb.scanAll<any>('buyer_applications', 500),
              ydb.scanAll<any>('documents_vault', 300),
            ]);
        const userDeal = (deals || []).find(
          (d: any) =>
            String(d.lotCode || d.lotId || '').toUpperCase() === targetCode &&
            (d.buyerId === authUser.id || d.buyerUserId === authUser.id || d.sellerId === authUser.id || d.sellerUserId === authUser.id)
        );
        const isWinningBuyer = (apps || []).some(
          (a: any) =>
            String(a.lotCode || '').toUpperCase() === targetCode &&
            String(a.userId) === String(authUser.id) &&
            ['priority_1', 'in_deal', 'completed'].includes(String(a.queueStatus || ''))
        );
        const isApplicantOwnProof =
          (apps || []).some(
            (a: any) =>
              String(a.lotCode || '').toUpperCase() === targetCode &&
              String(a.userId) === String(authUser.id) &&
              Array.isArray(a.proofDocuments) &&
              a.proofDocuments.some((pd: any) => pd?.objectKey === key)
          ) ||
          (vaultDocs || []).some(
            (d: any) =>
              String(d.entityId || '').toUpperCase() === targetCode &&
              String(d.uploadedByUid || '') === String(authUser.id) &&
              d.objectKey === key
          );

        if (!userDeal && !isWinningBuyer && !isApplicantOwnProof) {
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
