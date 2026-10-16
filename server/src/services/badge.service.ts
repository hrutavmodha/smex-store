export type BadgeType = 'none' | 'good_deal' | 'hot';

export interface BadgeComputationResult {
  badgeType: BadgeType;
  discountPct: number;
  baselinePriceInr: number;
}

export const TOP_COMPETITIVE_TIERS = ['Mythical Glory', 'Mythical Immortal'] as const;
export const PREMIUM_PRICE_THRESHOLD = 5000;
export const MIN_DISCOUNT_PERCENTAGE = 5;
export const MIN_PRICE_FLOOR = 100;

export class BadgeService {
  public static isTopCompetitiveTier(rankTier?: string): boolean {
    if (!rankTier) return false;
    const normalized = rankTier.trim().toLowerCase();
    return TOP_COMPETITIVE_TIERS.some(
      (tier) => tier.toLowerCase() === normalized
    );
  }

  public static isPremiumPrice(priceInr: number): boolean {
    return priceInr >= PREMIUM_PRICE_THRESHOLD;
  }

  public static computeInitialBadge(params: {
    priceInr: number;
    rankTier?: string;
  }): BadgeComputationResult {
    const { priceInr, rankTier } = params;

    if (this.isTopCompetitiveTier(rankTier) || this.isPremiumPrice(priceInr)) {
      return {
        badgeType: 'hot',
        discountPct: 0,
        baselinePriceInr: priceInr,
      };
    }

    return {
      badgeType: 'none',
      discountPct: 0,
      baselinePriceInr: priceInr,
    };
  }

  public static computeUpdatedBadge(params: {
    newPriceInr: number;
    baselinePriceInr: number;
    rankTier?: string;
  }): BadgeComputationResult {
    const { newPriceInr, baselinePriceInr, rankTier } = params;

    // Price reduced
    if (newPriceInr < baselinePriceInr) {
      const rawDiscount = ((baselinePriceInr - newPriceInr) / baselinePriceInr) * 100;
      const discountPct = Math.round(rawDiscount);

      if (discountPct >= MIN_DISCOUNT_PERCENTAGE) {
        return {
          badgeType: 'good_deal',
          discountPct,
          baselinePriceInr,
        };
      }

      return {
        badgeType: 'none',
        discountPct: 0,
        baselinePriceInr,
      };
    }

    // Price increased: resets baseline and assigns 'hot'
    if (newPriceInr > baselinePriceInr) {
      return {
        badgeType: 'hot',
        discountPct: 0,
        baselinePriceInr: newPriceInr,
      };
    }

    // Price unchanged: retain hot if top tier or premium, otherwise none
    if (this.isTopCompetitiveTier(rankTier) || this.isPremiumPrice(newPriceInr)) {
      return {
        badgeType: 'hot',
        discountPct: 0,
        baselinePriceInr,
      };
    }

    return {
      badgeType: 'none',
      discountPct: 0,
      baselinePriceInr,
    };
  }
}
