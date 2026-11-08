export type BoostingPricingMode = 'fixed_tier' | 'per_star' | 'composite';

export interface BoostingAddons {
  rolePriority?: 'Jungle' | 'Gold' | 'Mid' | 'Roam' | 'EXP' | string;
  restrictedHeroPool?: string[];
  duoPlayWithBooster?: boolean;
}

export interface BoostingSurchargeConfig {
  rolePriorityPercent: number; // Default: 0.15 (15%)
  heroPoolFlatInr: number; // Default: 150.00
  duoPartyPercent: number; // Default: 0.25 (25%)
}

export const DEFAULT_SURCHARGES: BoostingSurchargeConfig = {
  rolePriorityPercent: 0.15,
  heroPoolFlatInr: 150.0,
  duoPartyPercent: 0.25,
};

export interface BoostingRateRow {
  id?: string;
  gameSlug?: string;
  pricingMode: string;
  fromTier?: string | null;
  toTier?: string | null;
  starTier?: string | null;
  minStars?: number | null;
  maxStars?: number | null;
  priceInr: string | number;
  isActive?: boolean;
  basePriceInr?: string | number | null;
  pricePerStarInr?: string | number | null;
}

export interface CalculateBoostingParams {
  pricingMode?: string;
  startingRank?: string;
  targetRank?: string;
  fromTier?: string;
  toTier?: string;
  startingStars?: number;
  targetStars?: number;
  addons?: BoostingAddons;
  rates?: BoostingRateRow[];
  surcharges?: Partial<BoostingSurchargeConfig>;
}

export interface PriceBreakdownItem {
  tier: string;
  stars?: number;
  rate: string;
  subtotal: string;
}

export interface SurchargeItem {
  name: string;
  type: 'percentage' | 'flat';
  rate: string;
  amount: string;
}

export interface CalculateBoostingResult {
  basePriceInr: string;
  discountInr: string;
  breakdown: PriceBreakdownItem[];
  surcharges: SurchargeItem[];
  totalPriceInr: string;
}

export interface BoostingDispatchConfig {
  whatsappChannelUrl: string;
  instagramUrl: string;
  whatsappDirectPhone?: string;
}

export interface BoostingOrderDispatchInput {
  orderRef: string;
  customerIgn: string;
  serverId?: string | null;
  startingRank: string;
  targetRank: string;
  startingStars?: number;
  targetStars?: number;
  pricingMode?: string;
  totalPriceInr: string | number;
  addons?: {
    rolePriority?: string;
    restrictedHeroPool?: string[];
    duoPlayWithBooster?: boolean;
  };
  customerPhone?: string | null;
}

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

