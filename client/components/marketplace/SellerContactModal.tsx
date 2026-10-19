'use client';

import React from 'react';
import { X, MessageCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { MarketplaceListingItem } from '@smex/shared';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}


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
              <MessageCircle className="w-5 h-5 text-[#25D366]" />
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
