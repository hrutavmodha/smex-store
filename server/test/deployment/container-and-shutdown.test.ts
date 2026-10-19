import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { build } from '../helper.js';
import { registerSocket, type WebSocketClientMeta } from '../../src/plugins/websocket.js';
import type { WebSocket } from '@fastify/websocket';

describe('Containerization & Graceful Shutdown Suite (LLT 2.2)', () => {
  const rootDir = fs.existsSync(path.resolve(process.cwd(), 'server/Dockerfile'))
    ? process.cwd()
    : path.resolve(process.cwd(), '..');

  test('Test 3: Multi-stage Dockerfile rootless user validation', () => {
    const serverDockerPath = path.resolve(rootDir, 'server/Dockerfile');
    const clientDockerPath = path.resolve(rootDir, 'client/Dockerfile');

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

  test('Test 3b: Server Docker runner entrypoint and bundle target validation (Bug 14)', () => {
    const serverDockerPath = path.resolve(rootDir, 'server/Dockerfile');
    const tsdownConfigPath = path.resolve(rootDir, 'server/tsdown.config.ts');

    const dockerContent = fs.readFileSync(serverDockerPath, 'utf8');
    assert.ok(
      dockerContent.includes('CMD ["node", "dist/server.mjs"]'),
      'server/Dockerfile must execute dist/server.mjs directly'
    );

    const tsdownContent = fs.readFileSync(tsdownConfigPath, 'utf8');
    assert.ok(
      tsdownContent.includes('src/server.ts'),
      'tsdown.config.ts entry must include src/server.ts'
    );
  });

  test('Test 3c: Production docker-compose environment topology parity and secret validation (Bug 13)', () => {
    const composePath = path.resolve(rootDir, 'docker-compose.prod.yml');
    assert.ok(fs.existsSync(composePath), 'docker-compose.prod.yml must exist');

    const composeContent = fs.readFileSync(composePath, 'utf8');
    const compose = YAML.parse(composeContent);
    const serverEnv = compose.services?.server?.environment;

    assert.ok(serverEnv, 'server environment block must exist in docker-compose.prod.yml');
    assert.ok('JWT_SECRET' in serverEnv, 'server must specify JWT_SECRET');
    assert.ok('JWT_REFRESH_SECRET' in serverEnv, 'server must specify JWT_REFRESH_SECRET');
    assert.ok('S3_ENDPOINT' in serverEnv, 'server must specify S3_ENDPOINT');
    assert.ok('S3_ACCESS_KEY_ID' in serverEnv, 'server must specify S3_ACCESS_KEY_ID');
    assert.ok('S3_SECRET_ACCESS_KEY' in serverEnv, 'server must specify S3_SECRET_ACCESS_KEY');
    assert.ok('S3_BUCKET' in serverEnv, 'server must specify S3_BUCKET');

    // Reject legacy divergent STORAGE_* variables
    assert.strictEqual(
      'STORAGE_ENDPOINT' in serverEnv,
      false,
      'STORAGE_ENDPOINT must not be used in server environment'
    );
    assert.strictEqual(
      'STORAGE_ACCESS_KEY' in serverEnv,
      false,
      'STORAGE_ACCESS_KEY must not be used in server environment'
    );
    assert.strictEqual(
      'STORAGE_SECRET_KEY' in serverEnv,
      false,
      'STORAGE_SECRET_KEY must not be used in server environment'
    );
    assert.strictEqual(
      'STORAGE_BUCKET' in serverEnv,
      false,
      'STORAGE_BUCKET must not be used in server environment'
    );
  });

  test('Test 3d: Nginx production SSL/TLS termination and certificate volume validation (Bug 21)', () => {
    const composePath = path.resolve(rootDir, 'docker-compose.prod.yml');
    const nginxConfPath = path.resolve(rootDir, 'nginx.prod.conf');

    assert.ok(fs.existsSync(composePath), 'docker-compose.prod.yml must exist');
    assert.ok(fs.existsSync(nginxConfPath), 'nginx.prod.conf must exist');

    const composeContent = fs.readFileSync(composePath, 'utf8');
    const compose = YAML.parse(composeContent);
    const nginxVolumes = compose.services?.nginx?.volumes;

    assert.ok(Array.isArray(nginxVolumes), 'nginx volumes must be defined');
    assert.ok(
      nginxVolumes.some((v: string) => v.includes('/etc/nginx/certs')),
      'nginx service must mount /etc/nginx/certs volume'
    );

    const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
    assert.ok(nginxContent.includes('listen 443 ssl'), 'nginx.prod.conf must have listen 443 ssl');
    assert.ok(nginxContent.includes('ssl_certificate'), 'nginx.prod.conf must specify ssl_certificate');
    assert.ok(nginxContent.includes('ssl_certificate_key'), 'nginx.prod.conf must specify ssl_certificate_key');
    assert.ok(nginxContent.includes('return 301 https://'), 'nginx.prod.conf must redirect HTTP to HTTPS');
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
