import crypto from 'node:crypto';
import type { Redis } from 'ioredis';
import type { SmexDatabase } from '../db/index.js';
import { eq, and, ne, gt, lte } from 'drizzle-orm';
import { sessions } from '../db/schema/sessions.js';
import { users } from '../db/schema/users.js';
import { type DeviceMetadata, resolveDeviceType, type DeviceType } from '../utils/fingerprint.js';
import type { WsGatewayDecorator } from '../plugins/websocket.js';

export const REFRESH_TOKEN_TTL_SECONDS = 2592000; // 30 days
export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
export const TOMBSTONE_TTL_SECONDS = 900; // 15 minutes

export interface CreateSessionResult {
  sessionId: string;
  secretToken: string;
  cookieValue: string;
}

export interface RefreshSessionResult {
  userId: string;
  sessionId: string;
  role: 'user' | 'admin';
  newCookieValue: string;
}

export interface ActiveSessionView {
  id: string;
  sessionId: string;
  deviceType: DeviceType;
  deviceName: string;
  ipAddress: string;
  userAgent: string;
  isCurrent: boolean;
  lastActiveAt: Date;
  lastActive: string;
  createdAt: Date;
}

export class SessionService {
  /**
   * Generates a new session, persisting to Redis with secondary lookup index and PostgreSQL
   */
  static async createSession(
    userId: string,
    metadata: DeviceMetadata,
    db: SmexDatabase,
    redis: Redis
  ): Promise<CreateSessionResult> {
    const sessionId = crypto.randomUUID();
    const secretToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(secretToken)
      .digest('hex');

    const now = Date.now();
    const expiresAt = new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000);

    // 1. Store session hash in Redis
    const sessionKey = `session:${userId}:${sessionId}`;
    await redis.hset(sessionKey, {
      refresh_token_hash: refreshTokenHash,
      device_name: metadata.deviceName,
      ip_address: metadata.ipAddress,
      user_agent: metadata.userAgent,
      last_active_at: now.toString(),
      created_at: now.toString(),
    });
    await redis.expire(sessionKey, REFRESH_TOKEN_TTL_SECONDS);

    // 2. Set O(1) secondary lookup index
    const lookupKey = `session_lookup:${sessionId}`;
    await redis.set(lookupKey, userId, 'EX', REFRESH_TOKEN_TTL_SECONDS);

