import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BoostingPage from '../../app/boosting/page';
import { Calculator } from '../../components/boosting/Calculator';
import calculatorSource from '../../components/boosting/Calculator.tsx?raw';
import boostingPageSource from '../../app/boosting/page.tsx?raw';

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

  it('Test 30: AMOLED #000000 surface and motion physics compliance', async () => {
    // 1. Audit Calculator source code
    expect(calculatorSource.includes('backdrop-blur')).toBe(false);
    expect(calculatorSource.includes('backdrop-filter')).toBe(false);
    expect(calculatorSource.includes('fade-in')).toBe(false);
    expect(calculatorSource.includes('opacity-0')).toBe(false);
    expect(
      calculatorSource.includes('duration-[120ms]') || calculatorSource.includes('duration-120')
    ).toBe(true);
    expect(calculatorSource.includes('#000000')).toBe(true);

    // 2. Audit BoostingPage source code
    expect(boostingPageSource.includes('backdrop-blur')).toBe(false);
    expect(boostingPageSource.includes('backdrop-filter')).toBe(false);
    expect(boostingPageSource.includes('fade-in')).toBe(false);
    expect(boostingPageSource.includes('opacity-0')).toBe(false);
    expect(boostingPageSource.includes('#000000')).toBe(true);

    // 3. Render and inspect DOM
    const { container } = render(<BoostingPage />);
    const main = container.querySelector('[data-testid="boosting-page-container"]') as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.style.backgroundColor).toBe('rgb(0, 0, 0)');

    const calcCard = container.querySelector('[data-testid="boosting-calculator"]') as HTMLElement;
    expect(calcCard).toBeTruthy();
    expect(calcCard.style.backgroundColor).toBe('rgb(0, 0, 0)');
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
});

