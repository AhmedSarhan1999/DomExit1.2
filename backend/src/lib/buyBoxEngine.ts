import {
  BuyerBuyBox,
  BuyerApplication,
  BuyBoxTier,
  BuyBoxPaymentMethod,
  LotDropConfig,
  QueueStatus,
  PriceAcceptance,
} from '../types.js';

export interface MatchScoreResult {
  score: number; // 0..100
  breakdown: {
    location: number; // 0..30
    budget: number; // 0..30
    trackAndBank: number; // 0..20
    discount: number; // 0..10
    roomsAndArea: number; // 0..10
  };
  eligibleForDrop: boolean;
  reasons: string[];
}

export interface ClosingScoreResult {
  closingScore: number; // 0..105
  breakdown: {
    paymentMethod: number; // 0..40
    reliability: number; // 0..20
    priceAcceptance: number; // 0..25
    speed: number; // 0..20
  };
}

/**
 * Computes deterministic 0..100 Match Score between a Lot and a Buyer's Buy-Box.
 */
export function computeMatchScore(lot: any, buyBox: BuyerBuyBox): MatchScoreResult {
  const reasons: string[] = [];

  // --- 1. Location (Max 30) ---
  let locationScore = 0;
  const lotCity = String(lot.city || '').trim().toLowerCase();
  const lotDistrict = String(lot.district || '').trim().toLowerCase();
  const lotComplex = String(lot.complexName || '').trim().toLowerCase();

  // City match (15 pts)
  const buyBoxCities = (buyBox.cities || []).map((c) => c.trim().toLowerCase());
  const cityMatches = buyBoxCities.length === 0 || buyBoxCities.includes(lotCity);
  if (cityMatches) {
    locationScore += 15;
  } else {
    reasons.push(`Город объекта (${lotCity}) не входит в фильтры покупателя`);
  }

  // District / Complex match (15 pts or 12 pts if open)
  const buyBoxDistricts = (buyBox.districts || []).map((d) => d.trim().toLowerCase());
  const buyBoxComplexes = (buyBox.complexNames || []).map((c) => c.trim().toLowerCase());

  const hasSpecificLocationPrefs = buyBoxDistricts.length > 0 || buyBoxComplexes.length > 0;
  if (!hasSpecificLocationPrefs) {
    // Open to any district in the city
    locationScore += 12;
  } else {
    const complexMatched = buyBoxComplexes.some((c) => lotComplex.includes(c) || c.includes(lotComplex));
    const districtMatched = buyBoxDistricts.some((d) => lotDistrict.includes(d) || d.includes(lotDistrict));

    if (complexMatched || districtMatched) {
      locationScore += 15;
    } else {
      reasons.push(`Район (${lot.district}) или ЖК (${lot.complexName}) не соответствуют запросу`);
    }
  }

  // --- 2. Budget and Liquidity (Max 30) ---
  let budgetScore = 0;
  const lotPrice = Number(
    lot.price ||
      lot.dduContractPrice ||
      (Number(lot.cashPaidBySeller || 0) + Number(lot.remainingInstallmentDebt || 0)) ||
      0
  );
  const maxBudget = Number(buyBox.maxBudgetRub || 0);

  if (maxBudget > 0 && lotPrice > 0) {
    if (lotPrice > maxBudget * 1.1) {
      // Exceeds max budget by more than 10% -> 0 pts
      budgetScore = 0;
      reasons.push(`Цена объекта (${lotPrice.toLocaleString('ru-RU')} ₽) превышает бюджет более чем на 10%`);
    } else if (lotPrice <= maxBudget) {
      budgetScore += 20;
    } else {
      // Between 100% and 110% of budget -> proportional penalty
      const overPct = (lotPrice - maxBudget) / maxBudget; // 0..0.10
      budgetScore += Math.max(0, Math.round(20 * (1 - overPct / 0.1)));
    }

    // Down payment / cash coverage (10 pts)
    const requiredCash = Number(lot.cashPaidBySeller || lotPrice * 0.2);
    const availableLiquidity = Number(buyBox.availableLiquidityRub || 0);

    if (availableLiquidity <= 0 || availableLiquidity >= requiredCash) {
      budgetScore += 10;
    } else {
      const ratio = availableLiquidity / requiredCash;
      budgetScore += Math.max(0, Math.min(10, Math.round(10 * ratio)));
      reasons.push(`Заявленной ликвидности (${availableLiquidity.toLocaleString('ru-RU')} ₽) не хватает для покрытия первого взноса (${requiredCash.toLocaleString('ru-RU')} ₽)`);
    }
  } else {
    budgetScore += 20; // Default when budget is open
  }

  // --- 3. Deal Track & Payment Method & Bank (Max 20) ---
  let trackScore = 0;
  const lotTrack = lot.dealTrack || 'ddu_cession';
  const tracks = buyBox.dealTracks || [];
  if (tracks.length === 0 || tracks.includes(lotTrack)) {
    trackScore += 10;
  } else {
    reasons.push(`Формат сделки (${lotTrack}) не поддерживается предпочтениями покупателя`);
  }

  const pMethod = buyBox.paymentMethod || 'cash_100';
  if (pMethod === 'cash_100') {
    trackScore += 10;
  } else if (pMethod === 'family_mortgage_approved' || pMethod === 'standard_mortgage_approved') {
    const lotBank = String(lot.escrowBank || '').trim().toLowerCase();
    const prefBanks = (buyBox.preferredBanks || []).map((b) => b.trim().toLowerCase());
    if (prefBanks.length === 0 || prefBanks.some((b) => b.includes(lotBank) || lotBank.includes(b))) {
      trackScore += 10;
    } else {
      trackScore += 5;
    }
  } else {
    // alternative
    trackScore += 5;
  }

  // --- 4. Minimum Discount (Max 10) ---
  let discountScore = 0;
  const todayDevPrice = Number(lot.todayDeveloperPrice || lot.dduContractPrice || lotPrice);
  const calculatedSavingsPct =
    todayDevPrice > lotPrice ? Math.round(((todayDevPrice - lotPrice) / todayDevPrice) * 100) : Number(lot.savingsPercent || 0);

  const minRequiredDiscount = Number(buyBox.minDiscountPercent || 0);
  if (calculatedSavingsPct >= minRequiredDiscount) {
    discountScore = 10;
  } else {
    const diff = minRequiredDiscount - calculatedSavingsPct;
    if (diff <= 3) {
      discountScore = Math.max(0, Math.round(10 * (1 - diff / 3)));
    } else {
      discountScore = 0;
      reasons.push(`Скидка на лот (${calculatedSavingsPct}%) ниже минимально ожидаемой (${minRequiredDiscount}%)`);
    }
  }

  // --- 5. Rooms and Area (Max 10) ---
  let roomsAndAreaScore = 0;
  const lotRooms = String(lot.rooms || '').trim().toLowerCase();
  const targetRooms = (buyBox.rooms || []).map((r) => r.trim().toLowerCase());

  if (targetRooms.length === 0 || targetRooms.includes(lotRooms)) {
    roomsAndAreaScore += 5;
  } else {
    reasons.push(`Количество комнат (${lot.rooms}) не совпадает с предпочтениями`);
  }

  const lotArea = Number(lot.areaM2 || 0);
  const minArea = Number(buyBox.minAreaM2 || 0);
  const maxArea = Number(buyBox.maxAreaM2 || 0);

  const areaOk = (minArea <= 0 || lotArea >= minArea) && (maxArea <= 0 || lotArea <= maxArea);
  if (areaOk) {
    roomsAndAreaScore += 5;
  } else {
    reasons.push(`Площадь (${lotArea} м²) выходит за границы (${minArea}–${maxArea} м²)`);
  }

  const totalScore = Math.min(100, Math.max(0, locationScore + budgetScore + trackScore + discountScore + roomsAndAreaScore));
  const eligibleForDrop = Boolean(buyBox.active && buyBox.tier !== 'bronze' && totalScore >= 75);

  return {
    score: totalScore,
    breakdown: {
      location: locationScore,
      budget: budgetScore,
      trackAndBank: trackScore,
      discount: discountScore,
      roomsAndArea: roomsAndAreaScore,
    },
    eligibleForDrop,
    reasons,
  };
}

