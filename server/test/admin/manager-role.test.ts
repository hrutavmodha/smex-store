import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { type FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { activityLogs } from '../../src/db/schema/activity.js';
import { sessions } from '../../src/db/schema/sessions.js';
import type { UserRole } from '@smex/shared';

function createTokenForRole(
  app: FastifyInstance,
  userId: string,
  role: UserRole
) {
  return app.jwt.sign({
    sub: userId,
    role,
    sessionId: `test_sess_${role}_${Date.now()}_${Math.random()}`,
  });
}

describe('Sprint 1 - Module 1: Standing Manager Lifecycle & RBAC', () => {
  it('TC-M1.1: Admin promotes registered user to manager via PATCH /api/v1/admin/users/:id/role', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'promotee');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_p1');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createTokenForRole(app, adminUser.id, 'admin');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${targetUser.id}/role`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        role: 'manager',
      },
    });

    assert.equal(res.statusCode, 200, 'Admin promoting user must return HTTP 200 OK');
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.user.id, targetUser.id);
    assert.equal(body.user.role, 'manager');
    assert.equal(body.user.promotedBy, adminUser.id);
    assert.ok(body.user.promotedAt !== null);

    // Verify in database
    const [dbUser] = await app.db
      .select({
        role: users.role,
        promotedBy: users.promotedBy,
        promotedAt: users.promotedAt,
      })
      .from(users)
      .where(eq(users.id, targetUser.id));

    assert.equal(dbUser.role, 'manager');
    assert.equal(dbUser.promotedBy, adminUser.id);
    assert.ok(dbUser.promotedAt !== null);

    // Verify audit log record in activity_logs
    const [log] = await app.db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.entityId, targetUser.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(1);

    assert.ok(log, 'Audit log must be created');
    assert.equal(log.userId, adminUser.id);
    assert.equal(log.actionType, 'admin_user_promote_manager');
    assert.equal(log.entityType, 'user');
    const metadata = log.metadataJson as { previousRole: string; newRole: string; adminId: string };
    assert.equal(metadata.previousRole, 'user');
    assert.equal(metadata.newRole, 'manager');
    assert.equal(metadata.adminId, adminUser.id);
  });

  it('TC-M1.2: Non-admin (normal user or manager) attempts to promote user to manager', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'target_u2');
    const { user: normalUser, token: normalUserToken } = await createVerifiedUser(app, 'norm_u');
    const { user: managerUser } = await createVerifiedUser(app, 'mgr_u');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));
    const managerToken = createTokenForRole(app, managerUser.id, 'manager');

    // Attempt 1: Normal user attempts promotion
    const resNormal = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${targetUser.id}/role`,
      headers: {
        authorization: `Bearer ${normalUserToken}`,
      },
      payload: {
        role: 'manager',
      },
    });

    assert.equal(resNormal.statusCode, 403, 'Normal user must receive HTTP 403 Forbidden');
    const bodyNormal = JSON.parse(resNormal.payload);
    assert.ok(
      bodyNormal.code === 'INSUFFICIENT_PERMISSIONS' || bodyNormal.code === 'ADMIN_ACCESS_REQUIRED',
      `Expected 403 error code, got: ${bodyNormal.code}`
    );

    // Attempt 2: Manager attempts promotion (only Admins have authority)
    const resManager = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${targetUser.id}/role`,
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
      payload: {
        role: 'manager',
      },
    });

    assert.equal(resManager.statusCode, 403, 'Manager user must receive HTTP 403 Forbidden');
    const bodyManager = JSON.parse(resManager.payload);
    assert.ok(
      bodyManager.code === 'INSUFFICIENT_PERMISSIONS' || bodyManager.code === 'ADMIN_ACCESS_REQUIRED',
      `Expected 403 error code, got: ${bodyManager.code}`
    );

    // Ensure database remained unchanged
    const [dbUser] = await app.db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, targetUser.id));
    assert.equal(dbUser.role, 'user');
  });

  it('TC-M1.3: Admin demotes/fires manager back to user and active session permissions are revoked', async (t) => {
    const app = await build(t);
    const { user: managerUser } = await createVerifiedUser(app, 'fire_mgr');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_fire');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    await app.db.update(users).set({ role: 'manager', promotedBy: adminUser.id, promotedAt: new Date() }).where(eq(users.id, managerUser.id));

    // Create an active session in DB for the manager
    const sessionId = crypto.randomUUID();
    await app.db.insert(sessions).values({
      id: sessionId,
      userId: managerUser.id,
      refreshTokenHash: 'dummy_hash',
      deviceType: 'desktop',
      deviceName: 'Chrome on Linux',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      isActive: true,
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });
    if (app.redis) {
      await app.redis.set(`session:${managerUser.id}:${sessionId}`, '1', 'EX', 3600);
    }

    const adminToken = createTokenForRole(app, adminUser.id, 'admin');

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${managerUser.id}/role`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        role: 'user',
      },
    });

    assert.equal(res.statusCode, 200, 'Admin demoting manager must return HTTP 200 OK');
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.user.role, 'user');
    assert.equal(body.user.promotedBy, null);
    assert.equal(body.user.promotedAt, null);

    // Verify in database
    const [dbUser] = await app.db
      .select({
        role: users.role,
        promotedBy: users.promotedBy,
        promotedAt: users.promotedAt,
      })
      .from(users)
      .where(eq(users.id, managerUser.id));

    assert.equal(dbUser.role, 'user');
    assert.equal(dbUser.promotedBy, null);
    assert.equal(dbUser.promotedAt, null);

    // Verify sessions revoked
    const [dbSession] = await app.db
      .select({ isActive: sessions.isActive })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    assert.equal(dbSession.isActive, false, 'Demoting manager must revoke active sessions');

    if (app.redis) {
      const revoked = await app.redis.get(`revoked_token:${sessionId}`);
      assert.equal(revoked, '1', 'Session must be tombstoned in Redis');
    }

    // Verify audit log recorded
    const [log] = await app.db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.entityId, managerUser.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(1);

    assert.equal(log.actionType, 'admin_user_demote_manager');
    const metadata = log.metadataJson as { previousRole: string; newRole: string };
    assert.equal(metadata.previousRole, 'manager');
    assert.equal(metadata.newRole, 'user');
  });

  it('TC-M1.4: JWT access token verification on newly minted manager token and RoleGuard verification', async (t) => {
    const testRouteEndpoint = '/api/v1/test/manager-only-route';
    const app = await build(t, (instance) => {
      instance.get(
        testRouteEndpoint,
        { preHandler: [instance.authenticate, instance.managerGuard] },
        async (_req, reply) => {
          return reply.code(200).send({ ok: true, access: 'manager_authorized' });
        }
      );
    });

    const { user: managerUser } = await createVerifiedUser(app, 'jwt_mgr');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    const managerToken = createTokenForRole(app, managerUser.id, 'manager');

    // 1. Verify token payload
    const decoded = app.jwt.verify<{ sub: string; role: string }>(managerToken);
    assert.equal(decoded.sub, managerUser.id);
    assert.equal(decoded.role, 'manager');

    // 2. Test managerGuard & roleGuard with manager token
    const resMgr = await app.inject({
      method: 'GET',
      url: testRouteEndpoint,
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });

    assert.equal(resMgr.statusCode, 200);
    const bodyMgr = JSON.parse(resMgr.payload);
    assert.equal(bodyMgr.access, 'manager_authorized');

    // 3. Normal user token must be rejected with 403 INSUFFICIENT_PERMISSIONS
    const { user: normalUser } = await createVerifiedUser(app, 'jwt_norm');
    const normalToken = createTokenForRole(app, normalUser.id, 'user');

    const resNorm = await app.inject({
      method: 'GET',
      url: testRouteEndpoint,
      headers: {
        authorization: `Bearer ${normalToken}`,
      },
    });

    assert.equal(resNorm.statusCode, 403);
    const bodyNorm = JSON.parse(resNorm.payload);
    assert.equal(bodyNorm.code, 'INSUFFICIENT_PERMISSIONS');
  });

  it('TC-M1.5: Edge cases - Validation error on invalid role and self-alteration prevention', async (t) => {
    const app = await build(t);
    const { user: targetUser } = await createVerifiedUser(app, 'edge_u');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_edge');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createTokenForRole(app, adminUser.id, 'admin');

    // Invalid role
    const resInvalid = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${targetUser.id}/role`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        role: 'invalid_role_name',
      },
    });
    assert.equal(resInvalid.statusCode, 422, 'Invalid role must return 422 Unprocessable Entity');

    // Admin attempts to alter own role
    const resSelf = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${adminUser.id}/role`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        role: 'manager',
      },
    });
    assert.equal(resSelf.statusCode, 400, 'Admin altering own role must return 400 Bad Request');
    const bodySelf = JSON.parse(resSelf.payload);
    assert.equal(bodySelf.code, 'CANNOT_ALTER_OWN_ROLE');
  });
});
