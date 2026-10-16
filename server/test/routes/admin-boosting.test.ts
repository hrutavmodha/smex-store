import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { boostingRates, boostingOrders } from '../../src/db/schema/boosting.js';

function createAdminToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000001') {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: `test_admin_sess_${Date.now()}_${Math.random()}`,
  });
}

function createUserToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000002') {
  return app.jwt.sign({
    sub: userId,
    role: 'user',
    sessionId: `test_user_sess_${Date.now()}_${Math.random()}`,
  });
}

describe('Admin Rate Management & RBAC Suite (LLT 2.6)', () => {
  it('Test 26: Admin rate override updates rate matrix', async (t) => {
    const app = await build(t);
    const adminToken = createAdminToken(app);

    // Pick a per_star rate to update (e.g. Mythic)
    const [rateRow] = await app.db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.pricingMode, 'per_star'))
      .limit(1);

    assert.ok(rateRow, 'Must have at least one per_star rate');

    const originalPrice = rateRow.priceInr;

    // Admin updates rate to 25.00
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/boosting/rates/${rateRow.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        priceInr: 25.0,
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const updatedBody = JSON.parse(res.payload);
    assert.equal(Number(updatedBody.priceInr), 25.0);

    // Verify DB update
    const [dbRow] = await app.db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.id, rateRow.id));
    assert.equal(Number(dbRow.priceInr), 25.0);

    // Restore original price for test hygiene
    await app.db
      .update(boostingRates)
      .set({ priceInr: originalPrice })
      .where(eq(boostingRates.id, rateRow.id));
  });

  it('Test 27: Non-admin rate override rejection', async (t) => {
    const app = await build(t);
    const userToken = createUserToken(app);

    const [rateRow] = await app.db
      .select()
      .from(boostingRates)
      .limit(1);

    assert.ok(rateRow);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/boosting/rates/${rateRow.id}`,
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: {
        priceInr: 99.0,
      },
    });

    assert.equal(res.statusCode, 403);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'FORBIDDEN');
  });

  it('Test 28: Order lifecycle status progression', async (t) => {
    const app = await build(t);
    const adminToken = createAdminToken(app);

    // Create an inquiry order first
    const [order] = await app.db
      .insert(boostingOrders)
      .values({
        gameSlug: 'mlbb',
        pricingMode: 'per_star',
        startingRank: 'Mythic',
        targetRank: 'Mythical Honor',
        startingStars: 10,
        targetStars: 30,
        calculatedPriceInr: '450.00',
        customerIgn: 'OrderTester',
        contactChannel: 'whatsapp',
        status: 'inquiry',
      })
      .returning();

    assert.equal(order.status, 'inquiry');

    // Admin updates status to confirmed
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/boosting/orders/${order.id}/status`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        status: 'confirmed',
        notes: 'Payment verified via UPI screenshot. Assigned to Booster ID 04.',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.status, 'confirmed');
    assert.ok(body.notes.includes('Payment verified via UPI'));

    // Check DB
    const [dbOrder] = await app.db
      .select()
      .from(boostingOrders)
      .where(eq(boostingOrders.id, order.id));
    assert.equal(dbOrder.status, 'confirmed');

    // Admin queries orders filtered by channel=instagram
    const [instaOrder] = await app.db
      .insert(boostingOrders)
      .values({
        gameSlug: 'mlbb',
        pricingMode: 'per_star',
        startingRank: 'Mythic',
        targetRank: 'Mythical Honor',
        startingStars: 10,
        targetStars: 30,
        calculatedPriceInr: '450.00',
        customerIgn: 'IGUser123',
        contactChannel: 'instagram',
        status: 'inquiry',
      })
      .returning();

    const filterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/boosting/orders?channel=instagram',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(filterRes.statusCode, 200);
    const filterBody = JSON.parse(filterRes.payload);
    assert.ok(Array.isArray(filterBody.orders));
    const matchingOrder = filterBody.orders.find((o: any) => o.id === instaOrder.id);
    assert.ok(matchingOrder, 'Must return the order filtered by instagram channel');
    assert.equal(matchingOrder.contactChannel, 'instagram');
  });
});
