import crypto from 'node:crypto';
import { UserProfile, YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, getClientIp } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { deleteS3ObjectsByPrefix } from '../lib/s3Client.js';
import { memoryCache, CACHEABLE_COLLECTIONS } from '../lib/memoryCache.js';
import { recordJournalEvent } from '../lib/journal.js';
import { telegramNotifier } from '../lib/telegramNotifier.js';
import { validateCollectionPayload } from '../lib/validationAndGuards.js';
import { consumeQuota, recordSecurityIncident } from '../lib/anomalyDetector.js';

const PUBLIC_COLLECTIONS = new Set([
  'lots',
  'developers',
  'market_settings',
  'legal_settings',
  'legal_documents',
  'company_profile',
  'public_channels',
  'platform_settings',
]);

const CLIENT_ISOLATED_COLLECTIONS = new Set([
  'deals',
  'seller_requests',
  'buyer_applications',
  'documents_vault',
  'curator_messages',
  'user_consents',
]);

const STAFF_COLLECTIONS = new Set([
  'candidates',
  'employees',
  'partners',
  'partner_applications',
  'partner_preliminary_requests',
  'investor_applications',
  'deal_messages',
  'escrow_bridge_chats',
  'partner_banks',
  'bank_employees',
  'bank_special_approvals',
]);

const OWNER_ONLY_COLLECTIONS = new Set([
  'audit_logs',
  'security_incidents',
  'users',
]);

function sanitizeLotForPublic(lot: Record<string, any>, authUser: UserProfile | null): Record<string, any> {
  const isOwner = authUser?.role === 'owner';
  const isAssignedStaff =
    authUser?.role === 'employee' &&
    (lot.assignedEmployeeId === authUser.assignedEmployeeId || lot.assignedEmployeeId === authUser.id);
  const isSelfSeller = authUser?.id && lot.sellerId === authUser.id;

  if (isOwner || isAssignedStaff || isSelfSeller) {
    return lot;
  }

  // 152-FZ Privacy Barrier: Redact sensitive seller information for visitors and non-owning clients
  const sanitized = { ...lot };
  delete sanitized.sellerPhone;
  delete sanitized.sellerEmail;
  delete sanitized.sellerInn;
  delete sanitized.apartmentNumber;
  delete sanitized.sellerSubmittedImages;
  delete sanitized.sellerPhotos;
  return sanitized;
}

