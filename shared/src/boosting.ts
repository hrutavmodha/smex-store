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
  basePriceInr?: string | number | null;
  pricePerStarInr?: string | number | null;
}
