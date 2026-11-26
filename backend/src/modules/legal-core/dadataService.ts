/**
 * dadataService.ts — Legal Core Module
 * FREE-TIER ONLY: Uses suggestions.dadata.ru exclusively (0 ₽ cost).
 * No cleaner.dadata.ru, no DADATA_SECRET_KEY usage ever.
 *
 * Hard limits:
 *  - 10,000 requests/day on the free DaData plan
 *  - Soft daily cap: 8,500 external calls (cached responses don't count)
 *  - Cache TTL: 24 hours for all results
 *  - Timeout: 6s per request
 *  - Errors: never throw 500 — always return { ok: false, ... }
 */

import { memoryCache } from '../../lib/memoryCache.js';
import { logger } from '../../lib/logger.js';

const DADATA_SUGGESTIONS_BASE = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs';
const DADATA_CACHE_TTL_SEC = 24 * 3600; // 24 hours
const DADATA_TIMEOUT_MS = 6000;
const DADATA_DAILY_SOFT_CAP = 8500;

// Daily usage counter (resets on cold start; sweeper will reset daily)
let _dailyUsedCount = 0;
let _dailyCounterDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function _resetDailyCounterIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _dailyCounterDate) {
    _dailyUsedCount = 0;
    _dailyCounterDate = today;
  }
}

export function getDadataStats(): { dailyUsed: number; dailySoftCap: number; date: string } {
  _resetDailyCounterIfNeeded();
  return { dailyUsed: _dailyUsedCount, dailySoftCap: DADATA_DAILY_SOFT_CAP, date: _dailyCounterDate };
}

export function resetDadataDailyCounter(): void {
  _dailyUsedCount = 0;
  _dailyCounterDate = new Date().toISOString().slice(0, 10);
}

function getApiKey(): string {
  return (process.env.DADATA_API_KEY || '').trim();
}

interface DadataBaseResult {
  ok: boolean;
  configured: boolean;
  quotaExceeded: boolean;
  cached?: boolean;
  errorCode?: string;
}

export interface AddressSuggestion {
  value: string;
  unrestrictedValue: string;
  region: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  house: string | null;
  postalCode: string | null;
  fiasId: string | null;
  kladrId: string | null;
  geoLat: string | null;
  geoLon: string | null;
}

export interface SuggestAddressResult extends DadataBaseResult {
  items: AddressSuggestion[];
}

export interface PartyData {
  found: boolean;
  nameShort: string | null;
  nameFull: string | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  type: 'LEGAL' | 'INDIVIDUAL' | null;
  status: 'ACTIVE' | 'LIQUIDATING' | 'LIQUIDATED' | 'BANKRUPT' | 'REORGANIZING' | 'UNKNOWN' | null;
  statusLabelRu: string | null;
  registrationDate: string | null;
  liquidationDate: string | null;
  legalAddress: string | null;
  managementName: string | null;
  managementPost: string | null;
  okved: string | null;
  capitalRub: number | null;
}

export interface FindPartyResult extends DadataBaseResult {
  party: PartyData | null;
}

export interface BankData {
  found: boolean;
  nameShort: string | null;
  nameFull: string | null;
  bik: string | null;
  swift: string | null;
  correspondentAccount: string | null;
  inn: string | null;
  kpp: string | null;
  status: string | null;
  address: string | null;
}

export interface FindBankResult extends DadataBaseResult {
  bank: BankData | null;
}

