/**
 * backend/src/routes/legalCoreV1.ts
 *
 * REST API endpoints for Legal Core v1 (/api/legal-core/v1/*).
 * Protected by owner role OR X-LegalCore-Tenant-Key header.
 *
 * Endpoints:
 *   GET  /api/legal-core/v1/health          — Health and module readiness
 *   POST /api/legal-core/v1/kyc/check       — 1-Click KYC/KYB counterparty check
 *   GET  /api/legal-core/v1/kyc/history     — Historical checks for lot or subject
 *   GET  /api/legal-core/v1/kyc/protocol/:id — Presigned URL for S3 protocol JSON
 *   POST /api/legal-core/v1/party/lookup    — DaData company / entrepreneur lookup by INN
 *   GET  /api/legal-core/v1/radar/alerts    — Legislative radar alerts
 */

import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json, parseBody, normalizeHeaders } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { logger } from '../lib/logger.js';
import { legalCore } from '../modules/legal-core/index.js';

export async function handleLegalCoreV1(
  event: YcHttpEvent,
  subPath: string
): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const headers = normalizeHeaders(event.headers);

  // Authentication check: owner role OR valid service key
  const authUser = await getAuthenticatedUser(event);
  const tenantKeyHeader = headers['x-legalcore-tenant-key'];
  const validServiceKey =
    process.env.LEGAL_CORE_TENANT_KEY || process.env.INTERNAL_SERVICE_SECRET || 'domexit-legal-core-internal-key';

  const isOwner = authUser?.role === 'owner';
  const hasValidTenantKey = Boolean(tenantKeyHeader && tenantKeyHeader === validServiceKey);

  if (!isOwner && !hasValidTenantKey) {
    return json(event, 403, {
      error: 'Forbidden',
      hintRu: 'Доступ к Legal Core v1 ограничен ролью owner или валидным заголовком X-LegalCore-Tenant-Key',
    });
  }

  const requestedBy = authUser?.id || (hasValidTenantKey ? 'service:tenant' : 'unknown');
  const tenantId = (headers['x-tenant-id'] || 'domexit').toLowerCase();

  // 1. GET /api/legal-core/v1/health
  if (subPath === '/health' && method === 'GET') {
    const health = legalCore.getHealth(tenantId);
    return json(event, 200, { ok: true, health });
  }

  // 2. POST /api/legal-core/v1/kyc/check
  if (subPath === '/kyc/check' && method === 'POST') {
    const body = parseBody<any>(event);
    if (!body || !body.subjectType) {
      return json(event, 400, {
        error: 'Invalid input',
        hintRu: 'Укажите subjectType (individual | legal_entity) и реквизиты (fio/inn/passport)',
      });
    }

    const checkInput = {
      tenantId,
      lotCode: body.lotCode,
      subjectType: body.subjectType,
      fio: body.fio,
      birthDate: body.birthDate,
      passportSeries: body.passportSeries,
      passportNumber: body.passportNumber,
      inn: body.inn,
      ogrn: body.ogrn,
      companyName: body.companyName,
      regionCode: body.regionCode,
      forceRefresh: Boolean(body.forceRefresh),
      provider: body.provider,
    };

    const result = await legalCore.kyc.runCheck(checkInput, requestedBy);
    if (!result.ok) {
      return json(event, 200, {
        ok: false,
        configured: result.configured,
        provider: result.provider,
        hintRu: result.hintRu,
      });
    }

    return json(event, 200, {
      ok: true,
      record: result.record,
    });
  }

  // 3. GET /api/legal-core/v1/kyc/history
  if (subPath === '/kyc/history' && method === 'GET') {
    const lotCode = (event.queryStringParameters?.lotCode || '').trim();
    if (lotCode) {
      const records = await legalCore.kyc.getChecksForLot(lotCode);
      return json(event, 200, { ok: true, records });
    }

    // Default return recent checks
    const ydb = getYdbClient();
    try {
      const all = await ydb.scanAll<any>('kyc_checks', 50).catch(() => []);
      const sorted = all.sort((a, b) => (b.checkedAt || '').localeCompare(a.checkedAt || ''));
      return json(event, 200, { ok: true, records: sorted });
    } catch (err: any) {
      return json(event, 200, { ok: true, records: [] });
    }
  }

  // 4. GET /api/legal-core/v1/kyc/protocol/:id
  const protocolMatch = /^\/kyc\/protocol\/([^/]+)$/.exec(subPath);
  if (protocolMatch && method === 'GET') {
    const checkId = protocolMatch[1];
    const check = await legalCore.kyc.getCheckById(checkId);
    if (!check || !check.protocolS3Key) {
      return json(event, 404, { error: 'Протокол проверки не найден' });
    }

    const downloadUrl = await legalCore.kyc.getProtocolDownloadUrl(check.protocolS3Key);
    return json(event, 200, {
      ok: true,
      checkId,
      protocolS3Key: check.protocolS3Key,
      downloadUrl,
    });
  }

  // 5. POST /api/legal-core/v1/party/lookup
  if (subPath === '/party/lookup' && method === 'POST') {
    const body = parseBody<any>(event);
    const inn = (body?.inn || '').trim();
    if (!inn) {
      return json(event, 400, { error: 'Укажите ИНН организации или ИП' });
    }

    const result = await legalCore.dadata.findPartyByInn(inn);
    return json(event, 200, result);
  }

  // 6. GET /api/legal-core/v1/radar/alerts
  if (subPath === '/radar/alerts' && method === 'GET') {
    const category = event.queryStringParameters?.category;
    const ydb = getYdbClient();
    try {
      const items = await ydb.scanAll<any>('legislative_radar_items', 100).catch(() => []);
      let filtered = items;
      if (category) {
        filtered = items.filter((i) => i.category === category);
      }
      const sorted = filtered.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
      return json(event, 200, { ok: true, alerts: sorted });
    } catch (err: any) {
      return json(event, 200, { ok: true, alerts: [] });
    }
  }

  return json(event, 404, {
    error: 'Not Found',
    path: `/api/legal-core/v1${subPath}`,
    method,
  });
}
