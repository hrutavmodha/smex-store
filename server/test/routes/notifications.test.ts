import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { notifications } from '../../src/db/schema/notifications.js';
import { NotificationService } from '../../src/services/notification.service.js';

describe('Notification Read Management and Inbox Endpoints Suite (LLT 2.2)', () => {
  test('Test 6: Retrieve paginated notifications and unread counter', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'notif_r6');

    // Create 3 notifications
    for (let i = 1; i <= 3; i++) {
      await NotificationService.dispatchNotification(
        user.id,
        'update',
        `Update Alert #${i}`,
        `Message body ${i}`,
        {},
        app.db
      );
    }

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications?page=1&limit=10',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.unreadCount, 3);
    assert.equal(body.notifications.length, 3);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 10);
    assert.equal(body.pagination.total, 3);
  });

  test('Test 7: Mark single notification as read', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'notif_r7');

    const notif1 = await NotificationService.dispatchNotification(
      user.id,
      'request',
      'Alert 1',
      'Body 1',
      {},
      app.db
    );
    await NotificationService.dispatchNotification(
      user.id,
      'request',
      'Alert 2',
      'Body 2',
      {},
      app.db
    );

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notif1.notification.id}/read`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.notification.isRead, true);
    assert.equal(body.unreadCount, 1);

    // Verify database record
    const [dbRecord] = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notif1.notification.id));
    assert.equal(dbRecord.isRead, true);
  });

  test('Test 8: Mark all notifications as read', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'notif_r8');

    for (let i = 1; i <= 4; i++) {
      await NotificationService.dispatchNotification(
        user.id,
        'update',
        `Batch ${i}`,
        `Body ${i}`,
        {},
        app.db
      );
    }

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/notifications/read-all',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.unreadCount, 0);
    assert.equal(body.updatedCount, 4);

    // Inbox check
    const inboxRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    const inboxBody = JSON.parse(inboxRes.body);
    assert.equal(inboxBody.unreadCount, 0);
    assert.ok(inboxBody.notifications.every((n: any) => n.isRead === true));
  });

  test('Test 9: Cross-user notification access rejection', async (t) => {
    const app = await build(t);
    const { user: userA } = await createVerifiedUser(app, 'notif_r9a');
    const { token: tokenB } = await createVerifiedUser(app, 'notif_r9b');

    const notifA = await NotificationService.dispatchNotification(
      userA.id,
      'system',
      'Private Alert',
      'Secret message',
      {},
      app.db
    );

    // User B attempts to mark User A's notification as read
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${notifA.notification.id}/read`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    assert.equal(patchRes.statusCode, 404);
    const errBody = JSON.parse(patchRes.body);
    assert.equal(errBody.code, 'NOTIFICATION_NOT_FOUND');

    // User B attempts to delete User A's notification
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/${notifA.notification.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    assert.equal(deleteRes.statusCode, 404);
  });

  test('Test 10: Delete individual notification', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'notif_r10');

    const notif = await NotificationService.dispatchNotification(
      user.id,
      'system',
      'To be deleted',
      'Delete me',
      {},
      app.db
    );

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notifications/${notif.notification.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(deleteRes.statusCode, 200);
    const delBody = JSON.parse(deleteRes.body);
    assert.equal(delBody.success, true);

    // Verify record no longer exists in database
    const [dbRecord] = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notif.notification.id));
    assert.equal(dbRecord, undefined);

    // Verify inbox excludes it
    const inboxRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${token}` },
    });
    const inboxBody = JSON.parse(inboxRes.body);
    assert.equal(inboxBody.notifications.length, 0);
  });
});
