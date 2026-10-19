import { fetchWithAuth } from '../api';

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadProgressCallback {
  (percentage: number): void;
}

export interface UploadedProofResult {
  s3Key: string;
  cdnUrl: string;
}

export class UploadError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

/**
 * Uploads a proof screenshot directly to S3-compatible storage via presigned URL
 * and performs binary magic-byte verification.
 */
export async function uploadScreenshotProof(
  file: File,
  onProgress?: UploadProgressCallback,
  apiBaseUrl: string = ''
): Promise<UploadedProofResult> {
  // 1. Client-side invariant checks
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new UploadError(
      'FILE_TOO_LARGE',
      `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5MB.`
    );
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    throw new UploadError(
      'INVALID_MIME_TYPE',
      `File format '${file.type || 'unknown'}' is not supported. Please select JPEG, PNG, or WebP.`
    );
  }

  // Initial progress
  onProgress?.(0);

  // 2. Request Presigned Upload URL from Fastify
  const presignRes = await fetchWithAuth(`${apiBaseUrl}/api/v1/marketplace/uploads/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  if (!presignRes.ok) {
    const errorData = await presignRes.json().catch(() => ({}));
    throw new UploadError(
      errorData.code || 'PRESIGN_FAILED',
      errorData.detail || 'Failed to initialize direct storage upload.'
    );
  }

  const { uploadUrl, s3Key, cdnUrl } = await presignRes.json();

  // 3. Direct Binary PUT to S3 / MinIO via XMLHttpRequest for deterministic progress
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percentComplete = Math.min(
            100,
            Math.max(0, Math.round((event.loaded / event.total) * 100))
          );
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(
          new UploadError(
            'S3_UPLOAD_FAILED',
            `Direct storage upload failed with status ${xhr.status}`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(new UploadError('NETWORK_ERROR', 'Network error during binary upload to storage.'));
    };

    xhr.send(file);
  });

  // 4. Verify Payload Magic Bytes on Fastify Gateway
  const verifyRes = await fetchWithAuth(`${apiBaseUrl}/api/v1/marketplace/uploads/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      s3Key,
      expectedMime: file.type,
    }),
  });

  if (!verifyRes.ok) {
    const errorData = await verifyRes.json().catch(() => ({}));
    throw new UploadError(
      errorData.code || 'MEDIA_VERIFICATION_FAILED',
      errorData.detail || 'Image verification failed. Ensure the file is not corrupted.'
    );
  }

  return { s3Key, cdnUrl };
}

/**
 * Deletes an uploaded proof from storage (e.g. when removed from draft or page unmounts)
 */
export async function deleteUploadedProof(
  s3Key: string,
  apiBaseUrl: string = ''
): Promise<void> {
  const res = await fetchWithAuth(`${apiBaseUrl}/api/v1/marketplace/uploads`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ s3Key }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new UploadError(
      errorData.code || 'DELETE_FAILED',
      errorData.detail || 'Failed to delete uploaded proof.'
    );
  }
}
