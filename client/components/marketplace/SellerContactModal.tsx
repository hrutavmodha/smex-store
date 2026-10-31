'use client';

import React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';
import { InstagramIcon, WhatsAppIcon } from '../shell/SocialIcons';


export interface SellerContactModalProps {
  listing: MarketplaceListingItem;
  isOpen: boolean;
  onClose: () => void;
}

export function SellerContactModal({ listing, isOpen, onClose }: SellerContactModalProps) {
  if (!isOpen) return null;

  const { title, contactChannel, contactHandle, priceInr } = listing;

  const getContactUrl = () => {
    const cleanHandle = contactHandle.trim();
    const encodedMsg = encodeURIComponent(
      `Hello! I am inquiring about your Smex Store listing "${title}" (Price: ₹${priceInr} INR).`
    );

    if (contactChannel === 'whatsapp') {
      const phone = cleanHandle.replace(/[^0-9]/g, '');
      return `https://wa.me/${phone}?text=${encodedMsg}`;
    }

    if (contactChannel === 'instagram') {
      const username = cleanHandle.replace(/^@/, '');
      return `https://instagram.com/${username}`;
    }

    return null;
  };

  const contactUrl = getContactUrl();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-bg-surface border border-border-subtle p-6 shadow-2xl transition-all duration-120 ease-out">
        {/* Close Button */}
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-bg-surface-elevated transition-colors duration-120 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-bg-canvas border border-border-subtle">
            {contactChannel === 'whatsapp' ? (
              <WhatsAppIcon className="w-5 h-5 text-[#25D366]" />
            ) : (
              <InstagramIcon className="w-5 h-5 text-[#E1306C]" />
            )}
          </div>
          <div>
            <h3 id="contact-modal-title" className="text-lg font-bold text-text-primary">
              Contact Seller
            </h3>
            <p className="text-xs text-text-secondary">Direct external peer-to-peer negotiation</p>
          </div>
        </div>

        {/* Listing Summary Card */}
        <div className="p-3.5 rounded-xl bg-bg-canvas border border-border-subtle mb-5 flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-emerald-primary uppercase tracking-wider">
            Listing Target
          </span>
          <p className="text-sm font-semibold text-text-primary line-clamp-2">{title}</p>
          <p className="text-sm font-bold text-emerald-primary">₹{priceInr} INR</p>
        </div>

        {/* Contact Handle Details */}
        <div className="mb-5 flex flex-col gap-2">
          <span className="text-xs font-medium text-text-secondary">Preferred Communication Channel</span>
          <div className="flex items-center justify-between p-3 rounded-xl bg-bg-surface-elevated border border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary capitalize">{contactChannel}:</span>
              <span className="text-sm font-mono text-text-secondary">{contactHandle}</span>
            </div>
            {contactUrl && (
              <a
                href={contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-emerald-primary hover:underline flex items-center gap-1"
              >
                Open <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Safety Disclaimer */}
        <div className="p-3 rounded-xl bg-bg-canvas border border-border-subtle mb-5 flex items-start gap-2.5 text-xs text-text-secondary">
          <ShieldCheck className="w-4 h-4 text-emerald-primary shrink-0 mt-0.5" />
          <span>
            Smex Store charges zero commission on ID trading. Never share account passwords or login codes before securing payment confirmation.
          </span>
        </div>

        {/* Action Button */}
        {contactUrl ? (
          <a
            href={contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl font-bold text-center text-[#0B1A15] bg-emerald-primary hover:bg-[#22C58F] transition-all duration-120 ease-out active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            Launch {contactChannel.toUpperCase()} <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl font-bold text-text-primary bg-bg-surface-elevated hover:bg-bg-canvas border border-border-subtle transition-all duration-120 ease-out active:scale-98 cursor-pointer"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
