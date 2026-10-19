import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { calculateBoostingPrice } from '@smex/shared';

describe('Composite Cross-Regime Progression Suite (LLT 2.3)', () => {
  it('Test 13: Cross-regime progression: Legend to Mythical Honor 30★', () => {
    const result = calculateBoostingPrice({
      fromTier: 'Legend',
      toTier: 'Mythical Honor',
      startingStars: 0,
      targetStars: 30,
    });

    // Fixed leap (Legend -> Mythic): ₹300
    // Stars (0 -> 30): 25 stars @ 20 (500) + 5 stars @ 30 (150) = 650
    // Total = 300 + 650 = 950.00
    assert.equal(result.basePriceInr, '950.00');
    assert.equal(result.totalPriceInr, '950.00');
    assert.equal(result.breakdown.length, 3);
  });

  it('Test 14: Cross-regime progression: Epic to Mythic 20★', () => {
    const result = calculateBoostingPrice({
      fromTier: 'Epic',
      toTier: 'Mythic',
      startingStars: 0,
      targetStars: 20,
    });

    // Bundle leap (Epic -> Mythic): ₹600 (discount 100)
    // Stars (0 -> 20): 20 stars @ 20 = 400
    // Total = 600 + 400 = 1000.00
    assert.equal(result.basePriceInr, '1000.00');
    assert.equal(result.discountInr, '100.00');
    assert.equal(result.totalPriceInr, '1000.00');
    assert.equal(result.breakdown.length, 2);
  });
});
