import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { boostingRates } from '../../src/db/schema/boosting.js';
import { REDIS_BOOSTING_RATES_KEY } from '../../src/services/boosting-rate.service.js';
import { REDIS_ANNOUNCEMENT_KEY } from '../../src/services/announcement.service.js';

function createAdminToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000001') {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: `test_admin_sess_${Date.now()}_${Math.random()}`,
  });
}

describe('Milestone 9: Boosting Rate Overrides & Announcements (LLT 2.5 Tests 17-21)', () => {
  it('Test 17: Admin updates boosting rate row and invalidates Redis cache', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'rate_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Pick a per-star rate row (e.g. Mythic)
    const [rateRow] = await app.db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.pricingMode, 'per_star'))
      .limit(1);

    assert.ok(rateRow, 'Must have at least one per_star rate row');

    const originalPrice = rateRow.priceInr;

    try {
      // Seed Redis cache
      await app.redis.set(REDIS_BOOSTING_RATES_KEY, JSON.stringify([rateRow]));
      const cacheBefore = await app.redis.get(REDIS_BOOSTING_RATES_KEY);
      assert.ok(cacheBefore, 'Cache must be populated before update');

      // Admin updates rate to 28.00
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/boosting/rates/${rateRow.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          priceInr: 28.0,
        },
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(Number(body.priceInr), 28.0);

      // Verify rate updated in DB
      const [dbRow] = await app.db
        .select()
        .from(boostingRates)
        .where(eq(boostingRates.id, rateRow.id));
      assert.equal(Number(dbRow.priceInr), 28.0);

      // Verify Redis cache key was invalidated
      const cacheAfter = await app.redis.get(REDIS_BOOSTING_RATES_KEY);
      assert.equal(cacheAfter, null, 'Active rates cache must be cleared upon update');
    } finally {
      await app.db
        .update(boostingRates)
        .set({ priceInr: originalPrice })
        .where(eq(boostingRates.id, rateRow.id));
      await app.redis.del(REDIS_BOOSTING_RATES_KEY);
    }
  });

  it('Test 18: Rate override non-positive price rejection', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'neg_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    const [rateRow] = await app.db
      .select()
      .from(boostingRates)
      .limit(1);

    assert.ok(rateRow);

    // Attempt negative price
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/boosting/rates/${rateRow.id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        priceInr: -5.0,
      },
    });

    assert.equal(res.statusCode, 422, 'Negative price must be rejected with HTTP 422 Unprocessable');
  });

  it('Test 19: Public calculator reflects updated rate dynamically', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'dyn_calc_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Find Mythic rate (0-24 stars)
    const [mythicRate] = await app.db
      .select()
      .from(boostingRates)
      .where(eq(boostingRates.starTier, 'mythic'))
      .limit(1);

    assert.ok(mythicRate);
    const originalPrice = mythicRate.priceInr;

    try {
      // Update Mythic rate to ₹50.00 / star
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/boosting/rates/${mythicRate.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          priceInr: 50.0,
        },
      });

      // Public calculate request: Mythic 0 to 5 stars (5 stars @ 50 = 250)
      const calcRes = await app.inject({
        method: 'POST',
        url: '/api/v1/boosting/calculate',
        payload: {
          pricingMode: 'per_star',
          startingRank: 'Mythic',
          targetRank: 'Mythic',
          startingStars: 0,
          targetStars: 5,
        },
      });

      assert.equal(calcRes.statusCode, 200);
      const calcBody = JSON.parse(calcRes.payload);
      assert.equal(Number(calcBody.totalPriceInr), 250.0);
    } finally {
      // Restore original rate for test hygiene
      await app.db
        .update(boostingRates)
        .set({ priceInr: originalPrice })
        .where(eq(boostingRates.id, mythicRate.id));
      await app.redis.del(REDIS_BOOSTING_RATES_KEY);
    }
  });

  it('Test 20: System announcement persistence in Redis', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'ann_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/system/announcement',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        message: 'Scheduled server maintenance on Sunday at 02:00 UTC.',
        level: 'warning',
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.announcement.message, 'Scheduled server maintenance on Sunday at 02:00 UTC.');
    assert.equal(body.announcement.level, 'warning');

    // Verify saved to Redis key
    const savedInRedis = await app.redis.get(REDIS_ANNOUNCEMENT_KEY);
    assert.ok(savedInRedis, 'Payload must be saved to Redis key system:announcement:active');
    const parsed = JSON.parse(savedInRedis);
    assert.equal(parsed.message, 'Scheduled server maintenance on Sunday at 02:00 UTC.');
    assert.equal(parsed.level, 'warning');
  });

  it('Test 21: Real-time WebSocket announcement broadcast', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'ws_ann_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Mock WebSocket gateway broadcastAll
    let broadcastDelivered = false;
    let deliveredFrame: any = null;

    app.wsGateway = {
      ...app.wsGateway,
      broadcastAll: (message: unknown) => {
        broadcastDelivered = true;
        deliveredFrame = message;
      },
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/system/announcement',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        message: 'Tournament registration open now!',
        level: 'info',
        isActive: true,
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(broadcastDelivered, true, 'announcement:update frame must be broadcast to all connected sockets');
    assert.equal(deliveredFrame.event, 'announcement:update');
    assert.equal(deliveredFrame.payload.message, 'Tournament registration open now!');
  });
});
