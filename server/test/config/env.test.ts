import { test } from 'vitest';
import assert from 'node:assert';
import { loadEnv, envSchema } from '../../src/config/env.js';

test('envSchema provides valid development defaults', () => {
  const result = envSchema.safeParse({});
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.NODE_ENV, 'development');
    assert.strictEqual(result.data.PORT, 3001);
    assert.strictEqual(result.data.CORS_ORIGIN, 'http://localhost:3000');
    assert.strictEqual(result.data.DATABASE_URL.startsWith('postgresql://'), true);
    assert.strictEqual(result.data.REDIS_URL.startsWith('redis://'), true);
  }
});

test('envSchema fails with invalid URLs', () => {
  const result = envSchema.safeParse({
    DATABASE_URL: 'not-a-valid-url',
  });
  assert.strictEqual(result.success, false);
});

test('envSchema fails with short JWT secrets', () => {
  const result = envSchema.safeParse({
    JWT_SECRET: 'too-short',
  });
  assert.strictEqual(result.success, false);
});

test('envSchema rejects development secrets in production environment', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    JWT_SECRET: 'development_jwt_secret_key_needs_to_be_32_chars_minimum!',
  });
  assert.strictEqual(result.success, false);
});

test('loadEnv returns parsed configuration object', () => {
  const config = loadEnv();
  assert.ok(config);
  assert.strictEqual(typeof config.PORT, 'number');
});
