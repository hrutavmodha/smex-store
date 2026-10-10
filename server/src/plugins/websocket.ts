import { type FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyWebsocket, { type WebSocket } from '@fastify/websocket';
import crypto from 'node:crypto';

export interface WebSocketClientMeta {
  id: string;
  userId: string | null;
  isAlive: boolean;
  connectedAt: number;
  lastPingAt: number;
  lastPongAt: number;
  subscriptions: Set<string>;
}

export interface WsGatewayDecorator {
  clients: Map<WebSocket, WebSocketClientMeta>;
  broadcastToChannel: (channel: string, message: unknown) => void;
  getActiveClientCount: () => number;
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
    for (const socket of clients.keys()) {
      try {
        socket.close(1001, 'Server shutting down');
      } catch {
        socket.terminate();
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
        if (meta.subscriptions.has(channel) && socket.readyState === socket.OPEN) {
          socket.send(payload);
        }
      }
    },
    getActiveClientCount: () => clients.size,
  };

  fastify.decorate('wsGateway', wsGateway);
};

export function registerSocket(
  socket: WebSocket,
  clients: Map<WebSocket, WebSocketClientMeta>,
  logger: FastifyPluginAsync extends (...args: any[]) => any ? any : any,
  userId: string | null = null
): WebSocketClientMeta {
  const meta: WebSocketClientMeta = {
    id: crypto.randomUUID(),
    userId,
    isAlive: true,
    connectedAt: Date.now(),
    lastPingAt: Date.now(),
    lastPongAt: Date.now(),
    subscriptions: new Set<string>(),
  };

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
