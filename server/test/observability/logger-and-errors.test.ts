import { describe, test } from 'vitest';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { loggerOptions, REDACTED_PATHS } from '../../src/plugins/logger.js';
import sensiblePlugin from '../../src/plugins/sensible.js';

describe('Structured Observability & RFC 7807 Error Suite (LLT 2.4)', () => {
  test('Test 7: Structured Pino log serialization & credential redaction', async () => {
    const logChunks: any[] = [];

    // Custom memory destination stream capturing structured JSON log frames
    const destinationStream = {
      write(chunk: string) {
        try {
          const parsed = JSON.parse(chunk);
          logChunks.push(parsed);
        } catch {
          // non-json output
        }
      },
    };

    const app = Fastify({
      logger: {
        ...loggerOptions,
        stream: destinationStream,
      },
    });

    await app.register(sensiblePlugin);

    app.post('/api/v1/test-auth', async (request, reply) => {
      request.log.info({ body: request.body }, 'Processing authentication payload');
      return reply.code(200).send({ status: 'ok' });
    });

    await app.ready();

    // Inject request with sensitive authentication credentials in headers and body
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/test-auth',
      headers: {
        authorization: 'Bearer super_secret_jwt_token',
        cookie: 'session_token=secret_cookie_data',
        'content-type': 'application/json',
      },
      payload: {
        password: 'SuperSecretPassword123!',
        token: 'sensitive_token_payload',
        secret: 'top_secret_api_key',
        username: 'pro_gamer',
      },
    });

    assert.equal(response.statusCode, 200);

    // Verify structured JSON logs were emitted
    assert.ok(logChunks.length > 0, 'Log entries must be emitted as JSON');

    // Find the log entry with body or request details
    const authLog = logChunks.find((l) => l.body || l.req);
    assert.ok(authLog, 'Should emit request log entry');

    // Verify correlation ID / reqId
    const reqLog = logChunks.find((l) => l.reqId);
    assert.ok(reqLog, 'Log entry must contain reqId correlation identifier');

    // Verify credential redaction: sensitive credentials must be replaced with [REDACTED]
    const serializedLogs = JSON.stringify(logChunks);
    assert.equal(
      serializedLogs.includes('super_secret_jwt_token'),
      false,
      'Authorization bearer token must not appear in plaintext in logs'
    );
    assert.equal(
      serializedLogs.includes('secret_cookie_data'),
      false,
      'Cookie session token must not appear in plaintext in logs'
    );
    assert.equal(
      serializedLogs.includes('SuperSecretPassword123!'),
      false,
      'Password must not appear in plaintext in logs'
    );
    assert.equal(
      serializedLogs.includes('top_secret_api_key'),
      false,
      'Secret must not appear in plaintext in logs'
    );

    // Verify censor string [REDACTED] is present for redacted fields
    assert.ok(
      serializedLogs.includes('[REDACTED]'),
      'Redacted keys must be masked with [REDACTED]'
    );

    await app.close();
  });

  test('Test 8: RFC 7807 Problem Details error formatting', async () => {
    const app = Fastify({ logger: false });
    await app.register(sensiblePlugin);

    // Endpoint triggering a 422 Unprocessable Entity validation failure
    app.post('/api/v1/test-validation', {
      schema: {
        body: {
          type: 'object',
          required: ['priceInr'],
          properties: {
            priceInr: { type: 'number', minimum: 100 },
          },
        },
      },
    }, async (_request, reply) => {
      return reply.code(200).send({ status: 'ok' });
    });

    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/test-validation',
      headers: { 'content-type': 'application/json' },
      payload: {
        priceInr: 50, // Below minimum 100
      },
    });

    assert.equal(res.statusCode, 422, 'Must return 422 Unprocessable Entity');

    // Content-Type must be application/problem+json
    const contentType = res.headers['content-type'];
    assert.ok(
      contentType?.includes('application/problem+json'),
      `Content-Type must be application/problem+json, got: ${contentType}`
    );

    const body = JSON.parse(res.payload);

    // Required RFC 7807 Problem Details fields
    assert.ok(body.type, 'RFC 7807 "type" URI must be present');
    assert.ok(body.type.startsWith('https://api.smexstore.com/errors/'));
    assert.ok(body.title, 'RFC 7807 "title" must be present');
    assert.equal(body.status, 422, 'RFC 7807 "status" must match HTTP status code');
    assert.ok(body.detail, 'RFC 7807 "detail" explanation must be present');
    assert.equal(body.instance, '/api/v1/test-validation', 'RFC 7807 "instance" must reflect request URL');
    assert.ok(body.code, 'Domain error code must be present');

    await app.close();
  });

  test('Test 8b: Sensible onSend hook preserves original Content-Type on non-JSON payloads (Bug 23)', async () => {
    const app = Fastify({ logger: false });
    await app.register(sensiblePlugin);

    // Route returning plain text error
    app.get('/api/v1/test-text-error', async (_request, reply) => {
      return reply.code(404).type('text/plain').send('Resource does not exist');
    });

    // Route returning HTML error (e.g. gateway error)
    app.get('/api/v1/test-html-error', async (_request, reply) => {
      return reply.code(502).type('text/html').send('<html><body>502 Bad Gateway</body></html>');
    });

    await app.ready();

    // 1. Verify plain text response preserves text/plain
    const textRes = await app.inject({
      method: 'GET',
      url: '/api/v1/test-text-error',
    });
    assert.equal(textRes.statusCode, 404);
    assert.equal(textRes.body, 'Resource does not exist');
    assert.match(textRes.headers['content-type'] || '', /^text\/plain/);

    // 2. Verify HTML response preserves text/html
    const htmlRes = await app.inject({
      method: 'GET',
      url: '/api/v1/test-html-error',
    });
    assert.equal(htmlRes.statusCode, 502);
    assert.equal(htmlRes.body, '<html><body>502 Bad Gateway</body></html>');
    assert.match(htmlRes.headers['content-type'] || '', /^text\/html/);

    await app.close();
  });
});
