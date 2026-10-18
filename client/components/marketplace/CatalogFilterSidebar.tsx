'use client';

import React from 'react';
import { Filter, Search, Tag, Flame } from 'lucide-react';

export const ALL_RANK_TIERS = [
  'Epic',
  'Legend',
  'Mythic',
  'Mythical Honor',
  'Mythical Glory',
  'Mythical Immortal',
] as const;

export interface CatalogFilterSidebarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRanks: string[];
  toggleRank: (tier: string) => void;
  minPrice: string;
  setMinPrice: (price: string) => void;
  maxPrice: string;
  setMaxPrice: (price: string) => void;
  selectedBadge: string;
  setSelectedBadge: React.Dispatch<React.SetStateAction<string>>;
  resetFilters: () => void;
}

export function CatalogFilterSidebar({
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
  resetFilters,
}: CatalogFilterSidebarProps) {
  const hasActiveFilters =
    selectedRanks.length > 0 || minPrice || maxPrice || selectedBadge || searchQuery;

  return (
    <aside className="w-full lg:sticky lg:top-24 p-5 rounded-2xl bg-[#121C19] border border-[#223530] flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#223530] pb-3">
        <div className="flex items-center gap-2 font-bold text-[#E9F5F1]">
          <Filter className="w-4 h-4 text-[#1FAE7A]" />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
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
                aria-label={tier}
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
  );
}
