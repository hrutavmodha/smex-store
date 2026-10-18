'use client';

import React from 'react';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { useCatalogListings } from '../../hooks/useCatalogListings';
import { CatalogFilterSidebar } from './CatalogFilterSidebar';
import { CatalogListingGrid } from './CatalogListingGrid';

export function MarketplaceCatalog() {
  const {
    listings,
    totalCount,
    page,
    setPage,
    totalPages,
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
  } = useCatalogListings();

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
        <CatalogFilterSidebar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedRanks={selectedRanks}
          toggleRank={toggleRank}
          minPrice={minPrice}
          setMinPrice={setMinPrice}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          selectedBadge={selectedBadge}
          setSelectedBadge={setSelectedBadge}
          resetFilters={resetFilters}
        />

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
                  {totalCount > 0 && totalPages > 1 && (
                    <span className="text-xs text-[#8FA39C] ml-2">
                      (Page {page} of {totalPages})
                    </span>
                  )}
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
          <CatalogListingGrid listings={listings} isLoading={isLoading} />

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <nav
              aria-label="Marketplace pagination"
              className="flex items-center justify-between p-4 rounded-xl bg-[#121C19] border border-[#223530]"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                aria-label="Previous page"
                className="px-4 py-2 rounded-lg bg-[#0B0F12] border border-[#223530] text-xs font-bold text-[#E9F5F1] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#1FAE7A] hover:text-[#1FAE7A] transition-all duration-120 cursor-pointer"
              >
                Previous
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold text-[#8FA39C]">
                <span>
                  Page <strong className="text-[#E9F5F1]">{page}</strong> of{' '}
                  <strong className="text-[#E9F5F1]">{totalPages}</strong>
                </span>
                <span className="hidden sm:inline text-[#8FA39C]/60">•</span>
                <span className="hidden sm:inline">
                  Showing {listings.length} of {totalCount} listings
                </span>
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                aria-label="Next page"
                className="px-4 py-2 rounded-lg bg-[#0B0F12] border border-[#223530] text-xs font-bold text-[#E9F5F1] disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#1FAE7A] hover:text-[#1FAE7A] transition-all duration-120 cursor-pointer"
              >
                Next
              </button>
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}

export default MarketplaceCatalog;
