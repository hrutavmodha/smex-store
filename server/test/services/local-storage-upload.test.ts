import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';

describe('Local Storage Direct Upload Pipeline (Raasta 1)', () => {
  it('End-to-End: Presign -> Direct Binary PUT -> Verify Magic Bytes -> Media Stream -> Delete', async (t) => {
    process.env.STORAGE_DRIVER = 'local';
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_local');

    // 1. Request presigned upload URL
    const presignRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/presigned-url',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        fileName: 'proof.png',
        contentType: 'image/png',
        fileSize: 1024,
      },
    });

    assert.equal(presignRes.statusCode, 200);
    const presignBody = JSON.parse(presignRes.payload);
    assert.ok(presignBody.uploadUrl.startsWith('/api/v1/marketplace/uploads/binary/'));
    assert.ok(presignBody.s3Key.startsWith(`marketplace/proofs/${user.id}/`));
    assert.ok(presignBody.cdnUrl.startsWith('/api/v1/media/'));

    // 2. Direct Binary PUT upload (valid PNG magic bytes header)
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      ...Array(100).fill(0),
    ]);

    const uploadRes = await app.inject({
      method: 'PUT',
      url: presignBody.uploadUrl,
      headers: {
        'content-type': 'image/png',
      },
      payload: validPngBuffer,
    });

    assert.equal(uploadRes.statusCode, 200);
    const uploadBody = JSON.parse(uploadRes.payload);
    assert.equal(uploadBody.success, true);
    assert.equal(uploadBody.s3Key, presignBody.s3Key);

    // 3. Verify Upload Magic Bytes
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/uploads/verify',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: presignBody.s3Key,
        expectedMime: 'image/png',
      },
    });

    assert.equal(verifyRes.statusCode, 200);
    const verifyBody = JSON.parse(verifyRes.payload);
    assert.equal(verifyBody.verified, true);
    assert.equal(verifyBody.s3Key, presignBody.s3Key);

    // 4. Stream Public Media
    const mediaRes = await app.inject({
      method: 'GET',
      url: presignBody.cdnUrl,
    });

    assert.equal(mediaRes.statusCode, 200);
    assert.equal(mediaRes.headers['content-type'], 'image/png');
    assert.equal(mediaRes.headers['x-content-type-options'], 'nosniff');
    assert.ok(mediaRes.rawPayload.length > 0);

    // 5. Delete Uploaded Media
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/api/v1/marketplace/uploads',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        s3Key: presignBody.s3Key,
      },
    });

    assert.equal(deleteRes.statusCode, 200);
    const deleteBody = JSON.parse(deleteRes.payload);
    assert.equal(deleteBody.success, true);

    // 6. After deletion, media route must return 404
    const notFoundRes = await app.inject({
      method: 'GET',
      url: presignBody.cdnUrl,
    });
    assert.equal(notFoundRes.statusCode, 404);
  });
});
