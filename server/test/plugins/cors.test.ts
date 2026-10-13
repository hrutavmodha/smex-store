import { test } from 'vitest';
import assert from 'node:assert';
import { build } from '../helper.js';

test('CORS plugin permits localhost:3000 origin with credentials', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/',
    headers: {
      origin: 'http://localhost:3000',
    },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
  assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
});

test('CORS preflight request returns 24-hour max-age cache header', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'OPTIONS',
    url: '/',
    headers: {
      origin: 'http://localhost:3000',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,authorization',
    },
  });

  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.headers['access-control-max-age'], '86400');
  assert.strictEqual(res.headers['access-control-allow-credentials'], 'true');
});

test('CORS allows requests with no origin', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/',
  });

  assert.strictEqual(res.statusCode, 200);
});
