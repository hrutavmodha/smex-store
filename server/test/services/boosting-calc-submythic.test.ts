import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  calculateBoostingPrice,
  ValidationError,
} from '@smex/shared';

describe('Sub-Mythic Fixed Tier Jump Matrix Suite (LLT 2.1)', () => {
  it('Test 1: Standard 1-division leap: Epic to Legend', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Epic',
      toTier: 'Legend',
    });

    assert.equal(result.basePriceInr, '400.00');
    assert.equal(result.discountInr, '0.00');
    assert.equal(result.totalPriceInr, '400.00');
    assert.equal(result.breakdown.length, 1);
  });

  it('Test 2: Standard 1-division leap: Legend to Mythic', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Legend',
      toTier: 'Mythic',
    });

    assert.equal(result.basePriceInr, '300.00');
    assert.equal(result.discountInr, '0.00');
    assert.equal(result.totalPriceInr, '300.00');
    assert.equal(result.breakdown.length, 1);
  });

  it('Test 3: Full jump bundle package: Epic to Mythic', () => {
    const result = calculateBoostingPrice({
      pricingMode: 'fixed_tier',
      fromTier: 'Epic',
      toTier: 'Mythic',
    });

    assert.equal(result.basePriceInr, '600.00');
    assert.equal(result.discountInr, '100.00');
    assert.equal(result.totalPriceInr, '600.00');
    assert.equal(result.breakdown.length, 1);
  });

  it('Test 4: Rejection of backwards rank progression', () => {
    assert.throws(
      () => {
        calculateBoostingPrice({
          pricingMode: 'fixed_tier',
          fromTier: 'Legend',
          toTier: 'Epic',
        });
      },
      (err: any) => {
        return (
          err instanceof ValidationError &&
          err.statusCode === 422 &&
          err.code === 'INVALID_RANK_PROGRESSION'
        );
      }
    );
  });

  it('Test 5: Rejection of identical starting and target ranks', () => {
    assert.throws(
      () => {
        calculateBoostingPrice({
          pricingMode: 'fixed_tier',
          fromTier: 'Epic',
          toTier: 'Epic',
        });
      },
      (err: any) => {
        return (
          err instanceof ValidationError &&
          err.statusCode === 422 &&
          err.code === 'INVALID_RANK_PROGRESSION'
        );
      }
    );
  });
});
