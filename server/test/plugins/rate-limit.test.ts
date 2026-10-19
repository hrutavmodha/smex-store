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

  test('Test 19: trustProxy resolves client IP from X-Forwarded-For header (Bug 11)', async (t) => {
    const app = await build(t);
    const clientIp = '198.51.100.22';
    const proxyIp = '172.18.0.5';

    // Clear any leftover keys
    const existing = await app.redis.keys(`*${clientIp}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    // Submit 3 registration attempts with clientIp in X-Forwarded-For behind proxy
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        remoteAddress: proxyIp,
        headers: {
          'x-forwarded-for': clientIp,
        },
        payload: {
          email: `proxy_reg_${i}_${Date.now()}@smexstore.com`,
          password: 'ValidPassword123!',
          username: `px_${i}_${Date.now().toString().slice(-4)}`,
        },
      });
      assert.equal(res.statusCode, 201);
    }

    // 4th attempt from same clientIp is rate-limited (429)
    const limitedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: proxyIp,
      headers: {
        'x-forwarded-for': clientIp,
      },
      payload: {
        email: `proxy_overflow_${Date.now()}@smexstore.com`,
        password: 'ValidPassword123!',
        username: `px_overflow_${Date.now().toString().slice(-4)}`,
      },
    });
    assert.equal(limitedRes.statusCode, 429, 'Client IP exceeding quota must be rate-limited');
    assert.ok(limitedRes.headers['retry-after']);
    const limitedBody = JSON.parse(limitedRes.body);
    assert.equal(limitedBody.code, 'RATE_LIMIT_EXCEEDED');

    // Distinct client IP behind the same proxy is NOT blocked (verifies proxy IP was not pooled)
    const distinctClientIp = '198.51.100.33';
    const distinctRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: proxyIp,
      headers: {
        'x-forwarded-for': distinctClientIp,
      },
      payload: {
        email: `distinct_reg_${Date.now()}@smexstore.com`,
        password: 'ValidPassword123!',
        username: `dist_${Date.now().toString().slice(-4)}`,
      },
    });
    assert.equal(distinctRes.statusCode, 201, 'Distinct client IP must not be pooled under proxy IP');
  });

  test('Test 20: Horizontal password spraying rate limit per IP on login endpoint (Bug 12)', async (t) => {
    const app = await build(t);
    const ip = '192.0.2.77';

    // Clear any existing keys
    const existing = await app.redis.keys(`*${ip}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    // Perform 15 login requests with different emails from the same IP (within 15 req/min IP quota)
    for (let i = 0; i < 15; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: ip,
        payload: {
          email: `spray_user_${i}_${Date.now()}@smexstore.com`,
          password: 'CommonPassword123!',
        },
      });
      assert.equal(res.statusCode, 401, `Spray attempt ${i + 1} should evaluate to 401`);
    }

    // 16th attempt with another distinct email must trigger IP-level 429 RATE_LIMIT_EXCEEDED
    const overflowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: {
        email: `spray_user_16_${Date.now()}@smexstore.com`,
        password: 'CommonPassword123!',
      },
    });

    assert.equal(overflowRes.statusCode, 429, '16th attempt from IP must be rate-limited');
    assert.ok(overflowRes.headers['retry-after']);
    assert.equal(String(overflowRes.headers['x-ratelimit-limit']), '15');
    assert.equal(String(overflowRes.headers['x-ratelimit-remaining']), '0');

    const body = JSON.parse(overflowRes.body);
    assert.equal(body.code, 'RATE_LIMIT_EXCEEDED');
    assert.equal(body.status, 429);
  });
});

