import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';

describe('Session Cookie Security & Environment Transport Suite (Bug 22)', () => {
  test('Non-HTTPS / development environment sets plain HTTP cookies without __Host- prefix and SameSite=Lax', async (t) => {
    const app = await build(t, (instance) => {
      instance.config.COOKIE_SECURE = false;
    });

    const { user } = await createVerifiedUser(app, 'cookie_dev');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: user.email,
        password: 'ValidPassword123!',
      },
    });

    assert.equal(loginRes.statusCode, 200);
    const setCookieHeaders = loginRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders as string];

    const refreshCookie = cookies.find((c) => c.startsWith('smex_refresh_token='));
    const accessCookie = cookies.find((c) => c.startsWith('smex_access_token='));

    assert.ok(refreshCookie, 'Should use smex_refresh_token name in non-production');
    assert.ok(accessCookie, 'Should set smex_access_token cookie');
    assert.ok(!refreshCookie.includes('; Secure'), 'Non-production refresh cookie must not include Secure flag');
    assert.ok(!accessCookie.includes('; Secure'), 'Non-production access cookie must not include Secure flag');
    assert.match(refreshCookie, /SameSite=Lax/i, 'Non-production cookie should use SameSite=Lax');

    // Verify refresh works with smex_refresh_token
    const rawVal = refreshCookie.match(/smex_refresh_token=([^;]+)/)![1];
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: `smex_refresh_token=${rawVal}`,
      },
    });
    assert.equal(refreshRes.statusCode, 200);
  });

  test('Production / HTTPS environment enforces __Host- prefix, Secure flag, and SameSite=Strict', async (t) => {
    const app = await build(t, (instance) => {
      instance.config.COOKIE_SECURE = true;
    });

    const { user } = await createVerifiedUser(app, 'cookie_prod');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: user.email,
        password: 'ValidPassword123!',
      },
    });

    assert.equal(loginRes.statusCode, 200);
    const setCookieHeaders = loginRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders as string];

    const refreshCookie = cookies.find((c) => c.startsWith('__Host-refresh-token='));
    const accessCookie = cookies.find((c) => c.startsWith('smex_access_token='));

    assert.ok(refreshCookie, 'Should use __Host-refresh-token name in production');
    assert.ok(accessCookie, 'Should set smex_access_token cookie');
    assert.match(refreshCookie, /;\s*Secure/i, 'Production refresh cookie must enforce Secure flag');
    assert.match(accessCookie, /;\s*Secure/i, 'Production access cookie must enforce Secure flag');
    assert.match(refreshCookie, /SameSite=Strict/i, 'Production cookie should use SameSite=Strict');

    // Verify logout clears both cookie variants
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        authorization: `Bearer ${JSON.parse(loginRes.body).accessToken}`,
      },
    });
    assert.equal(logoutRes.statusCode, 200);
    const logoutCookies = logoutRes.headers['set-cookie'];
    const logoutStr = Array.isArray(logoutCookies) ? logoutCookies.join(';') : (logoutCookies || '');
    assert.match(logoutStr, /__Host-refresh-token=;/);
    assert.match(logoutStr, /smex_refresh_token=;/);
  });
});
