import type { Redis } from 'ioredis';
import { eq, and, desc, count } from 'drizzle-orm';
import type { WsGatewayDecorator } from '../plugins/websocket.js';
import type { SmexDatabase } from '../db/index.js';
import { notifications } from '../db/schema/notifications.js';
import { users } from '../db/schema/users.js';

import type {
  NotificationType,
  NotificationPayload,
  NotificationEnvelope,
  PaginatedNotificationsResult,
} from '@smex/shared';

export interface BaseNotificationEnvelope<T = unknown> {
  event: string;
  channel: string;
  timestamp: number;
  data: T;
}

export interface JoinRequestNotificationData {
  teamId: string;
  teamName: string;
  requestId: string;
  applicantId: string;
  playerIgn: string;
  playerRole: string;
}

export interface RequestStatusNotificationData {
  teamId: string;
  teamName: string;
  status: 'accepted' | 'rejected' | 'cancelled';
}

export interface TournamentAlertNotificationData {
  tournamentId: string;
  message: string;
}

export interface OrderStatusNotificationData {
  orderId: string;
  status: string;
  notes?: string;
}

export interface NewBoostingOrderData {
  orderId: string;
  orderRef: string;
  customerIgn: string;
  startingRank: string;
  targetRank: string;
  totalPriceInr: number | string;
  contactChannel: string;
  timestamp: string;
}


export class NotificationService {
  /**
   * Durable persistence and real-time dispatch of notifications
   */
  static async dispatchNotification(
    recipientId: string,
    type: NotificationType,
    title: string,
    message: string,
    payload: NotificationPayload = {},
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<{ notification: NotificationEnvelope; unreadCount: number }> {
    const [record] = await db
      .insert(notifications)
      .values({
        recipientId,
        type,
        title,
        message,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        payload,
        isRead: false,
      })
      .returning();

    const [unreadRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.isRead, false)
        )
      );
    const unreadCount = Number(unreadRow?.count ?? 0);

    const envelope: NotificationEnvelope = {
      id: record.id,
      recipientId: record.recipientId,
      type: record.type,
      title: record.title,
      message: record.message,
      payload: (record.payload ?? {}) as NotificationPayload,
      isRead: record.isRead,
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt.toISOString()
          : String(record.createdAt),
    };

