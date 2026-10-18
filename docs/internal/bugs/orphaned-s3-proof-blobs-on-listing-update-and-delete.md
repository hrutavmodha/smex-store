# Bug: Orphaned S3 Media Blobs on Marketplace Listing Update and Deletion

- **Bug ID**: BUG-M7-005
- **Milestone**: Milestone 7: Marketplace and S3 Presigned Uploads
- **Severity**: Medium (Unbounded Cloud Storage Leak)
- **Target Files**:
  - `server/src/services/listing.service.ts` (lines 429–441, 512–520)
  - `server/src/services/storage.service.ts`
- **Status**: Identified

---

## 1. Description

When a seller creates a listing with screenshot proofs, image binaries are stored in S3/MinIO under keys like `marketplace/proofs/<userId>/<uuid>.<ext>`, and their metadata is tracked in `listing_proofs`.

However, when listings are updated or deleted:

1. **`updateListing` (lines 429–441)**:
   ```typescript
   if (input.proofImages) {
     await tx.delete(listingProofs).where(eq(listingProofs.listingId, id));
     if (input.proofImages.length > 0) { ... }
   }
   ```
   The old `listing_proofs` rows are deleted from PostgreSQL, but `storageService.deleteObject` is never called for the replaced S3 keys.
2. **`deleteListing` (lines 512–520)**:
   ```typescript
   await db.transaction(async (tx) => {
     // Cascade delete proofs
     await tx.delete(listingProofs).where(eq(listingProofs.listingId, id));
     // Soft-delete listing status per specification
     await tx
       .update(marketplaceListings)
       .set({ status: 'deleted', updatedAt: new Date() })
       .where(eq(marketplaceListings.id, id));
   });
   ```
   The database records are deleted, but none of the actual binary files in the S3 bucket are deleted.

Because `storageService` is not even passed to or invoked by `ListingService`, all previous image binaries remain permanently orphaned in object storage.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/marketplace-media.md` Section 2.2 Item 4:
  > "**Object Key Namespacing**: `marketplace/proofs/${userId}/${uuidv4()}-${sanitizedFileName}`. Prevents file collisions and enables tenant-scoped lifecycle pruning."

---

## 3. Reproduction Steps / Proof of Concept

1. User uploads 5 proof images (total 15MB) and creates a listing `L1`.
2. S3 bucket contains 5 objects.
3. User edits the listing and replaces the 5 images with 5 new ones.
4. Database `listing_proofs` points to the new 5 images.
5. Inspect the S3 bucket:
   - S3 bucket now contains 10 objects. The first 5 are completely orphaned.
6. User deletes listing `L1`.
7. Database `listing_proofs` rows are deleted.
8. Inspect the S3 bucket:
   - All 10 objects still exist in S3 with zero database references.

---

## 4. Impact

- **Permanent Object Storage Bloat**: Storage costs scale unboundedly with every image update and listing deletion.
- **Data Retention / GDPR / Privacy Risk**: Deleted user content remains in storage infrastructure indefinitely.

---

## 5. Recommended Remediation

1. Before deleting rows from `listing_proofs` in `updateListing` and `deleteListing`, select existing `s3Key` values for the listing.
2. After the database transaction commits, invoke `storageService.deleteObject(key)` asynchronously (or via background queue/worker) for all orphaned keys:
   ```typescript
   const oldProofs = await tx
     .select({ s3Key: listingProofs.s3Key })
     .from(listingProofs)
     .where(eq(listingProofs.listingId, id));

   // After transaction commits:
   for (const proof of oldProofs) {
     await storageService.deleteObject(proof.s3Key).catch((err) => {
       logger.warn({ err, s3Key: proof.s3Key }, 'Failed to delete orphaned S3 object');
     });
   }
   ```
