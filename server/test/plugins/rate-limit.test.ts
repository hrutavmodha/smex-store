import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { build } from '../helper.js';

describe('Multi-Stage Distributed Rate Limiting (LLT 2.5)', () => {
  test('Test 16: Login rate limit enforcement at preValidation hook', async (t) => {
    const app = await build(t);
    const ip = '192.168.10.1';
    const email = `rl_login_${Date.now()}@smexstore.com`;

    const existing = await app.redis.keys(`*${ip}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    // Send 5 requests (within allowed limit 5/60s)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: ip,
        payload: {
          email,
          password: 'WrongPassword123!',
        },
      });
      assert.equal(res.statusCode, 401, `Attempt ${i + 1} should be evaluated to 401`);
    }

    // Attempt 6: Must trigger rate limit 429 at preValidation hook
    const res6 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: {
        email,
        password: 'WrongPassword123!',
      },
    });

    assert.equal(res6.statusCode, 429);
    assert.ok(res6.headers['retry-after'], 'Retry-After header must be present');
    assert.equal(String(res6.headers['x-ratelimit-limit']), '5');
    assert.equal(String(res6.headers['x-ratelimit-remaining']), '0');

    const body = JSON.parse(res6.body);
    assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(body.status, 429);
    assert.match(body.detail, /Rate limit exceeded/);
  });

  test('Test 17: Register endpoint IP rate limit at onRequest hook', async (t) => {
    const app = await build(t);
    const ip = '192.168.10.2';

    // Clear any leftover keys for this IP from prior test runs
    const existing = await app.redis.keys(`*${ip}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    // Send 3 requests (within allowed limit 3/1hr)
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        remoteAddress: ip,
        payload: {
          email: `reg_${i}_${Date.now()}@smexstore.com`,
          password: 'ValidPassword123!',
          username: `u_${i}_${Date.now().toString().slice(-4)}`,
        },
      });
      assert.equal(res.statusCode, 201, `Registration attempt ${i + 1} should succeed`);
    }

    // Attempt 4: Must be rejected at onRequest hook with 429
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: {
        email: `reg_overflow_${Date.now()}@smexstore.com`,
        password: 'ValidPassword123!',
        username: `u_overflow_${Date.now().toString().slice(-4)}`,
      },
    });

    assert.equal(res4.statusCode, 429);
    assert.ok(res4.headers['retry-after']);
    const body = JSON.parse(res4.body);
    assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
  });

  test('Test 18: Sliding rate limit quota restoration', async (t) => {
    const app = await build(t);
    const ip = '192.168.10.3';
    const email = `rl_restore_${Date.now()}@smexstore.com`;

    // Register user first from a different IP
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '192.168.10.99',
      payload: {
        email,
        password: 'ValidPassword123!',
        username: `res_${Date.now().toString().slice(-6)}`,
      },
    });
    assert.equal(regRes.statusCode, 201);

    // Exhaust 5 login attempts
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: ip,
        payload: { email, password: 'WrongPassword' },
      });
    }

    // 6th attempt is rate-limited
    const limitedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(limitedRes.statusCode, 429);

    // Flush rate-limit keys matching this IP/email in Redis to simulate window expiration
    const keys = await app.redis.keys(`*${ip}*`);
    if (keys.length > 0) {
      await app.redis.del(...keys);
    }

    // Subsequent login attempt succeeds with 200 OK
    const restoredRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(restoredRes.statusCode, 200);
    const body = JSON.parse(restoredRes.body);
    assert.ok(body.accessToken);
  });
});
