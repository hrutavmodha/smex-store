import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectTaggingCommand,
  PutBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { build, createVerifiedUser } from '../helper.js';

const s3Mock = mockClient(S3Client);

describe('Marketplace S3 Presigned Upload Pipeline (LLT 2.1)', () => {
  beforeEach(() => {
    s3Mock.reset();
    s3Mock.on(DeleteObjectCommand).resolves({});
    s3Mock.on(PutObjectTaggingCommand).resolves({});
    s3Mock.on(PutBucketLifecycleConfigurationCommand).resolves({});
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] });
  });
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

    s3Mock.on(GetObjectCommand).rejects(new Error('NoSuchKey'));

    // Request non-existent media with valid key format
    const notFoundRes = await app.inject({
      method: 'GET',
      url: '/api/v1/media/marketplace/proofs/user-test-123/non-existent-proof.png',
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

  it('Test 6: Presigned upload URL includes uncommitted status tagging (Bug 20)', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_tagging');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'tagged_proof.png',
        contentType: 'image/png',
        fileSize: 1048576,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.uploadUrl.includes('x-amz-tagging=status%3Duncommitted'), 'Upload URL must contain status=uncommitted tag');
  });

  it('Test 7: Authenticated user can delete uncommitted uploaded proof within their namespace (Bug 20)', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_delete_proof');

    const presignRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'to_delete.png',
        contentType: 'image/png',
        fileSize: 1024,
      },
    });
    const { s3Key } = JSON.parse(presignRes.payload);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/marketplace/uploads',
      headers: { authorization: `Bearer ${token}` },
      payload: { s3Key },
    });

    assert.equal(deleteRes.statusCode, 200);
    const delBody = JSON.parse(deleteRes.payload);
    assert.equal(delBody.success, true);
    assert.equal(delBody.s3Key, s3Key);
  });

  it('Test 8: Rejection of DELETE /api/v1/marketplace/uploads for key outside user namespace with 403 (Bug 20)', async (t) => {
    const app = await build(t);
    const { user: victim } = await createVerifiedUser(app, 'victim_user');
    const { token: attackerToken } = await createVerifiedUser(app, 'attacker_user');

    const foreignKey = `marketplace/proofs/${victim.id}/private_proof.png`;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/marketplace/uploads',
      headers: { authorization: `Bearer ${attackerToken}` },
      payload: { s3Key: foreignKey },
    });

    assert.equal(deleteRes.statusCode, 403);
    const delBody = JSON.parse(deleteRes.payload);
    assert.equal(delBody.code, 'UNAUTHORIZED_OBJECT_ACCESS');
  });

  it('Test 9: Admin cleanup route POST /api/v1/marketplace/uploads/cleanup purges orphaned proofs (Bug 20)', async (t) => {
    const app = await build(t);
    const { user: normalUser, token: normalToken } = await createVerifiedUser(app, 'regular_user');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_cleaner');
    const { users } = await import('../../src/db/schema/users.js');
    const { eq } = await import('drizzle-orm');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));

    const adminToken = app.jwt.sign({
      sub: adminUser.id,
      role: 'admin',
      sessionId: `test_admin_clean_${Date.now()}`,
    });

    // Regular user cannot trigger cleanup
    const forbiddenRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/cleanup',
      headers: { authorization: `Bearer ${normalToken}` },
      payload: { maxAgeHours: 24 },
    });
    assert.equal(forbiddenRes.statusCode, 403);

    // Admin can trigger cleanup
    const adminRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/cleanup',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { maxAgeHours: 24 },
    });
    assert.equal(adminRes.statusCode, 200);
    const body = JSON.parse(adminRes.payload);
    assert.equal(body.success, true);
    assert.ok(typeof body.purgedCount === 'number');
  });

  it('Test 10: StorageService tagging and lifecycle policy methods (Bug 20)', async () => {
    const { StorageService } = await import('../../src/services/storage.service.js');
    const storageService = new StorageService();

    // Verify configureLifecyclePolicy runs without unhandled exception
    await assert.doesNotReject(async () => {
      await storageService.configureLifecyclePolicy(2);
    });

    // Verify cleanupOrphanedUploads runs cleanly against empty/mocked list
    const purged = await storageService.cleanupOrphanedUploads(new Set());
    assert.ok(Array.isArray(purged));
  });

  it('Test 11: StorageService uses publicEndpoint for presigned URLs without leaking internal container hostname (BUG-OPS-003)', async () => {
    const { StorageService } = await import('../../src/services/storage.service.js');
    const storageService = new StorageService({
      endpoint: 'http://minio:9000',
      publicEndpoint: 'https://smexstore.com',
    });

    const result = await storageService.generatePresignedUpload('user-prod-123', {
      fileName: 'proof.png',
      contentType: 'image/png',
      fileSize: 1024,
    });

    assert.ok(result.uploadUrl.startsWith('https://smexstore.com/smex-storage/marketplace/proofs/user-prod-123/'));
    assert.ok(!result.uploadUrl.includes('minio:9000'), 'Presigned URL must not leak internal minio:9000 endpoint');
  });
});



