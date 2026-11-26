/**
 * cbrSyncService.ts — PropTech AI Module
 * Fetches the official Russian Central Bank key rate (Ключевая ставка ЦБ РФ)
 * via SOAP 1.1 from cbr.ru — 100% free, official, no API key required.
 *
 * Fallback: HTTP scrape of https://www.cbr.ru/hd_base/KeyRate/ if SOAP fails.
 * Validation: Rate must be between 1% and 40% to be accepted.
 * On success: updates market_settings in YDB and invalidates cache.
 */

import { getYdbClient } from '../../lib/ydbClient.js';
import { memoryCache } from '../../lib/memoryCache.js';
import { logger } from '../../lib/logger.js';

const CBR_SOAP_URL = 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx';
const CBR_FALLBACK_URL = 'https://www.cbr.ru/hd_base/KeyRate/';
const CBR_TIMEOUT_MS = 8000;

export interface CbrSyncResult {
  ok: boolean;
  keyRate: number | null;
  effectiveDate: string | null;
  source: 'soap' | 'fallback_html' | 'unchanged' | 'error';
  previousRate: number | null;
  changed: boolean;
  error?: string;
}

function buildSoapEnvelope(fromDate: string, toDate: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:cbr="http://web.cbr.ru/">
  <soap:Body>
    <cbr:KeyRateXML>
      <cbr:fromDate>${fromDate}</cbr:fromDate>
      <cbr:ToDate>${toDate}</cbr:ToDate>
    </cbr:KeyRateXML>
  </soap:Body>
</soap:Envelope>`;
}

function isValidRate(rate: number): boolean {
  return rate >= 1 && rate <= 40;
}

/**
 * Attempt SOAP call to cbr.ru to get key rate history (last 90 days).
 * Returns the most recent entry.
 */
async function fetchViaSoap(): Promise<{ rate: number; date: string } | null> {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 3600 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10); // YYYY-MM-DD

  const envelope = buildSoapEnvelope(fmt(from), fmt(to));

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), CBR_TIMEOUT_MS);

  try {
    const res = await fetch(CBR_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '"http://web.cbr.ru/KeyRateXML"',
        Accept: 'text/xml, text/html, */*',
      },
      body: envelope,
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!res.ok) return null;
    const xml = await res.text();

    // Parse all KR entries: <KR><DT>2026-11-26T00:00:00+03:00</DT><Rate>14.00</Rate></KR>
    const matches = [...xml.matchAll(/<KR>\s*<DT>([^<]+)<\/DT>\s*<Rate>([^<]+)<\/Rate>\s*<\/KR>/g)];
    if (!matches.length) return null;

    // Sort descending by date, pick latest
    const entries = matches
      .map((m) => ({ date: m[1].slice(0, 10), rate: parseFloat(m[2].replace(',', '.')) }))
      .filter((e) => !isNaN(e.rate) && isValidRate(e.rate))
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    return entries[0] || null;
  } catch {
    clearTimeout(tid);
    return null;
  }
}

/**
 * Fallback: scrape the HTML page at cbr.ru/hd_base/KeyRate/ to extract current rate.
 */
async function fetchViaFallback(): Promise<{ rate: number; date: string } | null> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), CBR_TIMEOUT_MS);

  try {
    const res = await fetch(CBR_FALLBACK_URL, {
      headers: { Accept: 'text/html', 'User-Agent': 'DomExit-CbrSync/1.0' },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return null;

    const html = await res.text();

    // Parse first data row in <table class="data">: <tr><td>26.11.2026</td><td>14,00</td></tr>
    const rowMatch = html.match(/<tr>\s*<td>(\d{2}\.\d{2}\.\d{4})<\/td>\s*<td>(\d{1,2}[,\.]\d{2})<\/td>/);
    if (rowMatch) {
      const rate = parseFloat(rowMatch[2].replace(',', '.'));
      if (!isValidRate(rate)) return null;
      const parts = rowMatch[1].split('.');
      return { rate, date: `${parts[2]}-${parts[1]}-${parts[0]}` };
    }

    const rateMatch = html.match(/(\d{1,2}[,\.]\d{2})\s*%/) ||
      html.match(/<td[^>]*>(\d{1,2}[,\.]\d{2})<\/td>/);

    if (!rateMatch) return null;
    const rate = parseFloat(rateMatch[1].replace(',', '.'));
    if (!isValidRate(rate)) return null;

    return { rate, date: new Date().toISOString().slice(0, 10) };
  } catch {
    clearTimeout(tid);
    return null;
  }
}

/**
 * Sync the CBR key rate into YDB market_settings.
 * Returns detailed result including whether rate changed.
 */
export async function syncCbrKeyRate(): Promise<CbrSyncResult> {
  const ydb = getYdbClient();

  // Load current market_settings
  let previousRate: number | null = null;
  let currentRecord: any = null;
  try {
    currentRecord = await ydb.getItem('market_settings', 'market_parameters');
    if (currentRecord?.cbrKeyRatePercent) {
      previousRate = Number(currentRecord.cbrKeyRatePercent);
    } else if (currentRecord?.keyRate) {
      previousRate = Number(currentRecord.keyRate);
    }
  } catch (err: any) {
    logger.warn('cbrSyncService: failed to read current market_settings', { meta: { error: err.message } });
  }

  // Try SOAP first
  let fetched: { rate: number; date: string } | null = null;
  let source: CbrSyncResult['source'] = 'error';

  fetched = await fetchViaSoap();
  if (fetched) {
    source = 'soap';
    logger.info('CBR key rate fetched via SOAP', { meta: { rate: fetched.rate, date: fetched.date } });
  } else {
    // Fallback to HTML scrape
    fetched = await fetchViaFallback();
    if (fetched) {
      source = 'fallback_html';
      logger.info('CBR key rate fetched via HTML fallback', { meta: { rate: fetched.rate, date: fetched.date } });
    }
  }

  if (!fetched) {
    logger.error('cbrSyncService: all fetch methods failed');
    return { ok: false, keyRate: null, effectiveDate: null, source: 'error', previousRate, changed: false, error: 'All CBR fetch methods failed' };
  }

  const { rate, date } = fetched;
  const changed = previousRate !== rate;
  const now = new Date().toISOString();

  // Merge with existing record to preserve all other fields
  const updatedRecord = {
    ...(currentRecord || {}),
    id: 'market_parameters',
    // Keep existing fields for compatibility
    cbrKeyRatePercent: rate,
    keyRate: rate,
    cbrEffectiveDate: date,
    cbrUpdatedAt: now,
    cbrSource: 'cbr.ru',
    updatedAt: now,
  };

  try {
    await ydb.putItem('market_settings', updatedRecord);
    // Invalidate market settings cache
    memoryCache.invalidate('market_settings');
    memoryCache.invalidate('market_parameters');
    logger.info('CBR key rate updated in market_settings', { meta: { rate, date, changed } });
  } catch (err: any) {
    logger.error('cbrSyncService: failed to save to market_settings', { meta: { error: err.message } });
    return { ok: false, keyRate: rate, effectiveDate: date, source, previousRate, changed, error: err.message };
  }

  return { ok: true, keyRate: rate, effectiveDate: date, source, previousRate, changed };
}
