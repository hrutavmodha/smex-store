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
}
