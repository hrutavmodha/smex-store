import type { Redis } from 'ioredis';
import type { WsGatewayDecorator } from '../plugins/websocket.js';
import type { SystemAnnouncementPayload, AnnouncementLevel } from '@smex/shared';

export const REDIS_ANNOUNCEMENT_KEY = 'system:announcement:active';
export const REDIS_ANNOUNCEMENT_CHANNEL = 'system:announcement';

export interface AnnouncementErrorOptions {
  code: string;
  statusCode: number;
}

export class AnnouncementError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options: AnnouncementErrorOptions) {
    super(message);
    this.name = 'AnnouncementError';
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export class AnnouncementService {
  /**
   * Retrieves the currently active sitewide announcement from Redis
   */
  static async getAnnouncement(redis: Redis): Promise<SystemAnnouncementPayload | null> {
    const raw = await redis.get(REDIS_ANNOUNCEMENT_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SystemAnnouncementPayload;
    } catch {
      return null;
    }
  }

  /**
   * Updates sitewide announcement in Redis, publishes to Redis channel,
   * and broadcasts real-time announcement:update frame to all active WebSocket clients.
   */
  static async setAnnouncement(
    payload: {
      message: string;
      level: AnnouncementLevel;
      isActive: boolean;
      actionUrl?: string;
      expiresAt?: string;
    },
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<SystemAnnouncementPayload> {
    if (!payload.message || payload.message.trim().length === 0) {
      throw new AnnouncementError('Announcement message cannot be empty', {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    }

    const validLevels: AnnouncementLevel[] = ['info', 'warning', 'alert'];
    if (!validLevels.includes(payload.level)) {
      throw new AnnouncementError(`Invalid announcement level '${payload.level}'`, {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    }

    const data: SystemAnnouncementPayload = {
      message: payload.message.trim(),
      level: payload.level,
      isActive: Boolean(payload.isActive),
      actionUrl: payload.actionUrl ? payload.actionUrl.trim() : undefined,
      expiresAt: payload.expiresAt,
    };

    const serialized = JSON.stringify(data);

    // 1. Store in Redis
    await redis.set(REDIS_ANNOUNCEMENT_KEY, serialized);

    // 2. Publish to Redis channel for multi-instance synchronization
    await redis.publish(REDIS_ANNOUNCEMENT_CHANNEL, serialized);

    // 3. Broadcast to all connected WebSocket clients
    if (wsGateway) {
      const frame = {
        event: 'announcement:update',
        channel: REDIS_ANNOUNCEMENT_CHANNEL,
        timestamp: Date.now(),
        payload: data,
      };

      if (typeof wsGateway.broadcastAll === 'function') {
        wsGateway.broadcastAll(frame);
      } else {
        // Fallback: broadcast directly to all open client sockets
        for (const [socket] of wsGateway.clients.entries()) {
          if (socket.readyState === 1 /* OPEN */) {
            socket.send(JSON.stringify(frame));
          }
        }
      }
    }

    return data;
  }
}
