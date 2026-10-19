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

test('envSchema rejects development JWT_REFRESH_SECRET in production even if JWT_SECRET is set', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    JWT_SECRET: 'a_very_secure_production_secret_with_sufficient_length_123',
    // JWT_REFRESH_SECRET omitted, falls back to default development string
  });
  assert.strictEqual(result.success, false);
});

test('envSchema accepts secure non-development JWT secrets in production environment', () => {
  const result = envSchema.safeParse({
    NODE_ENV: 'production',
    JWT_SECRET: 'a_very_secure_production_secret_with_sufficient_length_123',
    JWT_REFRESH_SECRET: 'another_secure_production_refresh_secret_32_chars_min!',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/smex_store',
    REDIS_URL: 'redis://localhost:6379',
  });
  assert.strictEqual(result.success, true);
});

test('loadEnv returns parsed configuration object', () => {
  const config = loadEnv();
  assert.ok(config);
  assert.strictEqual(typeof config.PORT, 'number');
});

