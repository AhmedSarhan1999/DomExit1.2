/**
 * nashDomSyncService.ts — PropTech AI Module
 * Synchronizes official open data for residential construction projects
 * from ЕИСЖС (Наш.Дом.РФ — https://наш.дом.рф / https://xn--80az8a.xn--d1aqf.xn--p1ai)
 *
 * Sovereign 152-FZ compliance: Open public data directly from Russian governmental portal.
 * Zero illegal scraping: Respectful requests (250ms spacing, 10s timeout, graceful error handling).
 * Fallback-ready: If remote portal times out or rate limits, manual/agent imports are supported.
 */

import { getYdbClient } from '../../lib/ydbClient.js';
import { logger } from '../../lib/logger.js';
import { memoryCache } from '../../lib/memoryCache.js';

export interface EiszhProjectRecord {
  id: string; // eiszh-{objId}
  eiszhObjId: string;
  complexKey: string;
  complexName: string;
  developerName: string;
  developerInn: string;
  region: string;
  address: string;
  escrowBankName?: string;
  plannedHandoverQuarter?: string; // e.g. "2027-Q2"
  delayMonths: number;
  readinessPct?: number;
  avgPricePerSqmRub?: number;
  propertyClass?: 'Эконом' | 'Комфорт' | 'Бизнес' | 'Элит';
  isProblematic: boolean;
  sourceUrl: string;
  syncedAt: string;
  rawPayload?: any;
}

export interface EiszhSyncResult {
  ok: boolean;
  syncedCount: number;
  developersChecked: number;
  failedDevelopers: string[];
  errors: string[];
  sourceMode: 'live_api' | 'partial';
}

const EISZH_TIMEOUT_MS = 10000;
const EISZH_API_BASE = 'https://xn--80az8a.xn--d1aqf.xn--p1ai/%D1%81%D0%B5%D1%80%D0%B2%D0%B8%D1%81%D1%8B/api/kn/object';

// Top Russian developers INNs for default seeding if not passed
export const DEFAULT_RUSSIAN_DEVELOPER_INNS: Array<{ name: string; inn: string }> = [
  { name: 'ПИК', inn: '7703010780' },
  { name: 'Самолет', inn: '7731477700' },
  { name: 'ФСК', inn: '7703554449' },
  { name: 'ЛСР', inn: '7838360491' },
  { name: 'Донстрой', inn: '7709214775' },
  { name: 'Эталон', inn: '7814116230' },
  { name: 'А101', inn: '7704514901' },
  { name: 'MR Group', inn: '7707328400' },
  { name: 'Брусника', inn: '6671382990' },
  { name: 'Setl Group', inn: '7810015707' },
];

/**
 * Normalizes complex name and region into a consistent matching key.
 * e.g. "ЖК 'Событие'", "Москва" -> "событие_москва"
 */
