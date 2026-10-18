# Bug: IDOR Vulnerability Enabling Arbitrary S3 Object Deletion via Upload Verification Endpoint

- **Bug ID**: BUG-M7-001
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Critical (Insecure Direct Object Reference / Arbitrary Object Deletion)
- **Target Files**:
  - `server/src/routes/marketplace/uploads.ts` (lines 80–125)
  - `server/src/services/media-inspector.service.ts` (lines 85–105)
- **Status**: Identified

---

## 1. Description

In Milestone 7, direct-to-storage uploads were introduced with an authenticated server-side verification endpoint (`POST /api/v1/marketplace/uploads/verify`). When a file fails binary magic-byte inspection (e.g. invalid signature or size under 12 bytes), `MediaInspectorService.inspectAndVerify` calls `await storageService.deleteObject(s3Key)` to prune disguises or invalid uploads.

However, `POST /api/v1/marketplace/uploads/verify` does **not** validate that the caller owns the provided `s3Key`:
```typescript
// server/src/routes/marketplace/uploads.ts:97-105
const { s3Key, expectedMime } = parseResult.data;

const result = await mediaInspectorService.inspectAndVerify(
  storageService,
  s3Key,
  expectedMime
);
```

Presigned upload keys follow a predictable tenant prefix structure generated via `storageService.generateListingProofKey`:
`marketplace/proofs/${userId}/${uuid}.${ext}`

Because `request.user.sub` is never compared against the user directory in `s3Key`, an authenticated attacker can specify:
1. Any arbitrary `s3Key` belonging to any other user in the storage bucket (e.g. `marketplace/proofs/<victim-user-id>/<victim-file-uuid>.jpg`).
2. An intentionally mismatched `expectedMime` (e.g. `image/png` for a JPEG image).

When `MediaInspectorService.verifyMagicBytes` evaluates the JPEG header against PNG magic bytes (`89 50 4E 47...`), the verification check fails, triggering:
```typescript
// server/src/services/media-inspector.service.ts:98-105
const isValid = this.verifyMagicBytes(header, expectedMime);
if (!isValid) {
  await storageService.deleteObject(s3Key).catch(() => {});
  throw new MediaInspectionError(
    'INVALID_IMAGE_PAYLOAD',
    `Disguised or invalid payload. Header magic bytes do not match '${expectedMime}'`,
    422
  );
}
```
This immediately deletes the victim's verified S3 object from the bucket.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/marketplace-media.md` Section 2.2 Item 4:
  > "**Object Key Namespacing**: `marketplace/proofs/${userId}/${uuidv4()}-${sanitizedFileName}`. Prevents file collisions and enables tenant-scoped lifecycle pruning."
- **Security Requirement**: S3 objects under `marketplace/proofs/${userId}/` must strictly be accessible, verified, and modifiable only by the authenticated tenant `${userId}` or an administrator.

---

## 3. Reproduction Steps / Proof of Concept

1. User A (victim) uploads a legitimate screenshot proof `marketplace/proofs/user-a-uuid/proof-123.jpg`.
2. User B (attacker) authenticates to the platform and acquires a valid JWT.
3. User B sends the following HTTP request:
   ```http
   POST /api/v1/marketplace/uploads/verify HTTP/1.1
   Host: api.smexstore.com
   Authorization: Bearer <User-B-JWT>
   Content-Type: application/json

   {
     "s3Key": "marketplace/proofs/user-a-uuid/proof-123.jpg",
     "expectedMime": "image/png"
   }
   ```
4. The server downloads the first 16 bytes of User A's file via S3 HTTP Range request.
5. The magic bytes match `image/jpeg` (`FF D8 FF`), but User B claimed `image/png`.
6. `inspectAndVerify` catches the mismatch, executes `await storageService.deleteObject("marketplace/proofs/user-a-uuid/proof-123.jpg")`, and returns HTTP 422.
7. User A's uploaded proof screenshot is permanently erased from S3 storage.

---

## 4. Impact

- **Arbitrary Data Loss**: Any authenticated user can purge media objects, proofs, and uploaded assets belonging to other sellers and users across the platform.
- **Denial of Service (DoS)**: Attackers can systematically disrupt competitor marketplace listings by deleting their uploaded proof images.

---

## 5. Recommended Remediation

1. **Enforce Tenant Namespace Authorization**:
   In `server/src/routes/marketplace/uploads.ts`, before invoking `mediaInspectorService.inspectAndVerify`, verify that the `s3Key` starts with the calling user's namespace:
   ```typescript
   const expectedPrefix = `marketplace/proofs/${request.user.sub}/`;
   if (!isAdmin && !s3Key.startsWith(expectedPrefix)) {
     return reply.code(403).send({
       type: 'https://api.smexstore.com/errors/forbidden',
       title: 'Forbidden',
       status: 403,
       detail: 'You are not authorized to verify objects outside your upload directory',
       code: 'UNAUTHORIZED_OBJECT_ACCESS',
     });
   }
   ```
2. **Strict Key Pattern Validation**:
   Validate that `s3Key` matches the strict pattern `^marketplace/proofs/[a-f0-9-]+/[a-f0-9-]+\.(jpe?g|png|webp)$` to prevent path traversal attempts (`../`) within the S3 bucket.
