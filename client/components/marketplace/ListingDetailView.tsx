'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Tag,
  Flame,
  ShieldCheck,
  Star,
  CheckCircle,
  MessageCircle,
} from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';
import { ProofLightboxCarousel } from './ProofLightboxCarousel';
import { SellerContactModal } from './SellerContactModal';

export interface ListingDetailViewProps {
  listing: MarketplaceListingItem;
}

export function ListingDetailView({ listing }: ListingDetailViewProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const hasDiscount = listing.badgeType === 'good_deal' && listing.discountPct && listing.discountPct > 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-emerald-primary transition-colors duration-120"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
      </div>

      {/* Main Grid: Left Carousel, Right Information Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Screenshot Carousel */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <ProofLightboxCarousel
            proofImages={listing.proofImages || []}
            title={listing.title}
          />
        </div>

        {/* Right Column: Listing & Seller Information */}
        <div className="lg:col-span-5 flex flex-col gap-6 p-6 rounded-2xl bg-bg-surface border border-border-subtle">
          {/* Badges & Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-bg-surface-elevated text-text-primary border border-border-subtle">
              {listing.rankTier}
            </span>

            {listing.badgeType === 'good_deal' && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-primary text-[#0B1A15] flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Good Deal {hasDiscount ? `(-${listing.discountPct}%)` : ''}
              </span>
            )}

            {listing.badgeType === 'hot' && (
              <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-rose-500 text-white flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                Hot
              </span>
            )}

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {listing.status === 'active' ? 'Active' : listing.status.toUpperCase()}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-black text-text-primary leading-snug">
            {listing.title}
          </h1>

          {/* Pricing Box */}
          <div className="p-4 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
              Listing Price
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black text-emerald-primary">
                ₹{listing.priceInr} INR
              </span>
              {hasDiscount && listing.baselinePriceInr && (
                <span className="text-sm font-semibold text-text-muted line-through">
                  ₹{listing.baselinePriceInr} INR
                </span>
              )}
            </div>
            {hasDiscount && (
              <span className="text-xs font-bold text-emerald-primary mt-0.5">
                Saved {listing.discountPct}% from original price!
              </span>
            )}
          </div>

          {/* Seller Information */}
          <div className="p-4 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col gap-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Seller Information
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-canvas border border-border-subtle flex items-center justify-center font-bold text-emerald-primary text-sm uppercase">
                  {listing.seller?.username?.substring(0, 2) || 'SM'}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">
                    {listing.seller?.username || 'Verified Seller'}
                  </span>
                  <span className="text-xs text-text-secondary">
                    Completed Sales: {listing.seller?.completedSales || 0} IDs
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-canvas border border-border-subtle text-amber-400 font-bold text-xs">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{listing.seller?.reputationScore?.toFixed(1) || '5.0'} / 5</span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="w-full py-4 px-6 rounded-xl font-bold text-base text-center text-[#0B1A15] bg-emerald-primary hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            Contact Seller (Direct Chat)
          </button>

          {/* Trust Guarantees */}
          <div className="flex items-center gap-2 text-xs text-text-secondary pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-primary shrink-0" />
            <span>Zero Smex Store fees • Direct communication on {listing.contactChannel.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Contact Seller Modal */}
      <SellerContactModal
        listing={listing}
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  );
}
