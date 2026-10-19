'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Tag,
  Flame,
  Star,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';

export interface CatalogListingGridProps {
  listings: MarketplaceListingItem[];
  isLoading: boolean;
}

export function CatalogListingGrid({ listings, isLoading }: CatalogListingGridProps) {
  if (isLoading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-primary" />
        <span className="text-sm">Fetching verified accounts...</span>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="w-full py-16 px-4 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col items-center justify-center text-center gap-3">
        <ImageIcon className="w-12 h-12 text-text-muted" />
        <h3 className="text-base font-bold text-text-primary">No Listings Found</h3>
        <p className="text-xs text-text-secondary max-w-sm">
          No active listings match your selected filters. Try broadening your search or rank filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {listings.map((item) => {
        const primaryProof = item.proofImages?.[0];
        const hasDiscount = item.badgeType === 'good_deal' && item.discountPct && item.discountPct > 0;

        return (
          <Link
            key={item.id}
            href={`/marketplace/${item.id}`}
            className="group rounded-2xl bg-bg-surface hover:bg-bg-surface-elevated border border-border-subtle hover:border-emerald-primary/60 overflow-hidden flex flex-col transition-all duration-120 ease-out hover:-translate-y-0.5 cursor-pointer shadow-md"
          >
            {/* Thumbnail Viewport */}
            <div className="relative aspect-video w-full bg-bg-canvas overflow-hidden flex items-center justify-center border-b border-border-subtle">
              {primaryProof ? (
                <Image
                  src={primaryProof.cdnUrl || `/api/v1/media/${primaryProof.s3Key}`}
                  alt={item.title}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-103 transition-transform duration-120 ease-out"
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-text-muted" />
              )}

              {/* Deal Badge */}
              {item.badgeType === 'good_deal' && (
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide bg-emerald-primary text-[#0B1A15] shadow-md flex items-center gap-1">
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
              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-bg-canvas/80 text-text-primary border border-border-subtle">
                {item.rankTier}
              </div>
            </div>

            {/* Listing Content */}
            <div className="p-4 flex flex-col flex-1 justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-bold text-text-primary group-hover:text-emerald-primary transition-colors duration-120 line-clamp-2">
                  {item.title}
                </h4>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-border-subtle/60">
                <span className="text-lg font-black text-emerald-primary">
                  ₹{item.priceInr} INR
                </span>
                {hasDiscount && item.baselinePriceInr && (
                  <span className="text-xs text-text-muted line-through font-medium">
                    ₹{item.baselinePriceInr}
                  </span>
                )}
              </div>

              {/* Seller Footer */}
              <div className="flex items-center justify-between text-xs text-text-secondary pt-1">
                <span className="truncate">
                  Seller: <strong className="text-text-primary">{item.seller?.username || 'Verified'}</strong>
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
  );
}
