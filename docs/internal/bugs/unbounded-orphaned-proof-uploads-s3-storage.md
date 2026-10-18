# Bug: Unbounded Orphaned Proof Uploads in S3 Storage from Abandoned Listing Drafts

- **Bug ID**: 20
- **Category**: Efficiency
- **Severity**: Low
- **Target Files**:
  - `client/components/marketplace/CreateListingForm.tsx` (lines 66–85)
  - `client/lib/marketplace/uploader.ts` (lines 70–128)
  - `server/src/routes/marketplace/uploads.ts` (lines 29–140)
  - `server/src/services/storage.service.ts`
- **Status**: Identified

---

## 1. Description

When a seller creates a new marketplace listing in `CreateListingForm.tsx`, selecting proof screenshots triggers immediate presigned URL generation and direct S3 uploads via `uploadScreenshotProof`:

```tsx
// client/components/marketplace/CreateListingForm.tsx (lines 68-82)
for (let i = 0; i < filesToUpload.length; i++) {
  const file = filesToUpload[i];
  const result = await uploadScreenshotProof(file, (percent) => { ... });

  newProofs.push({
    s3Key: result.s3Key,
    cdnUrl: result.cdnUrl,
    displayOrder: newProofs.length,
  });
}
```

The uploaded binary is immediately written to the S3 bucket under `marketplace/proofs/<userId>/<uuid>.<ext>` and verified via `/api/v1/marketplace/uploads/verify`.

However, the uploaded S3 object is not committed to the database until the user finishes filling out the form and successfully submits `POST /api/v1/marketplace/listings`.

If the user:
- Closes or refreshes the browser tab,
- Navigates away from the page,
- Fails client or server-side form validation, or
- Explicitly deletes the proof from the upload queue in the UI before submitting,

the uploaded files remain orphaned in S3 storage permanently. The system contains no mechanism (database pending-upload tracking table, periodic S3 garbage collection cron, or S3 bucket lifecycle expiration rule) to identify or purge unreferenced proof images.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/marketplace-engine.md` Section 5.1: "Storage Resource Management: Ephemeral upload artifacts not associated with a persistent listing entity within 24 hours must be evicted."
- AWS S3 Storage Architecture Best Practices: *"Use Object Lifecycle Management to automatically expire or transition incomplete or uncommitted multipart/staged uploads to avoid unbounded accumulation."*

---

## 3. Reproduction Steps / Proof of Concept

1. Open `/marketplace/create` in a web browser.
2. Select and upload 5 high-resolution account screenshot proofs (e.g. 5 x 4MB images).
3. Confirm in network logs that all 5 images successfully upload to S3 and pass `/api/v1/marketplace/uploads/verify`.
4. Close the browser tab without clicking "Create Listing".
5. Inspect the AWS S3 bucket / MinIO console: the 5 uploaded files remain in `marketplace/proofs/<userId>/` indefinitely and are never referenced in `marketplace_listings`.

---

## 4. Impact

1. **Unbounded Storage Growth & Cloud Cost Bloat**: Over time, abandoned drafts and deleted pre-upload images accumulate gigabytes or terabytes of dead data in S3/MinIO, resulting in continuous cloud storage billing increases.
2. **Resource Hygiene Degradation**: Unreferenced objects pollute the bucket namespace, complicating backup snapshots and storage analytics.

---

## 5. Recommended Remediation

Implement a hybrid lifecycle management and cleanup strategy:

1. **S3 Object Tagging & Lifecycle Rule**:
   - Tag newly uploaded objects with `status: uncommitted` during presigned URL generation.
   - Configure an S3 Bucket Lifecycle Policy that automatically deletes objects with tag `status: uncommitted` after 24 or 48 hours.
   - When a listing is successfully created in `POST /api/v1/marketplace/listings`, update the object tags in S3 to `status: committed` or move them to a permanent prefix.
2. **Pending Uploads Ledger**:
   - Create a lightweight `pending_uploads` database table recording `(id, user_id, s3_key, created_at, is_committed)`.
   - Run a daily background job or cron task that queries uncommitted records older than 24 hours, deletes the underlying S3 objects via `StorageService.deleteObject`, and removes the records.
