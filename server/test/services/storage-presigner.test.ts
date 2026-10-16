import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';

describe('Marketplace S3 Presigned Upload Pipeline (LLT 2.1)', () => {
  it('Test 1: Valid image presigned upload URL generation', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_presign');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'proof.png',
        contentType: 'image/png',
        fileSize: 1048576, // 1MB
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);

    assert.ok(body.uploadUrl, 'Must return signed uploadUrl');
    assert.ok(typeof body.uploadUrl === 'string');
    assert.equal(body.expiresIn, 900);
    assert.ok(body.s3Key.startsWith(`marketplace/proofs/${user.id}/`));
    assert.ok(body.s3Key.endsWith('proof.png'));
    assert.ok(body.cdnUrl.startsWith('/api/v1/media/'));
  });

  it('Test 2: Rejection of file exceeding 5MB limit', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_large');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'large.png',
        contentType: 'image/png',
        fileSize: 5242881, // 5MB + 1 byte
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'FILE_TOO_LARGE');
  });

  it('Test 3: Rejection of disallowed MIME type', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_svg');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'script.svg',
        contentType: 'image/svg+xml',
        fileSize: 2048,
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INVALID_MIME_TYPE');
  });

  it('Test 4: Rate limiting on presigned upload requests', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_ratelimit');

    for (let i = 1; i <= 10; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/marketplace/uploads/presigned-url',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          fileName: `proof_${i}.png`,
          contentType: 'image/png',
          fileSize: 1024,
        },
      });
      assert.equal(res.statusCode, 200, `Request ${i} should succeed with 200`);
    }

    // 11th request within 1 hour must be rejected with 429
    const blockedRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'proof_11.png',
        contentType: 'image/png',
        fileSize: 1024,
      },
    });

    assert.equal(blockedRes.statusCode, 429, '11th request must receive 429 Too Many Requests');
  });

  it('Test 5: Unauthorized presigned URL request rejection', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      payload: {
        fileName: 'proof.png',
        contentType: 'image/png',
        fileSize: 1024,
      },
    });

    assert.equal(res.statusCode, 401);
  });

  it('Test 5b: Presigned URL payload validation error handling', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_invalid_payload');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: '', // Invalid empty file name
        contentType: 'image/png',
        fileSize: -10, // Invalid negative size
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });

  it('Test 5c: Public media streaming route serves media or 404', async (t) => {
    const app = await build(t);

    // Request non-existent media
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/v1/media/non-existent-key.png',
    });
    assert.equal(notFoundRes.statusCode, 404);
  });

  it('Test 5d: Verify upload payload validation error handling', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_verify_validation');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: '', // Empty s3Key
        expectedMime: '',
      },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'VALIDATION_ERROR');
  });
});


