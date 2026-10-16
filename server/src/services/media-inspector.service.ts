import { StorageService } from './storage.service.js';

export interface MagicByteRule {
  mime: string;
  check: (header: Buffer) => boolean;
}

export const SUPPORTED_IMAGE_TYPES: MagicByteRule[] = [
  {
    mime: 'image/jpeg',
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
];

export class MediaInspectionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 422) {
    super(message);
    this.name = 'MediaInspectionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface VerificationResult {
  verified: boolean;
  s3Key: string;
  mimeType: string;
}

export class MediaInspectorService {
  public verifyMagicBytes(buffer: Buffer, expectedMime: string): boolean {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    // Windows PE / DOS executable header detection (0x4D, 0x5A -> 'MZ')
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return false;
    }

    const rule = SUPPORTED_IMAGE_TYPES.find((r) => r.mime === expectedMime);
    if (!rule) {
      return false;
    }

    return rule.check(buffer);
  }

  public async inspectAndVerify(
    storageService: StorageService,
    s3Key: string,
    expectedMime: string
  ): Promise<VerificationResult> {
    let header: Buffer;
    try {
      header = await storageService.getObjectHeader(s3Key, 16);
    } catch {
      throw new MediaInspectionError(
        'INVALID_IMAGE_PAYLOAD',
        'Failed to read object header from storage',
        422
      );
    }

    if (header.length < 12) {
      await storageService.deleteObject(s3Key).catch(() => {});
      throw new MediaInspectionError(
        'INVALID_IMAGE_PAYLOAD',
        'Truncated binary header payload (< 12 bytes)',
        422
      );
    }

    const isValid = this.verifyMagicBytes(header, expectedMime);
    if (!isValid) {
      await storageService.deleteObject(s3Key).catch(() => {});
      throw new MediaInspectionError(
        'INVALID_IMAGE_PAYLOAD',
        `Disguised or invalid payload. Header magic bytes do not match '${expectedMime}'`,
        422
      );
    }

    return {
      verified: true,
      s3Key,
      mimeType: expectedMime,
    };
  }
}
