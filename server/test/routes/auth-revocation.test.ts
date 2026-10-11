import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { sessions } from '../../src/db/schema/sessions.js';

describe('Disambiguated Session Revocation and Fast-Path Tombstones (LLT 2.3)', () => {
  test('Tests 9 & 10: Single remote session eviction via DELETE and fast-path rejection', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.1';

    const testUser = {
      email: `test_revoke_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `rvk_${Date.now().toString().slice(-6)}`,
    };

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: testUser,
    });
    assert.equal(regRes.statusCode, 201);
    const user = JSON.parse(regRes.body);

    // Login from device 1 (primary)
    const loginRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Chrome on Windows' },
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(loginRes1.statusCode, 200);
    const token1 = JSON.parse(loginRes1.body).accessToken;

    // Login from device 2 (remote target)
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Safari on iOS' },
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(loginRes2.statusCode, 200);
    const token2 = JSON.parse(loginRes2.body).accessToken;
    const cookieHeader = Array.isArray(loginRes2.headers['set-cookie'])
      ? loginRes2.headers['set-cookie'][0]
      : (loginRes2.headers['set-cookie'] as string);
    const sessionId2 = cookieHeader.match(/__Host-refresh-token=([^;]+)/)![1].split('.')[0];

    // Verify device 2 works before eviction
    const meBefore = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(meBefore.statusCode, 200);

    // Device 1 evicts Device 2: DELETE /api/v1/devices/sessions/:sessionId
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/devices/sessions/${sessionId2}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(deleteRes.statusCode, 200);

    // Test 9 assertions: Redis keys deleted, tombstone set, DB isActive false
    const sessionExists = await app.redis.exists(`session:${user.id}:${sessionId2}`);
    assert.equal(sessionExists, 0, 'Session hash must be deleted from Redis');

    const lookupExists = await app.redis.exists(`session_lookup:${sessionId2}`);
    assert.equal(lookupExists, 0, 'Lookup index must be deleted from Redis');

    const tombstoneExists = await app.redis.exists(`revoked_token:${sessionId2}`);
    assert.equal(tombstoneExists, 1, 'Tombstone must be written to Redis');

    const [dbSession] = await app.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId2))
      .limit(1);
    assert.equal(dbSession.isActive, false, 'DB session isActive must be false');

    // Test 10 assertion: Fast-path access rejection for revoked session token
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(meAfter.statusCode, 401, 'Revoked token must be rejected immediately via fast-path check');
    const meBody = JSON.parse(meAfter.body);
    assert.equal(meBody.code, 'SESSION_REVOKED');
  });

  test('Test 11: Revoke all other sessions leaves caller active', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.2';

    const email = `multi_${Date.now()}@smexstore.com`;
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!', username: `multi_${Date.now().toString().slice(-6)}` },
    });

    // Create 3 active devices
    const log1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Chrome on Windows' },
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(log1.statusCode, 200);
    const token1 = JSON.parse(log1.body).accessToken;

    const log2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Firefox on Linux' },
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(log2.statusCode, 200);
    const token2 = JSON.parse(log2.body).accessToken;

    const log3 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Safari on iOS' },
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(log3.statusCode, 200);
    const token3 = JSON.parse(log3.body).accessToken;

    // Caller on device 1 calls DELETE /api/v1/devices/sessions/others
    const revokeOthersRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/devices/sessions/others',
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(revokeOthersRes.statusCode, 200);
    const body = JSON.parse(revokeOthersRes.body);
    assert.equal(body.revokedCount, 2);

    // Calling session (token 1) must remain active
    const me1 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(me1.statusCode, 200);

    // Peer sessions (token 2 & 3) must be rejected
    const me2 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(me2.statusCode, 401);

    const me3 = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token3}` },
    });
    assert.equal(me3.statusCode, 401);
  });

  test('Test 12: Emergency kill-switch terminates 100% of user sessions', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.3';

    const email = `kill_${Date.now()}@smexstore.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!', username: `kill_${Date.now().toString().slice(-6)}` },
    });
    assert.equal(regRes.statusCode, 201);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Chrome on Windows' },
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(loginRes.statusCode, 200);
    const token = JSON.parse(loginRes.body).accessToken;

    const killRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/revoke-all',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(killRes.statusCode, 200);

    // Cookie must be cleared
    const rawCookie = killRes.headers['set-cookie'];
    const setCookie = Array.isArray(rawCookie) ? rawCookie[0] : (rawCookie as string) || '';
    assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'));

    // Even caller's token is now revoked
    const meAfter = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meAfter.statusCode, 401);
  });

  test('Test 13: Caller logout cleans up session and clears cookie', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.4';

    const email = `logout_${Date.now()}@smexstore.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!', username: `lgt_${Date.now().toString().slice(-6)}` },
    });
    assert.equal(regRes.statusCode, 201);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Chrome on Windows' },
      payload: { email, password: 'ValidPassword123!' },
    });
    assert.equal(loginRes.statusCode, 200);
    const token = JSON.parse(loginRes.body).accessToken;
    const cookieHeader = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie'][0]
      : (loginRes.headers['set-cookie'] as string);
    const sid = cookieHeader.match(/__Host-refresh-token=([^;]+)/)![1].split('.')[0];

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(logoutRes.statusCode, 200);

    // Tombstone must be set
    const tombstone = await app.redis.exists(`revoked_token:${sid}`);
    assert.equal(tombstone, 1);

    // Access token now rejected
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.statusCode, 401);
  });
});
