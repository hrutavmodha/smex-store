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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-bg-surface border border-border-subtle">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-primary/15 text-emerald-primary border border-emerald-primary/30">
              Verified ID Trading
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-surface-elevated text-text-secondary border border-border-subtle">
              Zero In-App Fees
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
            GAMING ID MARKETPLACE
          </h1>
          <p className="text-sm text-text-secondary max-w-xl">
            Verified screenshot proofs. Community seller ratings. Direct negotiation via WhatsApp and Instagram.
          </p>
        </div>

        <Link
          href="/marketplace/create"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-[#0B1A15] bg-emerald-primary hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 shrink-0 cursor-pointer shadow-lg"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-bg-surface border border-border-subtle">
            <span className="text-sm font-semibold text-text-primary">
              {isLoading ? (
                'Loading listings...'
              ) : (
                <>
                  <span className="text-emerald-primary font-bold">{totalCount}</span> Active Listings Found
                  {totalCount > 0 && totalPages > 1 && (
                    <span className="text-xs text-text-secondary ml-2">
                      (Page {page} of {totalPages})
                    </span>
                  )}
                </>
              )}
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'price_asc' | 'price_desc')}
                className="px-3 py-1.5 rounded-lg bg-bg-canvas border border-border-subtle text-xs font-semibold text-text-primary focus:outline-none focus:border-emerald-primary transition-all duration-120 cursor-pointer"
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
              className="flex items-center justify-between p-4 rounded-xl bg-bg-surface border border-border-subtle"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                aria-label="Previous page"
                className="px-4 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-xs font-bold text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-emerald-primary hover:text-emerald-primary transition-all duration-120 cursor-pointer"
              >
                Previous
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
                <span>
                  Page <strong className="text-text-primary">{page}</strong> of{' '}
                  <strong className="text-text-primary">{totalPages}</strong>
                </span>
                <span className="hidden sm:inline text-text-muted">•</span>
                <span className="hidden sm:inline">
                  Showing {listings.length} of {totalCount} listings
                </span>
              </div>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                aria-label="Next page"
                className="px-4 py-2 rounded-lg bg-bg-canvas border border-border-subtle text-xs font-bold text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:border-emerald-primary hover:text-emerald-primary transition-all duration-120 cursor-pointer"
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
