import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { build } from '../helper.js';

describe('Dual-Token Session Pipeline & RFC 6265bis Compliance (LLT 2.2)', () => {
  const testUser = {
    email: `test_dual_${Date.now()}@smexstore.com`,
    password: 'ValidPassword123!',
    username: `dual_usr_${Date.now().toString().slice(-6)}`,
  };

  let registeredUserId: string;
  let accessToken: string;
  let refreshCookie: string;
  let sessionId: string;

  const testIp = '10.50.1.1';

  test('Test 4: User registration endpoint creates user and profile', async (t) => {
    const app = await build(t);

    const existing = await app.redis.keys(`*${testIp}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: testIp,
      payload: testUser,
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.id, 'User ID must be returned');
    assert.equal(body.email, testUser.email.toLowerCase());
    assert.equal(body.emailVerified, false);
    assert.equal(body.profile.username, testUser.username);
    assert.equal(body.profile.avatarPreset, 'preset_default_01');

    registeredUserId = body.id;
  });

  test('Test 5: Login generates short-lived JWT and RFC 6265bis compliant cookie', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: testIp,
      headers: {
        'user-agent': 'Chrome on macOS Test Runner',
      },
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.accessToken, 'Access token must be returned in body');
    assert.equal(body.tokenType, 'Bearer');
    assert.equal(body.expiresIn, 900);
    assert.equal(body.user.id, registeredUserId);

    accessToken = body.accessToken;

    // Check Set-Cookie headers for RFC 6265bis compliance
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Set-Cookie header must be present');
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;

    assert.match(cookieHeader, /(?:__Host-refresh-token|smex_refresh_token)=/);
    assert.match(cookieHeader, /Path=\//);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=(Strict|Lax)/i);

    // Extract compound cookie value: <sessionId>.<secretToken>
    const match = cookieHeader.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/);
    assert.ok(match, 'Cookie value must be extractable');
    refreshCookie = match[1];

    assert.ok(refreshCookie.includes('.'), 'Compound cookie must contain dot separator');
    sessionId = refreshCookie.split('.')[0];
    assert.ok(sessionId.length >= 32, 'Session ID must be a UUID');
  });

  test('Test 6: Access Token validation on protected endpoint', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.id, registeredUserId);
    assert.equal(body.uid, registeredUserId);
    assert.equal(body.ign, testUser.username);
    assert.equal(body.avatarPreset, 'preset_default_01');
    assert.equal(body.email, testUser.email.toLowerCase());
    assert.equal(body.sessionId, sessionId);
    assert.equal(body.profile.username, testUser.username);
  });

  test('Test 7: Expired Access Token rejection', async (t) => {
    const app = await build(t);

    // Mint an expired JWT token
    const expiredToken = app.jwt.sign(
      {
        sub: registeredUserId,
        role: 'user',
        sessionId,
      },
      {
        expiresIn: '-10s',
      }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('Test 8: O(1) Token rotation via compound refresh cookie', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: `__Host-refresh-token=${refreshCookie}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.accessToken, 'Rotated access token must be returned');

    // Verify rotated access token works
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${body.accessToken}`,
      },
    });
    assert.equal(meRes.statusCode, 200);

    // Verify rotated cookie is set
    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'Rotated Set-Cookie header must be provided');
  });
});
