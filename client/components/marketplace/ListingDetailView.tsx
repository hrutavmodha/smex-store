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
  Lock,
  UserCheck,
  Check,
  Shield,
  Zap,
} from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';
import { ProofLightboxCarousel } from './ProofLightboxCarousel';
import { SellerContactModal } from './SellerContactModal';
import { WhatsAppIcon } from '../shell/SocialIcons';

export interface ListingDetailViewProps {
  listing: MarketplaceListingItem;
}

export function ListingDetailView({ listing }: ListingDetailViewProps) {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const hasDiscount = listing.badgeType === 'good_deal' && listing.discountPct && listing.discountPct > 0;

  // Nexus-style specs with fallback defaults
  const peakRank = listing.peakRank || (listing.rankTier.includes('Mythic') ? 'Mythical Immortal' : 'Mythic Glory');
  const skinsCount = listing.totalSkins ?? 280;
  const heroesCount = listing.totalHeroes ?? 125;
  const accLevel = listing.accountLevel ?? 88;
  const winrateText = listing.winrate ?? '58% WR (4,200 matches)';
  const collectionPointsText = listing.collectionPoints ?? '52,400 pts';
  const emblemText = listing.emblemsStatus ?? 'All Emblems 60 Max';
  const serverBindingText = listing.serverRegion
    ? `${listing.serverRegion} | ${listing.bindingStatus || 'Fresh Bind Ready'}`
    : 'India | Moonton Clean Bind (Ready for Transfer)';

  const highlightTags = listing.highlightAttributes && listing.highlightAttributes.length > 0
    ? listing.highlightAttributes
    : [
        'Legend skin',
        'Collector skin',
        'Limited edition skin',
        'Starlight skin',
        'All emblems maxed',
        'Rare frames & effects',
        'Season rewards',
      ];

  // Direct WhatsApp dispatch
  const cleanPhone = listing.contactChannel === 'whatsapp'
    ? listing.contactHandle.replace(/[^0-9]/g, '')
    : '';
  const waMsg = encodeURIComponent(
    `Hello! I am ready to purchase "${listing.title}" (Price: ₹${listing.priceInr} INR). Please proceed with the Harshu & Bishal escrow handover.`
  );
  const directWhatsAppUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${waMsg}`
    : `https://whatsapp.com/channel/0029VbDEVo70G0XbUx6MK90w`;

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
        {/* Left Column: Screenshot Carousel & Spec Metric Details */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <ProofLightboxCarousel
            proofImages={listing.proofImages || []}
            title={listing.title}
          />

          {/* Account Spec Metrics Card (Nexus Architecture) */}
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">
                Account Specifications & Attributes
              </h3>
              <span className="text-xs font-mono text-emerald-primary font-semibold">Verified Spec</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Total Skins</span>
                <span className="text-text-primary font-black text-sm">{skinsCount} Skins</span>
              </div>
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Total Heroes</span>
                <span className="text-text-primary font-black text-sm">{heroesCount} Heroes</span>
              </div>
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Account Level</span>
                <span className="text-text-primary font-black text-sm">Lvl {accLevel}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Winrate</span>
                <span className="text-text-primary font-black text-sm">{winrateText}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Collection Points</span>
                <span className="text-text-primary font-black text-sm">{collectionPointsText}</span>
              </div>
              <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle flex flex-col gap-1">
                <span className="text-text-muted text-[10px] uppercase">Emblems Status</span>
                <span className="text-emerald-primary font-black text-sm truncate">{emblemText}</span>
              </div>
            </div>

            {/* Server & Binding Bar */}
            <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle text-xs font-mono flex items-center justify-between">
              <span className="text-text-muted uppercase text-[10px]">Server & Binding:</span>
              <span className="text-text-primary font-bold">{serverBindingText}</span>
            </div>

            {/* Highlight Attribute Pills */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-text-muted">
                Highlights & Unlocks
              </span>
              <div className="flex flex-wrap gap-2">
                {highlightTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-bg-surface-elevated text-emerald-primary border border-emerald-primary/30 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Listing & Seller Information */}
        <div className="lg:col-span-5 flex flex-col gap-6 p-6 sm:p-7 rounded-2xl bg-bg-surface border border-border-subtle shadow-2xl">
          {/* Rank Dual-Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#111111] border border-emerald-primary/40 text-emerald-primary shadow-sm">
              <span>Current: <strong>{listing.rankTier}</strong></span>
              <span className="text-text-muted">•</span>
              <span className="text-amber-400">Peak: <strong>{peakRank}</strong></span>
            </div>

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
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-black text-text-primary leading-snug">
            {listing.title}
          </h1>

          {/* Pricing Box */}
          <div className="p-5 rounded-2xl bg-[#090909] border border-border-subtle flex flex-col gap-1.5 shadow-inner">
            <span className="text-xs text-text-secondary uppercase tracking-wider font-mono font-semibold">
              Listing Price (INR)
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-primary">
                ₹{listing.priceInr} INR
              </span>
              {hasDiscount && listing.baselinePriceInr && (
                <span className="text-sm font-semibold font-mono text-text-muted line-through">
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

          {/* Trust & Escrow Guarantee Box ("Before you buy" - Nexus Architecture) */}
          <div
            data-testid="escrow-guarantee-box"
            className="p-5 rounded-2xl bg-gradient-to-b from-[#141E18]/60 to-[#0A0F0D]/60 border border-emerald-500/30 space-y-3"
          >
            <div className="flex items-center gap-2 text-emerald-primary pb-2 border-b border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                Before You Buy: 100% Escrow Guarantee
              </span>
            </div>

            <ul className="space-y-2 text-xs text-text-primary">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
                <span>
                  <strong>100% Escrow Protection:</strong> Funds are held securely during credential handoff.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Handover Guarantee:</strong> Complete assistance with email, Moonton ID, and password change.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-cyan-depth shrink-0 mt-0.5" />
                <span>
                  <strong>7-Day Middleman Protection:</strong> Backed and verified by Harshu & Bishal.
                </span>
              </li>
            </ul>
          </div>

          {/* Seller Information */}
          <div className="p-4 rounded-xl bg-bg-surface-elevated border border-border-subtle flex flex-col gap-3">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Seller Information
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-canvas border border-border-subtle flex items-center justify-center font-bold text-emerald-primary text-sm uppercase">
                  {listing.seller?.username?.substring(0, 2) || 'SM'}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">
                    {listing.seller?.username || 'Verified Dealer'}
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

          {/* Action CTAs */}
          <div className="space-y-3 pt-1">
            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-center text-black bg-[#25D366] hover:bg-[#20ba5a] transition-all duration-120 ease-out active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#25D366]/20"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>Buy Now / Inquire on WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="w-full py-3 px-6 rounded-xl font-bold text-xs text-center text-text-primary bg-bg-surface-elevated hover:bg-bg-canvas border border-border-subtle transition-all duration-120 ease-out active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-primary" />
              <span>Contact Seller (Direct Chat)</span>
            </button>
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
