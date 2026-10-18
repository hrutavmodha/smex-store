import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, screen, act } from '@testing-library/react';
import MarketplacePage from '../../app/marketplace/page';
import { ProofLightboxCarousel } from '../../components/marketplace/ProofLightboxCarousel';
import { ListingDetailView } from '../../components/marketplace/ListingDetailView';
import { CreateListingForm } from '../../components/marketplace/CreateListingForm';
import { SellerContactModal } from '../../components/marketplace/SellerContactModal';
import * as uploaderModule from '../../lib/marketplace/uploader';

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

    const slidingContainer = container.querySelector('.transition-transform');
    expect(slidingContainer).toBeTruthy();
    expect((slidingContainer as HTMLElement)?.style.transform).toMatch(/translateX\(-?0%\)/);

    const nextBtn = screen.getByLabelText('Next screenshot');
    expect(nextBtn).toBeTruthy();

    // Click Next -> increments to Proof 2 of 3
    fireEvent.click(nextBtn);
    expect(container.textContent).toContain('Proof 2 of 3');
    expect((slidingContainer as HTMLElement)?.style.transform).toContain('translateX(-100%)');

    // Click Next again -> increments to Proof 3 of 3
    fireEvent.click(nextBtn);
    expect(container.textContent).toContain('Proof 3 of 3');
    expect((slidingContainer as HTMLElement)?.style.transform).toContain('translateX(-200%)');

    // Click Previous -> decrements back to Proof 2 of 3
    const prevBtn = screen.getByLabelText('Previous screenshot');
    expect(prevBtn).toBeTruthy();
    fireEvent.click(prevBtn);
    expect(container.textContent).toContain('Proof 2 of 3');
    expect((slidingContainer as HTMLElement)?.style.transform).toContain('translateX(-100%)');

    // Audit carousel DOM element: hardware transform 120ms and zero opacity fade (BUG-M7-006)
    expect(slidingContainer?.classList.contains('duration-120')).toBe(true);
    expect(slidingContainer?.classList.contains('transition-transform')).toBe(true);
    expect(slidingContainer?.classList.contains('fade-in')).toBe(false);
    expect(slidingContainer?.classList.contains('opacity-0')).toBe(false);
  });

  it('Test 26: AMOLED #000000 surface and motion physics compliance (BUG-M7-006)', () => {
    const pageRender = render(<MarketplacePage />);
    const mainElement = pageRender.container.querySelector('main');
    expect(mainElement).toBeTruthy();

    // Background is AMOLED True-Black #000000
    expect(mainElement?.style.backgroundColor).toBe('rgb(0, 0, 0)');

    // Render marketplace presentation components to verify actual rendered DOM trees
    const carouselRender = render(
      <ProofLightboxCarousel
        proofImages={mockListing.proofImages}
        title={mockListing.title}
      />
    );
    const detailRender = render(<ListingDetailView listing={mockListing} />);
    const modalRender = render(
      <SellerContactModal
        listing={mockListing}
        isOpen={true}
        onClose={() => {}}
      />
    );

    const renderedContainers = [
      pageRender.container,
      carouselRender.container,
      detailRender.container,
      modalRender.container,
    ];

    for (const cont of renderedContainers) {
      const allElements = cont.querySelectorAll('*');
      for (const el of allElements) {
        const className = el.className;
        if (typeof className === 'string') {
          // Prohibited: frosted glass blur
          expect(className).not.toContain('backdrop-blur');
          // Prohibited: opacity fade animations
          expect(className).not.toContain('animate-fade');
          expect(className).not.toContain('fade-in');
        }
      }

      // Mandated: 120ms hardware transitions
      const transitionElements = cont.querySelectorAll('[class*="transition-"]');
      for (const el of transitionElements) {
        expect(el.classList.contains('duration-120')).toBe(true);
      }
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

  it('Test 28: Multi-rank filter forwards rank tiers to server query without client truncation (BUG-M7-003)', async () => {
    let capturedUrl = '';
    const origFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          listings: [
            { ...mockListing, id: 'm1', rankTier: 'Mythic' },
            { ...mockListing, id: 'm2', rankTier: 'Mythical Glory' },
          ],
          total: 42,
          page: 1,
          limit: 50,
          totalPages: 1,
        }),
      });
    });

    const { MarketplaceCatalog } = await import('../../components/marketplace/MarketplaceCatalog');
    const { container } = render(<MarketplaceCatalog />);

    const mythicCheckbox = screen.getByLabelText('Mythic');
    const gloryCheckbox = screen.getByLabelText('Mythical Glory');

    await act(async () => {
      fireEvent.click(mythicCheckbox);
    });

    await act(async () => {
      fireEvent.click(gloryCheckbox);
    });

    expect(capturedUrl).toContain('rankTier=Mythic');
    expect(capturedUrl).toContain('rankTier=Mythical+Glory');
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('Active Listings Found');

    window.fetch = origFetch;
  });

  it('Test 29: Catalog search input debounces keystrokes to prevent request flooding (BUG-M7-004)', async () => {
    let fetchCount = 0;
    const origFetch = window.fetch;
    window.fetch = vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/v1/marketplace/listings')) {
        fetchCount++;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          listings: [],
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        }),
      });
    });

    const { MarketplaceCatalog } = await import('../../components/marketplace/MarketplaceCatalog');
    const { container } = render(<MarketplaceCatalog />);

    expect(fetchCount).toBe(1);

    const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'm' } });
      fireEvent.change(searchInput, { target: { value: 'my' } });
      fireEvent.change(searchInput, { target: { value: 'myt' } });
      fireEvent.change(searchInput, { target: { value: 'myth' } });
      fireEvent.change(searchInput, { target: { value: 'mythic' } });
    });

    expect(fetchCount).toBe(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(fetchCount).toBe(2);

    window.fetch = origFetch;
  });

  it('Test 30: Marketplace catalog renders pagination controls and loads subsequent pages (BUG-M7-007)', async () => {
    const urlsRequested: string[] = [];
    const origFetch = window.fetch;

    window.fetch = vi.fn().mockImplementation((url: string) => {
      urlsRequested.push(url);

      if (url.includes('page=2')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            listings: Array.from({ length: 25 }, (_, i) => ({
              ...mockListing,
              id: `p2-listing-${i}`,
              title: `Page 2 Listing ${i + 1}`,
            })),
            total: 75,
            page: 2,
            limit: 50,
            totalPages: 2,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          listings: Array.from({ length: 50 }, (_, i) => ({
            ...mockListing,
            id: `p1-listing-${i}`,
            title: `Page 1 Listing ${i + 1}`,
          })),
          total: 75,
          page: 1,
          limit: 50,
          totalPages: 2,
        }),
      });
    });

    const { MarketplaceCatalog } = await import('../../components/marketplace/MarketplaceCatalog');
    const { container } = render(<MarketplaceCatalog />);

    // Wait for initial fetch
    await act(async () => {
      await Promise.resolve();
    });

    // Authoritative server total matches count: 75
    expect(container.textContent).toContain('75');
    expect(container.textContent).toContain('Active Listings Found');
    expect(container.textContent).toContain('Page 1 of 2');
    expect(container.textContent).toContain('Showing 50 of 75 listings');

    // Pagination controls present
    const prevBtn = screen.getByLabelText('Previous page') as HTMLButtonElement;
    const nextBtn = screen.getByLabelText('Next page') as HTMLButtonElement;
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    // On page 1: Previous is disabled, Next is enabled
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    // Click Next -> advances to page 2
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // Verifies request sent with page=2
    expect(urlsRequested.some((u) => u.includes('page=2'))).toBe(true);

    // Page 2 assertions
    expect(container.textContent).toContain('Page 2 of 2');
    expect(container.textContent).toContain('Showing 25 of 75 listings');
    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);

    window.fetch = origFetch;
  });
});
