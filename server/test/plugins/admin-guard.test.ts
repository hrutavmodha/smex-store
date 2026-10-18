import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { build } from '../helper.js';

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

describe('Milestone 9: RBAC & Access Control Guards (LLT 2.1 Tests 1-4)', () => {
  it('Test 1: Unauthenticated request to admin endpoint', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
    });

    assert.equal(res.statusCode, 401, 'Unauthenticated request must return HTTP 401');
    const body = JSON.parse(res.payload);
    assert.ok(
      body.code === 'UNAUTHORIZED' || body.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER',
      `Expected 401 unauthorized code, got: ${body.code}`
    );
  });

  it('Test 2: Non-admin user access rejection', async (t) => {
    const app = await build(t);
    const userToken = createUserToken(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
      headers: {
        authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(res.statusCode, 403, 'Normal user request must return HTTP 403 Forbidden');
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'ADMIN_ACCESS_REQUIRED');
  });

  it('Test 3: Admin user access authorization', async (t) => {
    const app = await build(t);
    const adminToken = createAdminToken(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 200, 'Admin request must return HTTP 200 OK');
    const body = JSON.parse(res.payload);
    assert.ok(typeof body.activeUsers === 'number');
    assert.ok(typeof body.activeListings === 'number');
    assert.ok(typeof body.liveTournaments === 'number');
    assert.equal(body.databaseStatus, 'ok');
  });

  it('Test 4: Admin metrics aggregation accuracy', async (t) => {
    const app = await build(t);
    const adminToken = createAdminToken(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/metrics',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.activeUsers >= 0, 'activeUsers must be non-negative integer');
    assert.ok(body.activeListings >= 0, 'activeListings must be non-negative integer');
    assert.ok(body.liveTournaments >= 0, 'liveTournaments must be non-negative integer');
    assert.equal(body.databaseStatus, 'ok', 'database status probe must be ok');
    assert.ok(typeof body.dbLatencyMs === 'number', 'dbLatencyMs must be numeric');
  });
});
