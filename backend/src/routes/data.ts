import crypto from 'node:crypto';
import { UserProfile, YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, notModified, normalizeHeaders, parseBody, getClientIp } from '../lib/http.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getConfig } from '../lib/config.js';
import { deleteS3ObjectsByPrefix } from '../lib/s3Client.js';
import { memoryCache, CACHEABLE_COLLECTIONS } from '../lib/memoryCache.js';
import { appCache, generateETag } from '../lib/cache.js';
import { checkRateLimit } from '../lib/rateLimit.js';
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
  'pep_signatures',
  'buy_boxes',
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

export function sanitizeLotForPublic(lot: Record<string, any>, authUser: UserProfile | null): Record<string, any> {
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

export function projectLotForCard(lot: Record<string, any>): Record<string, any> {
  const rawPhotos = Array.isArray(lot.curatorApprovedImages) && lot.curatorApprovedImages.length > 0
    ? lot.curatorApprovedImages
    : Array.isArray(lot.approvedGalleryImages) && lot.approvedGalleryImages.length > 0
    ? lot.approvedGalleryImages
    : Array.isArray(lot.photos) && lot.photos.length > 0
    ? lot.photos
    : Array.isArray(lot.images) && lot.images.length > 0
    ? lot.images
    : [];

  const photos = rawPhotos.slice(0, 4);
  const images = rawPhotos.slice(0, 3);
  const imageUrl = lot.imageUrl || rawPhotos[0] || '';

  const areaM2 = lot.areaM2 ?? lot.area ?? 0;
  const totalFloors = lot.totalFloors ?? lot.floorsTotal ?? 0;
  const cashPaidBySeller = lot.cashPaidBySeller ?? lot.sellerReturnRub ?? lot.price ?? 0;
  const dduContractPrice = lot.dduContractPrice ?? lot.oldPrice ?? 0;
  const todayDeveloperPrice = lot.todayDeveloperPrice ?? lot.currentPrice ?? lot.price ?? 0;
  const remainingInstallmentDebt =
    lot.remainingInstallmentDebt ?? Math.max(0, dduContractPrice - cashPaidBySeller);

  const deliveryDate =
    lot.deliveryDate ||
    lot.deadline ||
    (lot.completionQuarter && lot.completionYear
      ? `${lot.completionQuarter} кв. ${lot.completionYear} г.`
      : lot.completionYear
      ? `${lot.completionYear} г.`
      : '');

  const metroName =
    lot.metro ||
    (Array.isArray(lot.metroStations) && lot.metroStations[0]?.name) ||
    '';
  const metroTime =
    lot.metroTime ||
    (Array.isArray(lot.metroStations) && lot.metroStations[0]?.travelTimeText) ||
    '';
  const metroAccessType =
    lot.metroAccessType ||
    (Array.isArray(lot.metroStations) && lot.metroStations[0]?.mode) ||
    'walk';

  const discountRub =
    lot.discountRub ?? Math.max(0, todayDeveloperPrice - dduContractPrice);
  const discountPercent =
    lot.discountPercent ??
    lot.discount ??
    (todayDeveloperPrice > 0 ? Math.round((discountRub / todayDeveloperPrice) * 100) : 0);

  return {
    id: lot.id,
    lotCode: lot.lotCode || lot.code || lot.id,
    code: lot.code || lot.lotCode || lot.id,
    title: lot.title || lot.complexName || 'Лот DomExit',
    description: lot.description ? String(lot.description).slice(0, 200) : '',
    propertyType: lot.propertyType || 'apartment',
    rooms: lot.rooms || '1-room',
    floor: lot.floor ?? 0,
    floorsTotal: totalFloors,
    totalFloors,
    floorRange: lot.floorRange || lot.ownerDossier?.floorRangeDisplay || '',
    ownerDossier: lot.ownerDossier
      ? {
          hideExactFloor: Boolean(lot.ownerDossier.hideExactFloor),
          floorRangeDisplay: lot.ownerDossier.floorRangeDisplay || '',
        }
      : undefined,
    area: areaM2,
    areaM2,
    livingArea: lot.livingArea,
    kitchenArea: lot.kitchenArea,
    price: cashPaidBySeller,
    currentPrice: todayDeveloperPrice,
    oldPrice: dduContractPrice,
    dduContractPrice,
    cashPaidBySeller,
    sellerReturnRub: cashPaidBySeller,
    todayDeveloperPrice,
    remainingInstallmentDebt,
    serviceCommissionRate: lot.serviceCommissionRate ?? 2.5,
    serviceCommissionRub:
      lot.serviceCommissionRub ?? Math.round((dduContractPrice || cashPaidBySeller) * 0.025),
    developerConsentFeeRub: lot.developerConsentFeeRub ?? 0,
    developerConsentPolicy: lot.developerConsentPolicy || 'included_in_platform_fee',
    discount: discountPercent,
    discountPercent,
    discountRub,
    city: lot.city || 'spb',
    region: lot.region || 'spb',
    district: lot.district || '',
    address: lot.address || lot.streetAddress || '',
    streetAddress: lot.streetAddress || lot.address || '',
    complexName: lot.complexName || lot.housingComplex || '',
    housingComplex: lot.housingComplex || lot.complexName || '',
    developer: lot.developer || lot.developerName || '',
    developerName: lot.developerName || lot.developer || '',
    developerInn: lot.developerInn || '',
    deadline: deliveryDate,
    deliveryDate,
    completionYear: lot.completionYear || lot.deliveryYear,
    deliveryYear: lot.deliveryYear || lot.completionYear,
    completionQuarter: lot.completionQuarter,
    renovation: lot.renovation,
    metro: metroName,
    metroTime,
    metroAccessType,
    metroStations: Array.isArray(lot.metroStations) ? lot.metroStations.slice(0, 2) : [],
    escrowBank: lot.escrowBank || 'Сбербанк',
    coordinates: lot.coordinates,
    imageUrl,
    images,
    photos,
    curatorApprovedImages: photos,
    approvedGalleryImages: images,
    tags: lot.tags || [],
    badges: lot.badges || [],
    status: lot.status || 'available',
    approvalStatus: lot.approvalStatus || 'approved',
    isApproved: Boolean(lot.isApproved ?? (lot.approvalStatus === 'approved')),
    isPublished: Boolean(lot.isPublished ?? (lot.status === 'available' || lot.status === 'in_deal')),
    isUrgentExit: Boolean(lot.isUrgentExit),
    isFeatured: Boolean(lot.isFeatured),
    isVerified: Boolean(lot.isVerified),
    isNegotiable: Boolean(lot.isNegotiable || lot.is_negotiable),
    is_negotiable: Boolean(lot.is_negotiable || lot.isNegotiable),
    currentStage: lot.currentStage ?? 3,
    dropConfig: lot.dropConfig,
    publishedAt: lot.publishedAt,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
    assignedEmployeeId: lot.assignedEmployeeId,
  };
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    return Math.max(0, parseInt(parsed.offset, 10) || 0);
  } catch {
    return 0;
  }
}

