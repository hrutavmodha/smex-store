import { fetchWithAuth } from '../api';
import type {
  MarketplaceListingItem,
  GetListingsParams,
  GetListingsResponse,
} from '@smex/shared';

export async function fetchMarketplaceListings(
  params: GetListingsParams = {},
  apiBaseUrl: string = ''
): Promise<GetListingsResponse> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.gameSlug) query.set('gameSlug', params.gameSlug);
  if (params.rankTier) query.set('rankTier', params.rankTier);
  if (params.minPrice !== undefined) query.set('minPrice', params.minPrice.toString());
  if (params.maxPrice !== undefined) query.set('maxPrice', params.maxPrice.toString());
  if (params.badgeType) query.set('badgeType', params.badgeType);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());

  const res = await fetch(`${apiBaseUrl}/api/v1/marketplace/listings?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to load marketplace listings.');
  }
  return res.json();
}

export async function fetchMarketplaceListingById(
  id: string,
  apiBaseUrl: string = ''
): Promise<MarketplaceListingItem> {
  const res = await fetch(`${apiBaseUrl}/api/v1/marketplace/listings/${id}`);
  if (!res.ok) {
    throw new Error('Failed to load listing details.');
  }
  return res.json();
}

export interface CreateListingPayload {
  title: string;
  gameSlug?: string;
  rankTier: string;
  priceInr: number;
  contactChannel: 'whatsapp' | 'instagram';
  contactHandle: string;
  proofImages?: { s3Key: string; cdnUrl: string; displayOrder?: number }[];
}

export async function createMarketplaceListing(
  payload: CreateListingPayload,
  apiBaseUrl: string = ''
): Promise<MarketplaceListingItem> {
  const res = await fetchWithAuth(`${apiBaseUrl}/api/v1/marketplace/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create listing.');
  }

  return res.json();
}

export async function updateMarketplaceListingStatus(
  id: string,
  status: 'active' | 'sold' | 'deleted',
  apiBaseUrl: string = ''
): Promise<MarketplaceListingItem> {
  const res = await fetchWithAuth(`${apiBaseUrl}/api/v1/marketplace/listings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error('Failed to update listing status.');
  }

  return res.json();
}