async function dadataPost<T>(
  path: string,
  body: object,
  apiKey: string
): Promise<T> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), DADATA_TIMEOUT_MS);
  try {
    const res = await fetch(`${DADATA_SUGGESTIONS_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw Object.assign(new Error(`DaData HTTP ${res.status}: ${errText}`), {
        httpStatus: res.status,
      });
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(tid);
  }
}

function mapPartyStatus(state: any): PartyData['status'] {
  const s = (state?.status || '').toLowerCase();
  if (s === 'active') return 'ACTIVE';
  if (s === 'liquidating') return 'LIQUIDATING';
  if (s === 'liquidated') return 'LIQUIDATED';
  if (s === 'bankrupt') return 'BANKRUPT';
  if (s === 'reorganizing') return 'REORGANIZING';
  return 'UNKNOWN';
}

function mapPartyStatusLabel(status: PartyData['status']): string {
  switch (status) {
    case 'ACTIVE': return 'Действующая';
    case 'LIQUIDATING': return 'В процессе ликвидации';
    case 'LIQUIDATED': return 'Ликвидирована';
    case 'BANKRUPT': return 'Банкрот';
    case 'REORGANIZING': return 'Реорганизация';
    default: return 'Неизвестно';
  }
}

/**
 * Suggest Russian addresses (free-tier suggestions API).
 * Returns up to `count` (max 5) normalized address suggestions.
 */
export async function suggestAddress(
  query: string,
  options: { count?: number; region?: string } = {}
): Promise<SuggestAddressResult> {
  const apiKey = getApiKey();
  const configured = Boolean(apiKey);

  if (!configured) {
    return { ok: false, configured: false, quotaExceeded: false, items: [], errorCode: 'NOT_CONFIGURED' };
  }

  _resetDailyCounterIfNeeded();
  const count = Math.min(options.count ?? 5, 5);
  const cacheKey = `dadata:addr:${query.toLowerCase().trim()}:${count}:${options.region || ''}`;
  const cached = memoryCache.get<SuggestAddressResult>(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  if (_dailyUsedCount >= DADATA_DAILY_SOFT_CAP) {
    logger.warn('DaData daily soft cap exceeded', { meta: { dailyUsed: _dailyUsedCount } });
    return { ok: false, configured: true, quotaExceeded: true, items: [], errorCode: 'QUOTA_EXCEEDED' };
  }

  try {
    const reqBody: any = { query, count };
    if (options.region) {
      reqBody.locations = [{ region: options.region }];
    }
    const data: any = await dadataPost('/suggest/address', reqBody, apiKey);
    _dailyUsedCount++;

    const items: AddressSuggestion[] = (data.suggestions || []).map((s: any) => {
      const d = s.data || {};
      return {
        value: s.value || '',
        unrestrictedValue: s.unrestricted_value || s.value || '',
        region: d.region_with_type || d.region || null,
        city: d.city_with_type || d.city || d.settlement_with_type || null,
        district: d.area_with_type || null,
        street: d.street_with_type || d.street || null,
        house: d.house ? `${d.house}${d.block ? ' к' + d.block : ''}` : null,
        postalCode: d.postal_code || null,
        fiasId: d.fias_id || null,
        kladrId: d.kladr_id || null,
        geoLat: d.geo_lat || null,
        geoLon: d.geo_lon || null,
      };
    });

    const result: SuggestAddressResult = { ok: true, configured: true, quotaExceeded: false, items };
    memoryCache.set(cacheKey, result, DADATA_CACHE_TTL_SEC);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    const http = err.httpStatus;
    let errorCode = 'DADATA_ERROR';
    if (isTimeout) errorCode = 'TIMEOUT';
    else if (http === 401 || http === 403) errorCode = 'AUTH_ERROR';
    else if (http === 429) errorCode = 'RATE_LIMITED';
    logger.warn('DaData suggestAddress error', { meta: { error: err.message, errorCode } });
    return { ok: false, configured: true, quotaExceeded: http === 429, items: [], errorCode };
  }
}

/**
 * Find a legal entity or individual entrepreneur by ИНН.
 * Uses suggestions.dadata.ru/findById/party (free tier).
 */
export async function findPartyByInn(inn: string): Promise<FindPartyResult> {
  const cleanInn = inn.replace(/\D/g, '');
  const apiKey = getApiKey();
  const configured = Boolean(apiKey);

  if (!configured) {
    return { ok: false, configured: false, quotaExceeded: false, party: null, errorCode: 'NOT_CONFIGURED' };
  }
  if (cleanInn.length !== 10 && cleanInn.length !== 12) {
    return { ok: false, configured, quotaExceeded: false, party: null, errorCode: 'INVALID_INN_LENGTH' };
  }

  _resetDailyCounterIfNeeded();
  const cacheKey = `dadata:party:${cleanInn}`;
  const cached = memoryCache.get<FindPartyResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  if (_dailyUsedCount >= DADATA_DAILY_SOFT_CAP) {
    return { ok: false, configured: true, quotaExceeded: true, party: null, errorCode: 'QUOTA_EXCEEDED' };
  }

  try {
    const data: any = await dadataPost('/findById/party', { query: cleanInn, branch_type: 'MAIN' }, apiKey);
    _dailyUsedCount++;

    const suggestion = data.suggestions?.[0];
    if (!suggestion) {
      const result: FindPartyResult = { ok: true, configured: true, quotaExceeded: false, party: { found: false, nameShort: null, nameFull: null, inn: cleanInn, kpp: null, ogrn: null, type: null, status: null, statusLabelRu: 'Не найдено', registrationDate: null, liquidationDate: null, legalAddress: null, managementName: null, managementPost: null, okved: null, capitalRub: null } };
      memoryCache.set(cacheKey, result, DADATA_CACHE_TTL_SEC);
      return result;
    }

    const d = suggestion.data || {};
    const status = mapPartyStatus(d.state);
    const party: PartyData = {
      found: true,
      nameShort: d.name?.short_with_opf || d.name?.short || null,
      nameFull: d.name?.full_with_opf || d.name?.full || suggestion.value || null,
      inn: d.inn || cleanInn,
      kpp: d.kpp || null,
      ogrn: d.ogrn || null,
      type: d.type === 'INDIVIDUAL' ? 'INDIVIDUAL' : 'LEGAL',
      status,
      statusLabelRu: mapPartyStatusLabel(status),
      registrationDate: d.state?.registration_date ? new Date(d.state.registration_date).toISOString().slice(0, 10) : null,
      liquidationDate: d.state?.liquidation_date ? new Date(d.state.liquidation_date).toISOString().slice(0, 10) : null,
      legalAddress: d.address?.unrestricted_value || d.address?.value || null,
      managementName: d.management?.name || null,
      managementPost: d.management?.post || null,
      okved: d.okved || null,
      capitalRub: d.capital?.value ? Number(d.capital.value) : null,
    };

    const result: FindPartyResult = { ok: true, configured: true, quotaExceeded: false, party };
    memoryCache.set(cacheKey, result, DADATA_CACHE_TTL_SEC);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    const http = err.httpStatus;
    let errorCode = 'DADATA_ERROR';
    if (isTimeout) errorCode = 'TIMEOUT';
    else if (http === 401 || http === 403) errorCode = 'AUTH_ERROR';
    else if (http === 429) errorCode = 'RATE_LIMITED';
    logger.warn('DaData findPartyByInn error', { meta: { error: err.message, errorCode, inn: cleanInn } });
    return { ok: false, configured: true, quotaExceeded: http === 429, party: null, errorCode };
  }
}

/**
 * Find a bank by БИК (Russian Bank Identifier Code).
 * Uses suggestions.dadata.ru/findById/bank (free tier).
 */
export async function findBankByBik(bik: string): Promise<FindBankResult> {
  const cleanBik = bik.replace(/\D/g, '');
  const apiKey = getApiKey();
  const configured = Boolean(apiKey);

  if (!configured) {
    return { ok: false, configured: false, quotaExceeded: false, bank: null, errorCode: 'NOT_CONFIGURED' };
  }
  if (cleanBik.length !== 9) {
    return { ok: false, configured, quotaExceeded: false, bank: null, errorCode: 'INVALID_BIK_LENGTH' };
  }

  _resetDailyCounterIfNeeded();
  const cacheKey = `dadata:bank:${cleanBik}`;
  const cached = memoryCache.get<FindBankResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  if (_dailyUsedCount >= DADATA_DAILY_SOFT_CAP) {
    return { ok: false, configured: true, quotaExceeded: true, bank: null, errorCode: 'QUOTA_EXCEEDED' };
  }

  try {
    const data: any = await dadataPost('/findById/bank', { query: cleanBik }, apiKey);
    _dailyUsedCount++;

    const suggestion = data.suggestions?.[0];
    if (!suggestion) {
      const result: FindBankResult = { ok: true, configured: true, quotaExceeded: false, bank: { found: false, nameShort: null, nameFull: null, bik: cleanBik, swift: null, correspondentAccount: null, inn: null, kpp: null, status: null, address: null } };
      memoryCache.set(cacheKey, result, DADATA_CACHE_TTL_SEC);
      return result;
    }

    const d = suggestion.data || {};
    const bank: BankData = {
      found: true,
      nameShort: d.name?.short || d.name?.payment || suggestion.value || null,
      nameFull: d.name?.full || suggestion.value || null,
      bik: d.bic || cleanBik,
      swift: d.swift || null,
      correspondentAccount: d.correspondent_account || null,
      inn: d.inn || null,
      kpp: d.kpp || null,
      status: d.state?.status || null,
      address: d.address?.unrestricted_value || d.address?.value || null,
    };

    const result: FindBankResult = { ok: true, configured: true, quotaExceeded: false, bank };
    memoryCache.set(cacheKey, result, DADATA_CACHE_TTL_SEC);
    return result;
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    const http = err.httpStatus;
    let errorCode = 'DADATA_ERROR';
    if (isTimeout) errorCode = 'TIMEOUT';
    else if (http === 401 || http === 403) errorCode = 'AUTH_ERROR';
    else if (http === 429) errorCode = 'RATE_LIMITED';
    logger.warn('DaData findBankByBik error', { meta: { error: err.message, errorCode, bik: cleanBik } });
    return { ok: false, configured: true, quotaExceeded: http === 429, bank: null, errorCode };
  }
}
