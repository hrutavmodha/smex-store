import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  calculateBoostingPrice,
  ValidationError,
} from '@smex/shared';

describe('Mythic Progressive Per-Star & Multi-Bracket Traversal Suite (LLT 2.2)', () => {
  it('Test 6: Intra-bracket star accumulation: Mythic 10★ to 20★', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythic',
      targetRank: 'Mythic',
      startingStars: 10,
      targetStars: 20,
    });

    assert.equal(result.basePriceInr, '200.00');
    assert.equal(result.totalPriceInr, '200.00');
    assert.equal(result.breakdown.length, 1);
    assert.equal(result.breakdown[0].stars, 10);
    assert.equal(result.breakdown[0].rate, '20.00');
  });

  it('Test 7: Multi-bracket traversal: Mythic 10★ to Mythical Honor 30★', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythic',
      targetRank: 'Mythical Honor',
      startingStars: 10,
      targetStars: 30,
    });

    assert.equal(result.basePriceInr, '450.00');
    assert.equal(result.totalPriceInr, '450.00');
    assert.equal(result.breakdown.length, 2);
    // 15 stars in Mythic [0, 24] @ 20 = 300
    assert.equal(result.breakdown[0].stars, 15);
    assert.equal(result.breakdown[0].subtotal, '300.00');
    // 5 stars in Honor [25, 49] @ 30 = 150
    assert.equal(result.breakdown[1].stars, 5);
    assert.equal(result.breakdown[1].subtotal, '150.00');
  });

  it('Test 8: Multi-bracket traversal: Mythical Honor 40★ to Mythical Glory 60★', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythical Honor',
      targetRank: 'Mythical Glory',
      startingStars: 40,
      targetStars: 60,
    });

    assert.equal(result.basePriceInr, '650.00');
    assert.equal(result.totalPriceInr, '650.00');
    assert.equal(result.breakdown.length, 2);
    // 10 stars in Honor [25, 49] @ 30 = 300
    assert.equal(result.breakdown[0].stars, 10);
    assert.equal(result.breakdown[0].subtotal, '300.00');
    // 10 stars in Glory [50, 99] @ 35 = 350
    assert.equal(result.breakdown[1].stars, 10);
    assert.equal(result.breakdown[1].subtotal, '350.00');
  });

  it('Test 9: High-MMR boundary traversal: Glory 80★ to Immortal 120★', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythical Glory',
      targetRank: 'Mythical Immortal',
      startingStars: 80,
      targetStars: 120,
    });

    assert.equal(result.basePriceInr, '1500.00');
    assert.equal(result.totalPriceInr, '1500.00');
    assert.equal(result.breakdown.length, 2);
    // 20 stars in Glory [50, 99] @ 35 = 700
    assert.equal(result.breakdown[0].stars, 20);
    assert.equal(result.breakdown[0].subtotal, '700.00');
    // 20 stars in Immortal [100, 999] @ 40 = 800
    assert.equal(result.breakdown[1].stars, 20);
    assert.equal(result.breakdown[1].subtotal, '800.00');
  });

  it('Test 10: Quad-bracket grand traversal: Mythic 20★ to Immortal 105★', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythic',
      targetRank: 'Mythical Immortal',
      startingStars: 20,
      targetStars: 105,
    });

    assert.equal(result.basePriceInr, '2800.00');
    assert.equal(result.totalPriceInr, '2800.00');
    assert.equal(result.breakdown.length, 4);
    // Mythic: 5 stars @ 20 = 100
    assert.equal(result.breakdown[0].subtotal, '100.00');
    // Honor: 25 stars @ 30 = 750
    assert.equal(result.breakdown[1].subtotal, '750.00');
    // Glory: 50 stars @ 35 = 1750
    assert.equal(result.breakdown[2].subtotal, '1750.00');
    // Immortal: 5 stars @ 40 = 200
    assert.equal(result.breakdown[3].subtotal, '200.00');
  });

  it('Test 11: Star regression rejection', () => {
    assert.throws(
      () => {
        calculateBoostingPrice({
          pricingMode: 'per_star',
          startingRank: 'Mythic',
          targetRank: 'Mythic',
          startingStars: 25,
          targetStars: 15,
        });
      },
      (err: any) => {
        return (
          err instanceof ValidationError &&
          err.statusCode === 422 &&
          err.code === 'INVALID_STAR_PROGRESSION'
        );
      }
    );
  });

  it('Test 12: Star upper ceiling constraint', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'per_star',
      startingRank: 'Mythical Immortal',
      targetRank: 'Mythical Immortal',
      startingStars: 950,
      targetStars: 1005,
    });

    // 999 - 950 = 49 stars @ 40.00 = 1960.00
    assert.equal(result.breakdown.length, 1);
    assert.equal(result.breakdown[0].stars, 49);
    assert.equal(result.breakdown[0].rate, '40.00');
    assert.equal(result.basePriceInr, '1960.00');
    assert.equal(result.totalPriceInr, '1960.00');
  });
});
