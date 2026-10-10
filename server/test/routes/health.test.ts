import { test } from 'node:test'
import assert from 'node:assert'
import { build } from '../helper.js'

test('health route returns server status, uptime, and memory metrics', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/health',
  })

  assert.strictEqual(res.statusCode, 200)
  const payload = JSON.parse(res.payload)

  assert.strictEqual(payload.status, 'ok')
  assert.strictEqual(typeof payload.uptime, 'number')
  assert.strictEqual(typeof payload.timestamp, 'string')
  assert.ok(payload.memory)
  assert.strictEqual(typeof payload.memory.rss, 'number')
  assert.strictEqual(typeof payload.memory.heapTotal, 'number')
  assert.strictEqual(typeof payload.memory.heapUsed, 'number')
  assert.strictEqual(typeof payload.environment, 'string')
})
