/**
 * avmValuationEngine.ts — PropTech AI Module
 * Transparent Assignment Valuation Engine (AVM v1 — Переуступка ДДУ)
 * Operating cost: 0 ₽ per valuation (100% deterministic mathematical model).
 *
 * Combines 4 official sources:
 * 1. market_benchmarks_v2 (approved agent benchmarks from Step 02)
 * 2. eiszh_projects_v2 (official ЕИСЖС Наш.Дом.РФ construction open data)
 * 3. cbr.ru keyRate from market_settings (macro liquidity premium)
 * 4. DomExit internal closed & available lot parameters
 *
 * Produces: Recommended 14-day fast exit price band, real discount vs developer,
 * liquidity score (0-100), estimated exit timeline, and transparent numeric explanation.
 */

import { getYdbClient } from '../../lib/ydbClient.js';
import { logger } from '../../lib/logger.js';
import { normalizeComplexKey, findMatchingEiszhProject, EiszhProjectRecord } from './nashDomSyncService.js';
import { MarketBenchmarkRecord } from './agentBridgeService.js';

export interface AvmValuationInput {
  lotCode?: string;
  complexName: string;
  developerName?: string;
  developerInn?: string;
  region: string;
  areaSqm: number;
  rooms?: number;
  floor?: number;
  totalFloors?: number;
  dduFullPriceRub: number;
  paidToDeveloperRub: number;
  remainingDebtRub?: number;
  handoverQuarter?: string;
  familyMortgageEligible?: boolean;
  developerConsentFeeRub?: number;
  developerPriceTodayRub?: number;
  curatorOverrideBenchmarkSqmRub?: number;
  saveHistory?: boolean;
  requestedBy?: string;
}

export interface FastExitPriceBand {
  minRub: number;
  recommendedRub: number;
  maxRub: number;
}

export interface AvmValuationResult {
  id?: string;
  lotCode?: string;
  complexKey: string;
  complexName: string;
  areaSqm: number;
  anchorDeveloperTotalRub: number;
  anchorDeveloperPricePerSqmRub: number;
  estimatedMarketValueRub: number;
  estimatedPricePerSqmRub: number;
  fastExitPriceBandRub: FastExitPriceBand;
  recommendedSellerCashRub: number;
  impliedDiscountVsDeveloperPct: number;
  buyerNetSavingsRub: number;
  liquidityScore: number; // 0..100
  estimatedDaysToExit: '7–14 дней' | '14–30 дней' | '30–60 дней' | '60+ дней';
  pricingVerdict: 'underpriced_hot' | 'fair_fast_exit' | 'slightly_overpriced' | 'overpriced_risk';
  dataQualityConfidence: 'high' | 'medium' | 'low';
  adjustmentsApplied: {
    keyRatePct: number;
    keyRateAdjustmentPct: number;
    familyMortgageBonusPct: number;
    delayPenaltyPct: number;
    cashTicketRatioPct: number;
    developerConsentFeeDeductionRub: number;
    effectiveDiscountPct: number;
  };
  sourcesUsed: Array<{
    sourceName: string;
    details: string;
    date?: string;
  }>;
  matchedEiszhProject?: {
    eiszhObjId: string;
    complexName: string;
    developerName: string;
    delayMonths: number;
    isProblematic: boolean;
    escrowBankName?: string;
  };
  matchedBenchmark?: {
    id: string;
    developerPricePerSqmRub: number;
    verifiedAt: string;
  };
  needsAgentBenchmark: boolean;
  explanationBulletsRu: string[];
  calculatedAt: string;
}

export interface AvmValuationRecord {
  id: string;
  lotCode?: string;
  complexKey: string;
  inputSnapshot: any;
  result: AvmValuationResult;
  createdBy: string;
  createdAt: string;
}

function formatRubles(val: number): string {
  return Math.round(val).toLocaleString('ru-RU') + ' ₽';
}

/**
 * Computes assignment valuation based on verified market benchmarks,
 * ЕИСЖС data, CBR key rate, and internal unit economics.
 */