function applyPaginationAndFilters(
  items: any[],
  query: Record<string, string> | undefined
): { items: any[]; total: number; page: number; limit: number; totalPages: number; hasMore: boolean } {
  const q = query || {};
  const page = Math.max(1, parseInt(q['page'] || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q['limit'] || '25', 10) || 25));
  const status = q['status']?.trim()?.toLowerCase();
  const category = q['category']?.trim()?.toLowerCase();
  const role = q['role']?.trim()?.toLowerCase();
  const lotCode = q['lotCode']?.trim()?.toLowerCase();
  const city = (q['city'] || q['region'])?.trim()?.toLowerCase();
  const search = q['search']?.trim()?.toLowerCase();
  const sort = q['sort']?.trim()?.toLowerCase();

  let filtered = items;

  if (category) {
    filtered = filtered.filter((item) => String(item.category || '').toLowerCase() === category);
  }
  if (status) {
    filtered = filtered.filter((item) => String(item.status || '').toLowerCase() === status);
  }
  if (role) {
    filtered = filtered.filter((item) => {
      const itemRole = String(item.role || '').toLowerCase();
      const roles = Array.isArray(item.roles) ? item.roles.map((r: any) => String(r).toLowerCase()) : [];
      return itemRole === role || roles.includes(role);
    });
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
        item.name,
        item.email,
        item.phone,
        item.clientCode,
        item.inn,
        item.developerInn,
        item.clientInn,
        item.id,
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
  const cfg = getConfig();
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
    appCache.invalidatePrefix('lots');
    appCache.invalidatePrefix('lot:');

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
  const id = parts[1]
    ? decodeURIComponent(parts[1])
    : event.queryStringParameters?.id
    ? decodeURIComponent(event.queryStringParameters.id)
    : undefined;

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

    // 2. Staff collections (with accredited partner access to own partner records & preliminary requests)
    if (STAFF_COLLECTIONS.has(collection)) {
      if (!authUser) {
        return json(event, 401, { error: 'Требуется авторизация' });
      }

      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
      const isPartner = Boolean(
        authUser.isPartnerApproved ||
        authUser.roles?.includes('partner') ||
        authUser.role === 'partner' ||
        authUser.activeRole === 'partner'
      );

      const isPartnerAllowedCol =
        collection === 'partners' ||
        collection === 'partner_applications' ||
        collection === 'partner_preliminary_requests';

      if (!isStaff && (!isPartner || !isPartnerAllowedCol)) {
        return json(event, 403, { error: 'Доступ разрешен только сотрудникам платформы' });
      }

      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });

        if (!isStaff && isPartner) {
          const cleanEmail = (authUser.email || '').trim().toLowerCase();
          const partnerId = authUser.partnerId || authUser.id;
          const partnerRef = authUser.partnerRefCode || authUser.referralCode;

          if (collection === 'partners' || collection === 'partner_applications') {
            const isSelf =
              item.userId === authUser.id ||
              item.uid === authUser.id ||
              (cleanEmail && item.email?.trim().toLowerCase() === cleanEmail) ||
              item.id === partnerId ||
              item.referralCode === partnerRef;
            if (!isSelf) return json(event, 403, { error: 'Доступ к чужой партнерской записи запрещен' });
          } else if (collection === 'partner_preliminary_requests') {
            const isMyRequest =
              item.partnerId === authUser.id ||
              item.partnerId === partnerId ||
              item.userId === authUser.id ||
              (partnerRef && item.partnerRefCode === partnerRef);
            if (!isMyRequest) return json(event, 403, { error: 'Доступ к чужой брони запрещен' });
          }
        }

        return json(event, 200, { item });
      }

      const all = await ydb.scanAll(collection);
      let visibleItems = all;

      if (!isStaff && isPartner) {
        const cleanEmail = (authUser.email || '').trim().toLowerCase();
        const partnerId = authUser.partnerId || authUser.id;
        const partnerRef = authUser.partnerRefCode || authUser.referralCode;

        if (collection === 'partners' || collection === 'partner_applications') {
          visibleItems = all.filter((item: any) =>
            item.userId === authUser.id ||
            item.uid === authUser.id ||
            (cleanEmail && item.email?.trim().toLowerCase() === cleanEmail) ||
            item.id === partnerId ||
            item.referralCode === partnerRef
          );
        } else if (collection === 'partner_preliminary_requests') {
          visibleItems = all.filter((item: any) =>
            item.partnerId === authUser.id ||
            item.partnerId === partnerId ||
            item.userId === authUser.id ||
            (partnerRef && item.partnerRefCode === partnerRef)
          );
        }
      }

      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(visibleItems, event.queryStringParameters));
      }
      return json(event, 200, { items: visibleItems });
    }

    // 3. Client isolated collections (with partner deal & request attribution)
    if (CLIENT_ISOLATED_COLLECTIONS.has(collection)) {
      if (!authUser) {
        return json(event, 401, { error: 'Требуется авторизация' });
      }

      const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
      const isPartner = Boolean(
        authUser.isPartnerApproved ||
        authUser.roles?.includes('partner') ||
        authUser.role === 'partner' ||
        authUser.activeRole === 'partner'
      );
      const partnerRef = authUser.partnerRefCode || authUser.referralCode;
      const partnerId = authUser.partnerId || authUser.id;

      if (id) {
        const item = await ydb.getItem(collection, id);
        if (!item) return json(event, 404, { error: 'Запись не найдена' });

        if (!isStaff) {
          const isOwnerOfRecord =
            item.userId === authUser.id ||
            item.sellerId === authUser.id ||
            item.buyerId === authUser.id ||
            item.senderId === authUser.id;

          const isPartnerOfRecord = isPartner && (
            (partnerRef && (
              item.partnerRefCode?.toUpperCase() === partnerRef.toUpperCase() ||
              item.referredByPartnerCode?.toUpperCase() === partnerRef.toUpperCase()
            )) ||
            (partnerId && (
              item.partnerId === partnerId ||
              item.referredByPartnerId === partnerId
            ))
          );

          if (!isOwnerOfRecord && !isPartnerOfRecord) {
            return json(event, 403, { error: 'Доступ к чужой записи запрещен' });
          }
        }
        return json(event, 200, { item });
      }

      const all = await ydb.scanAll(collection);
      const visibleItems = isStaff
        ? all
        : all.filter((item: any) => {
            const isOwnerOfRecord =
              item.userId === authUser.id ||
              item.sellerId === authUser.id ||
              item.buyerId === authUser.id ||
              item.senderId === authUser.id;
            if (isOwnerOfRecord) return true;

            if (isPartner) {
              const isPartnerOfRecord =
                (partnerRef && (
                  item.partnerRefCode?.toUpperCase() === partnerRef.toUpperCase() ||
                  item.referredByPartnerCode?.toUpperCase() === partnerRef.toUpperCase()
                )) ||
                (partnerId && (
                  item.partnerId === partnerId ||
                  item.referredByPartnerId === partnerId
                ));
              if (isPartnerOfRecord) return true;
            }
            return false;
          });

      if (isPaginated) {
        return json(event, 200, applyPaginationAndFilters(visibleItems, event.queryStringParameters));
      }
      return json(event, 200, { items: visibleItems });
    }

    // 4. Public collections
    if (PUBLIC_COLLECTIONS.has(collection)) {
      const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';
      const isFresh = event.queryStringParameters?.fresh === '1';
      const ifNoneMatch = normalizeHeaders(event.headers, event.multiValueHeaders)['if-none-match'];

      if (id) {
        let item = await ydb.getItem(collection, id);
        if (!item && collection === 'lots') {
          // Fallback: search by lotCode or id case-insensitively
          const allLots = await ydb.scanAll('lots');
          const target = id.trim().toUpperCase();
          item = (allLots || []).find(
            (l: any) =>
              (l.lotCode && String(l.lotCode).trim().toUpperCase() === target) ||
              (l.id && String(l.id).trim().toUpperCase() === target)
          );
        }
        if (!item) return json(event, 404, { error: 'Запись не найдена' });

        if (collection === 'lots') {
          if (!isStaff) {
            const allowedStatuses = new Set([
              'active',
              'available',
              'reserved',
              'in_deal',
              'deal_closing',
              'sold',
            ]);
            const isApproved =
              item.isApproved === true ||
              item.isPublished === true ||
              item.approvalStatus === 'approved';
            const isAllowedStatus = allowedStatuses.has(item.status);
            const isSeller = authUser?.id && item.sellerId === authUser.id;
            if ((!isApproved || !isAllowedStatus) && !isSeller) {
              return json(event, 404, { error: 'Объект не найден или снят с публикации' });
            }

            // Public LRU cache for individual lot details (60s TTL)
            const cacheKey = `lot:public:${id}`;
            const cached = appCache.getWithMeta(cacheKey);
            const cacheHeaders = {
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
              'ETag': cached?.etag || generateETag(item),
              'X-Cache': cached ? 'HIT' : 'MISS',
            };

            if (cached && ifNoneMatch && ifNoneMatch === cached.etag) {
              return notModified(event, cacheHeaders);
            }

            const sanitizedItem = sanitizeLotForPublic(item, authUser);
            if (!cached) {
              appCache.set(cacheKey, sanitizedItem, 60000, cacheHeaders.ETag);
            }

            return json(event, 200, { item: cached ? cached.data : sanitizedItem }, {
              extraHeaders: cacheHeaders,
            });
          }
          return json(event, 200, { item: sanitizeLotForPublic(item, authUser) }, {
            extraHeaders: { 'Cache-Control': 'private, no-store' },
          });
        }
        return json(event, 200, { item });
      }

      // Safe Warm Cache: use cache only for public queries without ?fresh=1, bypassed for staff
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
        const cursor = event.queryStringParameters?.cursor;
        const pageStr = event.queryStringParameters?.page;
        const limit = Math.min(50, Math.max(1, parseInt(event.queryStringParameters?.limit || '12', 10) || 12));
        const fields = event.queryStringParameters?.fields; // 'card' or 'full'

        // Check if query is default Page 1 catalog query (unauthenticated/visitor, default params)
        const isDefaultPage1 =
          !isStaff &&
          !isFresh &&
          (!cursor || cursor === '0') &&
          (!pageStr || pageStr === '1') &&
          !event.queryStringParameters?.search &&
          !event.queryStringParameters?.city &&
          !event.queryStringParameters?.region &&
          !event.queryStringParameters?.district &&
          !event.queryStringParameters?.status &&
          !event.queryStringParameters?.developer &&
          !event.queryStringParameters?.rooms &&
          !event.queryStringParameters?.priceMin &&
          !event.queryStringParameters?.priceMax &&
          (!event.queryStringParameters?.sort || event.queryStringParameters?.sort === 'newest');

        const cacheKey = `lots:catalog:p1:${fields || 'card'}:${limit}`;

        if (isDefaultPage1) {
          const cached = appCache.getWithMeta(cacheKey);
          if (cached) {
            const cacheHeaders = {
              'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
              'ETag': cached.etag || '',
              'X-Cache': 'HIT',
            };
            if (ifNoneMatch && ifNoneMatch === cached.etag) {
              return notModified(event, cacheHeaders);
            }
            return json(event, 200, cached.data, { extraHeaders: cacheHeaders });
          }
        }

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
              ((lot.isApproved === true || lot.isPublished === true || lot.approvalStatus === 'approved') && allowedStatuses.has(lot.status)) ||
              (authUser?.id && lot.sellerId === authUser.id)
          );
        }

        // Apply 152-ФЗ Privacy Barrier AFTER cache retrieval
        const sanitized = filtered.map((lot: any) => sanitizeLotForPublic(lot, authUser));

        // Apply filters & sort
        const q = event.queryStringParameters || {};
        let matching = sanitized;
        const statusFilter = q['status']?.trim()?.toLowerCase();
        const lotCodeFilter = q['lotCode']?.trim()?.toLowerCase();
        const locationFilter = (q['city'] || q['region'] || q['district'])?.trim()?.toLowerCase();
        const developerFilter = q['developer']?.trim()?.toLowerCase();
        const roomsFilter = q['rooms']?.trim()?.toLowerCase();
        const priceMin = q['priceMin'] ? Number(q['priceMin']) : undefined;
        const priceMax = q['priceMax'] ? Number(q['priceMax']) : undefined;
        const searchFilter = q['search']?.trim()?.toLowerCase();
        const sortFilter = q['sort']?.trim()?.toLowerCase();

        if (statusFilter) {
          matching = matching.filter((l: any) => String(l.status || '').toLowerCase() === statusFilter);
        }
        if (lotCodeFilter) {
          matching = matching.filter(
            (l: any) =>
              String(l.lotCode || '').toLowerCase() === lotCodeFilter ||
              String(l.code || '').toLowerCase() === lotCodeFilter ||
              String(l.id || '').toLowerCase() === lotCodeFilter
          );
        }
        if (locationFilter) {
          matching = matching.filter(
            (l: any) =>
              String(l.city || '').toLowerCase().includes(locationFilter) ||
              String(l.region || '').toLowerCase().includes(locationFilter) ||
              String(l.district || '').toLowerCase().includes(locationFilter) ||
              String(l.address || '').toLowerCase().includes(locationFilter)
          );
        }
        if (developerFilter) {
          matching = matching.filter(
            (l: any) =>
              String(l.developer || '').toLowerCase().includes(developerFilter) ||
              String(l.developerName || '').toLowerCase().includes(developerFilter) ||
              String(l.developerInn || '').includes(developerFilter)
          );
        }
        if (roomsFilter) {
          matching = matching.filter((l: any) => {
            if (roomsFilter === 'studio') return String(l.rooms || '').toLowerCase().includes('ст') || l.rooms === 0 || l.rooms === '0';
            return String(l.rooms) === roomsFilter;
          });
        }
        if (priceMin !== undefined && !isNaN(priceMin)) {
          matching = matching.filter((l: any) => (l.price ?? l.currentPrice ?? 0) >= priceMin);
        }
        if (priceMax !== undefined && !isNaN(priceMax)) {
          matching = matching.filter((l: any) => (l.price ?? l.currentPrice ?? 0) <= priceMax);
        }
        if (searchFilter) {
          matching = matching.filter((l: any) => {
            const str = [
              l.title,
              l.complexName,
              l.housingComplex,
              l.developerName,
              l.city,
              l.address,
              l.district,
              l.description,
              l.lotCode,
              l.code,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return str.includes(searchFilter);
          });
        }

        // Sorting
        if (sortFilter) {
          matching = [...matching].sort((a: any, b: any) => {
            if (sortFilter === 'price_asc') {
              return (Number(a.price ?? a.currentPrice ?? 0)) - (Number(b.price ?? b.currentPrice ?? 0));
            }
            if (sortFilter === 'price_desc') {
              return (Number(b.price ?? b.currentPrice ?? 0)) - (Number(a.price ?? a.currentPrice ?? 0));
            }
            if (sortFilter === 'discount_desc') {
              const da = Number(a.discount ?? a.discountPercent ?? a.discountRub ?? 0);
              const db = Number(b.discount ?? b.discountPercent ?? b.discountRub ?? 0);
              return db - da;
            }
            if (sortFilter === 'newest') {
              const ta = a.createdAt || a.publishedAt || a.updatedAt ? new Date(a.createdAt || a.publishedAt || a.updatedAt).getTime() : 0;
              const tb = b.createdAt || b.publishedAt || b.updatedAt ? new Date(b.createdAt || b.publishedAt || b.updatedAt).getTime() : 0;
              return tb - ta;
            }
            return 0;
          });
        }

        const totalMatching = matching.length;
        const stats = {
          totalCount: totalMatching,
          activeCount: matching.filter((l: any) => l.status === 'active' || l.status === 'available').length,
        };

        let offset = 0;
        if (cursor !== undefined) {
          offset = decodeCursor(cursor);
        } else if (pageStr) {
          const pageNum = Math.max(1, parseInt(pageStr, 10) || 1);
          offset = (pageNum - 1) * limit;
        }

        const sliced = matching.slice(offset, offset + limit);
        const finalItems = fields === 'card' ? sliced.map(projectLotForCard) : sliced;
        const hasMore = offset + limit < totalMatching;
        const nextCursor = hasMore ? encodeCursor(offset + limit) : null;

        let responsePayload: any;
        if (cursor !== undefined || (isPaginated && fields === 'card')) {
          responsePayload = {
            items: finalItems,
            nextCursor,
            hasMore,
            totalMatching,
            stats,
          };
        } else if (pageStr) {
          const pageNum = Math.max(1, parseInt(pageStr, 10) || 1);
          responsePayload = {
            items: finalItems,
            total: totalMatching,
            page: pageNum,
            limit,
            totalPages: Math.ceil(totalMatching / limit) || 1,
            hasMore,
          };
        } else if (isPaginated) {
          responsePayload = {
            items: finalItems,
            nextCursor,
            hasMore,
            totalMatching,
            total: totalMatching,
            page: 1,
            limit,
            totalPages: Math.ceil(totalMatching / limit) || 1,
            stats,
          };
        } else {
          // Backward compatible safety cap (max 100)
          responsePayload = {
            items: sanitized.slice(0, 100),
          };
        }

        const etag = generateETag(responsePayload);
        const cacheControl = isStaff ? 'private, no-store' : 'public, max-age=30, stale-while-revalidate=60';
        const headers: Record<string, string> = {
          'Cache-Control': cacheControl,
          'ETag': etag,
          'X-Cache': isDefaultPage1 ? 'MISS' : 'BYPASS',
        };

        if (isDefaultPage1) {
          appCache.set(cacheKey, responsePayload, 60000, etag);
        }

        if (!isStaff && ifNoneMatch && ifNoneMatch === etag) {
          return notModified(event, headers);
        }

        return json(event, 200, responsePayload, { extraHeaders: headers });
      }

      if (collection === 'developers') {
        const etag = generateETag(all);
        const cacheControl = isStaff ? 'private, no-store' : 'public, max-age=60, stale-while-revalidate=120';
        const headers: Record<string, string> = {
          'Cache-Control': cacheControl,
          'ETag': etag,
          'X-Cache': 'MISS',
        };

        if (!isStaff && ifNoneMatch && ifNoneMatch === etag) {
          return notModified(event, headers);
        }

        if (!isStaff) {
          appCache.set('developers:all', all, 300000, etag);
        }

        const resp = isPaginated ? applyPaginationAndFilters(all, event.queryStringParameters) : { items: all };
        return json(event, 200, resp, { extraHeaders: headers });
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
    // Unauthenticated PUT requests should be rejected immediately before privilege tampering checks
    if (method === 'PUT' && !authUser) {
      return json(event, 401, { error: 'Требуется авторизация для изменения данных' });
    }

    if (collection === 'pep_signatures') {
      return json(event, 403, {
        error: 'Прямая модификация pep_signatures запрещена. Используйте /api/pep/verify-and-sign',
      });
    }

    const body = parseBody<Record<string, any>>(event);
    if (!body) {
      return json(event, 400, { error: 'Тело запроса отсутствует или не в формате JSON' });
    }

    const clientIp = getClientIp(event);

    // Rate Limiting on public submission endpoints (15 submissions / 15 min per IP)
    if (
      method === 'POST' &&
      (collection === 'seller_requests' ||
        collection === 'investor_applications' ||
        collection === 'partner_preliminary_requests' ||
        collection === 'partner_applications')
    ) {
      const rateCheck = checkRateLimit(event, {
        scope: `submit_${collection}`,
        limit: 15,
        windowSec: 900,
        customMessageRu: 'Превышен лимит создания заявок. Пожалуйста, подождите 15 минут.',
      });
      if (!rateCheck.allowed) return rateCheck.response!;
    }

    const isOwner = authUser?.role === 'owner';
    const isStaff = isOwner || authUser?.role === 'employee';
    const isStaging = cfg.APP_ENV === 'staging';
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
          category: 'waf_security_event',
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
          limit: isStaging ? 100 : 5,
          windowSec: isStaging ? 60 : 86400,
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
          limit: isStaging ? 100 : 2,
          windowSec: isStaging ? 60 : 3600,
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
          limit: isStaging ? 100 : 3,
          windowSec: isStaging ? 60 : 86400,
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
          limit: isStaging ? 100 : 1,
          windowSec: isStaging ? 1 : 600,
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
          limit: isStaging ? 100 : 10,
          windowSec: isStaging ? 60 : 86400,
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
          limit: isStaging ? 100 : 2,
          windowSec: isStaging ? 60 : 86400,
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
    appCache.invalidatePrefix(collection);
    if (collection === 'lots') {
      appCache.invalidatePrefix('lot:');
    }

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

    // 2. Staff-only collections write (with partner applications & reservations allowed for clients/partners)
    if (STAFF_COLLECTIONS.has(collection)) {
      const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';
      const isPartner = Boolean(
        authUser?.isPartnerApproved ||
        authUser?.roles?.includes('partner') ||
        authUser?.role === 'partner' ||
        authUser?.activeRole === 'partner'
      );

      // Check non-staff submissions:
      // a) partner_applications / partners: allow non-staff (including public visitors) to submit pending applications
      if (!isStaff && (collection === 'partner_applications' || collection === 'partners')) {
        itemToSave.status = 'pending';
        itemToSave.isApproved = false;
        delete itemToSave.approvedAt;
        delete itemToSave.approvedBy;
        delete itemToSave.fixedRewardPerDealRub;
        itemToSave.userId = authUser ? authUser.id : (itemToSave.userId || `guest-${crypto.randomUUID().substring(0, 8)}`);
        itemToSave.uid = itemToSave.userId;
        if (!itemToSave.email && authUser?.email) itemToSave.email = authUser.email;
        if (!itemToSave.referralCode) {
          itemToSave.referralCode = `PART-${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }
      // b) partner_preliminary_requests: allow accredited partner to submit 7-day preliminary request
      else if (!isStaff && collection === 'partner_preliminary_requests') {
        if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });
        if (!isPartner) {
          return json(event, 403, { error: 'Фиксация клиентов доступна только аккредитованным партнерам' });
        }
        itemToSave.partnerId = authUser.id;
        itemToSave.partnerRefCode = authUser.partnerRefCode || authUser.referralCode || itemToSave.partnerRefCode || 'PART-0000';
        itemToSave.status = 'pending_client';
        itemToSave.fixedRewardPerDealRub = 30000;
        itemToSave.expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      }
      // c) other staff collections or non-partner: block non-staff
      else if (!isStaff) {
        if (!authUser) return json(event, 401, { error: 'Требуется авторизация' });
        return json(event, 403, { error: 'Модификация разрешена только сотрудникам платформы' });
      }

      // If staff is approving a partner in partners or partner_applications:
      if (isStaff && (collection === 'partners' || collection === 'partner_applications')) {
        if (itemToSave.status === 'approved' || itemToSave.isApproved === true) {
          itemToSave.isApproved = true;
          itemToSave.status = 'approved';
          itemToSave.fixedRewardPerDealRub = 30000;
          if (!itemToSave.referralCode || !itemToSave.referralCode.startsWith('PART-')) {
            itemToSave.referralCode = `PART-${Math.floor(1000 + Math.random() * 9000)}`;
          }
          itemToSave.approvedAt = new Date().toISOString();
          itemToSave.approvedBy = authUser.email || authUser.name || 'owner';

          // Atomic upgrade of matching user in users table while strictly preserving passwordHash
          try {
            let targetUser: UserProfile | null = null;
            if (itemToSave.userId || itemToSave.uid) {
              targetUser = await ydb.getItem<UserProfile>('users', itemToSave.userId || itemToSave.uid);
            }
            if (!targetUser && itemToSave.email) {
              const usersByEmail = await ydb.findByField<UserProfile>('users', 'email', itemToSave.email.trim().toLowerCase());
              targetUser = usersByEmail[0] || null;
            }
            if (!targetUser && itemToSave.clientCode) {
              const usersByCode = await ydb.findByField<UserProfile>('users', 'clientCode', itemToSave.clientCode);
              targetUser = usersByCode[0] || null;
            }

            if (targetUser) {
              targetUser.isPartnerApproved = true;
              targetUser.partnerId = itemToSave.id;
              targetUser.partnerRefCode = itemToSave.referralCode;
              targetUser.referralCode = itemToSave.referralCode;
              if (!targetUser.roles) targetUser.roles = [targetUser.role];
              if (!targetUser.roles.includes('partner')) {
                targetUser.roles.push('partner');
              }
              // STRICTLY preserve passwordHash!
              await ydb.putItem('users', targetUser);
            }
          } catch (uErr) {
            console.warn('[data] Non-fatal user role update on partner approval:', uErr);
          }
        }
      }

      await ydb.putItem(collection, itemToSave);

      // Record immutable journal event if collection is journaled
      await recordJournalEvent({
        action: method === 'POST' ? 'CREATE' : 'UPDATE',
        collection,
        recordId: docId,
        actor: {
          userId: authUser ? authUser.id : (itemToSave.userId || 'guest'),
          role: authUser ? authUser.role : 'guest',
          email: authUser?.email || itemToSave.email,
        },
        payload: itemToSave,
      });

      // Telegram notifications for staff applications
      if (method === 'POST') {
        if (collection === 'partner_applications' || collection === 'partners') {
          void telegramNotifier.notifyNewPartnerOrInvestor('partner', itemToSave);
        } else if (collection === 'investor_applications') {
          void telegramNotifier.notifyNewPartnerOrInvestor('investor', itemToSave);
        }
      }

      return json(event, 200, { success: true, item: itemToSave });
    }

    // 3. Client isolated collections write
    if (CLIENT_ISOLATED_COLLECTIONS.has(collection)) {
      if (!authUser && collection !== 'seller_requests') {
        return json(event, 401, { error: 'Требуется авторизация' });
      }
      const isStaff = authUser?.role === 'owner' || authUser?.role === 'employee';

      if (!isStaff) {
        // Enforce user ownership of the document
        if (authUser) {
          itemToSave.userId = authUser.id;
          if (collection === 'seller_requests') itemToSave.sellerId = authUser.id;
          if (collection === 'curator_messages') itemToSave.senderId = authUser.id;
        } else {
          itemToSave.userId = itemToSave.userId || `guest-${crypto.randomUUID().substring(0, 8)}`;
          if (collection === 'seller_requests') itemToSave.sellerId = itemToSave.userId;
        }
      }

      // Auto-match preliminary requests on seller_requests submission
      if (collection === 'seller_requests') {
        if (!itemToSave.partnerRefCode && itemToSave.referredByPartnerCode) {
          itemToSave.partnerRefCode = itemToSave.referredByPartnerCode;
        }
        if (!itemToSave.partnerRefCode) {
          try {
            const sellerPhoneDigits = (itemToSave.sellerPhone || itemToSave.phone || '').replace(/\D/g, '');
            if (sellerPhoneDigits.length >= 10) {
              const last10 = sellerPhoneDigits.slice(-10);
              const allPre = await ydb.scanAll<any>('partner_preliminary_requests');
              const nowMs = Date.now();
              const activeMatch = allPre.find((p: any) => {
                if (p.status === 'expired' || p.status === 'converted_to_lot') return false;
                if (new Date(p.expiresAt).getTime() < nowMs) return false;
                const preDigits = (p.clientPhone || '').replace(/\D/g, '');
                return preDigits.length >= 10 && preDigits.slice(-10) === last10;
              });

              if (activeMatch) {
                itemToSave.partnerId = activeMatch.partnerId;
                itemToSave.partnerRefCode = activeMatch.partnerRefCode;
                itemToSave.referredByPartnerCode = activeMatch.partnerRefCode;
                activeMatch.status = 'converted_to_lot';
                activeMatch.activatedLotCode = itemToSave.lotCode || itemToSave.id;
                activeMatch.activatedAt = new Date().toISOString();
                await ydb.putItem('partner_preliminary_requests', activeMatch);
              }
            }
          } catch (mErr) {
            console.warn('[data] Non-fatal preliminary request matching in seller_requests:', mErr);
          }
        }
      }

      // When deals completed, ensure partner commission is payable
      if (collection === 'deals') {
        if (itemToSave.stage === 'completed' || itemToSave.status === 'completed' || itemToSave.status === 'sold') {
          if (itemToSave.partnerRefCode || itemToSave.partnerId) {
            itemToSave.partnerPayoutStatus = 'payable';
            itemToSave.partnerRewardRub = 30000;
          }
        }
      }

      await ydb.putItem(collection, itemToSave);

      // Record immutable journal event
      await recordJournalEvent({
        action: method === 'POST' ? 'CREATE' : 'UPDATE',
        collection,
        recordId: docId,
        actor: {
          userId: authUser ? authUser.id : (itemToSave.userId || 'guest'),
          role: authUser ? authUser.role : 'guest',
          email: authUser?.email || itemToSave.sellerEmail || itemToSave.email,
        },
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
              id: authUser?.id || itemToSave.senderId || 'guest',
              role: authUser?.role || 'buyer',
              name: authUser?.name || authUser?.email || 'Пользователь',
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

        // Backend State Guards for Lots:
        // Publishing or setting available or advancing to Stage 3+ strictly requires verified legal audit and complete packaging
        if (
          itemToSave.isPublished === true ||
          itemToSave.status === 'available' ||
          (itemToSave.currentStage !== undefined && Number(itemToSave.currentStage) >= 3)
        ) {
          const isLegallyApproved =
            itemToSave.isVerified === true ||
            itemToSave.approvalStatus === 'approved_for_packaging' ||
            itemToSave.approvalStatus === 'approved';

          if (!isLegallyApproved) {
            return json(event, 400, {
              error: 'Правовой аудит не завершен. Публикация лота или переход к подбору покупателя запрещены до проверки юристом.',
              code: 'LEGAL_AUDIT_REQUIRED',
            });
          }

          const hasDeveloper = Boolean(itemToSave.developer && String(itemToSave.developer).trim());
          const hasComplex = Boolean(itemToSave.complexName && String(itemToSave.complexName).trim());
          const hasArea = Boolean(itemToSave.areaM2 || itemToSave.area || (itemToSave.specs && itemToSave.specs.totalArea));
          const hasPrice = Boolean(itemToSave.cashPaidBySeller || itemToSave.sellerReturnRub || itemToSave.price || itemToSave.dduContractPrice);
          const hasImage = Boolean(
            itemToSave.imageUrl ||
            (Array.isArray(itemToSave.images) && itemToSave.images.length > 0) ||
            (Array.isArray(itemToSave.photos) && itemToSave.photos.length > 0) ||
            (Array.isArray(itemToSave.curatorApprovedImages) && itemToSave.curatorApprovedImages.length > 0)
          );

          if (!hasDeveloper || !hasComplex || !hasArea || !hasPrice || !hasImage) {
            return json(event, 400, {
              error: 'Упаковка лота не завершена (отсутствуют обязательные поля: ЖК, Застройщик, Площадь, Цена или Фотографии)',
              code: 'PACKAGING_INCOMPLETE',
            });
          }
        }

        // Auto-match preliminary requests on lot creation if not explicitly passed
        if (!itemToSave.partnerRefCode) {
          try {
            const sellerPhoneDigits = (itemToSave.sellerPhone || itemToSave.phone || '').replace(/\D/g, '');
            if (sellerPhoneDigits.length >= 10) {
              const last10 = sellerPhoneDigits.slice(-10);
              const allPre = await ydb.scanAll<any>('partner_preliminary_requests');
              const nowMs = Date.now();
              const activeMatch = allPre.find((p: any) => {
                if (p.status === 'expired' || p.status === 'converted_to_lot') return false;
                if (new Date(p.expiresAt).getTime() < nowMs) return false;
                const preDigits = (p.clientPhone || '').replace(/\D/g, '');
                return preDigits.length >= 10 && preDigits.slice(-10) === last10;
              });

              if (activeMatch) {
                itemToSave.partnerId = activeMatch.partnerId;
                itemToSave.partnerRefCode = activeMatch.partnerRefCode;
                itemToSave.referredByPartnerCode = activeMatch.partnerRefCode;
                activeMatch.status = 'converted_to_lot';
                activeMatch.activatedLotCode = itemToSave.lotCode || itemToSave.id;
                activeMatch.activatedAt = new Date().toISOString();
                await ydb.putItem('partner_preliminary_requests', activeMatch);
              }
            }
          } catch (mErr) {
            console.warn('[data] Non-fatal preliminary request matching in lots:', mErr);
          }
        }

        await ydb.putItem(collection, itemToSave);

        // Auto-sync status with linked seller_requests
        try {
          const lotCode = itemToSave.lotCode || itemToSave.id;
          const allSellerReqs = await ydb.scanAll<any>('seller_requests');
          const linkedReq = (allSellerReqs || []).find((r: any) =>
            (itemToSave.sellerRequestId && r.id === itemToSave.sellerRequestId) ||
            (r.lotCode && String(r.lotCode).trim().toUpperCase() === String(lotCode).trim().toUpperCase()) ||
            (r.lotId && (String(r.lotId).trim().toUpperCase() === String(itemToSave.id).trim().toUpperCase() || String(r.lotId).trim().toUpperCase() === String(lotCode).trim().toUpperCase()))
          );

          if (linkedReq) {
            let reqStatusChanged = false;
            if ((itemToSave.isPublished || itemToSave.status === 'available') && linkedReq.status !== 'published') {
              linkedReq.status = 'published';
              reqStatusChanged = true;
            } else if (itemToSave.status === 'in_deal' && linkedReq.status !== 'in_deal') {
              linkedReq.status = 'in_deal';
              reqStatusChanged = true;
            } else if ((itemToSave.status === 'closed' || itemToSave.status === 'completed' || Number(itemToSave.currentStage) === 5) && linkedReq.status !== 'closed') {
              linkedReq.status = 'closed';
              reqStatusChanged = true;
            }
            if (reqStatusChanged) {
              linkedReq.updatedAt = new Date().toISOString();
              await ydb.putItem('seller_requests', linkedReq);
            }
          }
        } catch (srErr) {
          console.warn('[data] Non-fatal seller_requests sync in lots:', srErr);
        }

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
    if (collection === 'pep_signatures') {
      return json(event, 403, {
        error: 'Удаление записей электронных подписей ПЭП строго запрещено (63-ФЗ)',
      });
    }

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
    appCache.invalidatePrefix(collection);
    if (collection === 'lots') {
      appCache.invalidatePrefix('lot:');
    }

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
