import { test } from 'vitest';
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

test('terminateUserSockets terminates matching socket by userId and sessionId', async (t) => {
  const app = await build(t);

  let closed1 = false;
  let closeCode1 = 0;
  let closeReason1 = '';
  const socket1 = new EventEmitter() as any;
  socket1.readyState = 1;
  socket1.close = (code: number, reason: string) => {
    closed1 = true;
    closeCode1 = code;
    closeReason1 = reason;
  };

  let closed2 = false;
  const socket2 = new EventEmitter() as any;
  socket2.readyState = 1;
  socket2.close = () => {
    closed2 = true;
  };

  registerSocket(socket1, app.wsGateway.clients, app.log, 'user-1', 'session-1');
  registerSocket(socket2, app.wsGateway.clients, app.log, 'user-1', 'session-2');

  assert.strictEqual(app.wsGateway.getActiveClientCount(), 2);

  // Terminate only session-1
  app.wsGateway.terminateUserSockets('user-1', 'session-1');

  assert.strictEqual(closed1, true);
  assert.strictEqual(closeCode1, 4401);
  assert.strictEqual(closeReason1, 'Session revoked');
  assert.strictEqual(closed2, false);
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 1);
});

test('terminateUserSockets terminates all sockets for user when sessionId is omitted', async (t) => {
  const app = await build(t);

  let closedCount = 0;
  const createMockSocket = () => {
    const s = new EventEmitter() as any;
    s.readyState = 1;
    s.close = () => {
      closedCount++;
    };
    return s;
  };

  const s1 = createMockSocket();
  const s2 = createMockSocket();
  const sOther = createMockSocket();

  registerSocket(s1, app.wsGateway.clients, app.log, 'target-user', 'sess-A');
  registerSocket(s2, app.wsGateway.clients, app.log, 'target-user', 'sess-B');
  registerSocket(sOther, app.wsGateway.clients, app.log, 'other-user', 'sess-C');

  assert.strictEqual(app.wsGateway.getActiveClientCount(), 3);

  // Kill-switch for target-user
  app.wsGateway.terminateUserSockets('target-user');

  assert.strictEqual(closedCount, 2);
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 1);
  assert.strictEqual(app.wsGateway.clients.has(sOther), true);
});

test('WebSocket rejects connection with revoked session (Bug 10)', async (t) => {
  const { createVerifiedUser } = await import('../helper.js');
  const app = await build(t);
  const { token } = await createVerifiedUser(app, 'ws_revoked');
  const decoded = app.jwt.decode(token) as { sessionId: string };

  await app.redis.set(`revoked_token:${decoded.sessionId}`, '1', 'EX', 3600);

  const ws = await app.injectWS(`/ws?token=${token}`, {
    socket: { remoteAddress: '127.0.0.1' },
  });
  const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
    ws.on('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });

  assert.strictEqual(closeEvent.code, 4401);
  assert.strictEqual(closeEvent.reason, 'Session revoked');
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 0);
});

test('WebSocket rejects connection with banned user (Bug 10)', async (t) => {
  const { createVerifiedUser } = await import('../helper.js');
  const app = await build(t);
  const { user, token } = await createVerifiedUser(app, 'ws_banned');

  await app.redis.set(`banned_user:${user.id}`, '1', 'EX', 3600);

  const ws = await app.injectWS(`/ws?token=${token}`, {
    socket: { remoteAddress: '127.0.0.1' },
  });
  const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
    ws.on('close', (code, reason) => {
      resolve({ code, reason: reason.toString() });
    });
  });

  assert.strictEqual(closeEvent.code, 4403);
  assert.strictEqual(closeEvent.reason, 'Account banned');
  assert.strictEqual(app.wsGateway.getActiveClientCount(), 0);
});

