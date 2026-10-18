import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { SessionService } from '../../src/services/session.service.js';

function createAdminToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000001') {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: `test_admin_sess_${Date.now()}_${Math.random()}`,
  });
}

describe('Milestone 9: User Moderation and Session Eviction (LLT 2.2 Tests 5-10)', () => {
  it('Test 5: Admin bans user successfully', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'target_u');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_u');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Cheating and match fixing',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.bannedUserId, targetUser.id);

    // Verify in database
    const [dbUser] = await app.db
      .select({
        isBanned: users.isBanned,
        banReason: users.banReason,
        bannedAt: users.bannedAt,
      })
      .from(users)
      .where(eq(users.id, targetUser.id));

    assert.equal(dbUser.isBanned, true);
    assert.equal(dbUser.banReason, 'Cheating and match fixing');
    assert.ok(dbUser.bannedAt !== null);
  });

  it('Test 6: Active Redis session eviction on ban', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'session_target');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_sess');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create 3 active sessions in Redis and DB
    await SessionService.createSession(
      targetUser.id,
      {
        deviceFingerprint: 'fp_1',
        deviceName: 'Device 1',
        ipAddress: '10.0.0.1',
        userAgent: 'Agent 1',
      },
      app.db,
      app.redis
    );
    await SessionService.createSession(
      targetUser.id,
      {
        deviceFingerprint: 'fp_2',
        deviceName: 'Device 2',
        ipAddress: '10.0.0.2',
        userAgent: 'Agent 2',
      },
      app.db,
      app.redis
    );
    await SessionService.createSession(
      targetUser.id,
      {
        deviceFingerprint: 'fp_3',
        deviceName: 'Device 3',
        ipAddress: '10.0.0.3',
        userAgent: 'Agent 3',
      },
      app.db,
      app.redis
    );

    const initialKeys = await app.redis.keys(`session:${targetUser.id}:*`);
    assert.ok(initialKeys.length >= 3, 'Expected at least 3 session keys in Redis');

    // Admin bans target user
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Violation of rules',
      },
    });

    assert.equal(res.statusCode, 200);

    // Verify all active Redis session keys evicted
    const remainingKeys = await app.redis.keys(`session:${targetUser.id}:*`);
    assert.equal(remainingKeys.length, 0, 'All Redis session keys must be deleted upon ban');
  });

  it('Test 7: Real-time WebSocket session revocation broadcast', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'ws_target');
    const { user: adminUser } = await createVerifiedUser(app, 'ws_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Mock WebSocket broadcast
    let broadcastChannel = '';
    let broadcastPayload: any = null;

    app.wsGateway = {
      ...app.wsGateway,
      broadcastToChannel: (channel: string, message: unknown) => {
        broadcastChannel = channel;
        broadcastPayload = message;
      },
      terminateUserSockets: (_userId: string) => {},
    };

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Cheating',
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(broadcastChannel, `user:${targetUser.id}`);
    assert.ok(broadcastPayload);
    assert.equal(broadcastPayload.event, 'session:revoked');
    assert.equal(broadcastPayload.reason, 'account_banned');
  });

  it('Test 8: Banned user subsequent API call rejection', async (t) => {
    const app = await build(t);
    const { user: targetUser, token: userToken } = await createVerifiedUser(app, 'banned_caller');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_guard_caller');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // First, verify unbanned user can call auth/me route
    const okRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });
    assert.equal(okRes.statusCode, 200);

    // Admin bans the user
    const banRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Fraudulent transactions',
      },
    });
    assert.equal(banRes.statusCode, 200);

    // Banned user attempts subsequent API call with their existing token
    const blockedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(blockedRes.statusCode, 403, 'Banned user request must be intercepted with HTTP 403');
    const body = JSON.parse(blockedRes.payload);
    assert.equal(body.code, 'ACCOUNT_BANNED');
  });

  it('Test 9: Admin unbans user successfully', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'unban_target');
    const { user: adminUser } = await createVerifiedUser(app, 'unban_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Ban first
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/ban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Temporary suspension',
      },
    });

    // Verify banned in DB
    const [bannedDb] = await app.db
      .select({ isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, targetUser.id));
    assert.equal(bannedDb.isBanned, true);

    // Admin unbans the user
    const unbanRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetUser.id}/unban`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(unbanRes.statusCode, 200);
    const body = JSON.parse(unbanRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.unbannedUserId, targetUser.id);

    // Verify unbanned in DB
    const [unbannedDb] = await app.db
      .select({
        isBanned: users.isBanned,
        banReason: users.banReason,
        bannedAt: users.bannedAt,
      })
      .from(users)
      .where(eq(users.id, targetUser.id));

    assert.equal(unbannedDb.isBanned, false);
    assert.equal(unbannedDb.banReason, null);
    assert.equal(unbannedDb.bannedAt, null);
  });

  it('Test 10: Admin-on-admin ban prevention', async (t) => {
    const app = await build(t);
    const { user: adminA } = await createVerifiedUser(app, 'admin_a');
    const { user: adminB } = await createVerifiedUser(app, 'admin_b');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminA.id));
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminB.id));

    const adminAToken = createAdminToken(app, adminA.id);

    // Admin A attempts to ban Admin B
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${adminB.id}/ban`,
      headers: {
        authorization: `Bearer ${adminAToken}`,
      },
      payload: {
        reason: 'Internal dispute',
      },
    });

    assert.equal(res.statusCode, 400, 'Admin-on-admin ban must be rejected with HTTP 400');
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'CANNOT_BAN_ADMIN');
  });
});