/**
 * Computes deterministic 0..105 Closing Score for a buyer application on a drop.
 */
export function computeClosingScore(
  application: Partial<BuyerApplication>,
  buyBox: Partial<BuyerBuyBox>,
  lot: any
): ClosingScoreResult {
  // 1. Payment Method & Liquidity (Max 40)
  let paymentScore = 0;
  const paymentMethod = buyBox.paymentMethod || 'cash_100';
  if (paymentMethod === 'cash_100') {
    paymentScore = 40;
  } else if (paymentMethod === 'family_mortgage_approved') {
    paymentScore = 25;
  } else if (paymentMethod === 'standard_mortgage_approved') {
    paymentScore = 15;
  } else {
    // alternative
    paymentScore = 0;
  }

  // 2. Verification Tier & Reliability (Max 20)
  let baseTierScore = 0;
  const tier = buyBox.tier || 'silver';
  if (tier === 'gold') {
    baseTierScore = 20;
  } else if (tier === 'silver') {
    baseTierScore = 10;
  } else {
    baseTierScore = 0;
  }

  const noShowCount = Number(buyBox.noShowCount || 0);
  const penalty = Math.min(15, noShowCount * 5);
  const reliabilityScore = Math.max(0, baseTierScore - penalty);

  // 3. Price Acceptance (Max 25)
  let priceScore = 20; // default full_price
  const priceAcceptance = application.priceAcceptance || 'full_price';
  if (priceAcceptance === 'above_asking') {
    priceScore = 25;
  } else if (priceAcceptance === 'full_price') {
    priceScore = 20;
  } else if (priceAcceptance === 'discount_requested') {
    priceScore = 5;
  }

  // 4. Speed of Execution (Max 20)
  let speedScore = 0;
  if (application.readiness24h) {
    speedScore += 10;
  }
  if (application.deposit48h) {
    speedScore += 10;
  }

  const closingScore = paymentScore + reliabilityScore + priceScore + speedScore;

  return {
    closingScore: Math.min(105, Math.max(0, closingScore)),
    breakdown: {
      paymentMethod: paymentScore,
      reliability: reliabilityScore,
      priceAcceptance: priceScore,
      speed: speedScore,
    },
  };
}

/**
 * Deterministically ranks buyer applications by closingScore DESC, then createdAt ASC (tie-breaker).
 */
export function rankApplications<T extends Partial<BuyerApplication>>(apps: T[]): T[] {
  return [...apps]
    .sort((a, b) => {
      const scoreDiff = (b.closingScore || 0) - (a.closingScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeA - timeB;
    })
    .map((app, idx) => ({
      ...app,
      queuePosition: idx + 1,
    }));
}

/**
 * Determines the default tier when a buyer creates or updates their Buy-Box without staff override.
 */
export function determineDefaultTier(paymentMethod?: BuyBoxPaymentMethod): BuyBoxTier {
  if (paymentMethod === 'alternative') {
    return 'bronze';
  }
  return 'silver';
}