function applyPaginationAndFilters(
  items: any[],
  query: Record<string, string> | undefined
): { items: any[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean } {
  const q = query || {};
  const page = Math.max(1, parseInt(q['page'] || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q['limit'] || '24', 10) || 24));
  const status = q['status']?.trim()?.toLowerCase();
  const lotCode = q['lotCode']?.trim()?.toLowerCase();
  const city = (q['city'] || q['region'])?.trim()?.toLowerCase();
  const search = q['search']?.trim()?.toLowerCase();
  const sort = q['sort']?.trim()?.toLowerCase();

  let filtered = items;

  if (status) {
    filtered = filtered.filter((item) => String(item.status || '').toLowerCase() === status);
  }
  if (lotCode) {
    filtered = filtered.filter(
      (item) =>
        String(item.lotCode || '').toLowerCase() === lotCode ||
        String(item.id || '').toLowerCase() === lotCode ||
        String(item.code || '').toLowerCase() === lotCode
    );
  }
  if (city) {
    filtered = filtered.filter(
      (item) =>
        String(item.city || '').toLowerCase().includes(city) ||
        String(item.region || '').toLowerCase().includes(city) ||
        String(item.address || '').toLowerCase().includes(city)
    );
  }
  if (search) {
    filtered = filtered.filter((item) => {
      const searchTarget = [
        item.title,
        item.complexName,
        item.developerName,
        item.city,
        item.address,
        item.district,
        item.description,
        item.lotCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchTarget.includes(search);
    });
  }

  if (sort) {
    filtered = [...filtered].sort((a, b) => {
      if (sort === 'price_asc') {
        const pa = Number(a.price ?? a.currentPrice ?? 0);
        const pb = Number(b.price ?? b.currentPrice ?? 0);
        return pa - pb;
      }
      if (sort === 'price_desc') {
        const pa = Number(a.price ?? a.currentPrice ?? 0);
        const pb = Number(b.price ?? b.currentPrice ?? 0);
        return pb - pa;
      }
      if (sort === 'discount_desc') {
        const da = Number(a.discount ?? a.discountPercent ?? a.discountRub ?? 0);
        const db = Number(b.discount ?? b.discountPercent ?? b.discountRub ?? 0);
        return db - da;
      }
      if (sort === 'newest') {
        const ta = a.createdAt || a.publishedAt || a.updatedAt ? new Date(a.createdAt || a.publishedAt || a.updatedAt).getTime() : 0;
        const tb = b.createdAt || b.publishedAt || b.updatedAt ? new Date(b.createdAt || b.publishedAt || b.updatedAt).getTime() : 0;
        return tb - ta;
      }
      return 0;
    });
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedItems = filtered.slice(startIndex, startIndex + limit);
  const hasMore = page < totalPages;

  return {
    items: paginatedItems,
    total,
    page,
    limit,
    totalPages,
    hasMore,
  };
}

export async function handleData(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = event.httpMethod.toUpperCase();
  const ydb = getYdbClient();
  const authUser = await getAuthenticatedUser(event);

  // Check for cascade lot delete: DELETE /api/lots/:lotCode/cascade
  const cascadeMatch = subPath.match(/^\/lots\/([^/]+)\/cascade$/);
  if (cascadeMatch && method === 'DELETE') {
    if (!authUser || authUser.role !== 'owner') {
      return json(event, 403, { error: 'Каскадное удаление доступно только владельцу платформы (owner)' });
    }

    const lotCode = decodeURIComponent(cascadeMatch[1]);
    const cfg = getConfig();

    let deletedDbCount = 0;
    const collectionsToClean = [
      'lots',
      'deals',
      'seller_requests',
      'buyer_applications',
      'candidates',
      'curator_messages',
      'documents_vault',
    ];

    for (const col of collectionsToClean) {
      try {
        const items = await ydb.scanAll(col, 500);
        const toDelete = items.filter(
          (item: any) =>
            item.lotCode === lotCode ||
            item.id === lotCode ||
            item.code === lotCode
        );
        for (const item of toDelete) {
          await ydb.deleteItem(col, item.id);
          deletedDbCount++;
        }
      } catch (err: any) {
        console.warn(`[CascadeDelete] Error cleaning ${col} for ${lotCode}:`, err.message);
      }
    }

    // Invalidate lots cache
    memoryCache.invalidate('lots');

    // Record immutable journal cascade event
    await recordJournalEvent({
      action: 'CASCADE_DELETE',
      collection: 'lots',
      recordId: lotCode,
      actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
      payload: { targetLotCode: lotCode, deletedDbCount },
    });

    // Delete physical files from S3 buckets
    let deletedS3Count = 0;
    try {
      const publicDeleted = await deleteS3ObjectsByPrefix(
        cfg.S3_PUBLIC_BUCKET,
        `photos/${lotCode}/`
      );
      const privateDeleted = await deleteS3ObjectsByPrefix(
        cfg.S3_PRIVATE_BUCKET,
        `documents/${lotCode}/`
      );
      deletedS3Count = publicDeleted + privateDeleted;
    } catch (s3Err: any) {
      console.warn(`[CascadeDelete] S3 deletion error:`, s3Err.message);
    }

    // Write audit log
    try {
      await ydb.putItem('audit_logs', {
        id: `aud-${crypto.randomUUID()}`,
        action: 'CASCADE_DELETE_LOT',
        performedBy: authUser.id,
        userEmail: authUser.email,
        targetLotCode: lotCode,
        deletedDbCount,
        deletedS3Count,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    return json(event, 200, {
      success: true,
      lotCode,
      deletedDbRecords: deletedDbCount,
      deletedS3Objects: deletedS3Count,
    });
  }

  // Parse path: /data/:collection or /data/:collection/:id
  const parts = subPath.replace(/^\/data\/?/, '').split('/').filter(Boolean);
  const collection = parts[0];
  const id = parts[1] ? decodeURIComponent(parts[1]) : undefined;

  if (!collection) {
    return json(event, 400, { error: 'Не указана коллекция' });
  }

  const isPaginated = event.queryStringParameters?.paginated === '1';

  // --- GET Collection or Document ---
  if (method === 'GET') {
    // 1. Owner-only collections
    if (OWNER_ONLY_COLLECTIONS.has(collection)) {
      if (!authUser || authUser.role !== 'owner') {
        return json(event, 401, { error: 'Доступ ограничен владельцем платформы (owner)' });
      }

      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });
        if (collection === 'users') delete item.passwordHash;
        return json(event, 200, { item });
      }

      const all = await ydb.scanAll(collection);
      if (collection === 'users') {
        for (const u of all) delete u.passwordHash;
      }

      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(all, event.queryStringParameters));
      }
      return json(event, 200, { items: all });
    }

    // 2. Staff collections
    if (STAFF_COLLECTIONS.has(collection)) {
      if (!authUser) {
        return json(event, 401, { error: 'Требуется авторизация' });
      }

      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
      const isBankForApprovals =
        authUser.role === 'bank' &&
        (collection === 'bank_special_approvals' || collection === 'partner_banks');

      if (!isStaff && !isBankForApprovals) {
        return json(event, 403, { error: 'Доступ разрешен только сотрудникам платформы' });
      }

      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });
        return json(event, 200, { item });
      }

      const all = await ydb.scanAll(collection);
      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(all, event.queryStringParameters));
      }
      return json(event, 200, { items: all });
    }

    // 3. Client isolated collections
    if (CLIENT_ISOLATED_COLLECTIONS.has(collection)) {
      if (!authUser) {
        return json(event, 401, { error: 'Требуется авторизация' });
      }

      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';

      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });

        if (!isStaff) {
          const isOwnerOfRecord =
            item.userId === authUser.id ||
            item.sellerId === authUser.id ||
            item.buyerId === authUser.id ||
            item.senderId === authUser.id;
          if (!isOwnerOfRecord) {
            return json(event, 403, { error: 'Доступ к чужой записи запрещен' });
          }
        }
        return json(event, 200, { item });
      }

      const all = await ydb.scanAll(collection);
      const visibleItems = isStaff
        ? all
        : all.filter(
            (item: any) =>
              item.userId === authUser.id ||
              item.sellerId === authUser.id ||
              item.buyerId === authUser.id ||
              item.senderId === authUser.id
          );

      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(visibleItems, event.queryStringParameters));
      }
      return json(event, 200, { items: visibleItems });
    }

    // 4. Public collections
    if (PUBLIC_COLLECTIONS.has(collection)) {
      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });

        if (collection === 'lots') {
          return json(event, 200, { item: sanitizeLotForPublic(item, authUser) });
        }
        return json(event, 200, { item });
      }

      // Safe Warm Cache: use cache only for public queries without ?fresh=1, bypassed for staff
      const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';
      const isFresh = event.queryStringParameters?.fresh === '1';

      let all: any[] | null = null;
      if (!isStaff && !isFresh && CACHEABLE_COLLECTIONS.has(collection)) {
        all = memoryCache.get(collection);
      }

      if (!all) {
        all = await ydb.scanAll(collection);
        if (!isStaff && CACHEABLE_COLLECTIONS.has(collection)) {
          memoryCache.set(collection, all);
        }
      }

      if (collection === 'lots') {
        let filtered = all;

        if (!isStaff) {
          const allowedStatuses = new Set([
            'active',
            'available',
            'reserved',
            'in_deal',
            'deal_closing',
            'sold',
          ]);
          filtered = all.filter(
            (lot: any) =>
              (lot.isApproved === true && allowedStatuses.has(lot.status)) ||
              (authUser?.id && lot.sellerId === authUser.id)
          );
        }

        // Apply 152-ФЗ Privacy Barrier AFTER cache retrieval
        const sanitized = filtered.map((lot: any) => sanitizeLotForPublic(lot, authUser));

        if (isPaginated) {
          return json(event, 200, applyPaginationAndFilters(sanitized, event.queryStringParameters));
        }
        return json(event, 200, { items: sanitized });
      }

      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(all, event.queryStringParameters));
      }
      return json(event, 200, { items: all });
    }

    return json(event, 404, { error: `Коллекция ${collection} не поддерживается` });
  }

  // --- POST Create or PUT Update ---
  if (method === 'POST' || method === 'PUT') {
    const body = parseBody<Record<string, any>>(event);
    if (!body) {
      return json(event, 400, { error: 'Тело запроса отсутствует или не в формате JSON' });
    }

    const clientIp = getClientIp(event);
    const isOwner = authUser?.role === 'owner';
    const isStaff = isOwner || authUser?.role === 'employee';
    const actorKey = authUser ? authUser.id : clientIp || 'anonymous';

    // 1. Central Schema Validation, Size Cap & Privilege Tampering Check
    const valResult = await validateCollectionPayload({
      collection,
      payload: body,
      method,
      authUser,
      ydb,
    });

    if (!valResult.valid) {
      if (valResult.incidentType) {
        const sev =
          valResult.incidentType === 'privilege_tampering'
            ? 'critical'
            : valResult.incidentType === 'xss_or_injection_attempt'
            ? 'high'
            : valResult.incidentType === 'chat_contact_leak_attempt'
            ? 'medium'
            : 'low';

        await recordSecurityIncident({
          type: valResult.incidentType,
          severity: sev,
          actorUserId: authUser?.id,
          actorRole: authUser?.role,
          clientIp,
          endpoint: subPath,
          collection,
          summary: valResult.error || 'Ошибка валидации полезной нагрузки',
          details: { collection, method, error: valResult.error },
        });
      }

      return json(event, valResult.statusCode || 400, {
        error: valResult.error || 'Некорректные данные запроса',
        code: valResult.incidentType,
      });
    }

    // 2. Distributed Quota & Rate Limit Enforcement on POST for valid requests
    if (method === 'POST' && !isOwner) {
      // 2a. Buyer Applications
      if (collection === 'buyer_applications') {
        const qDay = await consumeQuota({
          scope: 'buyer_app_day',
          actorKey,
          limit: 5,
          windowSec: 86400,
        });
        if (!qDay.allowed) {
          await recordSecurityIncident({
            type: 'quota_exhaustion_or_spam',
            severity: 'medium',
            actorUserId: authUser?.id,
            actorRole: authUser?.role,
            clientIp,
            endpoint: subPath,
            collection,
            summary: 'Превышена дневная квота подачи заявок покупателя (макс. 5 в сутки)',
          });
          return json(
            event,
            429,
            { error: 'Превышен дневной лимит заявок покупателя (максимум 5 в сутки)', retryAfter: qDay.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qDay.retryAfterSec) } }
          );
        }

        const qHour = await consumeQuota({
          scope: 'buyer_app_hour',
          actorKey,
          limit: 2,
          windowSec: 3600,
        });
        if (!qHour.allowed) {
          await recordSecurityIncident({
            type: 'quota_exhaustion_or_spam',
            severity: 'medium',
            actorUserId: authUser?.id,
            actorRole: authUser?.role,
            clientIp,
            endpoint: subPath,
            collection,
            summary: 'Превышена часовая квота подачи заявок покупателя (макс. 2 в час)',
          });
          return json(
            event,
            429,
            { error: 'Превышен лимит заявок в час (максимум 2 в час)', retryAfter: qHour.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qHour.retryAfterSec) } }
          );
        }
      }

      // 2b. Seller Requests & Lots (Non-Staff)
      if ((collection === 'seller_requests' || collection === 'lots') && !isStaff) {
        const qDay = await consumeQuota({
          scope: 'seller_sub_day',
          actorKey,
          limit: 3,
          windowSec: 86400,
        });
        if (!qDay.allowed) {
          await recordSecurityIncident({
            type: 'quota_exhaustion_or_spam',
            severity: 'medium',
            actorUserId: authUser?.id,
            actorRole: authUser?.role,
            clientIp,
            endpoint: subPath,
            collection,
            summary: 'Превышена дневная квота создания заявок/объектов продавца (макс. 3 в сутки)',
          });
          return json(
            event,
            429,
            { error: 'Превышен лимит создания объектов (максимум 3 в сутки)', retryAfter: qDay.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qDay.retryAfterSec) } }
          );
        }

        const qTen = await consumeQuota({
          scope: 'seller_sub_10m',
          actorKey,
          limit: 1,
          windowSec: 600,
        });
        if (!qTen.allowed) {
          await recordSecurityIncident({
            type: 'quota_exhaustion_or_spam',
            severity: 'medium',
            actorUserId: authUser?.id,
            actorRole: authUser?.role,
            clientIp,
            endpoint: subPath,
            collection,
            summary: 'Превышена частота подачи объектов продавца (макс. 1 за 10 минут)',
          });
          return json(
            event,
            429,
            { error: 'Пожалуйста, подождите 10 минут перед добавлением следующего объекта', retryAfter: qTen.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qTen.retryAfterSec) } }
          );
        }
      }

      // 2c. Partner Preliminary Requests
      if (collection === 'partner_preliminary_requests' && !isStaff) {
        const qDay = await consumeQuota({
          scope: 'partner_pre_day',
          actorKey,
          limit: 10,
          windowSec: 86400,
        });
        if (!qDay.allowed) {
          return json(
            event,
            429,
            { error: 'Превышен дневной лимит фиксации предварительных заявок (максимум 10 в день)', retryAfter: qDay.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qDay.retryAfterSec) } }
          );
        }
      }

      // 2d. Partner & Investor Applications
      if ((collection === 'partner_applications' || collection === 'investor_applications') && !isStaff) {
        const qDay = await consumeQuota({
          scope: 'partner_inv_app_day',
          actorKey,
          limit: 2,
          windowSec: 86400,
        });
        if (!qDay.allowed) {
          return json(
            event,
            429,
            { error: 'Превышен лимит отправки анкет (максимум 2 в день)', retryAfter: qDay.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qDay.retryAfterSec) } }
          );
        }
      }

      // 2e. Curator Messages & Deal Messages (Non-Staff)
      if ((collection === 'curator_messages' || collection === 'deal_messages') && !isStaff) {
        const qMin = await consumeQuota({
          scope: 'chat_msg_min',
          actorKey,
          limit: 15,
          windowSec: 60,
        });
        if (!qMin.allowed) {
          return json(
            event,
            429,
            { error: 'Слишком частая отправка сообщений. Подождите 1 минуту.', retryAfter: qMin.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qMin.retryAfterSec) } }
          );
        }

        const qHour = await consumeQuota({
          scope: 'chat_msg_hour',
          actorKey,
          limit: 150,
          windowSec: 3600,
        });
        if (!qHour.allowed) {
          return json(
            event,
            429,
            { error: 'Превышен часовой лимит сообщений в чате.', retryAfter: qHour.retryAfterSec },
            { extraHeaders: { 'Retry-After': String(qHour.retryAfterSec) } }
          );
        }
      }
    }

    const payloadToSave = valResult.sanitizedPayload || body;
    const docId = id || payloadToSave.id || `doc-${crypto.randomUUID()}`;
    const itemToSave: Record<string, any> = { ...payloadToSave, id: docId };

    // Invalidate cache for this collection
    memoryCache.invalidate(collection);

    // 1. Owner-only collections write
    if (OWNER_ONLY_COLLECTIONS.has(collection)) {
      if (!authUser || authUser.role !== 'owner') {
        return json(event, 403, { error: 'Модификация разрешена только владельцу платформы' });
      }

      if (collection === 'users') {
        let existingUser = await ydb.getItem<any>('users', docId);
        if (!existingUser && itemToSave.email) {
          const byEmail = await ydb.findByField<any>('users', 'email', itemToSave.email.trim().toLowerCase());
          existingUser = byEmail.find((u: any) => Boolean(u.passwordHash)) || byEmail[0];
        }

        if (existingUser) {
          // Strictly protect and preserve passwordHash and critical metadata
          if (!itemToSave.passwordHash && existingUser.passwordHash) {
            itemToSave.passwordHash = existingUser.passwordHash;
          }
          if (!itemToSave.registeredAt && existingUser.registeredAt) {
            itemToSave.registeredAt = existingUser.registeredAt;
          }
          if (!itemToSave.authProvider && existingUser.authProvider) {
            itemToSave.authProvider = existingUser.authProvider;
          }
          if (!itemToSave.roles && existingUser.roles) {
            itemToSave.roles = existingUser.roles;
          }
          if (!itemToSave.role && existingUser.role) {
            itemToSave.role = existingUser.role;
          }
        }
      }

      await ydb.putItem(collection, itemToSave);

      const safeItem = { ...itemToSave };
      if (collection === 'users') {
        delete safeItem.passwordHash;
      }
      return json(event, 200, { success: true, item: safeItem });
    }

    // 2. Staff-only collections write
    if (STAFF_COLLECTIONS.has(collection)) {
      if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });
      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
      if (!isStaff) {
        return json(event, 403, { error: 'Модификация разрешена только сотрудникам платформы' });
      }

      await ydb.putItem(collection, itemToSave);

      // Record immutable journal event if collection is journaled
      await recordJournalEvent({
        action: method === 'POST' ? 'CREATE' : 'UPDATE',
        collection,
        recordId: docId,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: itemToSave,
      });

      // Telegram notifications for staff applications
      if (method === 'POST') {
        if (collection === 'partner_applications') {
          void telegramNotifier.notifyNewPartnerOrInvestor('partner', itemToSave);
        } else if (collection === 'investor_applications') {
          void telegramNotifier.notifyNewPartnerOrInvestor('investor', itemToSave);
        }
      }

      return json(event, 200, { success: true, item: itemToSave });
    }

    // 3. Client isolated collections write
    if (CLIENT_ISOLATED_COLLECTIONS.has(collection)) {
      if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });
      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';

      if (!isStaff) {
        // Enforce user ownership of the document
        itemToSave.userId = authUser.id;
        if (collection === 'seller_requests') itemToSave.sellerId = authUser.id;
        if (collection === 'curator_messages') itemToSave.senderId = authUser.id;
      }

      await ydb.putItem(collection, itemToSave);

      // Record immutable journal event
      await recordJournalEvent({
        action: method === 'POST' ? 'CREATE' : 'UPDATE',
        collection,
        recordId: docId,
        actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
        payload: itemToSave,
      });

      // Telegram notifications and chat bridge
      if (method === 'POST') {
        if (collection === 'seller_requests') {
          void telegramNotifier.notifyNewSellerSubmission(itemToSave);
        } else if (collection === 'buyer_applications' || collection === 'deals') {
          void telegramNotifier.notifyNewBuyerApplication(itemToSave);
        } else if (collection === 'curator_messages') {
          void telegramNotifier.handleWebCuratorMessage({
            lotCode: itemToSave.lotCode,
            dealId: itemToSave.dealId,
            threadChannel: itemToSave.threadChannel || 'seller_curator',
            senderUser: {
              id: authUser.id,
              role: authUser.role,
              name: authUser.name || authUser.email || 'Пользователь',
            },
            text: itemToSave.text || '',
          });
        }
      }

      return json(event, 200, { success: true, item: itemToSave });
    }

    // 4. Public collections write
    if (PUBLIC_COLLECTIONS.has(collection)) {
      const isOwner = authUser?.role === 'owner';
      const isStaff = isOwner || authUser?.role === 'employee';

      // Settings and policies can ONLY be updated by owner
      const isSettingCol =
        collection === 'market_settings' ||
        collection === 'legal_settings' ||
        collection === 'legal_documents' ||
        collection === 'platform_settings' ||
        collection === 'company_profile' ||
        collection === 'public_channels' ||
        collection === 'developers';

      if (isSettingCol && !isOwner) {
        return json(event, 403, { error: 'Изменение настроек платформы доступно только владельцу' });
      }

      // Lots special business logic
      if (collection === 'lots') {
        if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });

        if (!isStaff) {
          // Regular seller submitting a lot: force moderation status and link sellerId
          itemToSave.sellerId = authUser.id;
          itemToSave.isApproved = false;
          itemToSave.status = 'intake_moderation';
          // Disallow modifying curator approved fields
          delete itemToSave.curatorApprovedImages;
          delete itemToSave.legalVerification;
        }

        await ydb.putItem(collection, itemToSave);

        // Record immutable journal event for lots
        await recordJournalEvent({
          action: method === 'POST' ? 'CREATE' : 'UPDATE',
          collection: 'lots',
          recordId: docId,
          actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
          payload: itemToSave,
        });

        // Notify staff on newly submitted lot
        if (method === 'POST') {
          void telegramNotifier.notifyNewSellerSubmission(itemToSave);
        }

        return json(event, 200, { success: true, item: itemToSave });
      }

      await ydb.putItem(collection, itemToSave);
      return json(event, 200, { success: true, item: itemToSave });
    }

    return json(event, 404, { error: `Коллекция ${collection} не найдена` });
  }

  // --- DELETE Document ---
  if (method === 'DELETE') {
    if (!id) return json(event, 400, { error: 'Не указан ID для удаления' });
    if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });

    const isOwner = authUser.role === 'owner';
    const isStaff = isOwner || authUser.role === 'employee';

    // Settings, audit_logs, users require owner
    if (OWNER_ONLY_COLLECTIONS.has(collection) || collection.includes('settings')) {
      if (!isOwner) return json(event, 403, { error: 'Удаление разрешено только владельцу' });
    } else if (!isStaff) {
      return json(event, 403, { error: 'Удаление разрешено только сотрудникам платформы' });
    }

    await ydb.deleteItem(collection, id);

    // Invalidate cache
    memoryCache.invalidate(collection);

    // Record immutable journal event for deletes on sensitive collections
    await recordJournalEvent({
      action: 'DELETE',
      collection,
      recordId: id,
      actor: { userId: authUser.id, role: authUser.role, email: authUser.email },
    });

    // Audit log
    try {
      await ydb.putItem('audit_logs', {
        id: `aud-${crypto.randomUUID()}`,
        action: 'DELETE_ITEM',
        performedBy: authUser.id,
        userEmail: authUser.email,
        targetCollection: collection,
        targetId: id,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    return json(event, 200, { success: true, id, collection });
  }

  return json(event, 405, { error: `Метод ${method} не поддерживается` });
}
