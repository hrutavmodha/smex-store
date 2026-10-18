# Bug: Arbitrary S3 File Deletion Vulnerability via Unvalidated Proof Keys (IDOR)

- **Bug ID**: 8
- **Category**: Security
- **Severity**: Critical
- **Target Files**:
  - `server/src/services/listing.service.ts` (lines 129–141, 440–462, 476–481, 565–587)
  - `server/src/routes/marketplace/index.ts` (lines 12–16, 129–137, 182–189, 266)
- **Status**: Identified

---

## 1. Description

When creating a marketplace listing (`POST /api/v1/marketplace/listings`) or updating listing proofs (`PATCH /api/v1/marketplace/listings/:id`), the client provides an array of `proofImages` containing `{ s3Key, cdnUrl }`.
Neither `marketplace/index.ts` nor `ListingService` validates that the provided `s3Key` belongs to the authenticated user's upload namespace (`marketplace/proofs/${userId}/`).

When a seller later updates proofs (lines 447–450) or deletes their listing (lines 567–586):
```ts
const existingProofs = await tx
  .select({ s3Key: listingProofs.s3Key })
  .from(listingProofs)
  .where(eq(listingProofs.listingId, id));
s3KeysToDelete = existingProofs.map((p) => p.s3Key);

// ...
for (const key of s3KeysToDelete) {
  await storage.deleteObject(key).catch(() => {});
}
```
The storage service sends `DeleteObjectCommand` for each key stored in `listing_proofs`.

An attacker can specify any other user's S3 object keys (or system object keys) inside `proofImages` during listing creation. Once the listing is created, deleting or updating the listing permanently deletes the victim's S3 objects.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/marketplace-media.md` Section 3: "S3 Key Namespace Isolation: All objects must be strictly namespaced under marketplace/proofs/<USER_UUID>/."
- `docs/internal/requirements.md` Section 14: "Secure media handling and isolation across tenants."

---

## 3. Reproduction Steps / Proof of Concept

1. User A uploads a screenshot proof: `marketplace/proofs/user-a-uuid/proof1.png`.
2. Attacker B calls `POST /api/v1/marketplace/listings` with:
   ```json
   {
     "title": "Legit Account",
     "priceInr": 500,
     "rankTier": "Mythic",
     "contactChannel": "whatsapp",
     "contactHandle": "1234567890",
     "proofImages": [
       { "s3Key": "marketplace/proofs/user-a-uuid/proof1.png", "cdnUrl": "/api/v1/media/..." }
     ]
   }
   ```
3. Attacker B calls `DELETE /api/v1/marketplace/listings/:id`.
4. The server executes `DeleteObjectCommand` for `marketplace/proofs/user-a-uuid/proof1.png`.
5. User A's proof screenshot is permanently deleted from S3.

---

## 4. Impact

Arbitrary object deletion across the entire S3 bucket by any authenticated user.

---

## 5. Recommended Remediation

Validate all incoming proof keys in `ListingService.createListing` and `ListingService.updateListing`:
```ts
const expectedPrefix = `marketplace/proofs/${userId}/`;
for (const proof of proofImages) {
  if (!proof.s3Key.startsWith(expectedPrefix)) {
    throw createListingError(
      'Unauthorized proof image key',
      403,
      'UNAUTHORIZED_PROOF_KEY'
    );
  }
}
```
