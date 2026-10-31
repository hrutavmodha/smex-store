export type ListingStatus = 'active' | 'sold' | 'deleted';
export type ListingBadgeType = 'none' | 'good_deal' | 'hot';
export type ContactChannel = 'whatsapp' | 'instagram';

export interface ProofImageItem {
  id?: string;
  s3Key: string;
  cdnUrl: string;
  displayOrder?: number;
}

export interface MarketplaceSeller {
  userId: string;
  username: string;
  avatarPreset: string;
  inGameId?: string | null;
  reputationScore: number;
  reviewCount: number;
  completedSales: number;
}

export interface MarketplaceListingItem {
  id: string;
  sellerId: string;
  title: string;
  gameSlug: string;
  rankTier: string;
  peakRank?: string;
  priceInr: string;
  baselinePriceInr?: string | null;
  badgeType: ListingBadgeType;
  status: ListingStatus;
  contactChannel: ContactChannel;
  contactHandle: string;
  discountPct?: number;
  createdAt: string;
  updatedAt: string;
  proofImages: ProofImageItem[];
  seller?: MarketplaceSeller;
  totalSkins?: number;
  totalHeroes?: number;
  accountLevel?: number;
  winrate?: string;
  totalMatches?: number;
  collectionPoints?: string;
  emblemsStatus?: string;
  serverRegion?: string;
  bindingStatus?: string;
  highlightAttributes?: string[];
}

export interface GetListingsParams {
  q?: string;
  gameSlug?: string;
  rankTier?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  badgeType?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export interface GetListingsResponse {
  listings: MarketplaceListingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateListingPayload {
  title: string;
  gameSlug?: string;
  rankTier: string;
  priceInr: number;
  contactChannel: ContactChannel;
  contactHandle: string;
  proofImages?: ProofImageItem[];
}
