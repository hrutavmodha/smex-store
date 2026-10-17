import { fetchWithAuth } from '../api';
import type {
  MarketplaceListingItem,
  GetListingsParams,
  GetListingsResponse,
  CreateListingPayload,
} from '@smex/shared';

export async function fetchMarketplaceListings(
  params: GetListingsParams = {},
  apiBaseUrl: string = ''
): Promise<GetListingsResponse> {
  const { q, gameSlug, rankTier, minPrice, maxPrice, badgeType, sortBy, page, limit } = params;
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (gameSlug) query.set('gameSlug', gameSlug);
  if (rankTier) query.set('rankTier', rankTier);
  if (minPrice !== undefined) query.set('minPrice', minPrice.toString());
  if (maxPrice !== undefined) query.set('maxPrice', maxPrice.toString());
  if (badgeType) query.set('badgeType', badgeType);
  if (sortBy) query.set('sortBy', sortBy);
  if (page) query.set('page', page.toString());
  if (limit) query.set('limit', limit.toString());

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
