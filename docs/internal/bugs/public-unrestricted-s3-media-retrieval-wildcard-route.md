# Bug: Public Unrestricted S3 Media Retrieval via Wildcard Route

- **Bug ID**: 9
- **Category**: Security
- **Severity**: High
- **Target Files**:
  - `server/src/routes/marketplace/uploads.ts` (lines 158–178)
- **Status**: Identified

---

## 1. Description

The public media proxy route in `marketplace/uploads.ts`:
```ts
fastify.get('/api/v1/media/*', async (request, reply) => {
  const s3Key = (request.params as { '*': string })['*'];
  if (!s3Key) {
    return reply.code(404).send({ error: 'Media key missing' });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: storageService.getBucket(),
      Key: s3Key,
    });
    const s3Res = await storageService.getClient().send(command);
    if (s3Res.ContentType) {
      reply.header('Content-Type', s3Res.ContentType);
    }
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(s3Res.Body);
  } catch {
    return reply.code(404).send({ error: 'Media not found' });
  }
});
```
This route takes any arbitrary string passed after `/api/v1/media/` and sends it directly to `GetObjectCommand` for the application's S3 bucket.
1. There is no prefix validation ensuring the object belongs under `marketplace/proofs/`. Any object stored in the bucket (e.g. system configurations, database dumps, private attachments) can be retrieved by an unauthenticated caller.
2. The endpoint passes through `s3Res.ContentType` directly without setting `X-Content-Type-Options: nosniff` or a restrictive `Content-Security-Policy`. If an SVG or HTML file is present, a browser requesting the media link directly from the API domain can execute embedded JavaScript.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/marketplace-media.md` Section 4: "Media streaming must strictly serve verified image formats (jpeg, png, webp) scoped to marketplace proofs."
- `docs/internal/requirements.md` Section 14: "Secure media serving."

---

## 3. Reproduction Steps / Proof of Concept

1. Store an internal file in S3 at `backups/db-dump.sql` or `private/secrets.env`.
2. Issue an unauthenticated HTTP GET request to `http://localhost:3001/api/v1/media/backups/db-dump.sql`.
3. The server responds with 200 OK and streams the raw private file contents.

---

## 4. Impact

Unauthorized read access to all objects in the S3 bucket and potential Stored Cross-Site Scripting (XSS).

---

## 5. Recommended Remediation

1. Validate that the key matches the permitted marketplace proofs regex:
   ```ts
   const S3_KEY_REGEX = /^marketplace\/proofs\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_.\-]+\.(jpe?g|png|webp)$/i;
   if (!S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
     return reply.code(400).send({ error: 'Invalid media key' });
   }
   ```
2. Whitelist allowed `Content-Type` headers to `image/jpeg`, `image/png`, and `image/webp`.
3. Set `X-Content-Type-Options: nosniff`.
