'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  Filter,
  PlusCircle,
  Flame,
  Tag,
  Star,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import {
  fetchMarketplaceListings,
  type MarketplaceListingItem,
  type GetListingsParams,
} from '../../lib/marketplace/api';

const ALL_RANK_TIERS = [
  'Epic',
  'Legend',
  'Mythic',
  'Mythical Honor',
  'Mythical Glory',
  'Mythical Immortal',
] as const;

export function MarketplaceCatalog() {
  const [listings, setListings] = useState<MarketplaceListingItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRanks, setSelectedRanks] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [selectedBadge, setSelectedBadge] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const params: GetListingsParams = {
          sortBy,
          limit: 50,
        };

        if (searchQuery.trim()) {
          params.q = searchQuery.trim();
        }

        if (selectedRanks.length === 1) {
          params.rankTier = selectedRanks[0];
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
          let filtered = data.listings || [];
          if (selectedRanks.length > 1) {
            filtered = filtered.filter((l) => selectedRanks.includes(l.rankTier));
          }

          setListings(filtered);
          setTotalCount(filtered.length);
        }
      } catch {
        if (!cancelled) {
          setListings([]);
          setTotalCount(0);
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
  }, [searchQuery, selectedRanks, minPrice, maxPrice, selectedBadge, sortBy]);

  const toggleRank = (tier: string) => {
    setSelectedRanks((prev) =>
      prev.includes(tier) ? prev.filter((r) => r !== tier) : [...prev, tier]
    );
  };

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-[#121C19] border border-[#223530]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1FAE7A]/15 text-[#1FAE7A] border border-[#1FAE7A]/30">
              Verified ID Trading
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#16211D] text-[#8FA39C] border border-[#223530]">
              Zero In-App Fees
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#E9F5F1] tracking-tight">
            GAMING ID MARKETPLACE
          </h1>
          <p className="text-sm text-[#8FA39C] max-w-xl">
            Verified screenshot proofs. Community seller ratings. Direct negotiation via WhatsApp and Instagram.
          </p>
        </div>

        <Link
          href="/marketplace/create"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-[#0B1A15] bg-[#1FAE7A] hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 shrink-0 cursor-pointer shadow-lg"
        >
          <PlusCircle className="w-4 h-4" />
          Create Account Listing
        </Link>
      </div>

      {/* Main Layout: Filters Sidebar + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Filters Sidebar */}
        <aside className="w-full lg:sticky lg:top-24 p-5 rounded-2xl bg-[#121C19] border border-[#223530] flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-[#223530] pb-3">
            <div className="flex items-center gap-2 font-bold text-[#E9F5F1]">
              <Filter className="w-4 h-4 text-[#1FAE7A]" />
              <span>Filters</span>
            </div>
            {(selectedRanks.length > 0 || minPrice || maxPrice || selectedBadge || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedRanks([]);
                  setMinPrice('');
                  setMaxPrice('');
                  setSelectedBadge('');
                  setSearchQuery('');
                }}
                className="text-xs font-semibold text-[#1FAE7A] hover:underline cursor-pointer"
              >
                Reset All
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#8FA39C] uppercase tracking-wider">
              Search Titles
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA39C]" />
              <input
                type="text"
                placeholder="Search skins, rank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[#0B0F12] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120"
              />
            </div>
          </div>

          {/* Rank Tier Checkboxes */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#8FA39C] uppercase tracking-wider">
              Rank Tier
            </label>
            <div className="flex flex-col gap-2">
              {ALL_RANK_TIERS.map((tier) => (
                <label
                  key={tier}
                  className="flex items-center gap-2.5 text-sm text-[#E9F5F1] hover:text-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedRanks.includes(tier)}
                    onChange={() => toggleRank(tier)}
                    className="w-4 h-4 rounded border-[#223530] bg-[#0B0F12] text-[#1FAE7A] focus:ring-[#1FAE7A] focus:ring-offset-0 cursor-pointer"
                  />
                  <span>{tier}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range (INR) */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#8FA39C] uppercase tracking-wider">
              Price Range (INR)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-[#0B0F12] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-[#0B0F12] border border-[#223530] text-[#E9F5F1] placeholder-[#8FA39C] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120"
              />
            </div>
          </div>

          {/* Deal Badges */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-[#8FA39C] uppercase tracking-wider">
              Deal Badges
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedBadge((prev) => (prev === 'good_deal' ? '' : 'good_deal'))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-120 cursor-pointer text-left ${
                  selectedBadge === 'good_deal'
                    ? 'bg-[#1FAE7A] text-[#0B1A15]'
                    : 'bg-[#0B0F12] border border-[#223530] text-[#1FAE7A] hover:border-[#1FAE7A]'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Good Deals (Price Drops)
              </button>

              <button
                type="button"
                onClick={() => setSelectedBadge((prev) => (prev === 'hot' ? '' : 'hot'))}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-120 cursor-pointer text-left ${
                  selectedBadge === 'hot'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white'
                    : 'bg-[#0B0F12] border border-[#223530] text-amber-400 hover:border-amber-400'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Hot Premium & High Rank
              </button>
            </div>
          </div>
        </aside>

        {/* Listings Catalog Grid */}
        <main className="w-full lg:col-span-3 flex flex-col gap-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#121C19] border border-[#223530]">
            <span className="text-sm font-semibold text-[#E9F5F1]">
              {isLoading ? (
                'Loading listings...'
              ) : (
                <>
                  <span className="text-[#1FAE7A] font-bold">{totalCount}</span> Active Listings Found
                </>
              )}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8FA39C]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc')}
                className="px-3 py-1.5 rounded-lg bg-[#0B0F12] border border-[#223530] text-xs font-semibold text-[#E9F5F1] focus:outline-none focus:border-[#1FAE7A] transition-all duration-120 cursor-pointer"
              >
                <option value="newest">Newest Added</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-[#8FA39C]">
              <Loader2 className="w-8 h-8 animate-spin text-[#1FAE7A]" />
              <span className="text-sm">Fetching verified accounts...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="w-full py-16 px-4 rounded-2xl bg-[#121C19] border border-[#223530] flex flex-col items-center justify-center text-center gap-3">
              <ImageIcon className="w-12 h-12 text-[#8FA39C]/60" />
              <h3 className="text-base font-bold text-[#E9F5F1]">No Listings Found</h3>
              <p className="text-xs text-[#8FA39C] max-w-sm">
                No active listings match your selected filters. Try broadening your search or rank filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {listings.map((item) => {
                const primaryProof = item.proofImages?.[0];
                const hasDiscount = item.badgeType === 'good_deal' && item.discountPct && item.discountPct > 0;

                return (
                  <Link
                    key={item.id}
                    href={`/marketplace/${item.id}`}
                    className="group rounded-2xl bg-[#121C19] hover:bg-[#16211D] border border-[#223530] hover:border-[#1FAE7A]/60 overflow-hidden flex flex-col transition-all duration-120 ease-out hover:-translate-y-0.5 cursor-pointer shadow-md"
                  >
                    {/* Thumbnail Viewport */}
                    <div className="relative aspect-video w-full bg-[#0B0F12] overflow-hidden flex items-center justify-center border-b border-[#223530]">
                      {primaryProof ? (
                        <Image
                          src={primaryProof.cdnUrl || `/api/v1/media/${primaryProof.s3Key}`}
                          alt={item.title}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-103 transition-transform duration-120 ease-out"
                        />
                      ) : (
                        <ImageIcon className="w-10 h-10 text-[#8FA39C]/40" />
                      )}

                      {/* Deal Badge */}
                      {item.badgeType === 'good_deal' && (
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide bg-[#1FAE7A] text-[#0B1A15] shadow-md flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          Good Deal {hasDiscount ? `(-${item.discountPct}%)` : ''}
                        </div>
                      )}

                      {item.badgeType === 'hot' && (
                        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          Hot
                        </div>
                      )}

                      {/* Rank Tier Tag */}
                      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-[#0B0F12]/80 text-[#E9F5F1] border border-[#223530]">
                        {item.rankTier}
                      </div>
                    </div>

                    {/* Listing Content */}
                    <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <h4 className="text-sm font-bold text-[#E9F5F1] group-hover:text-[#1FAE7A] transition-colors duration-120 line-clamp-2">
                          {item.title}
                        </h4>
                      </div>

                      <div className="flex items-baseline gap-2 pt-2 border-t border-[#223530]/60">
                        <span className="text-lg font-black text-[#1FAE7A]">
                          ₹{item.priceInr} INR
                        </span>
                        {hasDiscount && item.baselinePriceInr && (
                          <span className="text-xs text-[#8FA39C] line-through font-medium">
                            ₹{item.baselinePriceInr}
                          </span>
                        )}
                      </div>

                      {/* Seller Footer */}
                      <div className="flex items-center justify-between text-xs text-[#8FA39C] pt-1">
                        <span className="truncate">
                          Seller: <strong className="text-[#E9F5F1]">{item.seller?.username || 'Verified'}</strong>
                        </span>
                        <div className="flex items-center gap-1 text-amber-400 font-bold shrink-0">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{item.seller?.reputationScore?.toFixed(1) || '5.0'}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
