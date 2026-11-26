import { YcHttpEvent, YcHttpResponse } from '../types.js';
import { json } from '../lib/http.js';
import { getAuthenticatedUser } from '../lib/cryptoAuth.js';
import { getYdbClient } from '../lib/ydbClient.js';
import { getConfig } from '../lib/config.js';
import { validateRussianInn } from '../lib/validationAndGuards.js';
import { consumeQuota } from '../lib/anomalyDetector.js';
import { memoryCache } from '../lib/memoryCache.js';
import { logger } from '../lib/logger.js';

export async function handleTools(event: YcHttpEvent, subPath: string): Promise<YcHttpResponse> {
  const method = (event.httpMethod || 'GET').toUpperCase();
  const authUser = await getAuthenticatedUser(event);

  // Strict RBAC: Tools are restricted to platform staff (owner and employees)
  if (!authUser) {
    return json(event, 401, { error: 'Требуется авторизация' });
  }

  const isStaff = authUser.role === 'owner' || authUser.role === 'employee';
  if (!isStaff) {
    return json(event, 403, { error: 'Доступ разрешен только сотрудникам платформы' });
  }

  // GET /api/tools/inn-lookup?inn=...
  if (subPath === '/inn-lookup' && method === 'GET') {
    const inn = (event.queryStringParameters?.inn || '').trim();
    if (!inn) {
      return json(event, 400, { error: 'Укажите параметр inn' });
    }

    // Rate Limiting: 60 requests/hour per staff user
    const quotaRes = await consumeQuota({
      scope: 'tools_inn_lookup',
      actorKey: authUser.id,
      limit: 60,
      windowSec: 3600,
    });
    if (!quotaRes.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен лимит запросов проверки ИНН (максимум 60 в час).',
          retryAfter: quotaRes.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(quotaRes.retryAfterSec) } }
      );
    }

    // Check Memory Cache (1 hour)
    const cacheKey = `inn_lookup:${inn}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return json(event, 200, { ...cached, cached: true });
    }

    // 1. Mathematical Checksum Verification
    const innCheck = validateRussianInn(inn);
    if (!innCheck.valid) {
      return json(event, 400, {
        ok: false,
        validChecksum: false,
        inn,
        error: innCheck.message || 'Неверная контрольная сумма ИНН',
      });
    }

    const ydb = getYdbClient();
    const cfg = getConfig();

    // 2. Local YDB Database Lookup (developers table)
    let developerMatch: any = null;
    try {
      const developers = await ydb.scanAll('developers', 300);
      developerMatch =
        developers.find(
          (d: any) =>
            d.inn === inn ||
            d.developerInn === inn ||
            String(d.id || '').includes(inn)
        ) || null;
    } catch (err: any) {
      logger.warn('Error querying developers for INN', { meta: { error: err.message, inn } });
    }

    // 3. Optional Standby-Ready DaData Free Integration
    const dadataApiKey = (process.env.DADATA_API_KEY || cfg.DADATA_API_KEY || '').trim();
    let partyData: any = null;
    let dadataConfigured = false;
    let dadataError: string | null = null;

    if (dadataApiKey) {
      dadataConfigured = true;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s Circuit Breaker

        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Token ${dadataApiKey}`,
          },
          body: JSON.stringify({ query: inn }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const resJson: any = await response.json();
          const suggestion = resJson.suggestions?.[0];
          if (suggestion?.data) {
            const d = suggestion.data;
            partyData = {
              value: suggestion.value,
              nameRu: d.name?.full_with_opf || suggestion.value,
              shortNameRu: d.name?.short_with_opf || suggestion.value,
              ogrn: d.ogrn,
              inn: d.inn,
              kpp: d.kpp,
              managementName: d.management?.name || null,
              address: d.address?.value || null,
              status: d.state?.status || 'UNKNOWN',
              actualityDate: d.state?.actuality_date ? new Date(d.state.actuality_date).toISOString() : null,
              liquidationDate: d.state?.liquidation_date || null,
            };
          }
        } else {
          dadataError = `DaData HTTP ${response.status}`;
        }
      } catch (dadataErr: any) {
        dadataError = dadataErr.name === 'AbortError' ? 'Timeout 3.5s exceeded' : dadataErr.message;
      }
    }

    const result = {
      ok: true,
      valid: true,
      validChecksum: true,
      inn,
      type: innCheck.type,
      source: partyData ? 'dadata_and_local' : 'local_checksum_and_db',
      dadataConfigured,
      dadataError,
      developerMatch: developerMatch
        ? {
            id: developerMatch.id,
            name: developerMatch.name || developerMatch.title,
            rating: developerMatch.rating || null,
            accredited: developerMatch.isAccredited ?? true,
          }
        : null,
      party: partyData,
    };

    // Cache valid result for 1 hour
    memoryCache.set(cacheKey, result, 3600);

    return json(event, 200, result);
  }

  // POST /api/tools/clean-address { address: string }
  // IMPORTANT: Uses FREE DaData suggestions API only (suggestions.dadata.ru).
  // cleaner.dadata.ru (paid) is permanently disabled. No DADATA_SECRET_KEY is used.
  if (subPath === '/clean-address' && method === 'POST') {
    let body: any = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return json(event, 400, { error: 'Некорректный JSON' });
    }
    const address = String(body.address || '').trim();
    if (!address) {
      return json(event, 400, { error: 'Укажите параметр address' });
    }

    const quotaRes = await consumeQuota({
      scope: 'tools_clean_address',
      actorKey: authUser.id,
      limit: 60,
      windowSec: 3600,
    });
    if (!quotaRes.allowed) {
      return json(
        event,
        429,
        {
          error: 'Превышен лимит запросов стандартизации адреса (максимум 60 в час).',
          retryAfter: quotaRes.retryAfterSec,
        },
        { extraHeaders: { 'Retry-After': String(quotaRes.retryAfterSec) } }
      );
    }

    const cacheKey = `clean_address:${address.toLowerCase()}`;
    const cached = memoryCache.get<any>(cacheKey);
    if (cached) {
      return json(event, 200, { ...cached, cached: true });
    }

    // Use FREE suggestions API only — no cleaner.dadata.ru, no DADATA_SECRET_KEY
    const cfg = getConfig();
    const dadataApiKey = (process.env.DADATA_API_KEY || cfg.DADATA_API_KEY || '').trim();

    if (!dadataApiKey) {
      return json(event, 200, {
        ok: true,
        dadataConfigured: false,
        source: 'local_unstandardized',
        address,
        cleaned: null,
      });
    }

    let cleaned: any = null;
    let dadataError: string | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Token ${dadataApiKey}`,
          // No X-Secret header — free tier only
        },
        body: JSON.stringify({ query: address, count: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const resJson: any = await response.json();
        const suggestion = resJson.suggestions?.[0];
        if (suggestion?.data) {
          const d = suggestion.data;
          cleaned = {
            result: suggestion.unrestricted_value || suggestion.value || null,
            region: d.region_with_type || d.region || null,
            city: d.city_with_type || d.city || d.settlement_with_type || null,
            postalCode: d.postal_code || null,
            fiasId: d.fias_id || null,
            kladrId: d.kladr_id || null,
            geoLat: d.geo_lat || null,
            geoLon: d.geo_lon || null,
          };
        }
      } else {
        dadataError = `DaData HTTP ${response.status}`;
      }
    } catch (err: any) {
      dadataError = err.name === 'AbortError' ? 'Timeout 6s exceeded' : err.message;
    }

    const result = {
      ok: true,
      dadataConfigured: true,
      source: 'free_tier_only', // cleaner.dadata.ru permanently disabled
      dadataError,
      address,
      cleaned,
    };
    if (cleaned) {
      memoryCache.set(cacheKey, result, 3600);
    }
    return json(event, 200, result);
  }

  return json(event, 404, { error: `Endpoint /api/tools${subPath} не найден` });
}
