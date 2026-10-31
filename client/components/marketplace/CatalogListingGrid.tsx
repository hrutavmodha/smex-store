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
  ShieldCheck,
  Check,
  Eye,
} from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';
import { WhatsAppIcon } from '../shell/SocialIcons';

export interface CatalogListingGridProps {
  listings: MarketplaceListingItem[];
  isLoading: boolean;
}

export function CatalogListingGrid({ listings, isLoading }: CatalogListingGridProps) {
  if (isLoading) {
    return (
      <div className="w-full py-20 flex flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-primary" />
        <span className="text-sm font-mono">Fetching verified accounts...</span>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="w-full py-16 px-4 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col items-center justify-center text-center gap-3">
        <ImageIcon className="w-12 h-12 text-text-muted opacity-60" />
        <h3 className="text-base font-bold text-text-primary">No Listings Found</h3>
        <p className="text-xs text-text-secondary max-w-sm">
          No active listings match your selected filters. Inventory updates frequently from verified dealers.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {listings.map((item) => {
        const primaryProof = item.proofImages?.[0];
        const hasDiscount = item.badgeType === 'good_deal' && item.discountPct && item.discountPct > 0;

        // Nexus-style specs with fallback defaults for seamless inventory presentation
        const peakRank = item.peakRank || (item.rankTier.includes('Mythic') ? 'Mythical Immortal' : 'Mythic Glory');
        const skinsCount = item.totalSkins ?? 280;
        const heroesCount = item.totalHeroes ?? 125;
        const accLevel = item.accountLevel ?? 88;
        const winrateText = item.winrate ?? '58% WR (4,200 matches)';
        const emblemText = item.emblemsStatus ?? 'All Emblems 60 Max';
        const serverBinding = item.serverRegion
          ? `${item.serverRegion} | ${item.bindingStatus || 'Fresh Bind Ready'}`
          : 'India | Moonton Clean Bind';

        const highlightTags = item.highlightAttributes && item.highlightAttributes.length > 0
          ? item.highlightAttributes
          : ['Collector skin', 'Starlight skin', 'All emblems maxed'];

        // Direct WhatsApp inquiry URL for action control
        const waCleanHandle = item.contactChannel === 'whatsapp'
          ? item.contactHandle.replace(/[^0-9]/g, '')
          : '';
        const waMsg = encodeURIComponent(
          `Hello! I want to buy "${item.title}" (Price: ₹${item.priceInr} INR, Rank: ${item.rankTier}). Please verify account availability and escrow.`
        );
        const directWhatsAppUrl = waCleanHandle
          ? `https://wa.me/${waCleanHandle}?text=${waMsg}`
          : `https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w`;

        return (
          <div
            key={item.id}
            data-testid="nexus-account-card"
            className="group rounded-2xl bg-[#080808] border border-border-subtle hover:border-emerald-primary/70 transition-all duration-[120ms] ease-out hover:-translate-y-1 flex flex-col overflow-hidden shadow-2xl relative"
          >
            {/* Top Glow Accent */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-120" />

            {/* Thumbnail Viewport */}
            <Link href={`/marketplace/${item.id}`} className="relative aspect-[16/10] w-full bg-[#030303] overflow-hidden flex items-center justify-center border-b border-border-subtle/80 block">
              {primaryProof ? (
                <Image
                  src={primaryProof.cdnUrl || `/api/v1/media/${primaryProof.s3Key}`}
                  alt={item.title}
                  fill
                  unoptimized
                  className="object-cover group-hover:scale-105 transition-transform duration-[120ms] ease-out"
                />
              ) : (
                <ImageIcon className="w-10 h-10 text-text-muted" />
              )}

              {/* Deal & Promo Badges */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                {item.badgeType === 'good_deal' && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase bg-emerald-primary text-[#0B1A15] shadow-lg flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Good Deal {hasDiscount ? `(-${item.discountPct}%)` : ''}
                  </span>
                )}
                {item.badgeType === 'hot' && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-lg flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    Hot
                  </span>
                )}
              </div>

              {/* Rank Dual-Badge Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-black/85 backdrop-blur-md text-emerald-primary border border-emerald-primary/40 shadow-lg">
                  <span>Current: <strong>{item.rankTier}</strong></span>
                  <span className="text-text-muted">•</span>
                  <span className="text-amber-400">Peak: <strong>{peakRank}</strong></span>
                </div>
              </div>
            </Link>

            {/* Account Card Content */}
            <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-4">
              <div>
                <Link href={`/marketplace/${item.id}`} className="block">
                  <h3 className="text-base font-bold text-text-primary group-hover:text-emerald-primary transition-colors duration-120 line-clamp-1">
                    {item.title}
                  </h3>
                </Link>

                {/* Account Spec Metrics Grid (Nexus-Style 2x3 Grid) */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-[#111111] border border-border-subtle/60 flex items-center justify-between">
                    <span className="text-text-muted">Skins:</span>
                    <strong className="text-text-primary">{skinsCount} Skins</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-border-subtle/60 flex items-center justify-between">
                    <span className="text-text-muted">Heroes:</span>
                    <strong className="text-text-primary">{heroesCount} Heroes</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-border-subtle/60 flex items-center justify-between">
                    <span className="text-text-muted">Level:</span>
                    <strong className="text-text-primary">Lvl {accLevel}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-[#111111] border border-border-subtle/60 flex items-center justify-between">
                    <span className="text-text-muted">Emblems:</span>
                    <strong className="text-emerald-primary truncate">{emblemText}</strong>
                  </div>
                </div>

                {/* Server & Binding */}
                <div className="mt-2 px-2 py-1.5 rounded-lg bg-[#111111] border border-border-subtle/60 text-[10px] font-mono text-text-secondary flex items-center justify-between">
                  <span className="text-text-muted">Server & Bind:</span>
                  <span className="text-text-primary font-bold truncate">{serverBinding}</span>
                </div>

                {/* Highlight Attribute Pills */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {highlightTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-bg-surface-elevated text-emerald-primary border border-emerald-primary/30 flex items-center gap-1"
                    >
                      <Check className="w-2.5 h-2.5 shrink-0" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Pricing & Controls */}
              <div className="pt-3 border-t border-border-subtle/80 flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black font-mono text-emerald-primary">
                      ₹{item.priceInr} INR
                    </span>
                    {hasDiscount && item.baselinePriceInr && (
                      <span className="text-xs text-text-muted line-through font-mono">
                        ₹{item.baselinePriceInr}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-text-secondary">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{item.seller?.reputationScore?.toFixed(1) || '5.0'}</span>
                  </div>
                </div>

                {/* Dual Action Controls */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/marketplace/${item.id}`}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold text-center text-text-primary bg-bg-surface-elevated hover:bg-bg-surface border border-border-subtle hover:border-emerald-primary/50 transition-colors duration-[120ms] flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </Link>

                  <a
                    href={directWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl text-xs font-bold text-center text-black bg-emerald-primary hover:bg-[#20ba5a] transition-all duration-[120ms] flex items-center justify-center gap-1.5 shadow-md shadow-emerald-primary/20"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5" />
                    <span>Buy / Inquire</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
