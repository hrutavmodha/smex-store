import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { build } from '../helper.js';
import { registerSocket } from '../../src/plugins/websocket.js';

test('WebSocket plugin decorates fastify with wsGateway', async (t) => {
  const app = await build(t);

  assert.ok(app.wsGateway);
  assert.strictEqual(typeof app.wsGateway.broadcastToChannel, 'function');
  assert.strictEqual(typeof app.wsGateway.getActiveClientCount, 'function');
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 0);
});

test('registerSocket tracks client and updates isAlive on pong', async (t) => {
  const app = await build(t);
  const fakeSocket = new EventEmitter() as any;
  fakeSocket.readyState = 1;
  fakeSocket.send = () => {};

  const meta = registerSocket(fakeSocket, app.wsGateway.clients, app.log, 'user-123');

  assert.strictEqual(app.wsGateway.getActiveClientCount(), 1);
  assert.strictEqual(meta.isAlive, true);
  assert.strictEqual(meta.userId, 'user-123');

  // Simulate missed pong
  meta.isAlive = false;

  // Simulate pong event from client
  fakeSocket.emit('pong');
  assert.strictEqual(meta.isAlive, true);

  // Simulate socket close
  fakeSocket.emit('close', 1000, Buffer.from('normal close'));
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 0);
});
