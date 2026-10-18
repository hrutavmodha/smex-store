'use client';

import { useState, useEffect } from 'react';
import { fetchMarketplaceListings } from '../lib/marketplace/api';
import type { MarketplaceListingItem, GetListingsParams } from '@smex/shared';

export function useCatalogListings() {
  const [listings, setListings] = useState<MarketplaceListingItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedBadge, setSelectedBadge] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  const limit = 50;

  // Keystroke debounce timer (300ms) to prevent network request flooding (BUG-M7-004)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when any search filter changes
  const filterKey = `${debouncedQuery}:${selectedRanks.join(',')}:${minPrice}:${maxPrice}:${selectedBadge}:${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const params: GetListingsParams = {
          sortBy,
          page,
          limit,
        };

        if (debouncedQuery.trim()) {
          params.q = debouncedQuery.trim();
        }

        if (selectedRanks.length > 0) {
          params.rankTier = selectedRanks.length === 1 ? selectedRanks[0] : selectedRanks;
        }

        if (minPrice && !isNaN(Number(minPrice))) {
          params.minPrice = Number(minPrice);
        }

        if (maxPrice && !isNaN(Number(maxPrice))) {
          params.maxPrice = Number(maxPrice);
        }

        if (selectedBadge) {
          params.badgeType = selectedBadge;
        }

        const data = await fetchMarketplaceListings(params);

        if (!cancelled) {
          setListings(data.listings || []);
          setTotalCount(data.total ?? data.listings?.length ?? 0);
          setTotalPages(data.totalPages ?? (data.total ? Math.ceil(data.total / (data.limit || limit)) : 1));
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, selectedRanks, minPrice, maxPrice, selectedBadge, sortBy, page]);

  const toggleRank = (tier: string) => {
    setSelectedRanks((prev) =>
      prev.includes(tier) ? prev.filter((r) => r !== tier) : [...prev, tier]
    );
  };

  const resetFilters = () => {
    setSelectedRanks([]);
    setMinPrice('');
    setMaxPrice('');
    setSelectedBadge('');
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
  };

  return {
    listings,
    totalCount,
    page,
    setPage,
    totalPages,
    limit,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedRanks,
    toggleRank,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    selectedBadge,
    setSelectedBadge,
    sortBy,
    setSortBy,
    resetFilters,
  };
}
