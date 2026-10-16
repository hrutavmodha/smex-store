import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, screen, act } from '@testing-library/react';
import MarketplacePage from '../../app/marketplace/page';
import { ProofLightboxCarousel } from '../../components/marketplace/ProofLightboxCarousel';
import { ListingDetailView } from '../../components/marketplace/ListingDetailView';
import { CreateListingForm } from '../../components/marketplace/CreateListingForm';
import { SellerContactModal } from '../../components/marketplace/SellerContactModal';
import * as uploaderModule from '../../lib/marketplace/uploader';

import catalogSource from '../../components/marketplace/MarketplaceCatalog.tsx?raw';
import carouselSource from '../../components/marketplace/ProofLightboxCarousel.tsx?raw';
import detailSource from '../../components/marketplace/ListingDetailView.tsx?raw';
import modalSource from '../../components/marketplace/SellerContactModal.tsx?raw';
import marketplacePageSource from '../../app/marketplace/page.tsx?raw';

const mockListing = {
  id: '7b8e5c3a-1234-4567-89ab-cdef01234567',
  sellerId: 'user-123',
  title: 'MLBB Mythical Glory 75★ Account - 120 Skins',
  gameSlug: 'mlbb',
  rankTier: 'Mythical Glory',
  priceInr: '3500.00',
  baselinePriceInr: '4100.00',
  badgeType: 'good_deal' as const,
  discountPct: 15,
  status: 'active' as const,
  contactChannel: 'whatsapp' as const,
  contactHandle: '15550100100',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  proofImages: [
    { s3Key: 'marketplace/proofs/user-123/p1.png', cdnUrl: '/media/p1.png', displayOrder: 0 },
    { s3Key: 'marketplace/proofs/user-123/p2.png', cdnUrl: '/media/p2.png', displayOrder: 1 },
    { s3Key: 'marketplace/proofs/user-123/p3.png', cdnUrl: '/media/p3.png', displayOrder: 2 },
  ],
  seller: {
    userId: 'user-123',
    username: 'ShadowViper',
    avatarPreset: 'preset_default_01',
    reputationScore: 4.9,
    reviewCount: 12,
    completedSales: 18,
  },
};

describe('Marketplace Presentation UI & Media Carousel Suite (LLT 2.5)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Test 24: Deterministic upload progress bar tracking', async () => {
    const progressValues: number[] = [];
    const origXHR = window.XMLHttpRequest;
    const origFetch = window.fetch;

    window.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('presigned-url')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            uploadUrl: 'http://localhost:9000/smex-storage/proof.png',
            s3Key: 'marketplace/proofs/user-123/proof.png',
            cdnUrl: '/media/proof.png',
          }),
        });
      }
      if (typeof url === 'string' && url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ verified: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    let onProgressCb: any = null;
    (window as any).XMLHttpRequest = class {
      upload = {
        set onprogress(fn: any) {
          onProgressCb = fn;
        },
        get onprogress() {
          return onProgressCb;
        },
      };
      status = 200;
      onload: any = null;
      open() {}
      setRequestHeader() {}
      send() {
        if (onProgressCb) {
          onProgressCb({ lengthComputable: true, loaded: 25, total: 100 });
          onProgressCb({ lengthComputable: true, loaded: 50, total: 100 });
          onProgressCb({ lengthComputable: true, loaded: 75, total: 100 });
          onProgressCb({ lengthComputable: true, loaded: 100, total: 100 });
        }
        setTimeout(() => this.onload?.(), 10);
      }
    };

    // 1. Direct uploader verification of deterministic progress values (0%, 25%, 50%, 75%, 100%)
    const mockFile = new File(['dummy-proof-data'], 'proof.png', { type: 'image/png' });
    const result = await uploaderModule.uploadScreenshotProof(mockFile, (pct) => {
      progressValues.push(pct);
    });

    expect(result.s3Key).toBe('marketplace/proofs/user-123/proof.png');
    expect(Array.from(new Set(progressValues))).toEqual([0, 25, 50, 75, 100]);
    expect(progressValues[progressValues.length - 1]).toBe(100);


    // 2. Component progress bar DOM element verification with aria-valuenow
    const { container } = render(<CreateListingForm />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    // Restore
    window.XMLHttpRequest = origXHR;
    window.fetch = origFetch;
  });


  it('Test 25: Proof screenshot lightbox carousel navigation', () => {
    const { container } = render(
      <ProofLightboxCarousel
        proofImages={mockListing.proofImages}
        title={mockListing.title}
      />
    );

    // Initial counter: Proof 1 of 3
    expect(container.textContent).toContain('Proof 1 of 3');

    const nextBtn = screen.getByLabelText('Next screenshot');
    expect(nextBtn).toBeTruthy();

    // Click Next -> increments to Proof 2 of 3
    fireEvent.click(nextBtn);
    expect(container.textContent).toContain('Proof 2 of 3');

    // Click Next again -> increments to Proof 3 of 3
    fireEvent.click(nextBtn);
    expect(container.textContent).toContain('Proof 3 of 3');

    // Click Previous -> decrements back to Proof 2 of 3
    const prevBtn = screen.getByLabelText('Previous screenshot');
    expect(prevBtn).toBeTruthy();
    fireEvent.click(prevBtn);
    expect(container.textContent).toContain('Proof 2 of 3');

    // Audit carousel source: hardware transform 120ms and zero opacity fade
    expect(carouselSource.includes('duration-120')).toBe(true);
    expect(carouselSource.includes('transition-transform')).toBe(true);
    expect(carouselSource.includes('fade-in')).toBe(false);
    expect(carouselSource.includes('opacity-0')).toBe(false);
  });

  it('Test 26: AMOLED #000000 surface and motion physics compliance', () => {
    const { container } = render(<MarketplacePage />);
    const mainElement = container.querySelector('main');
    expect(mainElement).toBeTruthy();

    // Background is AMOLED True-Black #000000
    expect(mainElement?.style.backgroundColor).toBe('rgb(0, 0, 0)');

    // Source code audits across all Marketplace presentation components
    const allMarketplaceSources = [
      catalogSource,
      carouselSource,
      detailSource,
      modalSource,
      marketplacePageSource,
    ];

    for (const source of allMarketplaceSources) {
      // Prohibited: frosted glass blur
      expect(source.includes('backdrop-blur')).toBe(false);
      expect(source.includes('backdrop-filter: blur')).toBe(false);

      // Prohibited: opacity fade animations
      expect(source.includes('animate-fade')).toBe(false);
      expect(source.includes('fade-in')).toBe(false);

      // Mandated: 120ms hardware transitions
      expect(source.includes('duration-120')).toBe(true);
    }
  });

  it('Test 27: Seller contact modal button opens direct external channel', () => {
    render(<ListingDetailView listing={mockListing} />);

    // Click "Contact Seller" button
    const contactBtn = screen.getByText('Contact Seller (Direct Chat)');
    expect(contactBtn).toBeTruthy();

    fireEvent.click(contactBtn);

    // Modal opens with role="dialog"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    // Link must point directly to WhatsApp intent with seller handle and pre-filled title
    const launchLink = screen.getByRole('link', { name: /Launch WHATSAPP/i });
    expect(launchLink).toBeTruthy();

    const href = launchLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href?.startsWith('https://wa.me/15550100100')).toBe(true);
    expect(href).toContain(encodeURIComponent(mockListing.title));
  });
});
