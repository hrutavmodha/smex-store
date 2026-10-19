import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BoostingPage from '../../app/boosting/page';
import { Calculator } from '../../components/boosting/Calculator';

describe('Milestone 6: Client Presentation Tier & AMOLED Boosting UI Suite (LLT 2.7)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Test 29: Client-side slider recomputes live quote without network call', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ rates: [], surcharges: {} }),
      } as any)
    );
    const { container } = render(<Calculator />);

    // Verify rate fetch on mount (BUG-M6-002)
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/boosting/rates');
    fetchSpy.mockClear();

    // Default per_star starts at Mythic 10★ to Mythical Honor 30★ -> ₹450.00
    const priceElem = container.querySelector('[data-testid="live-quote-price"]');
    expect(priceElem).toBeTruthy();
    expect(priceElem?.textContent).toContain('450.00');

    // Drag target slider to 40★
    const targetSlider = container.querySelector('[data-testid="target-stars-slider"]') as HTMLInputElement;
    expect(targetSlider).toBeTruthy();

    fireEvent.change(targetSlider, { target: { value: '40' } });

    // 15★ @ 20 (300) + 15★ @ 30 (450) = 750.00
    expect(priceElem?.textContent).toContain('750.00');

    // Drag target slider to 20★
    fireEvent.change(targetSlider, { target: { value: '20' } });
    // 10★ @ 20 = 200.00
    expect(priceElem?.textContent).toContain('200.00');

    // Zero network calls emitted during slider interaction
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Test 30: Semantic surface and motion physics compliance', async () => {
    const { container } = render(<BoostingPage />);
    const main = container.querySelector('[data-testid="boosting-page-container"]') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.className).toContain('bg-bg-canvas');
    expect(main.className).toContain('text-text-primary');

    const calcCard = container.querySelector('[data-testid="boosting-calculator"]') as HTMLElement;
    expect(calcCard).toBeTruthy();
    expect(calcCard.className).toContain('bg-bg-surface');
    expect(calcCard.className).toContain('border-border-subtle');

    // Forbidden visual effects: zero backdrop blur
    const blurElements = container.querySelectorAll('[class*="backdrop-blur"]');
    expect(blurElements.length).toBe(0);

    // Forbidden animations: zero opacity fade animations
    const fadeElements = container.querySelectorAll('[class*="fade-in"], [class*="animate-fade"], [class*="opacity-0"]');
    expect(fadeElements.length).toBe(0);

    // Snappy physical transitions <= 120ms
    expect(calcCard.className.includes('duration-[120ms]') || calcCard.className.includes('duration-120')).toBe(true);
  });

  it('Test 31: Dispatch buttons disabled when IGN is missing', async () => {
    const { container } = render(<Calculator />);

    const ignInput = container.querySelector('[data-testid="customer-ign-input"]') as HTMLInputElement;
    const waBtn = container.querySelector('[data-testid="dispatch-whatsapp-btn"]') as HTMLButtonElement;
    const igBtn = container.querySelector('[data-testid="dispatch-instagram-btn"]') as HTMLButtonElement;

    expect(ignInput).toBeTruthy();
    expect(waBtn).toBeTruthy();
    expect(igBtn).toBeTruthy();

    // Initially IGN is blank -> buttons disabled
    expect(ignInput.value).toBe('');
    expect(waBtn.disabled).toBe(true);
    expect(igBtn.disabled).toBe(true);

    // Enter valid IGN -> buttons enabled
    fireEvent.change(ignInput, { target: { value: 'ViperMLBB' } });
    expect(waBtn.disabled).toBe(false);
    expect(igBtn.disabled).toBe(false);

    // Clear IGN again -> buttons disabled
    fireEvent.change(ignInput, { target: { value: '   ' } });
    expect(waBtn.disabled).toBe(true);
    expect(igBtn.disabled).toBe(true);
  });

  it('Test 32: Dynamic rates fetched on mount update live quote calculations (BUG-M6-002)', async () => {
    // Mock API returning custom rates: Mythical Honor = 35.00/star instead of default 30.00
    const mockRates = [
      { pricingMode: 'per_star', starTier: 'mythic', minStars: 0, maxStars: 24, priceInr: '20.00' },
      { pricingMode: 'per_star', starTier: 'mythical_honor', minStars: 25, maxStars: 49, priceInr: '35.00' },
      { pricingMode: 'per_star', starTier: 'mythical_glory', minStars: 50, maxStars: 99, priceInr: '40.00' },
      { pricingMode: 'per_star', starTier: 'mythical_immortal', minStars: 100, maxStars: 999, priceInr: '50.00' },
    ];

    vi.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ rates: mockRates, surcharges: {} }),
      } as any)
    );

    const { container } = render(<Calculator />);
    const priceElem = container.querySelector('[data-testid="live-quote-price"]');
    expect(priceElem).toBeTruthy();

    // Default per-star is 10★ (Mythic) to 30★ (Honor):
    // 15★ in Mythic @ 20 = 300, 5★ in Honor @ 35 = 175 -> 475.00
    await waitFor(() => {
      expect(priceElem?.textContent).toContain('475.00');
    });
  });

  it('Test 33: Per-star slider and rank dropdown bidirectional synchronization and 999 ceiling (BUG-M6-003)', async () => {
    const { container } = render(<Calculator />);

    const startSelect = container.querySelector('[data-testid="starting-rank-select"]') as HTMLSelectElement;
    const targetSelect = container.querySelector('[data-testid="target-rank-select"]') as HTMLSelectElement;
    const startSlider = container.querySelector('[data-testid="starting-stars-slider"]') as HTMLInputElement;
    const targetSlider = container.querySelector('[data-testid="target-stars-slider"]') as HTMLInputElement;
    const startInput = container.querySelector('[data-testid="starting-stars-input"]') as HTMLInputElement;
    const targetInput = container.querySelector('[data-testid="target-stars-input"]') as HTMLInputElement;

    // Verify 999 ceiling
    expect(startSlider.max).toBe('999');
    expect(targetSlider.max).toBe('999');
    expect(startInput.max).toBe('999');
    expect(targetInput.max).toBe('999');

    // 1. Changing dropdown updates slider to tier base
    fireEvent.change(startSelect, { target: { value: 'Mythical Glory' } });
    expect(startSlider.value).toBe('50');
    expect(startInput.value).toBe('50');

    fireEvent.change(targetSelect, { target: { value: 'Mythical Immortal' } });
    expect(targetSlider.value).toBe('100');
    expect(targetInput.value).toBe('100');

    // 2. Changing slider across thresholds updates dropdown
    // Move starting slider to 25★ -> Mythical Honor
    fireEvent.change(startSlider, { target: { value: '25' } });
    expect(startSelect.value).toBe('Mythical Honor');

    // Move target slider to 60★ -> Mythical Glory
    fireEvent.change(targetSlider, { target: { value: '60' } });
    expect(targetSelect.value).toBe('Mythical Glory');

    // 3. Typing high star count into numeric input updates dropdown and slider up to 999
    fireEvent.change(targetInput, { target: { value: '350' } });
    expect(targetSlider.value).toBe('350');
    expect(targetSelect.value).toBe('Mythical Immortal');
  });

  it('Test 34: Composite cross-regime progression accessible and calculated in UI (BUG-M6-004)', async () => {
    const { container } = render(<Calculator />);

    // Click composite mode tab
    const compositeBtn = container.querySelector('[data-testid="mode-composite"]') as HTMLButtonElement;
    expect(compositeBtn).toBeTruthy();
    fireEvent.click(compositeBtn);

    const startSelect = container.querySelector('[data-testid="composite-starting-rank-select"]') as HTMLSelectElement;
    const targetInput = container.querySelector('[data-testid="composite-target-stars-input"]') as HTMLInputElement;
    const priceElem = container.querySelector('[data-testid="live-quote-price"]');

    expect(startSelect).toBeTruthy();
    expect(targetInput).toBeTruthy();
    expect(priceElem).toBeTruthy();

    // 1. Legend to 30★ (Mythical Honor) -> ₹300 (Legend->Mythic) + 25*20 + 5*30 = ₹950.00
    fireEvent.change(startSelect, { target: { value: 'Legend' } });
    fireEvent.change(targetInput, { target: { value: '30' } });
    expect(priceElem?.textContent).toContain('950.00');

    // 2. Epic to 20★ (Mythic) -> ₹600 (Epic->Mythic) + 20*20 = ₹1,000.00
    fireEvent.change(startSelect, { target: { value: 'Epic' } });
    fireEvent.change(targetInput, { target: { value: '20' } });
    expect(priceElem?.textContent).toContain('1000.00');
  });

  it('Test 35: Server validation rejection displays error toast and halts dispatch without phantom fallback (BUG-M6-005)', async () => {
    // Mock fetch so mount rates fetch succeeds
    vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
      if (typeof url === 'string' && url.includes('/api/v1/boosting/rates')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ rates: [], surcharges: {} }),
        } as any);
      }
      // Rejection for order creation
      return Promise.resolve({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Server rejected: Invalid rank progression detected' }),
      } as any);
    });

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { container } = render(<Calculator />);

    const ignInput = container.querySelector('[data-testid="customer-ign-input"]') as HTMLInputElement;
    const waBtn = container.querySelector('[data-testid="dispatch-whatsapp-btn"]') as HTMLButtonElement;

    fireEvent.change(ignInput, { target: { value: 'CheaterIGN' } });
    expect(waBtn.disabled).toBe(false);

    fireEvent.click(waBtn);

    // Verify error toast appears with server rejection message
    await waitFor(() => {
      const toast = container.querySelector('[data-testid="toast-notification"]');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toContain('Server rejected: Invalid rank progression detected');
    });

    // Zero phantom links or window.open calls when server rejects
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});


