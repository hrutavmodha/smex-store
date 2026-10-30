import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { sessions } from '../../src/db/schema/sessions.js';
import { registerSocket } from '../../src/plugins/websocket.js';

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
    const sessionId2 = cookieHeader.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

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
    const sid = cookieHeader.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

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

  test('Test 13-expired: Caller logout succeeds when access token is expired (BUG-M3-007)', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.41';

    const email = `logout_exp_${Date.now()}@smexstore.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: { email, password: 'ValidPassword123!', username: `lexp_${Date.now().toString().slice(-6)}` },
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

    const cookieHeader = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie'][0]
      : (loginRes.headers['set-cookie'] as string);
    const cookieVal = cookieHeader.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1];
    const sid = cookieVal.split('.')[0];
    const userId = JSON.parse(loginRes.body).user.id;

    // Craft an expired access token for this session
    const expiredToken = app.jwt.sign(
      { sub: userId, role: 'user', sessionId: sid },
      { expiresIn: '-10s' }
    );

    // Ensure /me rejects with 401 on expired token
    const meExpired = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(meExpired.statusCode, 401);

    // Call logout with expired token and refresh cookie
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${expiredToken}`,
        cookie: `__Host-refresh-token=${cookieVal}`,
      },
    });
    assert.equal(logoutRes.statusCode, 200);
    assert.deepEqual(JSON.parse(logoutRes.body), {
      success: true,
      message: 'Logged out successfully',
    });

    // Check Set-Cookie clears __Host-refresh-token
    const logoutCookies = logoutRes.headers['set-cookie'];
    const logoutCookieStr = Array.isArray(logoutCookies) ? logoutCookies.join(';') : (logoutCookies || '');
    assert.match(logoutCookieStr, /__Host-refresh-token=;/);

    // Fast-path tombstone must be set in Redis
    const tombstone = await app.redis.exists(`revoked_token:${sid}`);
    assert.equal(tombstone, 1);

    // Session deleted from Redis
    const sessionExists = await app.redis.exists(`session:${userId}:${sid}`);
    assert.equal(sessionExists, 0);

    // Session marked inactive in Postgres
    const [dbSession] = await app.db
      .select({ isActive: sessions.isActive })
      .from(sessions)
      .where(eq(sessions.id, sid));
    assert.equal(dbSession?.isActive, false);
  });

  test('Test 13b: Query active device sessions via GET /api/v1/devices/sessions with current session flag and device types', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.5';

    const testUser = {
      email: `devices_test_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `dev_${Date.now().toString().slice(-6)}`,
    };

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: testUser,
    });
    assert.equal(regRes.statusCode, 201);

    // Unauthenticated GET /api/v1/devices/sessions must return 401
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/sessions',
    });
    assert.equal(unauthRes.statusCode, 401);

    // Login from Device 1 (Desktop)
    const log1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '103.21.244.10',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(log1.statusCode, 200);
    const token1 = JSON.parse(log1.body).accessToken;
    const cookieHeader1 = Array.isArray(log1.headers['set-cookie'])
      ? log1.headers['set-cookie'][0]
      : (log1.headers['set-cookie'] as string);
    const sessionId1 = cookieHeader1.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

    // Login from Device 2 (Mobile)
    const log2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '103.21.244.20',
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' },
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(log2.statusCode, 200);
    const cookieHeader2 = Array.isArray(log2.headers['set-cookie'])
      ? log2.headers['set-cookie'][0]
      : (log2.headers['set-cookie'] as string);
    const sessionId2 = cookieHeader2.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

    // Query active sessions using Device 1 token
    const devicesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/sessions',
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(devicesRes.statusCode, 200);
    const body = JSON.parse(devicesRes.body);
    assert.ok(Array.isArray(body.sessions), 'sessions must be an array');
    assert.equal(body.sessions.length, 2, 'Must have 2 active sessions');

    // Find sessions in response
    const currentSession = body.sessions.find((s: any) => s.isCurrent === true);
    const peerSession = body.sessions.find((s: any) => s.isCurrent === false);

    assert.ok(currentSession, 'Current device session must be present and flagged isCurrent: true');
    assert.ok(peerSession, 'Peer device session must be present and flagged isCurrent: false');

    // Verify unified contract: both id and sessionId are provided
    assert.equal(currentSession.id, sessionId1);
    assert.equal(currentSession.sessionId, sessionId1);
    assert.equal(currentSession.deviceType, 'desktop');
    assert.equal(currentSession.deviceName, 'Chrome on Windows');
    assert.equal(currentSession.ipAddress, '103.21.244.10');
    assert.ok(currentSession.lastActive, 'lastActive string must be present');
    assert.ok(currentSession.lastActiveAt, 'lastActiveAt must be present');
    assert.ok(currentSession.createdAt, 'createdAt must be present');

    assert.equal(peerSession.id, sessionId2);
    assert.equal(peerSession.sessionId, sessionId2);
    assert.equal(peerSession.deviceType, 'mobile');
    assert.equal(peerSession.deviceName, 'Safari on iOS');
    assert.equal(peerSession.ipAddress, '103.21.244.20');

    // Revoke Device 2 and re-query
    const revokeRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/devices/sessions/${sessionId2}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(revokeRes.statusCode, 200);

    const afterRevokeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/sessions',
      headers: { authorization: `Bearer ${token1}` },
    });
    assert.equal(afterRevokeRes.statusCode, 200);
    const afterBody = JSON.parse(afterRevokeRes.body);
    assert.equal(afterBody.sessions.length, 1, 'Only Device 1 should remain active');
    assert.equal(afterBody.sessions[0].sessionId, sessionId1);
  });

  test('Test 13c: Prevent IDOR unauthorized remote session revocation across users (BUG-M3-001)', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.6';

    const userA = {
      email: `idor_a_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `idor_a_${Date.now().toString().slice(-6)}`,
    };

    const userB = {
      email: `idor_b_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `idor_b_${Date.now().toString().slice(-6)}`,
    };

    // Register User A
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: userA,
    });

    // Login User A
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email: userA.email, password: userA.password },
    });
    assert.equal(loginA.statusCode, 200);
    const tokenA = JSON.parse(loginA.body).accessToken;

    // Register User B
    const regB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: userB,
    });
    assert.equal(regB.statusCode, 201);
    const userBRecord = JSON.parse(regB.body);

    // Login User B
    const loginB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email: userB.email, password: userB.password },
    });
    assert.equal(loginB.statusCode, 200);
    const tokenB = JSON.parse(loginB.body).accessToken;
    const cookieHeaderB = Array.isArray(loginB.headers['set-cookie'])
      ? loginB.headers['set-cookie'][0]
      : (loginB.headers['set-cookie'] as string);
    const sessionIdB = cookieHeaderB.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

    // User A attempts to evict User B's session via IDOR: DELETE /api/v1/devices/sessions/:sessionIdB
    const idorRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/devices/sessions/${sessionIdB}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });

    assert.equal(idorRes.statusCode, 404, 'Must reject unauthorized cross-user session revocation with 404');
    const idorBody = JSON.parse(idorRes.body);
    assert.equal(idorBody.code, 'SESSION_NOT_FOUND');

    // Verify User B's session is still completely intact in Redis
    const sessionBExists = await app.redis.exists(`session:${userBRecord.id}:${sessionIdB}`);
    assert.equal(sessionBExists, 1, 'User B session must NOT be deleted from Redis');

    const lookupBExists = await app.redis.exists(`session_lookup:${sessionIdB}`);
    assert.equal(lookupBExists, 1, 'User B session lookup must NOT be deleted from Redis');

    const tombstoneB = await app.redis.exists(`revoked_token:${sessionIdB}`);
    assert.equal(tombstoneB, 0, 'No tombstone should be created for User B session');

    // Verify User B can still access /api/v1/auth/me
    const meB = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    assert.equal(meB.statusCode, 200, 'User B session must remain fully active and valid');

    // Verify User B DB session isActive remains true
    const [dbSessionB] = await app.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionIdB))
      .limit(1);
    assert.equal(dbSessionB.isActive, true, 'User B database session isActive must remain true');
  });

  test('Test 14: Expired sessions are excluded from active devices list and lazily marked inactive (BUG-M3-006)', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.99';

    const testUser = {
      email: `test_expired_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `exp_${Date.now().toString().slice(-6)}`,
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

    // Login (active session)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: { 'user-agent': 'Chrome on Windows' },
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(loginRes.statusCode, 200);
    const activeToken = JSON.parse(loginRes.body).accessToken;

    // Insert an expired session manually for this user in DB
    const expiredSessionId = crypto.randomUUID();
    const expiredAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    await app.db.insert(sessions).values({
      id: expiredSessionId,
      userId: user.id,
      refreshTokenHash: 'hash_expired_session',
      deviceType: 'desktop',
      deviceName: 'Chrome on Windows',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Expired Device',
      isActive: true,
      expiresAt: expiredAt,
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      lastActiveAt: expiredAt,
    });

    // Query active device sessions: GET /api/v1/devices/sessions
    const devicesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/sessions',
      headers: { authorization: `Bearer ${activeToken}` },
    });
    assert.equal(devicesRes.statusCode, 200);
    const devicesBody = JSON.parse(devicesRes.body);

    // Verify expired session is NOT returned in active sessions list
    const foundExpired = devicesBody.sessions.find((s: any) => s.sessionId === expiredSessionId || s.id === expiredSessionId);
    assert.equal(foundExpired, undefined, 'Expired session must not be returned in active sessions list');

    // Verify expired session was lazily marked as isActive = false in DB
    const [dbExpiredSession] = await app.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, expiredSessionId))
      .limit(1);
    assert.equal(dbExpiredSession.isActive, false, 'Expired session must be lazily updated to isActive = false in DB');
  });

  test('Test 15: Session revocation terminates live WebSocket connections (BUG-M3-009)', async (t) => {
    const app = await build(t);
    const ip = '10.10.1.99';

    const testUser = {
      email: `ws_revoke_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `wsr_${Date.now().toString().slice(-6)}`,
    };

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: testUser,
    });
    assert.equal(regRes.statusCode, 201);
    const userId = JSON.parse(regRes.body).id;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email: testUser.email, password: testUser.password },
    });
    assert.equal(loginRes.statusCode, 200);
    const token = JSON.parse(loginRes.body).accessToken;
    const cookieHeader = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie'][0]
      : (loginRes.headers['set-cookie'] as string);
    const sessionId = cookieHeader.match(/(?:__Host-refresh-token|smex_refresh_token)=([^;]+)/)![1].split('.')[0];

    // Register a live mock WebSocket connection for this user and session
    let wsClosed = false;
    let wsCloseCode = 0;
    const mockSocket = new EventEmitter() as any;
    mockSocket.readyState = 1;
    mockSocket.close = (code: number) => {
      wsClosed = true;
      wsCloseCode = code;
    };
    mockSocket.terminate = () => {
      wsClosed = true;
    };
    mockSocket.send = () => {};

    registerSocket(mockSocket, app.wsGateway.clients, app.log, userId, sessionId);
    assert.equal(app.wsGateway.getActiveClientCount(), 1);

    // Call DELETE /api/v1/devices/sessions/:sessionId
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/devices/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(deleteRes.statusCode, 200);

    // Verify WebSocket connection was forcefully terminated by server
    assert.equal(wsClosed, true, 'WebSocket connection must be forcefully closed on session revocation');
    assert.equal(wsCloseCode, 4401);
    assert.equal(app.wsGateway.getActiveClientCount(), 0, 'Socket must be purged from clients map');
  });

  test('Test 15: Login history audit log tracking and retrieval via GET /api/v1/devices/history (BUG-M3-008)', async (t) => {
    const app = await build(t);
    const email = `audit_login_${Date.now()}@smexstore.com`;
    const password = 'ValidPassword123!';

    // Register user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '192.168.1.10',
      payload: {
        email,
        password,
        username: `aud_${Date.now().toString().slice(-6)}`,
      },
    });
    assert.equal(regRes.statusCode, 201);
    const user = JSON.parse(regRes.body);

    // 1. Successful login
    const loginRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '192.168.1.10',
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      payload: { email, password },
    });
    assert.equal(loginRes1.statusCode, 200);
    const token = JSON.parse(loginRes1.body).accessToken;

    // 2. Failed login attempt (wrong password)
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: '192.168.1.20',
      headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      payload: { email, password: 'WrongPassword123!' },
    });
    assert.equal(loginRes2.statusCode, 401);

    // 3. Retrieve login history
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/history',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(historyRes.statusCode, 200);
    const body = JSON.parse(historyRes.body);

    assert.ok(Array.isArray(body.history), 'Must return history array');
    assert.ok(body.history.length >= 2, 'Must contain at least 2 audit entries');

    const statuses = body.history.map((h: any) => h.status);
    assert.ok(statuses.includes('success'), 'Must contain success entry');
    assert.ok(statuses.includes('failed'), 'Must contain failed entry');

    // Verify fields
    const successEntry = body.history.find((h: any) => h.status === 'success');
    assert.equal(successEntry.ipAddress, '192.168.1.10');
    assert.ok(successEntry.createdAt, 'Must include timestamp');
  });
});
