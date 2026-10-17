import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'node:events';
import { build, createVerifiedUser } from '../helper.js';
import { notifications } from '../../src/db/schema/notifications.js';
import { NotificationService } from '../../src/services/notification.service.js';
import { registerSocket } from '../../src/plugins/websocket.js';

describe('Notification Persistence and Real-Time Dispatch Suite (LLT 2.1)', () => {
  test('Test 1: Notification record persistence in PostgreSQL', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'notif_p1');

    const result = await NotificationService.dispatchNotification(
      user.id,
      'request',
      'Join Squad',
      'Viper wants to join',
      { actionUrl: '/teams/squad-1', entityType: 'team' },
      app.db
    );

    assert.ok(result.notification.id, 'Generated UUID ID must exist');
    assert.equal(result.notification.recipientId, user.id);
    assert.equal(result.notification.type, 'request');
    assert.equal(result.notification.title, 'Join Squad');
    assert.equal(result.notification.message, 'Viper wants to join');
    assert.equal(result.notification.isRead, false);
    assert.ok(result.notification.createdAt);
    assert.equal(result.unreadCount, 1);

    // Verify record in database
    const [dbRecord] = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, result.notification.id));

    assert.ok(dbRecord, 'Record must exist in notifications table');
    assert.equal(dbRecord.isRead, false);
    assert.equal(dbRecord.recipientId, user.id);
  });

  test('Test 2: Real-time Redis pub/sub dispatch to user channel', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'notif_p2');

    const subscriber = app.redis.duplicate();
    await subscriber.connect();

    const channel = `user:${user.id}`;
    const receivedMessages: any[] = [];
    await subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        receivedMessages.push(JSON.parse(msg));
      }
    });

    await NotificationService.dispatchNotification(
      user.id,
      'update',
      'Match Alert',
      'Match starts in 10 minutes',
      { entityType: 'tournament' },
      app.db,
      app.redis
    );

    // Await async pub/sub delivery
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(receivedMessages.length >= 1, 'Recipient must receive Redis pub/sub frame');
    const msg = receivedMessages[0];
    assert.equal(msg.event, 'notification:new');
    assert.equal(msg.channel, channel);
    assert.equal(msg.title, 'Match Alert');
    assert.equal(msg.unreadCount, 1);
    assert.equal(msg.data.title, 'Match Alert');
    assert.equal(msg.data.type, 'update');

    await subscriber.quit();
  });

  test('Test 3: WebSocket client delivery of notification frame', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'notif_p3');

    // Register active mock socket on user channel
    const receivedFrames: string[] = [];
    const mockSocket = new EventEmitter() as any;
    mockSocket.readyState = 1; // WebSocket.OPEN
    mockSocket.send = (payload: string) => {
      receivedFrames.push(payload);
    };

    const meta = registerSocket(mockSocket, app.wsGateway.clients, app.log, user.id);
    assert.ok(meta.subscriptions.has(`user:${user.id}`));

    await NotificationService.dispatchNotification(
      user.id,
      'system',
      'Security Alert',
      'New device logged in',
      {},
      app.db,
      app.redis,
      app.wsGateway
    );

    assert.ok(receivedFrames.length >= 1, 'WebSocket client must receive notification envelope');
    const parsed = JSON.parse(receivedFrames[0]);
    assert.equal(parsed.event, 'notification:new');
    assert.equal(parsed.title, 'Security Alert');
    assert.equal(parsed.unreadCount, 1);
    assert.equal(parsed.data.type, 'system');
  });

  test('Test 4: Offline recipient notification delivery on subsequent login', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'notif_p4');

    // User is offline; notification inserted into DB
    await NotificationService.dispatchNotification(
      user.id,
      'request',
      'Offline Invitation',
      'Join our squad today',
      { actionUrl: '/teams/squad-99' },
      app.db
    );

    // User logs in and queries notifications inbox
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.unreadCount, 1);
    assert.ok(body.notifications.length >= 1);
    const notif = body.notifications[0];
    assert.equal(notif.title, 'Offline Invitation');
    assert.equal(notif.isRead, false);
    assert.equal(notif.payload.actionUrl, '/teams/squad-99');
  });

  test('Test 5: Action request payload validation and deep routing link', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'notif_p5');

    const result = await NotificationService.dispatchNotification(
      user.id,
      'request',
      'Squad Invitation',
      'Smex Elite invited you',
      { actionUrl: '/teams/squad-elite', entityType: 'team', entityId: '00000000-0000-0000-0000-000000000001' },
      app.db
    );

    assert.equal(result.notification.payload.actionUrl, '/teams/squad-elite');
    assert.equal(result.notification.payload.entityType, 'team');
    assert.equal(result.notification.payload.entityId, '00000000-0000-0000-0000-000000000001');

    const [dbRecord] = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, result.notification.id));

    assert.deepEqual(dbRecord.payload, {
      actionUrl: '/teams/squad-elite',
      entityType: 'team',
      entityId: '00000000-0000-0000-0000-000000000001',
    });
  });
});
