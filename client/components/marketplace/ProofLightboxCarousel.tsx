'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { ProofImageItem } from '@smex/shared';

export interface ProofLightboxCarouselProps {
  proofImages: ProofImageItem[];
  title?: string;
}

export function ProofLightboxCarousel({ proofImages = [], title = 'Listing Proofs' }: ProofLightboxCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!proofImages || proofImages.length === 0) {
    return (
      <div className="w-full h-80 rounded-xl bg-bg-surface border border-border-subtle flex flex-col items-center justify-center text-text-secondary gap-2 select-none">
        <ImageIcon className="w-12 h-12 stroke-[1.5] text-emerald-primary" />
        <span className="text-sm font-medium">No screenshot proofs uploaded</span>
      </div>
    );
  }

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : proofImages.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < proofImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Main Viewport Container */}
      <div className="relative w-full h-80 md:h-96 rounded-xl overflow-hidden bg-bg-surface border border-border-subtle flex items-center justify-center">
        {/* Hardware-accelerated sliding carousel container */}
        <div
          className="w-full h-full flex transition-transform duration-120 ease-out"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
          }}
        >
          {proofImages.map((img, idx) => (
            <div
              key={img.s3Key || idx}
              className="w-full h-full shrink-0 flex items-center justify-center relative p-2"
            >
              <Image
                src={img.cdnUrl || `/api/v1/media/${img.s3Key}`}
                alt={`${title} - Proof ${idx + 1}`}
                fill
                unoptimized
                className="object-contain rounded-lg select-none p-2"
                priority={idx === 0}
              />
            </div>
          ))}
        </div>

        {/* Counter Badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-bg-canvas border border-border-subtle text-xs font-semibold text-text-primary z-10 select-none">
          Proof {activeIndex + 1} of {proofImages.length}
        </div>

        {/* Previous Button */}
        {proofImages.length > 1 && (
          <button
            type="button"
            aria-label="Previous screenshot"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary hover:text-emerald-primary hover:border-emerald-primary flex items-center justify-center transition-all duration-120 ease-out active:scale-95 z-10 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Next Button */}
        {proofImages.length > 1 && (
          <button
            type="button"
            aria-label="Next screenshot"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-bg-canvas border border-border-subtle text-text-primary hover:text-emerald-primary hover:border-emerald-primary flex items-center justify-center transition-all duration-120 ease-out active:scale-95 z-10 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Thumbnails Row */}
      {proofImages.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {proofImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={img.s3Key || idx}
                type="button"
                aria-label={`Select proof ${idx + 1}`}
                onClick={() => setActiveIndex(idx)}
                className={`relative w-16 h-16 rounded-lg overflow-hidden border shrink-0 transition-all duration-120 ease-out cursor-pointer ${
                  isActive
                    ? 'border-emerald-primary ring-2 ring-emerald-primary/30 scale-102'
                    : 'border-border-subtle hover:border-text-secondary opacity-70 hover:opacity-100'
                }`}
              >
                <Image
                  src={img.cdnUrl || `/api/v1/media/${img.s3Key}`}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
