import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { build, createVerifiedUser } from '../helper.js';
import { tournaments } from '../../src/db/schema/tournaments.js';

describe('Search Caching and Rate Limiting Suite (LLT 2.4)', () => {
  test('Test 18: Redis search result caching on consecutive query', async (t) => {
    const app = await build(t);

    await app.db.insert(tournaments).values({
      title: 'Clash of Legends Championship',
      gameSlug: 'mlbb',
      status: 'upcoming',
      startTime: new Date(Date.now() + 86400000),
    });

    const query = 'clash';
    // 1st call - cache miss, executes DB query and sets Redis
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=${query}`,
    });

    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.ok(body1.results.tournaments.length >= 1);

    // Verify key exists in Redis: search:{hash}
    const hash = crypto
      .createHash('sha256')
      .update(`all:${query}:10:0`)
      .digest('hex');
    const cacheKey = `search:${hash}`;
    const cachedData = await app.redis.get(cacheKey);
    assert.ok(cachedData, `Redis must contain cached search result under key ${cacheKey}`);
    const ttl = await app.redis.ttl(cacheKey);
    assert.ok(ttl > 0 && ttl <= 60, `TTL must be within 60s, got ${ttl}`);

    // 2nd call - consecutive identical query hit from cache
    const start = performance.now();
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=${query}`,
    });
    const duration = performance.now() - start;

    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.deepEqual(body2, body1);
    assert.ok(duration < 25, `Cache hit should be fast (<25ms), took ${duration.toFixed(2)}ms`);
  });

  test('Test 19: Rate limiting enforcement on universal search', async (t) => {
    const app = await build(t);
    const testIp = '10.88.99.111';

    // Clear any prior rate-limit entries for this IP
    if (app.redis) {
      const keys = await app.redis.keys(`*rl:search:${testIp}*`);
      if (keys.length > 0) {
        await app.redis.del(...keys);
      }
    }

    // Emit 60 search requests
    for (let i = 1; i <= 60; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/search?q=mlbb',
        remoteAddress: testIp,
      });
      assert.equal(
        res.statusCode,
        200,
        `Request #${i} within rate limit quota of 60 should return 200 OK`
      );
    }

    // 61st search request must be rejected with HTTP 429
    const exceededRes = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=mlbb',
      remoteAddress: testIp,
    });

    assert.equal(exceededRes.statusCode, 429, '61st query should be rejected with HTTP 429');
    const body = JSON.parse(exceededRes.body);
    assert.equal(body.status, 429);
    assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
  });
});
