'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMarketplaceListings } from '../lib/marketplace/api';
import { useSafeQueryClient } from '../providers/QueryProvider';
import type { MarketplaceListingItem, GetListingsParams } from '@smex/shared';

export function useCatalogListings() {
  const queryClient = useSafeQueryClient();
  const [page, setPage] = useState(1);

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

  // Reset to page 1 when any search filter changes (using useEffect, avoiding render-time mutation)
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setPage(1);
  }, [debouncedQuery, selectedRanks, minPrice, maxPrice, selectedBadge, sortBy]);

  const { data, isLoading } = useQuery(
    {
      queryKey: [
        'marketplace-listings',
        {
          debouncedQuery,
          selectedRanks,
          minPrice,
          maxPrice,
          selectedBadge,
          sortBy,
          page,
          limit,
        },
      ],
      queryFn: async () => {
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

        return fetchMarketplaceListings(params);
      },
      placeholderData: keepPreviousData,
    },
    queryClient
  );

  const listings: MarketplaceListingItem[] = data?.listings || [];
  const totalCount = data?.total ?? data?.listings?.length ?? 0;
  const totalPages =
    data?.totalPages ??
    (data?.total ? Math.ceil(data.total / (data.limit || limit)) : 1);

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
