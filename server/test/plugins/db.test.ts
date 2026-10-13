import { test } from 'vitest';
import assert from 'node:assert/strict';
import pg from 'pg';
import { build } from '../helper.js';
import { createDbPool, getDbPoolConfig } from '../../src/db/index.js';

test('Test 1: Fastify DB Instance Decoration', async (t) => {
  const app = await build(t);

  assert.ok(app.db, 'app.db should be decorated on Fastify instance');
  assert.ok(app.dbPool, 'app.dbPool should be decorated on Fastify instance');
  assert.ok(app.dbPool instanceof pg.Pool, 'app.dbPool should be an instance of pg.Pool');

  const result = await app.dbPool.query('SELECT 1 as result');
  assert.strictEqual(result.rows[0].result, 1);
});

test('Test 2: Bounded connection pool sizing and timeout parameters', async () => {
  const devConfig = getDbPoolConfig({
    NODE_ENV: 'development',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/smex_store',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'development_jwt_secret_key_needs_to_be_32_chars_minimum!',
    JWT_REFRESH_SECRET: 'development_jwt_refresh_secret_key_needs_32_chars_min!',
    CORS_ORIGIN: 'http://localhost:3000',
    S3_REGION: 'auto',
    S3_BUCKET: 'smex-storage',
  });

  assert.ok(devConfig.max <= 20, 'Pool max connections must be <= 20');
  assert.strictEqual(devConfig.idleTimeoutMillis, 30000, 'idleTimeoutMillis should be 30000ms');
  assert.strictEqual(devConfig.connectionTimeoutMillis, 5000, 'connectionTimeoutMillis should be 5000ms');
  assert.strictEqual(devConfig.allowExitOnIdle, false);

  const prodConfig = getDbPoolConfig({
    NODE_ENV: 'production',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/smex_store',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'production_secure_jwt_secret_key_32_chars_min!',
    JWT_REFRESH_SECRET: 'production_secure_jwt_refresh_secret_32_chars_min!',
    CORS_ORIGIN: 'http://localhost:3000',
    S3_REGION: 'auto',
    S3_BUCKET: 'smex-storage',
  });

  assert.strictEqual(prodConfig.max, 20, 'Production pool max connections should be 20');
  assert.strictEqual(prodConfig.idleTimeoutMillis, 30000);
  assert.strictEqual(prodConfig.connectionTimeoutMillis, 5000);
});

test('Test 3: Graceful connection pool draining on server close', async (t) => {
  const app = await build(t);
  const pool = app.dbPool;

  assert.ok(pool);
  const probe = await pool.query('SELECT 1 as val');
  assert.strictEqual(probe.rows[0].val, 1);

  // Trigger server teardown
  await app.close();

  // Subsequent queries on the drained pool must be rejected
  await assert.rejects(
    async () => {
      await pool.query('SELECT 1');
    },
    (err: Error) => {
      return (
        err.message.includes('Cannot use a pool after calling end on the pool') ||
        err.message.includes('called end')
      );
    },
    'Queries after pool.end() must be rejected'
  );
});
