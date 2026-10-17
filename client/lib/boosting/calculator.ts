import {
  type BoostingSurchargeConfig,
  type BoostingRateRow,
  type CalculateBoostingParams,
  type PriceBreakdownItem,
  type SurchargeItem,
  type CalculateBoostingResult,
  DEFAULT_SURCHARGES,
} from '@smex/shared';

export class ValidationError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, statusCode: number, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const BoostingCalcError = ValidationError;

// Ladder order for MLBB divisions
const RANK_ORDER: Record<string, number> = {
  warrior: 1,
  elite: 2,
  master: 3,
  grandmaster: 4,
  epic: 5,
  legend: 6,
  mythic: 7,
  'mythical honor': 8,
  'mythical_honor': 8,
  'mythical glory': 9,
  'mythical_glory': 9,
  'mythical immortal': 10,
  'mythical_immortal': 10,
};

// Default rate fallback constants
const DEFAULT_FIXED_TIER_RATES: Record<string, { price: number; discount: number }> = {
  'epic->legend': { price: 400.0, discount: 0.0 },
  'legend->mythic': { price: 300.0, discount: 0.0 },
  'epic->mythic': { price: 600.0, discount: 100.0 },
};

const DEFAULT_STAR_BRACKETS = [
  { tier: 'Mythic', starTier: 'mythic', minStars: 0, maxStars: 24, rate: 20.0 },
  { tier: 'Mythical Honor', starTier: 'mythical_honor', minStars: 25, maxStars: 49, rate: 30.0 },
  { tier: 'Mythical Glory', starTier: 'mythical_glory', minStars: 50, maxStars: 99, rate: 35.0 },
  { tier: 'Mythical Immortal', starTier: 'mythical_immortal', minStars: 100, maxStars: 999, rate: 40.0 },
];

function normalizeTier(tierName?: string | null): string {
  if (!tierName) return '';
  return tierName.trim().toLowerCase().replace(/_/g, ' ');
}

