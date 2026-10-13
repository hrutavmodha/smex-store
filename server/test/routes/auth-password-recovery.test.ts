import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { verifyPassword } from '../../src/utils/crypto.js';

describe('Atomic Password Recovery (LLT 2.7)', () => {
  test('Test 21: Forgot password timing-safe response and token generation', async (t) => {
    const app = await build(t);
    const ip = '10.30.1.1';

    const registeredEmail = `pwd_reg_${Date.now()}@smexstore.com`;
    const unregisteredEmail = `pwd_unreg_${Date.now()}@smexstore.com`;

    // Register a user
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: {
        email: registeredEmail,
        password: 'ValidPassword123!',
        username: `pwd_${Date.now().toString().slice(-6)}`,
      },
    });

    // Request reset for registered account
    const start1 = Date.now();
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      remoteAddress: ip,
      payload: { email: registeredEmail },
    });
    const dur1 = Date.now() - start1;
    assert.equal(res1.statusCode, 200);
    const body1 = JSON.parse(res1.body);
    assert.equal(body1.message, 'If an account exists, a link was sent');

    // Request reset for non-existent account
    const start2 = Date.now();
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      remoteAddress: ip,
      payload: { email: unregisteredEmail },
    });
    const dur2 = Date.now() - start2;
    assert.equal(res2.statusCode, 200);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.message, 'If an account exists, a link was sent');

    // Both should return identical success messages
    assert.deepEqual(body1, body2);

    // Verify token exists in Redis for registered user
    const keys = await app.redis.keys('reset_password:*');
    assert.ok(keys.length > 0, 'Reset token must be stored in Redis');
    const ttl = await app.redis.ttl(keys[0]);
    assert.ok(ttl > 0 && ttl <= 900, 'TTL must be <= 900 seconds');
  });

  test('Test 22: Password reset atomic consumption via GETDEL', async (t) => {
    const app = await build(t);
    const ip = '10.30.1.2';

    const email = `pwd_reset_${Date.now()}@smexstore.com`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: {
        email,
        password: oldPassword,
        username: `rst_${Date.now().toString().slice(-6)}`,
      },
    });

    // Clear old reset tokens and rate limit keys
    const oldTokens = await app.redis.keys('reset_password:*');
    if (oldTokens.length > 0) {
      await app.redis.del(...oldTokens);
    }
    const existing = await app.redis.keys(`*${ip}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    // Trigger forgot password
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      remoteAddress: ip,
      payload: { email },
    });

    // Find the token
    const tokenKeys = await app.redis.keys('reset_password:*');
    assert.ok(tokenKeys.length > 0);
    const resetToken = tokenKeys[0].replace('reset_password:', '');

    // Reset password with valid token
    const resetRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: resetToken,
        newPassword,
      },
    });
    assert.equal(resetRes1.statusCode, 200);
    const body1 = JSON.parse(resetRes1.body);
    assert.equal(body1.message, 'Password updated successfully');

    // Verify DB updated with new hash
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    assert.equal(await verifyPassword(user.passwordHash, newPassword), true);
    assert.equal(await verifyPassword(user.passwordHash, oldPassword), false);

    // Attempt second submission with same token: Must be rejected with 400 Bad Request
    const resetRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token: resetToken,
        newPassword: 'AnotherPassword789!',
      },
    });
    assert.equal(resetRes2.statusCode, 400);
    const body2 = JSON.parse(resetRes2.body);
    assert.equal(body2.code, 'INVALID_RESET_TOKEN');
  });

  test('Test 23: Password reset triggers automatic account kill-switch', async (t) => {
    const app = await build(t);
    const ip = '10.30.1.3';

    const email = `pwd_kill_${Date.now()}@smexstore.com`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: ip,
      payload: {
        email,
        password: oldPassword,
        username: `rkill_${Date.now().toString().slice(-6)}`,
      },
    });

    // Log in to create an active session
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      payload: { email, password: oldPassword },
    });
    const oldAccessToken = JSON.parse(loginRes.body).accessToken;

    // Trigger forgot password
    const oldTokens = await app.redis.keys('reset_password:*');
    if (oldTokens.length > 0) {
      await app.redis.del(...oldTokens);
    }
    const existing = await app.redis.keys(`*${ip}*`);
    if (existing.length > 0) {
      await app.redis.del(...existing);
    }

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      remoteAddress: ip,
      payload: { email },
    });

    const tokenKeys = await app.redis.keys('reset_password:*');
    const resetToken = tokenKeys[0].replace('reset_password:', '');

    // Reset password
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: { token: resetToken, newPassword },
    });

    // Old access token must now be rejected via fast-path tombstone
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${oldAccessToken}` },
    });
    assert.equal(meRes.statusCode, 401);
  });
});
