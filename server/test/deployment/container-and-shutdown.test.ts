import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../helper.js';
import { registerSocket, type WebSocketClientMeta } from '../../src/plugins/websocket.js';
import type { WebSocket } from '@fastify/websocket';

describe('Containerization & Graceful Shutdown Suite (LLT 2.2)', () => {
  test('Test 3: Multi-stage Dockerfile rootless user validation', () => {
    const serverDockerPath = path.resolve(process.cwd(), 'Dockerfile');
    const clientDockerPath = path.resolve(process.cwd(), '../client/Dockerfile');

    assert.ok(fs.existsSync(serverDockerPath), 'server/Dockerfile must exist');
    assert.ok(fs.existsSync(clientDockerPath), 'client/Dockerfile must exist');

    const serverContent = fs.readFileSync(serverDockerPath, 'utf8');
    const clientContent = fs.readFileSync(clientDockerPath, 'utf8');

    // 1. Verify multi-stage structure
    assert.ok(serverContent.includes('FROM node:22-alpine AS dependencies'));
    assert.ok(serverContent.includes('FROM node:22-alpine AS builder'));
    assert.ok(serverContent.includes('FROM node:22-alpine AS runner'));

    assert.ok(clientContent.includes('FROM node:22-alpine AS dependencies'));
    assert.ok(clientContent.includes('FROM node:22-alpine AS builder'));
    assert.ok(clientContent.includes('FROM node:22-alpine AS runner'));

    // 2. Verify rootless non-root user execution in runner stage
    assert.ok(serverContent.includes('USER node:node'), 'Server must drop root and run as node:node');
    assert.ok(clientContent.includes('USER nextjs:nodejs'), 'Client must drop root and run as nextjs:nodejs');

    // 3. Verify exposed ports and healthcheck definitions
    assert.ok(serverContent.includes('EXPOSE 3001'));
    assert.ok(serverContent.includes('HEALTHCHECK'));
    assert.ok(serverContent.includes('/health'));

    assert.ok(clientContent.includes('EXPOSE 3000'));
    assert.ok(clientContent.includes('HEALTHCHECK'));
  });

  test('Test 4: Container health probe endpoint response', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(res.statusCode, 200, 'Healthcheck endpoint must return 200 OK');
    const body = JSON.parse(res.payload);

    assert.equal(body.status, 'ok');
    assert.ok(typeof body.uptime === 'number');
    assert.ok(typeof body.timestamp === 'string');
    assert.ok(body.memory && typeof body.memory.heapUsed === 'number');
    assert.ok(body.database && (body.database.status === 'connected' || body.database.status === 'healthy'));
  });

  test('Test 5: Graceful shutdown signal handling (SIGTERM)', async () => {
    const app = await build();

    // Setup mock WebSocket clients to verify broadcast and graceful drain
    const sentMessages: string[] = [];
    let closedCode: number | null = null;

    const mockSocket = {
      readyState: 1, // OPEN
      send: (msg: string) => {
        sentMessages.push(msg);
      },
      close: (code: number) => {
        closedCode = code;
      },
      terminate: () => {},
      on: () => {},
      ping: () => {},
    } as unknown as WebSocket;

    app.wsGateway.clients.set(mockSocket, {
      id: 'mock-ws-client-1',
      userId: 'test-user-1',
      isAlive: true,
      connectedAt: Date.now(),
      lastPingAt: Date.now(),
      lastPongAt: Date.now(),
      subscriptions: new Set(['system:all']),
    });

    // Execute application close (simulating graceful shutdown sequence)
    await app.close();

    // Verify WebSocket broadcast frame { event: 'server:shutdown', code: 1001 } was delivered
    const shutdownMsg = sentMessages.find((m) => m.includes('server:shutdown'));
    assert.ok(shutdownMsg, 'Shutdown notification frame must be sent to open WebSocket clients');
    const parsedMsg = JSON.parse(shutdownMsg);
    assert.equal(parsedMsg.event, 'server:shutdown');
    assert.equal(parsedMsg.code, 1001);

    // Verify socket was closed with code 1001
    assert.equal(closedCode, 1001, 'Socket must be closed with standard 1001 Going Away status');

    // Verify client map is cleared
    assert.equal(app.wsGateway.clients.size, 0, 'Client registry must be empty after shutdown');
  });
});