// Ladder order for MLBB divisions
export const RANK_ORDER: Record<string, number> = {
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
export const DEFAULT_FIXED_TIER_RATES: Record<string, { price: number; discount: number }> = {
  'epic->legend': { price: 400.0, discount: 0.0 },
  'legend->mythic': { price: 300.0, discount: 0.0 },
  'epic->mythic': { price: 600.0, discount: 100.0 },
};

export const DEFAULT_STAR_BRACKETS = [
  { tier: 'Mythic', starTier: 'mythic', minStars: 0, maxStars: 24, rate: 20.0 },
  { tier: 'Mythical Honor', starTier: 'mythical_honor', minStars: 25, maxStars: 49, rate: 30.0 },
  { tier: 'Mythical Glory', starTier: 'mythical_glory', minStars: 50, maxStars: 99, rate: 35.0 },
  { tier: 'Mythical Immortal', starTier: 'mythical_immortal', minStars: 100, maxStars: 999, rate: 40.0 },
];

export function normalizeTier(tierName?: string | null): string {
  if (!tierName) return '';
  return tierName.trim().toLowerCase().replace(/_/g, ' ');
}

export function formatTierDisplayName(normalized: string): string {
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

export function calculateStarBrackets(
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

export function getDispatchConfig(): BoostingDispatchConfig {
  const env = ((typeof globalThis !== 'undefined' && (globalThis as any).process?.env)
    ? (globalThis as any).process.env
    : {}) as Record<string, string | undefined>;
  return {
    whatsappChannelUrl: env.NEXT_PUBLIC_SOCIAL_WHATSAPP_CHANNEL || '',
    instagramUrl: env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || '',
    whatsappDirectPhone: env.NEXT_PUBLIC_BOOSTING_WHATSAPP_PHONE,
  };
}

/**
 * Standardized order reference ID matching ^BST-[0-9]{6}-[0-9]{4}$
 */
export function generateOrderRef(date: Date = new Date(), sequenceOrRandom?: number): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const seq =
    sequenceOrRandom !== undefined
      ? String(sequenceOrRandom).padStart(4, '0')
      : String(Math.floor(1000 + Math.random() * 9000));
  return `BST-${yyyy}${mm}-${seq}`;
}

/**
 * Standardized order inquiry message block
 */
export function formatOrderMessage(input: BoostingOrderDispatchInput): string {
  const serverIdText = input.serverId ? input.serverId : 'N/A';
  const startStars = input.startingStars ?? 0;
  const targetStars = input.targetStars ?? 0;

  const addonParts: string[] = [];
  if (input.addons?.rolePriority) {
    addonParts.push(`Role: ${input.addons.rolePriority}`);
  }
  if (input.addons?.restrictedHeroPool && input.addons.restrictedHeroPool.length > 0) {
    addonParts.push(`Hero Pool: ${input.addons.restrictedHeroPool.join(', ')}`);
  }
  if (input.addons?.duoPlayWithBooster) {
    addonParts.push('Duo Play');
  }
  const addonsSummary = addonParts.length > 0 ? addonParts.join(' | ') : 'None';

  let modeLabel = input.pricingMode || 'Fixed Tier';
  if (modeLabel === 'fixed_tier') modeLabel = 'Fixed Tier';
  else if (modeLabel === 'per_star') modeLabel = 'Per-Star Ladder';
  else if (modeLabel === 'composite') modeLabel = 'Composite Progression';

  const priceFormatted = Number(input.totalPriceInr).toFixed(2);

  return [
    `[SMEX STORE BOOSTING ORDER]`,
    `• Order Ref: #${input.orderRef}`,
    `• Customer IGN: ${input.customerIgn} (Server: ${serverIdText})`,
    ...(input.customerPhone ? [`• Customer Phone: ${input.customerPhone}`] : []),
    `• Game: Mobile Legends: Bang Bang`,
    `• Progression: ${input.startingRank} (${startStars}★) ➔ ${input.targetRank} (${targetStars}★)`,
    `• Pricing Mode: ${modeLabel}`,
    `• Add-ons: ${addonsSummary}`,
    `• Calculated Price: ₹${priceFormatted} INR`,
    `----------------------------------------`,
    `Please confirm booster availability and payment details.`,
  ].join('\n');
}

/**
 * Resolves WhatsApp handoff
 */
export function resolveWhatsAppHandoff(
  input: BoostingOrderDispatchInput,
  config?: Partial<BoostingDispatchConfig>
): { destinationUrl: string; formattedText: string; isDirectPhone: boolean } {
  const activeConfig = { ...getDispatchConfig(), ...config };
  const formattedText = formatOrderMessage(input);

  if (activeConfig.whatsappDirectPhone) {
    const directUrl = `https://wa.me/${activeConfig.whatsappDirectPhone}?text=${encodeURIComponent(formattedText)}`;
    return {
      destinationUrl: directUrl,
      formattedText,
      isDirectPhone: true,
    };
  }

  return {
    destinationUrl: activeConfig.whatsappChannelUrl,
    formattedText,
    isDirectPhone: false,
  };
}

/**
 * Resolves Instagram handoff
 */
export function resolveInstagramHandoff(
  input: BoostingOrderDispatchInput,
  config?: Partial<BoostingDispatchConfig>
): { destinationUrl: string; formattedText: string } {
  const activeConfig = { ...getDispatchConfig(), ...config };
  const formattedText = formatOrderMessage(input);

  return {
    destinationUrl: activeConfig.instagramUrl,
    formattedText,
  };
}

export class BoostingDispatchService {
  private config: BoostingDispatchConfig;

  constructor(customConfig?: Partial<BoostingDispatchConfig>) {
    this.config = { ...getDispatchConfig(), ...customConfig };
  }

  generateOrderRef(date?: Date): string {
    return generateOrderRef(date);
  }

  formatMessage(input: BoostingOrderDispatchInput): string {
    return formatOrderMessage(input);
  }

  resolveDispatch(
    channel: 'whatsapp' | 'instagram' | string,
    input: BoostingOrderDispatchInput
  ): { channel: string; destinationUrl: string; formattedText: string } {
    if (channel === 'instagram') {
      const ig = resolveInstagramHandoff(input, this.config);
      return {
        channel: 'instagram',
        destinationUrl: ig.destinationUrl,
        formattedText: ig.formattedText,
      };
    }

    const wa = resolveWhatsAppHandoff(input, this.config);
    return {
      channel: 'whatsapp',
      destinationUrl: wa.destinationUrl,
      formattedText: wa.formattedText,
    };
  }
}