export function normalizeComplexKey(name: string, region?: string): string {
  if (!name) return 'unknown';

  let cleaned = name.toLowerCase();
  // Strip common prefixes and quotes
  cleaned = cleaned.replace(/жк\s+|жилой\s+комплекс\s+|клубный\s+дом\s+|квартал\s+|микрорайон\s+/gi, '');
  cleaned = cleaned.replace(/["'«»„“]/g, '');
  cleaned = cleaned.replace(/[^a-zа-я0-9]/gi, '_');
  cleaned = cleaned.replace(/_+/g, '_').replace(/^_|_$/g, '');

  let regionSlug = '';
  if (region) {
    regionSlug = region.toLowerCase().replace(/[^a-zа-я0-9]/gi, '');
  }

  return regionSlug ? `${cleaned}_${regionSlug}` : cleaned;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches objects for a specific developer INN from ЕИСЖС public API.
 */
async function fetchEiszhObjectsForInn(
  devInn: string,
  limit = 15
): Promise<{ ok: boolean; items: any[]; error?: string }> {
  const url = `${EISZH_API_BASE}?offset=0&limit=${limit}&devInn=${encodeURIComponent(devInn)}`;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), EISZH_TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DomExit-PropTech-Sync/1.0',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) {
      return { ok: false, items: [], error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data = await res.json();
    const list = data?.data?.list || data?.list || (Array.isArray(data) ? data : []);
    return { ok: true, items: list };
  } catch (err: any) {
    return { ok: false, items: [], error: err.message || 'Network error / Timeout' };
  }
}

/**
 * Sync developer projects from ЕИСЖС into eiszh_projects_v2 table.
 */
export async function syncDeveloperProjectsFromEiszh(options?: {
  developerInn?: string;
  limitPerDeveloper?: number;
}): Promise<EiszhSyncResult> {
  const ydb = getYdbClient();
  const limitPerDev = options?.limitPerDeveloper || 15;
  const nowIso = new Date().toISOString();

  let targetInns: Array<{ name: string; inn: string }> = [];

  if (options?.developerInn) {
    targetInns = [{ name: 'Застройщик', inn: options.developerInn.trim() }];
  } else {
    // Collect from internal developer catalog or default seeds
    try {
      const dbDevs = await ydb.scanAll<any>('developers', 50);
      if (Array.isArray(dbDevs) && dbDevs.length > 0) {
        for (const d of dbDevs) {
          if (d.inn && /^\d{10,12}$/.test(d.inn)) {
            targetInns.push({ name: d.name || 'Застройщик', inn: d.inn });
          }
        }
      }
    } catch {
      // ignore
    }

    if (targetInns.length === 0) {
      targetInns = [...DEFAULT_RUSSIAN_DEVELOPER_INNS];
    }
  }

  // Deduplicate by INN
  const seenInns = new Set<string>();
  targetInns = targetInns.filter((item) => {
    if (seenInns.has(item.inn)) return false;
    seenInns.add(item.inn);
    return true;
  });

  logger.info('[EiszhSync] Starting synchronization for developers', {
    meta: { developerCount: targetInns.length, limitPerDev },
  });

  let syncedCount = 0;
  const failedDevelopers: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < targetInns.length; i++) {
    const dev = targetInns[i];
    if (i > 0) {
      await delay(250); // Respectful pause between developer requests
    }

    const fetchRes = await fetchEiszhObjectsForInn(dev.inn, limitPerDev);
    if (!fetchRes.ok) {
      failedDevelopers.push(dev.inn);
      errors.push(`${dev.name} (${dev.inn}): ${fetchRes.error}`);
      continue;
    }

    for (const obj of fetchRes.items) {
      try {
        const objId = String(obj.objId || obj.id || '').trim();
        if (!objId) continue;

        const complexName =
          obj.developer?.objCompxName ||
          obj.objCompxName ||
          obj.name ||
          obj.developer?.devShortCleanNm ||
          'Многоквартирный дом';
        const region = String(obj.developer?.regCode || obj.region || '77');
        const complexKey = normalizeComplexKey(complexName, region);
        const developerName =
          obj.developer?.devShortCleanNm || obj.developer?.devFullCleanNm || dev.name;
        const address = obj.address || obj.objAddr || 'Россия';

        // Handover quarter mapping
        let plannedHandoverQuarter = '';
        if (obj.objReadyDate || obj.objDeadlineDate) {
          const rawDate = String(obj.objReadyDate || obj.objDeadlineDate);
          const yMatch = rawDate.match(/(\d{4})/);
          const mMatch = rawDate.match(/-(\d{2})-/);
          if (yMatch) {
            const year = yMatch[1];
            const month = mMatch ? Number(mMatch[1]) : 6;
            const q = Math.ceil(month / 3);
            plannedHandoverQuarter = `${year}-Q${q}`;
          }
        }

        // Delay months
        let delayMonths = 0;
        if (obj.objTransferDelayMonths) {
          delayMonths = Math.max(0, Number(obj.objTransferDelayMonths) || 0);
        } else if (obj.delayMonths) {
          delayMonths = Math.max(0, Number(obj.delayMonths) || 0);
        }

        const avgPricePerSqmRub =
          Number(obj.objPriceAvg || obj.avgPrice || obj.objPricePerMeter || 0) || undefined;
        const readinessPct =
          obj.objReadyPercent !== undefined ? Math.min(100, Math.max(0, Number(obj.objReadyPercent))) : undefined;

        let propertyClass: EiszhProjectRecord['propertyClass'] = undefined;
        const rawClass = String(obj.objClass || '').toLowerCase();
        if (rawClass.includes('эконом') || rawClass.includes('стандарт')) propertyClass = 'Эконом';
        else if (rawClass.includes('комфорт')) propertyClass = 'Комфорт';
        else if (rawClass.includes('бизнес')) propertyClass = 'Бизнес';
        else if (rawClass.includes('элит') || rawClass.includes('премиум')) propertyClass = 'Элит';

        const isProblematic = Boolean(obj.isProblematic || obj.problemFlag || delayMonths >= 12);
        const escrowBankName =
          obj.developer?.bankName || obj.escrowBankName || obj.bankShortName || undefined;

        const record: EiszhProjectRecord = {
          id: `eiszh-${objId}`,
          eiszhObjId: objId,
          complexKey,
          complexName,
          developerName,
          developerInn: dev.inn,
          region,
          address,
          escrowBankName,
          plannedHandoverQuarter: plannedHandoverQuarter || undefined,
          delayMonths,
          readinessPct,
          avgPricePerSqmRub,
          propertyClass,
          isProblematic,
          sourceUrl: `https://наш.дом.рф/сервисы/каталог-новостроек/объект/${objId}`,
          syncedAt: nowIso,
        };

        await ydb.putItem('eiszh_projects', record);
        syncedCount++;
      } catch (err: any) {
        logger.warn('[EiszhSync] Failed saving object record', { meta: { error: err.message } });
      }
    }
  }

  memoryCache.invalidate('eiszh_stats');

  return {
    ok: syncedCount > 0 || failedDevelopers.length === 0,
    syncedCount,
    developersChecked: targetInns.length,
    failedDevelopers,
    errors,
    sourceMode: failedDevelopers.length === targetInns.length ? 'partial' : 'live_api',
  };
}

/**
 * Manually upserts or updates an ЕИСЖС project record in YDB.
 * Used as reliable fallback if remote API is blocked or for specific project overrides.
 */
export async function upsertEiszhProjectManual(
  input: Partial<EiszhProjectRecord> & {
    complexName: string;
    developerInn: string;
  }
): Promise<EiszhProjectRecord> {
  const ydb = getYdbClient();
  const objId = input.eiszhObjId || `${Date.now().toString().slice(-8)}`;
  const complexName = input.complexName.trim();
  const region = input.region?.trim() || '77';
  const complexKey = input.complexKey || normalizeComplexKey(complexName, region);
  const nowIso = new Date().toISOString();

  const record: EiszhProjectRecord = {
    id: `eiszh-${objId}`,
    eiszhObjId: objId,
    complexKey,
    complexName,
    developerName: input.developerName || 'Застройщик',
    developerInn: input.developerInn.trim(),
    region,
    address: input.address || 'Россия',
    escrowBankName: input.escrowBankName,
    plannedHandoverQuarter: input.plannedHandoverQuarter,
    delayMonths: Math.max(0, Number(input.delayMonths) || 0),
    readinessPct: input.readinessPct,
    avgPricePerSqmRub: input.avgPricePerSqmRub,
    propertyClass: input.propertyClass,
    isProblematic: Boolean(input.isProblematic),
    sourceUrl: input.sourceUrl || `https://наш.дом.рф/сервисы/каталог-новостроек/объект/${objId}`,
    syncedAt: nowIso,
  };

  await ydb.putItem('eiszh_projects', record);
  memoryCache.invalidate('eiszh_stats');
  return record;
}

/**
 * Searches for a matching project in eiszh_projects_v2:
 * 1. Checks complexKey-index.
 * 2. If not found, checks developerInn-index.
 */
export async function findMatchingEiszhProject(params: {
  complexName?: string;
  developerInn?: string;
  region?: string;
}): Promise<EiszhProjectRecord | null> {
  const ydb = getYdbClient();

  // 1. By complexKey
  if (params.complexName) {
    const key = normalizeComplexKey(params.complexName, params.region);
    try {
      const res = await ydb.queryByIndex<EiszhProjectRecord>({
        tableName: 'eiszh_projects',
        indexName: 'complexKey-index',
        hashKey: 'complexKey',
        hashValue: key,
        limit: 1,
      });
      if (res?.items?.[0]) {
        return res.items[0];
      }
    } catch (err: any) {
      logger.warn('[EiszhSync] complexKey query failed', { meta: { error: err.message } });
    }
  }

  // 2. By developerInn
  if (params.developerInn && /^\d{10,12}$/.test(params.developerInn)) {
    try {
      const res = await ydb.queryByIndex<EiszhProjectRecord>({
        tableName: 'eiszh_projects',
        indexName: 'developerInn-index',
        hashKey: 'developerInn',
        hashValue: params.developerInn.trim(),
        limit: 5,
      });
      if (res?.items && res.items.length > 0) {
        // If complexName provided, find best match
        if (params.complexName) {
          const target = params.complexName.toLowerCase();
          const match = res.items.find((p) => p.complexName.toLowerCase().includes(target) || target.includes(p.complexName.toLowerCase()));
          if (match) return match;
        }
        return res.items[0];
      }
    } catch (err: any) {
      logger.warn('[EiszhSync] developerInn query failed', { meta: { error: err.message } });
    }
  }

  return null;
}

/**
 * Returns summary statistics for EISZH projects stored in YDB.
 */
export async function getEiszhStats(): Promise<{
  projectsCount: number;
  lastSyncAt: string | null;
}> {
  const cached = memoryCache.get<{ projectsCount: number; lastSyncAt: string | null }>('eiszh_stats');
  if (cached) return cached;

  const ydb = getYdbClient();
  try {
    const projects = await ydb.scanAll<EiszhProjectRecord>('eiszh_projects', 200);
    let lastSyncAt: string | null = null;
    for (const p of projects) {
      if (!lastSyncAt || (p.syncedAt && p.syncedAt > lastSyncAt)) {
        lastSyncAt = p.syncedAt;
      }
    }
    const result = { projectsCount: projects.length, lastSyncAt };
    memoryCache.set('eiszh_stats', result, 60);
    return result;
  } catch {
    return { projectsCount: 0, lastSyncAt: null };
  }
}
