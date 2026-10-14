import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';

describe('Email Verification Lifecycle (LLT 2.6)', () => {
  test('Test 19: Atomic email verification execution via GETDEL', async (t) => {
    const app = await build(t);
    const ip = '10.20.1.1';

    const testUser = {
      email: `verify_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `ver_${Date.now().toString().slice(-6)}`,
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
    assert.equal(user.emailVerified, false);

    // Find the verification token in Redis: verify_email:{token}
    const tokenKeys = await app.redis.keys('verify_email:*');
    let verifyToken = '';
    for (const k of tokenKeys) {
      const val = await app.redis.get(k);
      if (val === user.id) {
        verifyToken = k.replace('verify_email:', '');
        break;
      }
    }
    assert.ok(verifyToken, 'Verification token must exist in Redis');
    assert.equal(verifyToken.length, 64, 'Token must be 64 characters');

    // First verification call: Consumes token via GETDEL and sets email_verified = true
    const verifyRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyToken },
    });
    assert.equal(verifyRes1.statusCode, 200);
    const body1 = JSON.parse(verifyRes1.body);
    assert.equal(body1.success, true);

    // Verify DB record
    const [dbUser] = await app.db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    assert.equal(dbUser.emailVerified, true);

    // Replay attack with same token: Must be rejected with 400 Bad Request
    const verifyRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-email',
      payload: { token: verifyToken },
    });
    assert.equal(verifyRes2.statusCode, 400);
    const body2 = JSON.parse(verifyRes2.body);
    assert.equal(body2.code, 'INVALID_OR_EXPIRED_TOKEN');
  });

  test('Test 20: Email verification guard gating high-trust actions', async (t) => {
    const app = await build(t, (instance) => {
      instance.post(
        '/api/v1/test/guarded-action',
        {
          preHandler: [instance.authenticate, instance.emailVerifiedGuard],
        },
        async (_request, reply) => {
          return reply.code(201).send({
            success: true,
            message: 'Action completed',
          });
        }
      );
    });
    const ip = '10.20.1.2';

    const testUser = {
      email: `guard_${Date.now()}@smexstore.com`,
      password: 'ValidPassword123!',
      username: `grd_${Date.now().toString().slice(-6)}`,
    };

    // Register unverified user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: testUser,
    });

    // Login to get access token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email: testUser.email, password: testUser.password },
    });
    const token = JSON.parse(loginRes.body).accessToken;

    // Attempt protected action while unverified: must be rejected with 403 Forbidden
    const deniedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/test/guarded-action',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(deniedRes.statusCode, 403);
    const deniedBody = JSON.parse(deniedRes.body);
    assert.equal(deniedBody.code, 'EMAIL_VERIFICATION_REQUIRED');
    assert.equal(deniedBody.status, 403);

    // Now verify the user in DB
    await app.db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, testUser.email.toLowerCase()));

    // Attempt protected action again: must succeed with 201 Created
    const allowedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/test/guarded-action',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(allowedRes.statusCode, 201);
    const allowedBody = JSON.parse(allowedRes.body);
    assert.equal(allowedBody.success, true);
  });
});
