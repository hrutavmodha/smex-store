import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { BadgeService } from '../../src/services/badge.service.js';

describe('Dynamic Badge Computation Engine Suite (LLT 2.4)', () => {
  it('Test 19: Price reduction >= 5% assigns Good Deal badge', () => {
    const originalBaseline = 1000;
    const newPrice = 850; // 15% drop

    const result = BadgeService.computeUpdatedBadge({
      newPriceInr: newPrice,
      baselinePriceInr: originalBaseline,
      rankTier: 'Epic II',
    });

    assert.equal(result.badgeType, 'good_deal');
    assert.equal(result.discountPct, 15);
    assert.equal(result.baselinePriceInr, 1000);
  });

  it('Test 20: Price reduction < 5% retains none badge', () => {
    const originalBaseline = 1000;
    const newPrice = 980; // 2% drop (< 5% threshold)

    const result = BadgeService.computeUpdatedBadge({
      newPriceInr: newPrice,
      baselinePriceInr: originalBaseline,
      rankTier: 'Legend V',
    });

    assert.equal(result.badgeType, 'none');
    assert.equal(result.discountPct, 0);
    assert.equal(result.baselinePriceInr, 1000);
  });

  it('Test 21: Price increase resets baseline and assigns Hot badge', () => {
    const originalBaseline = 1000;
    const newPrice = 1200; // Increased price

    const result = BadgeService.computeUpdatedBadge({
      newPriceInr: newPrice,
      baselinePriceInr: originalBaseline,
      rankTier: 'Legend I',
    });

    assert.equal(result.badgeType, 'hot');
    assert.equal(result.baselinePriceInr, 1200);
    assert.equal(result.discountPct, 0);
  });

  it('Test 22: High competitive rank tier receives Hot badge', () => {
    // Top competitive tier 'Mythical Immortal'
    const resultImmortal = BadgeService.computeInitialBadge({
      priceInr: 2500,
      rankTier: 'Mythical Immortal',
    });
    assert.equal(resultImmortal.badgeType, 'hot');

    // Top competitive tier 'Mythical Glory'
    const resultGlory = BadgeService.computeInitialBadge({
      priceInr: 1800,
      rankTier: 'Mythical Glory',
    });
    assert.equal(resultGlory.badgeType, 'hot');

    // Standard tier 'Epic' receives 'none'
    const resultStandard = BadgeService.computeInitialBadge({
      priceInr: 800,
      rankTier: 'Epic III',
    });
    assert.equal(resultStandard.badgeType, 'none');
  });

  it('Test 23: Premium price listing receives Hot badge', () => {
    const resultPremium = BadgeService.computeInitialBadge({
      priceInr: 6000.0, // >= ₹5,000 threshold
      rankTier: 'Legend IV',
    });

    assert.equal(resultPremium.badgeType, 'hot');
    assert.equal(resultPremium.baselinePriceInr, 6000.0);
  });

  it('Test 23b: Price unchanged retains hot for top tier or none for standard', () => {
    const topTierResult = BadgeService.computeUpdatedBadge({
      newPriceInr: 1000,
      baselinePriceInr: 1000,
      rankTier: 'Mythical Glory',
    });
    assert.equal(topTierResult.badgeType, 'hot');

    const standardResult = BadgeService.computeUpdatedBadge({
      newPriceInr: 1000,
      baselinePriceInr: 1000,
      rankTier: 'Epic II',
    });
    assert.equal(standardResult.badgeType, 'none');
  });
});

