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
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-[#8FA39C]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1FAE7A]" />
        <span className="text-sm">Fetching verified accounts...</span>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="w-full py-16 px-4 rounded-2xl bg-[#121C19] border border-[#223530] flex flex-col items-center justify-center text-center gap-3">
        <ImageIcon className="w-12 h-12 text-[#8FA39C]/60" />
        <h3 className="text-base font-bold text-[#E9F5F1]">No Listings Found</h3>
        <p className="text-xs text-[#8FA39C] max-w-sm">
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
  );
}