function formatTierDisplayName(normalized: string): string {
  if (normalized === 'mythical honor') return 'Mythical Honor';
  if (normalized === 'mythical glory') return 'Mythical Glory';
  if (normalized === 'mythical immortal') return 'Mythical Immortal';
  if (normalized === 'mythic') return 'Mythic';
  if (normalized === 'legend') return 'Legend';
  if (normalized === 'epic') return 'Epic';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Calculates authoritative MLBB rank boosting prices based on active rates matrix,
 * star progression, multi-bracket piecewise traversals, and add-on surcharges.
 */
export function calculateBoostingPrice(params: CalculateBoostingParams): CalculateBoostingResult {
  const startTierRaw = params.startingRank || params.fromTier || '';
  const targetTierRaw = params.targetRank || params.toTier || '';
  const normStartTier = normalizeTier(startTierRaw);
  const normTargetTier = normalizeTier(targetTierRaw);

  const startLevel = RANK_ORDER[normStartTier] ?? 0;
  const targetLevel = RANK_ORDER[normTargetTier] ?? 0;

  let rawStartStars = params.startingStars ?? 0;
  let rawTargetStars = params.targetStars ?? 0;

  // Max star ceiling clamping at 999
  if (rawTargetStars > 999) {
    rawTargetStars = 999;
  }
  if (rawStartStars > 999) {
    rawStartStars = 999;
  }

  // Determine mode: fixed_tier, per_star, or composite
  const isExplicitFixed = params.pricingMode === 'fixed_tier';
  const isExplicitPerStar = params.pricingMode === 'per_star';
  const isSubMythicStart = normStartTier === 'epic' || normStartTier === 'legend';
  const isSubMythicTarget = normTargetTier === 'legend' || (normTargetTier === 'mythic' && rawTargetStars === 0);
  const isTargetWithStars = rawTargetStars > 0 || normTargetTier === 'mythical honor' || normTargetTier === 'mythical glory' || normTargetTier === 'mythical immortal';

  const isComposite = (isSubMythicStart && isTargetWithStars) || params.pricingMode === 'composite';
  const isFixedTier = isExplicitFixed || (!isExplicitPerStar && !isComposite && isSubMythicStart && isSubMythicTarget);

  let basePrice = 0;
  let bundleDiscount = 0;
  const breakdown: PriceBreakdownItem[] = [];

  if (isFixedTier) {
    // 1. Sub-Mythic Fixed Tier Leap
    if (startLevel > 0 && targetLevel > 0) {
      if (startLevel === targetLevel) {
        throw new ValidationError('INVALID_RANK_PROGRESSION', 422, 'Target rank must strictly exceed starting rank');
      }
      if (startLevel > targetLevel) {
        throw new ValidationError('INVALID_RANK_PROGRESSION', 422, 'Backwards rank progression is not allowed');
      }
    } else if (normStartTier && normTargetTier && normStartTier === normTargetTier) {
      throw new ValidationError('INVALID_RANK_PROGRESSION', 422, 'Target rank must strictly exceed starting rank');
    }

    const leapKey = `${normStartTier}->${normTargetTier}`;

    let matchedRate: { price: number; discount: number } | undefined;
    if (params.rates && params.rates.length > 0) {
      const dbRow = params.rates.find(
        (r) =>
          r.pricingMode === 'fixed_tier' &&
          (r.isActive === undefined || r.isActive === true) &&
          normalizeTier(r.fromTier) === normStartTier &&
          normalizeTier(r.toTier) === normTargetTier
      );
      if (dbRow) {
        const p = Number(dbRow.priceInr);
        matchedRate = {
          price: p,
          discount: normStartTier === 'epic' && normTargetTier === 'mythic' ? 100.0 : 0.0,
        };
      }
    }

    if (!matchedRate) {
      matchedRate = DEFAULT_FIXED_TIER_RATES[leapKey];
    }

    if (!matchedRate) {
      throw new ValidationError('INVALID_RANK_PROGRESSION', 422, `Unsupported fixed tier progression: ${startTierRaw} to ${targetTierRaw}`);
    }

    basePrice = matchedRate.price;
    bundleDiscount = matchedRate.discount;

    breakdown.push({
      tier: `${formatTierDisplayName(normStartTier)} to ${formatTierDisplayName(normTargetTier)}`,
      rate: matchedRate.price.toFixed(2),
      subtotal: matchedRate.price.toFixed(2),
    });
  } else if (isComposite) {
    // 2. Composite Cross-Regime Progression (Sub-Mythic to Mythic Stars)
    const fixedLeapKey = `${normStartTier}->mythic`;
    let fixedRate = DEFAULT_FIXED_TIER_RATES[fixedLeapKey];
    if (params.rates && params.rates.length > 0) {
      const dbRow = params.rates.find(
        (r) =>
          r.pricingMode === 'fixed_tier' &&
          (r.isActive === undefined || r.isActive === true) &&
          normalizeTier(r.fromTier) === normStartTier &&
          normalizeTier(r.toTier) === 'mythic'
      );
      if (dbRow) {
        fixedRate = {
          price: Number(dbRow.priceInr),
          discount: normStartTier === 'epic' ? 100.0 : 0.0,
        };
      }
    }

    if (!fixedRate) {
      throw new ValidationError('INVALID_RANK_PROGRESSION', 422, `Unsupported composite progression from ${startTierRaw}`);
    }

    basePrice += fixedRate.price;
    bundleDiscount += fixedRate.discount;
    breakdown.push({
      tier: `${formatTierDisplayName(normStartTier)} to Mythic Base`,
      rate: fixedRate.price.toFixed(2),
      subtotal: fixedRate.price.toFixed(2),
    });

    const starStart = 0;
    const starTarget = rawTargetStars;
    if (starTarget <= starStart) {
      throw new ValidationError('INVALID_STAR_PROGRESSION', 422, 'Target stars must strictly exceed starting stars');
    }

    const { starPrice, starBreakdown } = calculateStarBrackets(starStart, starTarget, params.rates);
    basePrice += starPrice;
    breakdown.push(...starBreakdown);
  } else {
    // 3. Per-Star Ladder Progression (Mythic and Above)
    if (rawTargetStars <= rawStartStars) {
      throw new ValidationError('INVALID_STAR_PROGRESSION', 422, 'Target stars must strictly exceed starting stars');
    }

    const { starPrice, starBreakdown } = calculateStarBrackets(rawStartStars, rawTargetStars, params.rates);
    basePrice = starPrice;
    breakdown.push(...starBreakdown);
  }

  // 4. Surcharges
  const surchargeConfig: BoostingSurchargeConfig = {
    ...DEFAULT_SURCHARGES,
    ...(params.surcharges || {}),
  };

  const surcharges: SurchargeItem[] = [];
  const hasRole = Boolean(params.addons?.rolePriority);
  const hasHeroPool = Boolean(params.addons?.restrictedHeroPool && params.addons.restrictedHeroPool.length > 0);
  const isDuo = Boolean(params.addons?.duoPlayWithBooster);

  let percentageMultiplier = 1;

  if (hasRole) {
    const roleAmount = basePrice * surchargeConfig.rolePriorityPercent;
    percentageMultiplier += surchargeConfig.rolePriorityPercent;
    surcharges.push({
      name: `Role Priority (${params.addons!.rolePriority})`,
      type: 'percentage',
      rate: `${Math.round(surchargeConfig.rolePriorityPercent * 100)}%`,
      amount: roleAmount.toFixed(2),
    });
  }

  if (hasHeroPool) {
    surcharges.push({
      name: 'Restricted Hero Pool',
      type: 'flat',
      rate: `₹${Math.round(surchargeConfig.heroPoolFlatInr)}`,
      amount: surchargeConfig.heroPoolFlatInr.toFixed(2),
    });
  }

  if (isDuo) {
    const duoAmount = basePrice * surchargeConfig.duoPartyPercent;
    percentageMultiplier += surchargeConfig.duoPartyPercent;
    surcharges.push({
      name: 'Duo Play with Booster',
      type: 'percentage',
      rate: `${Math.round(surchargeConfig.duoPartyPercent * 100)}%`,
      amount: duoAmount.toFixed(2),
    });
  }

  const flatSurcharges = hasHeroPool ? surchargeConfig.heroPoolFlatInr : 0;
  const rawTotalPrice = basePrice * percentageMultiplier + flatSurcharges;
  const finalPriceInr = Math.round(rawTotalPrice);

  return {
    basePriceInr: basePrice.toFixed(2),
    discountInr: bundleDiscount.toFixed(2),
    breakdown,
    surcharges,
    totalPriceInr: finalPriceInr.toFixed(2),
  };
}

function calculateStarBrackets(
  s1: number,
  s2: number,
  rates?: BoostingRateRow[]
): { starPrice: number; starBreakdown: PriceBreakdownItem[] } {
  let starPrice = 0;
  const starBreakdown: PriceBreakdownItem[] = [];

  for (const bracket of DEFAULT_STAR_BRACKETS) {
    let rate = bracket.rate;

    if (rates && rates.length > 0) {
      const match = rates.find(
        (r) =>
          r.pricingMode === 'per_star' &&
          (r.isActive === undefined || r.isActive === true) &&
          normalizeTier(r.starTier) === normalizeTier(bracket.starTier)
      );
      if (match) {
        rate = Number(match.priceInr);
      }
    }

    const bracketStars = Math.max(0, Math.min(s2, bracket.maxStars + 1) - Math.max(s1, bracket.minStars));

    if (bracketStars > 0) {
      const subtotal = bracketStars * rate;
      starPrice += subtotal;
      starBreakdown.push({
        tier: bracket.tier,
        stars: bracketStars,
        rate: rate.toFixed(2),
        subtotal: subtotal.toFixed(2),
      });
    }
  }

  return { starPrice, starBreakdown };
}