    // 3. Insert into PostgreSQL sessions table
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      refreshTokenHash,
      deviceFingerprint: metadata.deviceFingerprint,
      deviceName: metadata.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      isActive: true,
      lastActiveAt: new Date(now),
      expiresAt,
      createdAt: new Date(now),
    });

    return {
      sessionId,
      secretToken,
      cookieValue: `${sessionId}.${secretToken}`,
    };
  }

  /**
   * O(1) Session rotation using compound cookie: <sessionId>.<secretToken>
   */
  static async refreshSession(
    compoundCookie: string,
    db: SmexDatabase,
    redis: Redis
  ): Promise<RefreshSessionResult> {
    if (!compoundCookie || !compoundCookie.includes('.')) {
      throw new Error('INVALID_REFRESH_COOKIE');
    }

    const [sessionId, secretToken] = compoundCookie.split('.');
    if (!sessionId || !secretToken) {
      throw new Error('INVALID_REFRESH_COOKIE');
    }

    // 1. O(1) Lookup user ID
    const userId = await redis.get(`session_lookup:${sessionId}`);
    if (!userId) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // 2. Fetch session data
    const sessionKey = `session:${userId}:${sessionId}`;
    const sessionData = await redis.hgetall(sessionKey);
    if (!sessionData || !sessionData.refresh_token_hash) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // 3. Verify hash using constant-time comparison
    const incomingHash = crypto
      .createHash('sha256')
      .update(secretToken)
      .digest('hex');

    const expectedBuffer = Buffer.from(sessionData.refresh_token_hash, 'hex');
    const incomingBuffer = Buffer.from(incomingHash, 'hex');

    if (
      expectedBuffer.length !== incomingBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, incomingBuffer)
    ) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // 4. Rotate secret token
    const newSecretToken = crypto.randomBytes(32).toString('hex');
    const newHash = crypto
      .createHash('sha256')
      .update(newSecretToken)
      .digest('hex');

    const now = Date.now();
    await redis.hset(sessionKey, {
      refresh_token_hash: newHash,
      last_active_at: now.toString(),
    });
    await redis.expire(sessionKey, REFRESH_TOKEN_TTL_SECONDS);
    await redis.expire(`session_lookup:${sessionId}`, REFRESH_TOKEN_TTL_SECONDS);

    // 5. Update PostgreSQL record
    await db
      .update(sessions)
      .set({
        refreshTokenHash: newHash,
        lastActiveAt: new Date(now),
      })
      .where(eq(sessions.id, sessionId));

    // 6. Query user role
    const [userRecord] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      userId,
      sessionId,
      role: userRecord?.role ?? 'user',
      newCookieValue: `${sessionId}.${newSecretToken}`,
    };
  }

  /**
   * Revokes a single session, writes fast-path tombstone, and deactivates in DB
   */
  static async revokeSession(
    userId: string,
    sessionId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<boolean> {
    // 0. Verify session exists and belongs to the authenticated user
    const [sessionRecord] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), eq(sessions.isActive, true)))
      .limit(1);

    if (!sessionRecord) {
      return false;
    }

    // 1. Delete Redis keys
    await redis.del(`session:${userId}:${sessionId}`);
    await redis.del(`session_lookup:${sessionId}`);

    // 2. Set fast-path tombstone
    await redis.set(`revoked_token:${sessionId}`, '1', 'EX', TOMBSTONE_TTL_SECONDS);

    // 3. Deactivate in PostgreSQL
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));

    // 4. WebSocket notification & connection termination
    if (wsGateway) {
      wsGateway.broadcastToChannel(`user:${userId}`, {
        event: 'session:revoked',
        channel: `user:${userId}`,
        timestamp: Date.now(),
        payload: { sessionId },
      });
      wsGateway.terminateUserSockets(userId, sessionId);
    }

    return true;
  }

  /**
   * Evicts all other remote sessions while keeping current caller session active
   */
  static async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<number> {
    const peerSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, currentSessionId),
          eq(sessions.isActive, true)
        )
      );

    for (const s of peerSessions) {
      await redis.del(`session:${userId}:${s.id}`);
      await redis.del(`session_lookup:${s.id}`);
      await redis.set(`revoked_token:${s.id}`, '1', 'EX', TOMBSTONE_TTL_SECONDS);
      await db
        .update(sessions)
        .set({ isActive: false })
        .where(eq(sessions.id, s.id));

      if (wsGateway) {
        wsGateway.broadcastToChannel(`user:${userId}`, {
          event: 'session:revoked',
          channel: `user:${userId}`,
          timestamp: Date.now(),
          payload: { sessionId: s.id },
        });
        wsGateway.terminateUserSockets(userId, s.id);
      }
    }

    return peerSessions.length;
  }

  /**
   * Emergency account kill-switch: terminates 100% of user sessions including caller
   */
  static async revokeAllSessions(
    userId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator
  ): Promise<number> {
    const allActive = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.isActive, true)));

    for (const s of allActive) {
      await redis.del(`session:${userId}:${s.id}`);
      await redis.del(`session_lookup:${s.id}`);
      await redis.set(`revoked_token:${s.id}`, '1', 'EX', TOMBSTONE_TTL_SECONDS);
    }

    // Non-blocking cursor iteration to purge any orphaned session keys in Redis
    const stream = redis.scanStream({
      match: `session:${userId}:*`,
      count: 100,
    });

    const keysToDelete: string[] = [];
    for await (const chunk of stream) {
      if (Array.isArray(chunk) && chunk.length > 0) {
        keysToDelete.push(...chunk);
      }
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
    }

    await db
      .update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.userId, userId));

    if (wsGateway) {
      wsGateway.broadcastToChannel(`user:${userId}`, {
        event: 'session:revoked',
        channel: `user:${userId}`,
        timestamp: Date.now(),
        payload: { all: true },
      });
      wsGateway.terminateUserSockets(userId);
    }

    return allActive.length;
  }

  /**
   * Queries all active device sessions for authenticated user
   */
  static async getActiveSessions(
    userId: string,
    currentSessionId: string,
    db: SmexDatabase
  ): Promise<ActiveSessionView[]> {
    const now = new Date();

    // Lazily mark expired sessions as inactive
    await db
      .update(sessions)
      .set({ isActive: false })
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.isActive, true),
          lte(sessions.expiresAt, now)
        )
      );

    const list = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.isActive, true),
          gt(sessions.expiresAt, now)
        )
      );

    return list.map((item) => ({
      id: item.id,
      sessionId: item.id,
      deviceType: resolveDeviceType(item.userAgent),
      deviceName: item.deviceName,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      isCurrent: item.id === currentSessionId,
      lastActiveAt: item.lastActiveAt,
      lastActive: item.lastActiveAt ? item.lastActiveAt.toISOString() : item.createdAt.toISOString(),
      createdAt: item.createdAt,
    }));
  }
}