    const channel = `user:${recipientId}`;
    const wsFrame = {
      event: 'notification:new',
      channel,
      timestamp: Date.now(),
      data: envelope,
      unreadCount,
      ...envelope,
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(wsFrame));
    } else if (wsGateway) {
      wsGateway.broadcastToChannel(channel, wsFrame);
    }

    return {
      notification: envelope,
      unreadCount,
    };
  }

  /**
   * Retrieves paginated user notifications with unread count
   */
  static async getNotifications(
    recipientId: string,
    options?: { page?: number; limit?: number },
    db?: SmexDatabase
  ): Promise<PaginatedNotificationsResult> {
    if (!db) {
      throw new Error('Database client is required to fetch notifications');
    }
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.max(1, Math.min(100, options?.limit ?? 20));
    const offset = (page - 1) * limit;

    const [unreadRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.isRead, false)
        )
      );
    const unreadCount = Number(unreadRow?.count ?? 0);

    const [totalRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.recipientId, recipientId));
    const total = Number(totalRow?.count ?? 0);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, recipientId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const mapped: NotificationEnvelope[] = rows.map((r) => ({
      id: r.id,
      recipientId: r.recipientId,
      type: r.type,
      title: r.title,
      message: r.message,
      payload: (r.payload ?? {}) as NotificationPayload,
      isRead: r.isRead,
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : String(r.createdAt),
    }));

    return {
      unreadCount,
      notifications: mapped,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  /**
   * Marks a single notification as read for the authenticated recipient
   */
  static async markAsRead(
    notificationId: string,
    userId: string,
    db: SmexDatabase
  ): Promise<{ notification: NotificationEnvelope; unreadCount: number } | null> {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId)
        )
      );

    if (!existing) {
      return null;
    }

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId)
        )
      )
      .returning();

    const [unreadRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        )
      );
    const unreadCount = Number(unreadRow?.count ?? 0);

    return {
      notification: {
        id: updated.id,
        recipientId: updated.recipientId,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        payload: (updated.payload ?? {}) as NotificationPayload,
        isRead: updated.isRead,
        createdAt:
          updated.createdAt instanceof Date
            ? updated.createdAt.toISOString()
            : String(updated.createdAt),
      },
      unreadCount,
    };
  }

  /**
   * Marks all unread notifications for a user as read
   */
  static async markAllAsRead(
    userId: string,
    db: SmexDatabase
  ): Promise<{ updatedCount: number; unreadCount: number }> {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, userId),
          eq(notifications.isRead, false)
        )
      )
      .returning();

    return {
      updatedCount: updated.length,
      unreadCount: 0,
    };
  }

  /**
   * Deletes an individual notification belonging to the user
   */
  static async deleteNotification(
    notificationId: string,
    userId: string,
    db: SmexDatabase
  ): Promise<boolean> {
    const [deleted] = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientId, userId)
        )
      )
      .returning();

    return !!deleted;
  }

  /**
   * Dispatches real-time event when a player submits a squad join request
   */
  static async notifyCaptainJoinRequest(
    captainId: string,
    data: JoinRequestNotificationData,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator,
    db?: SmexDatabase
  ): Promise<BaseNotificationEnvelope<JoinRequestNotificationData>> {
    const channel = `user:${captainId}`;
    const envelope: BaseNotificationEnvelope<JoinRequestNotificationData> = {
      event: 'team:join_request',
      channel,
      timestamp: Date.now(),
      data,
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope));
    } else if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }

    if (db) {
      try {
        await this.dispatchNotification(
          captainId,
          'request',
          'New Squad Join Request',
          `Player '${data.playerIgn}' requested to join squad '${data.teamName}'.`,
          {
            actionUrl: `/teams/${data.teamId}`,
            entityType: 'team',
            entityId: data.teamId,
            metadata: {
              requestId: data.requestId,
              applicantId: data.applicantId,
              playerIgn: data.playerIgn,
              playerRole: data.playerRole,
            },
          },
          db,
          redis,
          wsGateway
        );
      } catch {
        // Notification persistence side-effect failure should not throw
      }
    }

    return envelope;
  }

  /**
   * Dispatches real-time event when a captain accepts or rejects a join request
   */
  static async notifyApplicantStatus(
    applicantId: string,
    data: RequestStatusNotificationData,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator,
    db?: SmexDatabase
  ): Promise<BaseNotificationEnvelope<RequestStatusNotificationData>> {
    const channel = `user:${applicantId}`;
    const envelope: BaseNotificationEnvelope<RequestStatusNotificationData> = {
      event: 'team:request_status',
      channel,
      timestamp: Date.now(),
      data,
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope));
    } else if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }

    if (db) {
      try {
        await this.dispatchNotification(
          applicantId,
          'update',
          'Squad Join Request Updated',
          `Your request to join squad '${data.teamName}' was ${data.status}.`,
          {
            actionUrl: `/teams/${data.teamId}`,
            entityType: 'team',
            entityId: data.teamId,
            metadata: {
              status: data.status,
            },
          },
          db,
          redis,
          wsGateway
        );
      } catch {
        // Persistence side-effect failure should not throw
      }
    }

    return envelope;
  }

  /**
   * Dispatches tournament schedule alerts to participants (durable DB persistence + WS/Redis)
   */
  static async notifyTournamentScheduleAlert(
    participantIds: string[],
    tournamentId: string,
    alertMessage: string,
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<void> {
    if (!participantIds || participantIds.length === 0) return;

    for (const recipientId of participantIds) {
      try {
        await this.dispatchNotification(
          recipientId,
          'system',
          'Tournament Schedule Alert',
          alertMessage,
          {
            actionUrl: `/tournaments/${tournamentId}`,
            entityType: 'tournament',
            entityId: tournamentId,
            metadata: { tournamentId, alertMessage },
          },
          db,
          redis,
          wsGateway
        );
      } catch {
        // Non-blocking notification dispatch
      }
    }

    // Also broadcast to tournament channel
    const channel = `tournament:${tournamentId}`;
    const envelope: BaseNotificationEnvelope<TournamentAlertNotificationData> = {
      event: 'tournament:schedule_alert',
      channel,
      timestamp: Date.now(),
      data: { tournamentId, message: alertMessage },
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope)).catch(() => {});
    } else if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }
  }

  /**
   * Dispatches boosting order status update to customer (durable DB persistence + WS/Redis)
   */
  static async notifyOrderStatusUpdate(
    customerId: string | null | undefined,
    orderId: string,
    status: string,
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator,
    notes?: string
  ): Promise<BaseNotificationEnvelope<OrderStatusNotificationData> | null> {
    if (!customerId) return null;

    const channel = `user:${customerId}`;
    const envelope: BaseNotificationEnvelope<OrderStatusNotificationData> = {
      event: 'order:status_update',
      channel,
      timestamp: Date.now(),
      data: { orderId, status, notes },
    };

    if (redis) {
      await redis.publish(channel, JSON.stringify(envelope)).catch(() => {});
    } else if (wsGateway) {
      wsGateway.broadcastToChannel(channel, envelope);
    }

    try {
      await this.dispatchNotification(
        customerId,
        'update',
        'Boosting Order Status Update',
        `Your order status has changed to '${status}'.`,
        {
          actionUrl: `/boosting`,
          entityType: 'boosting_order',
          entityId: orderId,
          metadata: { orderId, status, notes },
        },
        db,
        redis,
        wsGateway
      );
    } catch {
      // Non-blocking notification dispatch
    }

    return envelope;
  }

  /**
   * Queries user IDs of all active users holding the 'manager' role (excluding 'admin')
   */
  static async getManagerRecipients(db: SmexDatabase): Promise<string[]> {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'manager'), eq(users.isBanned, false)));

    return rows.map((r) => r.id);
  }

  /**
   * Dispatches real-time alerts and durable notifications for new boosting orders
   * exclusively to all active Managers (excluding Admins).
   */
  static async notifyNewBoostingOrder(
    orderData: {
      orderId: string;
      orderRef: string;
      customerIgn: string;
      startingRank: string;
      targetRank: string;
      totalPriceInr: number | string;
      contactChannel: string;
    },
    db: SmexDatabase,
    redis?: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<string[]> {
    const managerIds = await this.getManagerRecipients(db);
    if (!managerIds.length) return [];

    const nowIso = new Date().toISOString();
    const payloadData: NewBoostingOrderData = {
      orderId: orderData.orderId,
      orderRef: orderData.orderRef,
      customerIgn: orderData.customerIgn,
      startingRank: orderData.startingRank,
      targetRank: orderData.targetRank,
      totalPriceInr: orderData.totalPriceInr,
      contactChannel: orderData.contactChannel,
      timestamp: nowIso,
    };

    const wsFrame = {
      event: 'NEW_BOOSTING_ORDER',
      payload: payloadData,
      timestamp: Date.now(),
    };

    const title = `🚀 New Boosting Order #${orderData.orderRef}`;
    const message = `Customer ${orderData.customerIgn} requested ${orderData.startingRank} ➔ ${orderData.targetRank} (₹${orderData.totalPriceInr}) via ${orderData.contactChannel}.`;

    for (const managerId of managerIds) {
      const channel = `user:${managerId}`;

      // 1. WebSocket / Redis PubSub broadcast directly to Manager channel
      if (redis) {
        await redis.publish(channel, JSON.stringify(wsFrame)).catch(() => {});
      } else if (wsGateway) {
        wsGateway.broadcastToChannel(channel, wsFrame);
      }

      // 2. Durable in-app notification record insertion
      try {
        await this.dispatchNotification(
          managerId,
          'update',
          title,
          message,
          {
            actionUrl: `/boosting`,
            entityType: 'boosting_order',
            entityId: orderData.orderId,
            metadata: {
              ...payloadData,
              event: 'NEW_BOOSTING_ORDER',
            },
          },
          db,
          redis,
          wsGateway
        );
      } catch {
        // Non-blocking notification dispatch
      }
    }

    return managerIds;
  }
}
