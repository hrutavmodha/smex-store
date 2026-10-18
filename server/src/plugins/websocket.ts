import { type FastifyPluginAsync, type FastifyBaseLogger } from 'fastify';
import fp from 'fastify-plugin';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import crypto from 'node:crypto';
import { type AccessTokenPayload } from '@smex/shared';

export interface WebSocketClientMeta {
  id: string;
  userId: string | null;
  sessionId?: string | null;
  reqId?: string | null;
  isAlive: boolean;
  connectedAt: number;
  lastPingAt: number;
  lastPongAt: number;
  subscriptions: Set<string>;
}

export interface WsGatewayDecorator {
  clients: Map<WebSocket, WebSocketClientMeta>;
  broadcastToChannel: (channel: string, message: unknown) => void;
  broadcastAll: (message: unknown) => void;
  getActiveClientCount: () => number;
  terminateUserSockets: (userId: string, sessionId?: string) => void;
}

export const HEARTBEAT_INTERVAL_MS = 30000;

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB payload ceiling
    },
  });

  const clients = new Map<WebSocket, WebSocketClientMeta>();

  // Periodic heartbeat timer to terminate dead/zombie sockets
  const interval = setInterval(() => {
    for (const [socket, meta] of clients.entries()) {
      if (!meta.isAlive) {
        fastify.log.warn(
          { clientId: meta.id, userId: meta.userId },
          'Terminating unresponsive zombie WebSocket connection'
        );
        clients.delete(socket);
        socket.terminate();
        continue;
      }

      meta.isAlive = false;
      meta.lastPingAt = Date.now();
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Clean shutdown hook to prevent open socket handle leaks
  fastify.addHook('onClose', (_instance, done) => {
    clearInterval(interval);
    const shutdownPayload = JSON.stringify({ event: 'server:shutdown', code: 1001 });
    for (const socket of clients.keys()) {
      try {
        if (socket.readyState === 1) {
          socket.send(shutdownPayload);
        }
        socket.close(1001, 'Server shutting down');
      } catch {
        socket.terminate?.();
      }
    }
    clients.clear();
    done();
  });

  const wsGateway: WsGatewayDecorator = {
    clients,
    broadcastToChannel: (channel: string, message: unknown) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      for (const [socket, meta] of clients.entries()) {
        const isOpen = socket.readyState === 1;
        if (meta.subscriptions.has(channel) && isOpen) {
          socket.send(payload);
        }
      }
    },
    broadcastAll: (message: unknown) => {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      for (const socket of clients.keys()) {
        if (socket.readyState === 1) {
          socket.send(payload);
        }
      }
    },
    getActiveClientCount: () => clients.size,
    terminateUserSockets: (userId: string, sessionId?: string) => {
      for (const [socket, meta] of clients.entries()) {
        if (meta.userId === userId && (!sessionId || meta.sessionId === sessionId)) {
          try {
            socket.close(4401, 'Session revoked');
          } catch {
            socket.terminate?.();
          }
          clients.delete(socket);
        }
      }
    },
  };

  fastify.decorate('wsGateway', wsGateway);

  // Redis Pub/Sub Subscriber for horizontal multi-instance synchronization
  if (fastify.redis) {
    const redisSubscriber = fastify.redis.duplicate();
    redisSubscriber.psubscribe('tournament:*', 'user:*', 'system:*', (err) => {
      if (err) {
        fastify.log.error({ err }, 'Failed to psubscribe to tournament:*, user:*, system:* channel patterns');
      }
    });

    redisSubscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      let parsed: unknown = message;
      try {
        parsed = JSON.parse(message);
      } catch {
        // Keep string format
      }
      if (channel.startsWith('system:')) {
        wsGateway.broadcastAll({
          event: 'announcement:update',
          channel,
          timestamp: Date.now(),
          payload: parsed,
        });
      } else {
        wsGateway.broadcastToChannel(channel, parsed);
      }
    });

    fastify.addHook('onClose', async () => {
      await redisSubscriber.quit().catch(() => {});
    });
  }

  // Register public WebSocket gateway route
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const query = (req.query || {}) as { token?: string };
    let userId: string | null = null;
    let sessionId: string | null = null;

    if (query.token && fastify.jwt) {
      try {
        const decoded = fastify.jwt.verify<AccessTokenPayload>(query.token);
        userId = decoded.sub;
        sessionId = decoded.sessionId;
      } catch {
        // Unauthenticated or expired token: allow guest or restricted connection
      }
    }

    const meta = registerSocket(socket, clients, fastify.log, userId, sessionId, req.id);

    socket.on('message', (raw: Buffer | string) => {
      try {
        const text = typeof raw === 'string' ? raw : raw.toString();
        const msg = JSON.parse(text);
        if (msg.action === 'subscribe' && typeof msg.channel === 'string') {
          const channel = msg.channel.trim();

          // Enforce private channel authorization (BUG-M8-005)
          if (channel.startsWith('user:')) {
            const targetUserId = channel.slice(5);
            if (!meta.userId || meta.userId !== targetUserId) {
              if (socket.readyState === socket.OPEN) {
                socket.send(
                  JSON.stringify({
                    event: 'error',
                    code: 'FORBIDDEN_CHANNEL',
                    message: 'You are not authorized to subscribe to this private channel',
                  })
                );
              }
              return;
            }
          }

          meta.subscriptions.add(channel);
          if (socket.readyState === socket.OPEN) {
            socket.send(
              JSON.stringify({
                event: 'subscribed',
                channel,
                timestamp: Date.now(),
              })
            );
          }
        } else if (msg.action === 'unsubscribe' && typeof msg.channel === 'string') {
          meta.subscriptions.delete(msg.channel);
          if (socket.readyState === socket.OPEN) {
            socket.send(
              JSON.stringify({
                event: 'unsubscribed',
                channel: msg.channel,
                timestamp: Date.now(),
              })
            );
          }
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Invalid WebSocket incoming message frame');
      }
    });
  });
};

export function registerSocket(
  socket: WebSocket,
  clients: Map<WebSocket, WebSocketClientMeta>,
  logger?: FastifyBaseLogger | null,
  userId: string | null = null,
  sessionId: string | null = null,
  reqId: string | null = null
): WebSocketClientMeta {
  const meta: WebSocketClientMeta = {
    id: crypto.randomUUID(),
    userId,
    sessionId,
    reqId,
    isAlive: true,
    connectedAt: Date.now(),
    lastPingAt: Date.now(),
    lastPongAt: Date.now(),
    subscriptions: new Set<string>(),
  };

  if (userId) {
    meta.subscriptions.add(`user:${userId}`);
  }

  clients.set(socket, meta);

  socket.on('pong', () => {
    meta.isAlive = true;
    meta.lastPongAt = Date.now();
  });

  socket.on('close', (code: number, reason: Buffer) => {
    logger?.info?.({ clientId: meta.id, code, reason: reason?.toString?.() }, 'WebSocket disconnected');
    clients.delete(socket);
  });

  socket.on('error', (err: Error) => {
    logger?.error?.({ clientId: meta.id, err }, 'WebSocket error');
    clients.delete(socket);
  });

  return meta;
}

declare module 'fastify' {
  interface FastifyInstance {
    wsGateway: WsGatewayDecorator;
  }
}

export default fp(websocketPlugin, {
  name: 'websocket',
});
