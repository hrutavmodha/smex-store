import { describe, it, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  MediaInspectorService,
  MediaInspectionError,
} from '../../src/services/media-inspector.service.js';
import { StorageService } from '../../src/services/storage.service.js';
import { build, createVerifiedUser } from '../helper.js';

const s3Mock = mockClient(S3Client);

describe('Binary Magic Byte Media Inspection Suite (LLT 2.2)', () => {
  const inspector = new MediaInspectorService();

  beforeEach(() => {
    s3Mock.reset();
  });

  it('Test 6: Verification of genuine JPEG header', async (t) => {
    // 1. Direct unit verification
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01]);
    assert.equal(inspector.verifyMagicBytes(jpegBuffer, 'image/jpeg'), true);

    // 2. Mock storage service inspection
    const storage = new StorageService();
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: async () => new Uint8Array(jpegBuffer),
      } as any,
    });

    const inspectRes = await inspector.inspectAndVerify(storage, 'marketplace/proofs/u1/photo.jpg', 'image/jpeg');
    assert.equal(inspectRes.verified, true);
    assert.equal(inspectRes.mimeType, 'image/jpeg');

    // 3. Endpoint integration verification
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'media_jpeg');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: 'marketplace/proofs/u1/photo.jpg',
        expectedMime: 'image/jpeg',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.verified, true);
  });

  it('Test 7: Verification of genuine PNG header', async (t) => {
    // 1. Direct unit verification
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    assert.equal(inspector.verifyMagicBytes(pngBuffer, 'image/png'), true);

    // 2. Mock storage service inspection
    const storage = new StorageService();
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: async () => new Uint8Array(pngBuffer),
      } as any,
    });

    const inspectRes = await inspector.inspectAndVerify(storage, 'marketplace/proofs/u1/screen.png', 'image/png');
    assert.equal(inspectRes.verified, true);

    // 3. Endpoint verification
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'media_png');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: 'marketplace/proofs/u1/screen.png',
        expectedMime: 'image/png',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.verified, true);
  });

  it('Test 8: Verification of genuine WebP header', async (t) => {
    // 1. Direct unit verification: 'RIFF' at 0, 'WEBP' at 8
    const webpBuffer = Buffer.alloc(16);
    webpBuffer.write('RIFF', 0, 4, 'ascii');
    webpBuffer.writeUInt32LE(100, 4);
    webpBuffer.write('WEBP', 8, 4, 'ascii');
    assert.equal(inspector.verifyMagicBytes(webpBuffer, 'image/webp'), true);

    // 2. Mock storage inspection
    const storage = new StorageService();
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: async () => new Uint8Array(webpBuffer),
      } as any,
    });

    const inspectRes = await inspector.inspectAndVerify(storage, 'marketplace/proofs/u1/shot.webp', 'image/webp');
    assert.equal(inspectRes.verified, true);

    // 3. Endpoint verification
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'media_webp');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: 'marketplace/proofs/u1/shot.webp',
        expectedMime: 'image/webp',
      },
    });

    assert.equal(res.statusCode, 200);
  });

  it('Test 9: Rejection of disguised executable payload', async (t) => {
    // Disguised payload claiming to be PNG, but having Windows PE 'MZ' header
    const peBuffer = Buffer.alloc(16);
    peBuffer[0] = 0x4d; // 'M'
    peBuffer[1] = 0x5a; // 'Z'
    assert.equal(inspector.verifyMagicBytes(peBuffer, 'image/png'), false);

    const storage = new StorageService();
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: async () => new Uint8Array(peBuffer),
      } as any,
    });
    s3Mock.on(DeleteObjectCommand).resolves({});

    // Must throw INVALID_IMAGE_PAYLOAD
    await assert.rejects(
      async () => {
        await inspector.inspectAndVerify(storage, 'marketplace/proofs/u1/trojan.png', 'image/png');
      },
      (err: any) => {
        assert.ok(err instanceof MediaInspectionError);
        assert.equal(err.code, 'INVALID_IMAGE_PAYLOAD');
        return true;
      }
    );

    // Verify S3 DeleteObjectCommand was called to purge the malicious payload
    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand);
    assert.ok(deleteCalls.length > 0, 'Must purge disguised file via DeleteObjectCommand');

    // Endpoint verification
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'media_trojan');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: 'marketplace/proofs/u1/trojan.png',
        expectedMime: 'image/png',
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INVALID_IMAGE_PAYLOAD');
  });

  it('Test 10: Truncated binary header payload rejection', async (t) => {
    // Truncated header buffer (< 12 bytes)
    const truncatedBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // Only 4 bytes

    const storage = new StorageService();
    s3Mock.on(GetObjectCommand).resolves({
      Body: {
        transformToByteArray: async () => new Uint8Array(truncatedBuffer),
      } as any,
    });
    s3Mock.on(DeleteObjectCommand).resolves({});

    await assert.rejects(
      async () => {
        await inspector.inspectAndVerify(storage, 'marketplace/proofs/u1/short.png', 'image/png');
      },
      (err: any) => {
        assert.ok(err instanceof MediaInspectionError);
        assert.equal(err.code, 'INVALID_IMAGE_PAYLOAD');
        return true;
      }
    );

    // Endpoint verification
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'media_trunc');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: 'marketplace/proofs/u1/short.png',
        expectedMime: 'image/png',
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INVALID_IMAGE_PAYLOAD');
  });
});
