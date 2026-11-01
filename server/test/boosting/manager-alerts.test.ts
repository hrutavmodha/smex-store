import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { eq, and } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { notifications } from '../../src/db/schema/notifications.js';
import { boostingOrders } from '../../src/db/schema/boosting.js';
import { registerSocket } from '../../src/plugins/websocket.js';
import { NotificationService } from '../../src/services/notification.service.js';

const sampleOrderPayload = {
  pricingMode: 'per_star',
  startingRank: 'Mythic',
  targetRank: 'Mythical Honor',
  startingStars: 10,
  targetStars: 30,
  customerIgn: 'AlphaBoosterClient',
  serverId: '2048',
  contactChannel: 'whatsapp',
  addons: {
    rolePriority: 'Jungle',
    restrictedHeroPool: ['Ling', 'Fanny'],
    duoPlayWithBooster: false,
  },
};

describe('Sprint 1 - Module 2: Real-Time Boosting Order Alerts (Manager-Exclusive)', () => {
  it('TC-B1.1: Guest customer places boosting order -> Managers receive alert, 201 Created', async (t) => {
    const app = await build(t);

    // Create an active manager
    const { user: managerUser } = await createVerifiedUser(app, 'mgr_b1');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    // Place order as guest (no authorization header)
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      payload: sampleOrderPayload,
    });

    assert.equal(res.statusCode, 201, 'Guest order submission must succeed with HTTP 201');
    const body = JSON.parse(res.payload);
    assert.ok(body.orderId, 'Response must contain orderId');
    assert.ok(body.orderRef, 'Response must contain orderRef');
    assert.equal(body.status, 'inquiry');

    // Verify manager received in-app notification
    const managerNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, managerUser.id));

    assert.ok(managerNotifs.length >= 1, 'Manager must receive at least 1 notification');
    const notif = managerNotifs[0];
    assert.match(notif.title, /New Boosting Order/i);
    assert.ok(notif.message.includes('AlphaBoosterClient'));
    assert.equal(notif.entityType, 'boosting_order');
    assert.equal(notif.entityId, body.orderId);
  });

  it('TC-B1.2: Registered user places boosting order -> Customer & Managers receive respective alerts', async (t) => {
    const app = await build(t);

    const { user: customerUser, token: customerToken } = await createVerifiedUser(app, 'cust_b2');
    const { user: managerUser } = await createVerifiedUser(app, 'mgr_b2');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      headers: {
        authorization: `Bearer ${customerToken}`,
      },
      payload: {
        ...sampleOrderPayload,
        customerIgn: 'RegisteredBuyer',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    // 1. Customer receives order status update notification
    const customerNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, customerUser.id));

    assert.ok(customerNotifs.length >= 1, 'Customer must receive notification');
    assert.match(customerNotifs[0].title, /Boosting Order Status Update/i);

    // 2. Manager receives manager-exclusive new boosting order alert
    const managerNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, managerUser.id));

    assert.ok(managerNotifs.length >= 1, 'Manager must receive notification');
    assert.match(managerNotifs[0].title, /New Boosting Order/i);
    assert.ok(managerNotifs[0].message.includes('RegisteredBuyer'));
  });

  it('TC-B1.3: Verify Admin exclusion from boosting alerts', async (t) => {
    const app = await build(t);

    const { user: adminUser } = await createVerifiedUser(app, 'admin_excl');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_excl');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    // Clear any prior notifications for admin
    await app.db.delete(notifications).where(eq(notifications.recipientId, adminUser.id));

    // Place order
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      payload: {
        ...sampleOrderPayload,
        customerIgn: 'SpamCheckIgn',
      },
    });

    assert.equal(res.statusCode, 201);

    // Query notifications table for admin recipient
    const adminNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, adminUser.id));

    assert.equal(
      adminNotifs.length,
      0,
      'Admins must be strictly excluded from boosting order inquiry alerts'
    );

    // Verify Manager DID receive the notification
    const managerNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, managerUser.id));

    assert.ok(managerNotifs.length >= 1, 'Manager must receive notification');
  });

  it('TC-B1.4: WebSocket frame verification for NEW_BOOSTING_ORDER', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_ws');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    // Register a mock connected WebSocket socket for the manager
    const receivedFrames: any[] = [];
    const fakeSocket = new EventEmitter() as any;
    fakeSocket.readyState = 1;
    fakeSocket.send = (data: string) => {
      try {
        receivedFrames.push(JSON.parse(data));
      } catch {
        receivedFrames.push(data);
      }
    };

    registerSocket(fakeSocket, app.wsGateway.clients, app.log, managerUser.id);

    // Submit order
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/boosting/orders',
      payload: {
        ...sampleOrderPayload,
        customerIgn: 'WebSocketTestBuyer',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    // Verify received frame
    const boostFrame = receivedFrames.find((f) => f.event === 'NEW_BOOSTING_ORDER');
    assert.ok(boostFrame, 'Manager socket must receive NEW_BOOSTING_ORDER frame');
    assert.equal(boostFrame.payload.orderId, body.orderId);
    assert.equal(boostFrame.payload.orderRef, body.orderRef);
    assert.equal(boostFrame.payload.customerIgn, 'WebSocketTestBuyer');
    assert.equal(boostFrame.payload.startingRank, 'Mythic');
    assert.equal(boostFrame.payload.targetRank, 'Mythical Honor');
    assert.ok(boostFrame.payload.totalPriceInr);
    assert.equal(boostFrame.payload.contactChannel, 'whatsapp');
    assert.ok(boostFrame.payload.timestamp);
  });

  it('TC-B1.5: Notification dispatch failure resilience', async (t) => {
    const app = await build(t);

    // Force an error in notification dispatch by temporarily monkey-patching notifyNewBoostingOrder
    const originalNotify = NotificationService.notifyNewBoostingOrder;
    NotificationService.notifyNewBoostingOrder = async () => {
      throw new Error('Simulated Redis / WebSocket connection failure');
    };

    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/boosting/orders',
        payload: {
          ...sampleOrderPayload,
          customerIgn: 'ResilientBuyer',
        },
      });

      // Primary order creation MUST still succeed
      assert.equal(
        res.statusCode,
        201,
        'Order creation must succeed even if notification transport throws'
      );
      const body = JSON.parse(res.payload);
      assert.ok(body.orderId);
      assert.equal(body.status, 'inquiry');

      // Verify row exists in DB
      const [orderInDb] = await app.db
        .select()
        .from(boostingOrders)
        .where(eq(boostingOrders.id, body.orderId));

      assert.ok(orderInDb, 'Order must be committed to database');
      assert.equal(orderInDb.customerIgn, 'ResilientBuyer');
    } finally {
      NotificationService.notifyNewBoostingOrder = originalNotify;
    }
  });
});
