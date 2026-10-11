import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../helper.js';

describe('Data Layer Extended Health Probe Suite', () => {
  test('Test 26: Active database query ping and latency reporting', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      url: '/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const payload = JSON.parse(res.payload);

    assert.strictEqual(payload.status, 'ok');
    assert.strictEqual(typeof payload.uptime, 'number');
    assert.strictEqual(typeof payload.timestamp, 'string');
    assert.ok(payload.memory);
    assert.strictEqual(typeof payload.memory.rss, 'number');
    assert.strictEqual(typeof payload.memory.heapTotal, 'number');
    assert.strictEqual(typeof payload.memory.heapUsed, 'number');
    assert.strictEqual(typeof payload.environment, 'string');

    // Database specific health payload
    assert.ok(payload.database, 'database health object must be present');
    assert.strictEqual(payload.database.status, 'connected');
    assert.strictEqual(typeof payload.database.latencyMs, 'number');
    assert.ok(payload.database.latencyMs >= 0);
    assert.ok(payload.database.pool, 'database pool metrics must be present');
    assert.strictEqual(typeof payload.database.pool.totalCount, 'number');
    assert.strictEqual(typeof payload.database.pool.idleCount, 'number');
    assert.strictEqual(typeof payload.database.pool.waitingCount, 'number');
  });

  test('Test 27: Degraded health probe on database connection failure', async (t) => {
    const app = await build(t);

    // Close the dbPool to simulate connection severance / DB outage
    await app.dbPool.end();

    const res = await app.inject({
      url: '/health',
    });

    assert.strictEqual(res.statusCode, 503, 'Should return HTTP 503 Service Unavailable when DB is down');
    const payload = JSON.parse(res.payload);

    assert.strictEqual(payload.status, 'degraded');
    assert.strictEqual(payload.database.status, 'disconnected');
    assert.strictEqual(payload.database.latencyMs, -1);

    // Sanitize: ensure no database connection strings or credentials leak
    const rawString = JSON.stringify(payload);
    assert.strictEqual(rawString.includes('postgresql://'), false);
    assert.strictEqual(rawString.includes('postgres:postgres'), false);
  });
});
