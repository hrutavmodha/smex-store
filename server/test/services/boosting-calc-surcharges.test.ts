import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { calculateBoostingPrice } from '@smex/shared';

describe('Role Priority and Hero Surcharge Engine Suite (LLT 2.4)', () => {
  it('Test 15: Role priority percentage surcharge calculation', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Epic',
      toTier: 'Legend', // Base 400.00
      addons: {
        rolePriority: 'Jungle', // +15% = +60.00
      },
    });

    assert.equal(result.basePriceInr, '400.00');
    assert.equal(result.surcharges.length, 1);
    assert.equal(result.surcharges[0].amount, '60.00');
    assert.equal(result.totalPriceInr, '460.00');
  });

  it('Test 16: Restricted hero pool flat surcharge calculation', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Epic',
      toTier: 'Legend', // Base 400.00
      addons: {
        restrictedHeroPool: ['Fanny', 'Ling'], // +150.00 flat
      },
    });

    assert.equal(result.basePriceInr, '400.00');
    assert.equal(result.surcharges.length, 1);
    assert.equal(result.surcharges[0].amount, '150.00');
    assert.equal(result.totalPriceInr, '550.00');
  });

  it('Test 17: Duo party play percentage surcharge calculation', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Epic',
      toTier: 'Legend', // Base 400.00
      addons: {
        duoPlayWithBooster: true, // +25% = +100.00
      },
    });

    assert.equal(result.basePriceInr, '400.00');
    assert.equal(result.surcharges.length, 1);
    assert.equal(result.surcharges[0].amount, '100.00');
    assert.equal(result.totalPriceInr, '500.00');
  });

  it('Test 18: Combined multiple surcharges with rounding', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythic',
      targetRank: 'Mythical Honor',
      startingStars: 10,
      targetStars: 30, // Base 450.00
      addons: {
        rolePriority: 'Mid', // +15% = 67.50
        restrictedHeroPool: ['Kagura'], // +150.00 flat
      },
    });

    // (450 * 1.15) + 150 = 517.50 + 150 = 667.50 -> 668.00
    assert.equal(result.basePriceInr, '450.00');
    assert.equal(result.surcharges.length, 2);
    assert.equal(result.totalPriceInr, '668.00');
  });
});
