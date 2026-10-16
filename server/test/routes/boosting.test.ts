import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { boostingOrders } from '../../src/db/schema/boosting.js';

describe('Boosting REST API Suite (LLT 2.6)', () => {
  it('Test 23: Public rates query returns active matrix', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/boosting/rates',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    assert.ok(Array.isArray(body.rates), 'Rates must be an array');
    assert.ok(body.rates.length >= 7, 'Must have at least 7 active rates');

    // 3 fixed tier rates + 4 per-star brackets
    const fixedRates = body.rates.filter((r: any) => r.pricingMode === 'fixed_tier');
    const perStarRates = body.rates.filter((r: any) => r.pricingMode === 'per_star');

    assert.ok(fixedRates.length >= 3, 'Must have at least 3 fixed tier rates');
    assert.ok(perStarRates.length >= 4, 'Must have at least 4 per-star rates');

    // Surcharge configuration
    assert.ok(body.surcharges);
    assert.equal(body.surcharges.rolePriorityPercent, 0.15);
    assert.equal(body.surcharges.heroPoolFlatInr, 150);
    assert.equal(body.surcharges.duoPartyPercent, 0.25);
  });

  it('Test 24: Server-side price calculation endpoint', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/calculate',
      payload: {
        pricingMode: 'per_star',
        startingRank: 'Mythic',
        targetRank: 'Mythical Honor',
        startingStars: 10,
        targetStars: 30,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    assert.equal(body.basePriceInr, '450.00');
    assert.equal(body.totalPriceInr, '450.00');
    assert.ok(Array.isArray(body.breakdown));
    assert.equal(body.breakdown.length, 2);
  });

  it('Test 25: Customer booking inquiry persistence', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      payload: {
        pricingMode: 'per_star',
        startingRank: 'Mythic',
        targetRank: 'Mythical Honor',
        startingStars: 10,
        targetStars: 30,
        customerIgn: 'ViperMLBB',
        serverId: '2048',
        contactChannel: 'whatsapp',
        addons: {
          rolePriority: 'Jungle',
          restrictedHeroPool: ['Ling', 'Fanny'],
          duoPlayWithBooster: false,
        },
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    assert.ok(body.orderId, 'Must return orderId');
    assert.match(body.orderRef, /^BST-[0-9]{6}-[0-9]{4}$/);
    assert.equal(body.status, 'inquiry');
    assert.equal(body.calculatedPriceInr, '668.00');
    assert.ok(body.dispatch);
    assert.equal(body.dispatch.channel, 'whatsapp');

    // Verify row was persisted in database
    const [saved] = await app.db
      .select()
      .from(boostingOrders)
      .where(eq(boostingOrders.id, body.orderId));

    assert.ok(saved);
    assert.equal(saved.customerIgn, 'ViperMLBB');
    assert.equal(saved.status, 'inquiry');
    assert.equal(saved.contactChannel, 'whatsapp');
    assert.equal(Number(saved.calculatedPriceInr), 668.0);
  });

  it('Test 25b: Customer booking inquiry with Instagram channel persistence', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      payload: {
        pricingMode: 'per_star',
        startingRank: 'Mythic',
        targetRank: 'Mythical Honor',
        startingStars: 10,
        targetStars: 30,
        customerIgn: 'InstaGamer',
        contactChannel: 'instagram',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    assert.ok(body.orderId);
    assert.equal(body.dispatch.channel, 'instagram');

    // Verify persisted row in database has contactChannel = 'instagram'
    const [saved] = await app.db
      .select()
      .from(boostingOrders)
      .where(eq(boostingOrders.id, body.orderId));

    assert.ok(saved);
    assert.equal(saved.contactChannel, 'instagram');
    assert.equal(saved.customerIgn, 'InstaGamer');
  });
});