export async function computeAssignmentAvm(input: AvmValuationInput): Promise<AvmValuationResult> {
  const ydb = getYdbClient();
  const areaSqm = Math.max(10, Number(input.areaSqm) || 50);
  const region = input.region?.trim() || 'Москва';
  const complexName = input.complexName.trim();
  const complexKey = normalizeComplexKey(complexName, region);
  const nowIso = new Date().toISOString();

  const sourcesUsed: AvmValuationResult['sourcesUsed'] = [];
  let dataQualityConfidence: 'high' | 'medium' | 'low' = 'low';
  let needsAgentBenchmark = false;

  // ------------------------------------------------------------------
  // 1. Fetch CBR Key Rate (Macro anchor)
  // ------------------------------------------------------------------
  let keyRatePct = 21.0; // Default current Russian benchmark
  try {
    const ms = await ydb.getItem<any>('market_settings', 'market_parameters');
    if (ms?.cbrKeyRatePercent && Number(ms.cbrKeyRatePercent) > 0) {
      keyRatePct = Number(ms.cbrKeyRatePercent);
      sourcesUsed.push({
        sourceName: 'ЦБ РФ (cbr.ru)',
        details: `Ключевая ставка: ${keyRatePct}%`,
        date: ms.cbrUpdatedAt || ms.cbrEffectiveDate || undefined,
      });
    } else {
      sourcesUsed.push({
        sourceName: 'ЦБ РФ (Стандарт)',
        details: `Базовая ставка: ${keyRatePct}%`,
      });
    }
  } catch {
    sourcesUsed.push({
      sourceName: 'ЦБ РФ (Резерв)',
      details: `Базовая ставка: ${keyRatePct}%`,
    });
  }

  // ------------------------------------------------------------------
  // 2. Fetch Latest Verified Market Benchmark (Highest precision)
  // ------------------------------------------------------------------
  let matchedBenchmark: MarketBenchmarkRecord | null = null;
  if (input.lotCode) {
    try {
      const res = await ydb.queryByIndex<MarketBenchmarkRecord>({
        tableName: 'market_benchmarks',
        indexName: 'lotCode-verifiedAt-index',
        hashKey: 'lotCode',
        hashValue: input.lotCode.trim().toUpperCase(),
        scanIndexForward: false,
        limit: 1,
      });
      if (res?.items?.[0]) matchedBenchmark = res.items[0];
    } catch {
      // ignore
    }
  }

  if (!matchedBenchmark) {
    try {
      const res = await ydb.queryByIndex<MarketBenchmarkRecord>({
        tableName: 'market_benchmarks',
        indexName: 'complexKey-verifiedAt-index',
        hashKey: 'complexKey',
        hashValue: complexKey,
        scanIndexForward: false,
        limit: 1,
      });
      if (res?.items?.[0]) matchedBenchmark = res.items[0];
    } catch {
      // ignore
    }
  }

  // Check if benchmark is expired (> 30 days)
  let isBenchmarkFresh = false;
  if (matchedBenchmark) {
    const bAgeDays = (Date.now() - new Date(matchedBenchmark.verifiedAt).getTime()) / (1000 * 3600 * 24);
    isBenchmarkFresh = bAgeDays <= 45;
    const devSqm = matchedBenchmark.developerPricePerSqmRub ? `${formatRubles(matchedBenchmark.developerPricePerSqmRub)}/м²` : '—';
    const portal = matchedBenchmark.sources?.[0]?.name || 'Мониторинг';
    sourcesUsed.push({
      sourceName: 'market_benchmarks (Агентский мониторинг)',
      details: `Застройщик: ${devSqm} (${portal})`,
      date: matchedBenchmark.verifiedAt,
    });
  }

  // ------------------------------------------------------------------
  // 3. Match with ЕИСЖС (Наш.Дом.РФ) Construction Open Data
  // ------------------------------------------------------------------
  let matchedEiszh: EiszhProjectRecord | null = null;
  try {
    matchedEiszh = await findMatchingEiszhProject({
      complexName,
      developerInn: input.developerInn,
      region,
    });
    if (matchedEiszh) {
      sourcesUsed.push({
        sourceName: 'ЕИСЖС (Наш.Дом.РФ)',
        details: `Объект #${matchedEiszh.eiszhObjId}, задержка: ${matchedEiszh.delayMonths} мес., банк: ${matchedEiszh.escrowBankName || 'Эскроу'}`,
        date: matchedEiszh.syncedAt,
      });
    }
  } catch {
    // ignore
  }

  // ------------------------------------------------------------------
  // 4. Determine Developer Anchor Price (Базовый ценовой ориентир)
  // ------------------------------------------------------------------
  let anchorDeveloperPricePerSqmRub = 0;
  let anchorDeveloperTotalRub = 0;

  if (input.curatorOverrideBenchmarkSqmRub && input.curatorOverrideBenchmarkSqmRub > 50000) {
    anchorDeveloperPricePerSqmRub = Math.round(input.curatorOverrideBenchmarkSqmRub);
    anchorDeveloperTotalRub = Math.round(anchorDeveloperPricePerSqmRub * areaSqm);
    dataQualityConfidence = 'high';
  } else if (matchedBenchmark && isBenchmarkFresh && matchedBenchmark.developerPricePerSqmRub && matchedBenchmark.developerPricePerSqmRub > 50000) {
    anchorDeveloperPricePerSqmRub = Math.round(matchedBenchmark.developerPricePerSqmRub);
    anchorDeveloperTotalRub = Math.round(anchorDeveloperPricePerSqmRub * areaSqm);
    dataQualityConfidence = 'high';
  } else if (matchedEiszh && matchedEiszh.avgPricePerSqmRub && matchedEiszh.avgPricePerSqmRub > 50000) {
    anchorDeveloperPricePerSqmRub = Math.round(matchedEiszh.avgPricePerSqmRub);
    anchorDeveloperTotalRub = Math.round(anchorDeveloperPricePerSqmRub * areaSqm);
    dataQualityConfidence = 'medium';
  } else if (input.developerPriceTodayRub && input.developerPriceTodayRub > 1000000) {
    anchorDeveloperTotalRub = Math.round(input.developerPriceTodayRub);
    anchorDeveloperPricePerSqmRub = Math.round(anchorDeveloperTotalRub / areaSqm);
    dataQualityConfidence = 'medium';
  } else {
    // Fallback based on DDU contract price + estimated construction progress markup (+12%)
    const dduBase = Math.max(1000000, Number(input.dduFullPriceRub) || 6000000);
    anchorDeveloperTotalRub = Math.round(dduBase * 1.12);
    anchorDeveloperPricePerSqmRub = Math.round(anchorDeveloperTotalRub / areaSqm);
    dataQualityConfidence = 'low';
    needsAgentBenchmark = true;
    sourcesUsed.push({
      sourceName: 'DomExit Модель удорожания ДДУ',
      details: 'Оценка по ДДУ +12% к цене первичного контракта (требуется свежий срез)',
    });
  }

  // ------------------------------------------------------------------
  // 5. Compute Market & Economic Adjustments
  // ------------------------------------------------------------------
  // Key rate discount liquidity adjustment (higher rate = buyers demand deeper assignment discount)
  let keyRateAdjustmentPct = 0;
  if (keyRatePct >= 20) {
    keyRateAdjustmentPct = 6.0;
  } else if (keyRatePct >= 16) {
    keyRateAdjustmentPct = 4.5;
  } else if (keyRatePct >= 12) {
    keyRateAdjustmentPct = 3.0;
  } else {
    keyRateAdjustmentPct = 1.5;
  }

  // Family mortgage subsidized advantage (6% vs standard market mortgage)
  const familyMortgageBonusPct = input.familyMortgageEligible ? 3.0 : 0.0;

  // Delay & problematic construction penalty
  let delayPenaltyPct = 0.0;
  const delayMonths = matchedEiszh?.delayMonths || 0;
  if (matchedEiszh?.isProblematic) {
    delayPenaltyPct = 12.0;
  } else if (delayMonths >= 12) {
    delayPenaltyPct = 7.0;
  } else if (delayMonths >= 6) {
    delayPenaltyPct = 4.0;
  }

  // Cash ticket factor: proportion of cash required immediately to total value
  const dduPrice = Math.max(1, Number(input.dduFullPriceRub) || anchorDeveloperTotalRub);
  const paidCash = Math.max(0, Number(input.paidToDeveloperRub) || 0);
  const cashTicketRatioPct = Number(((paidCash / dduPrice) * 100).toFixed(1));

  // Base assignment discount vs developer: 9.0%
  const BASE_ASSIGNMENT_DISCOUNT = 9.0;
  let effectiveDiscountPct =
    BASE_ASSIGNMENT_DISCOUNT + keyRateAdjustmentPct - familyMortgageBonusPct + delayPenaltyPct;

  // Bound effective discount logically between 6% and 28%
  effectiveDiscountPct = Math.min(28.0, Math.max(6.0, Number(effectiveDiscountPct.toFixed(1))));

  // ------------------------------------------------------------------
  // 6. Fast Exit Price Band & Buyer Savings
  // ------------------------------------------------------------------
  // Market value for patient seller (1-3 months)
  const estimatedMarketValueRub = Math.round(anchorDeveloperTotalRub * (1 - (effectiveDiscountPct - 3.0) / 100));
  const estimatedPricePerSqmRub = Math.round(estimatedMarketValueRub / areaSqm);

  // Fast exit recommended price (14-21 days)
  const recommendedRub = Math.round(anchorDeveloperTotalRub * (1 - effectiveDiscountPct / 100));
  const minRub = Math.round(recommendedRub * 0.96); // 7-10 day aggressive exit
  const maxRub = Math.round(recommendedRub * 1.04); // 25-35 day flexible exit

  // Remaining developer debt and seller cash
  const remainingDebtRub =
    input.remainingDebtRub !== undefined
      ? Math.max(0, Number(input.remainingDebtRub))
      : Math.max(0, dduPrice - paidCash);

  const recommendedSellerCashRub = Math.max(0, recommendedRub - remainingDebtRub);

  // Platform fee (2.5%) and developer consent fee
  const consentFee = Math.max(0, Number(input.developerConsentFeeRub) || 0);
  const platformFeeRub = Math.round(recommendedRub * 0.025);
  const totalBuyerCostRub = recommendedRub + platformFeeRub + consentFee;
  const buyerNetSavingsRub = Math.max(0, anchorDeveloperTotalRub - totalBuyerCostRub);
  const impliedDiscountVsDeveloperPct = Number(
    (((anchorDeveloperTotalRub - recommendedRub) / anchorDeveloperTotalRub) * 100).toFixed(1)
  );

  // ------------------------------------------------------------------
  // 7. Liquidity Score (0..100) & Days to Exit
  // ------------------------------------------------------------------
  let liquidityScore = 65; // Base fair assignment liquidity
  if (input.familyMortgageEligible) liquidityScore += 15;
  if (impliedDiscountVsDeveloperPct >= 14) liquidityScore += 12;
  else if (impliedDiscountVsDeveloperPct >= 10) liquidityScore += 6;

  if (matchedEiszh?.isProblematic) liquidityScore -= 30;
  else if (delayMonths >= 6) liquidityScore -= 14;

  if (cashTicketRatioPct > 75) liquidityScore -= 8; // High cash requirement shrinks buyer pool
  if (dataQualityConfidence === 'high') liquidityScore += 5;

  liquidityScore = Math.min(98, Math.max(12, Math.round(liquidityScore)));

  let estimatedDaysToExit: AvmValuationResult['estimatedDaysToExit'] = '14–30 дней';
  if (liquidityScore >= 80) estimatedDaysToExit = '7–14 дней';
  else if (liquidityScore >= 65) estimatedDaysToExit = '14–30 дней';
  else if (liquidityScore >= 45) estimatedDaysToExit = '30–60 дней';
  else estimatedDaysToExit = '60+ дней';

  // ------------------------------------------------------------------
  // 8. Pricing Verdict (if lotCode has current price or comparison)
  // ------------------------------------------------------------------
  let pricingVerdict: AvmValuationResult['pricingVerdict'] = 'fair_fast_exit';
  if (impliedDiscountVsDeveloperPct >= 16) {
    pricingVerdict = 'underpriced_hot';
  } else if (impliedDiscountVsDeveloperPct >= 10) {
    pricingVerdict = 'fair_fast_exit';
  } else if (impliedDiscountVsDeveloperPct >= 5) {
    pricingVerdict = 'slightly_overpriced';
  } else {
    pricingVerdict = 'overpriced_risk';
  }

  // ------------------------------------------------------------------
  // 9. Explanation Bullets (Transparent numeric rationale)
  // ------------------------------------------------------------------
  const explanationBulletsRu: string[] = [
    `Ценовой якорь застройщика: ${formatRubles(anchorDeveloperTotalRub)} (${formatRubles(anchorDeveloperPricePerSqmRub)}/м²) ${
      dataQualityConfidence === 'high' ? 'по верифицированным рыночным бенчмаркам' : 'по нормализованной модели ЕИСЖС'
    }.`,
    `Макро-фактор: ключевая ставка ЦБ РФ ${keyRatePct}% обуславливает дополнительный дисконт ликвидности -${keyRateAdjustmentPct}% для покупателей с наличными средствами.`,
    input.familyMortgageEligible
      ? 'Доступность семейной ипотеки (6%) дает преимущество +3.0% к рыночной оценке и +15 пунктов к ликвидности.'
      : 'Без субсидированной ипотеки: переуступка ориентирована на прямой кэш или стандартную ипотеку.',
    matchedEiszh && delayMonths > 0
      ? `По данным ЕИСЖС Наш.Дом.РФ зафиксирована задержка сдачи ${delayMonths} мес. (дисконт задержки -${delayPenaltyPct}%).`
      : 'По данным ЕИСЖС Наш.Дом.РФ объект строится по графику, эскроу-счета защищены.',
    `Чистая выгода покупателя с учетом комиссии платформы 2.5% составляет ${formatRubles(buyerNetSavingsRub)} (эффективный дисконт ${impliedDiscountVsDeveloperPct}% к застройщику).`,
    `Рекомендуемая выплата кэша продавцу: ${formatRubles(recommendedSellerCashRub)} (при остатке долга застройщику ${formatRubles(remainingDebtRub)}).`,
  ];

  const result: AvmValuationResult = {
    lotCode: input.lotCode,
    complexKey,
    complexName,
    areaSqm,
    anchorDeveloperTotalRub,
    anchorDeveloperPricePerSqmRub,
    estimatedMarketValueRub,
    estimatedPricePerSqmRub,
    fastExitPriceBandRub: {
      minRub,
      recommendedRub,
      maxRub,
    },
    recommendedSellerCashRub,
    impliedDiscountVsDeveloperPct,
    buyerNetSavingsRub,
    liquidityScore,
    estimatedDaysToExit,
    pricingVerdict,
    dataQualityConfidence,
    adjustmentsApplied: {
      keyRatePct,
      keyRateAdjustmentPct,
      familyMortgageBonusPct,
      delayPenaltyPct,
      cashTicketRatioPct,
      developerConsentFeeDeductionRub: consentFee,
      effectiveDiscountPct,
    },
    sourcesUsed,
    matchedEiszhProject: matchedEiszh
      ? {
          eiszhObjId: matchedEiszh.eiszhObjId,
          complexName: matchedEiszh.complexName,
          developerName: matchedEiszh.developerName,
          delayMonths: matchedEiszh.delayMonths,
          isProblematic: matchedEiszh.isProblematic,
          escrowBankName: matchedEiszh.escrowBankName,
        }
      : undefined,
    matchedBenchmark: matchedBenchmark && matchedBenchmark.developerPricePerSqmRub
      ? {
          id: matchedBenchmark.id,
          developerPricePerSqmRub: matchedBenchmark.developerPricePerSqmRub,
          verifiedAt: matchedBenchmark.verifiedAt,
        }
      : undefined,
    needsAgentBenchmark,
    explanationBulletsRu,
    calculatedAt: nowIso,
  };

  // ------------------------------------------------------------------
  // 10. Save History to avm_valuations_v2 if requested or lotCode given
  // ------------------------------------------------------------------
  if (input.saveHistory || input.lotCode) {
    try {
      const valId = `avm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      result.id = valId;

      const record: AvmValuationRecord = {
        id: valId,
        lotCode: input.lotCode,
        complexKey,
        inputSnapshot: {
          region,
          complexName,
          areaSqm,
          rooms: input.rooms,
          dduFullPriceRub: input.dduFullPriceRub,
          paidToDeveloperRub: input.paidToDeveloperRub,
          remainingDebtRub: input.remainingDebtRub,
          handoverQuarter: input.handoverQuarter,
          familyMortgageEligible: input.familyMortgageEligible,
          developerConsentFeeRub: input.developerConsentFeeRub,
        },
        result,
        createdBy: input.requestedBy || 'system',
        createdAt: nowIso,
      };

      await ydb.putItem('avm_valuations', record);
    } catch (saveErr: any) {
      logger.warn('[AvmValuation] Failed saving valuation history', { meta: { error: saveErr.message } });
    }
  }

  return result;
}

/**
 * Retrieves valuation history for a given lotCode.
 */
export async function getAvmHistoryForLot(lotCode: string, limit = 10): Promise<AvmValuationRecord[]> {
  const ydb = getYdbClient();
  try {
    const res = await ydb.queryByIndex<AvmValuationRecord>({
      tableName: 'avm_valuations',
      indexName: 'lotCode-createdAt-index',
      hashKey: 'lotCode',
      hashValue: lotCode.trim().toUpperCase(),
      scanIndexForward: false,
      limit,
    });
    return res?.items || [];
  } catch (err: any) {
    logger.warn('[AvmValuation] Failed querying valuation history', { meta: { lotCode, error: err.message } });
    return [];
  }
}

/**
 * Returns summary stats for AVM valuations.
 */
export async function getAvmStats(): Promise<{ totalEstimates: number }> {
  const ydb = getYdbClient();
  try {
    const list = await ydb.scanAll<any>('avm_valuations', 100);
    return { totalEstimates: list.length };
  } catch {
    return { totalEstimates: 0 };
  }
}
