import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../helper.js';

describe('User Registration Username Validation Suite (BUG-M2-002)', () => {
  const validPassword = 'ValidPassword123!';

  test('Rejects registration with script injection tag in username', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '10.88.1.1',
      payload: {
        email: `xss_${Date.now()}@smexstore.com`,
        password: validPassword,
        username: '<script>alert(1)</script>',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'VALIDATION_FAILED');
    assert.equal(body.detail, 'Username must only contain alphanumeric characters and underscores');
  });

  test('Rejects registration with whitespace in username', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '10.88.1.2',
      payload: {
        email: `space_${Date.now()}@smexstore.com`,
        password: validPassword,
        username: 'hello world',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'VALIDATION_FAILED');
    assert.equal(body.detail, 'Username must only contain alphanumeric characters and underscores');
  });

  test('Rejects registration with URL-sensitive characters in username', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '10.88.1.3',
      payload: {
        email: `slash_${Date.now()}@smexstore.com`,
        password: validPassword,
        username: 'user/admin',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'VALIDATION_FAILED');
  });

  test('Rejects registration with username shorter than 3 characters', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '10.88.1.4',
      payload: {
        email: `short_${Date.now()}@smexstore.com`,
        password: validPassword,
        username: 'ab',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'VALIDATION_FAILED');
    assert.equal(body.detail, 'Username must be at least 3 characters');
  });

  test('Accepts valid alphanumeric and underscore username', async (t) => {
    const app = await build(t);

    const validUsername = `valid_${Date.now().toString().slice(-6)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      remoteAddress: '10.88.1.5',
      payload: {
        email: `valid_${Date.now()}@smexstore.com`,
        password: validPassword,
        username: validUsername,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.profile.username, validUsername);
  });
});
