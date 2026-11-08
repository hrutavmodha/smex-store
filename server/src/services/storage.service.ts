import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectTaggingCommand,
  GetObjectTaggingCommand,
  PutBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '../config/env.js';

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes (5,242,880)
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class StorageError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number = 422) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface PresignedUploadParams {
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
  cdnUrl: string;
  expiresIn: number;
}

export interface StorageServiceOptions {
  s3Client?: S3Client;
  bucket?: string;
  endpoint?: string;
  publicEndpoint?: string;
  driver?: 'local' | 's3';
  uploadDir?: string;
}

export class StorageService {
  private driver: 'local' | 's3';
  private uploadDir: string;
  private s3Client: S3Client;
  private signerClient: S3Client;
  private bucket: string;

  constructor(options?: StorageServiceOptions) {
    const env = getEnv();
    this.driver =
      options?.driver ||
      (options?.s3Client || options?.endpoint ? 's3' : env.STORAGE_DRIVER);
    this.uploadDir =
      options?.uploadDir ||
      env.UPLOAD_DIR ||
      path.resolve(process.cwd(), 'uploads');
    this.bucket = options?.bucket || env.S3_BUCKET || 'smex-storage';

    const endpoint = options?.endpoint || env.S3_ENDPOINT || 'http://localhost:9000';
    const publicEndpoint = options?.publicEndpoint || env.S3_PUBLIC_ENDPOINT || endpoint;
    const region = env.S3_REGION || 'auto';
    const credentials = {
      accessKeyId: env.S3_ACCESS_KEY_ID || 'minioadmin',
      secretAccessKey: env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    };

    if (options?.s3Client) {
      this.s3Client = options.s3Client;
      this.signerClient = options.s3Client;
    } else {
      this.s3Client = new S3Client({
        endpoint,
        region,
        credentials,
        forcePathStyle: true,
      });

      this.signerClient =
        publicEndpoint === endpoint
          ? this.s3Client
          : new S3Client({
              endpoint: publicEndpoint,
              region,
              credentials,
              forcePathStyle: true,
            });
    }
  }

  public isLocal(): boolean {
    return this.driver === 'local';
  }

  public getUploadDir(): string {
    return this.uploadDir;
  }

  public getLocalFilePath(s3Key: string): string {
    const cleanKey = path.normalize(s3Key).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.resolve(this.uploadDir, cleanKey);
    const resolvedBase = path.resolve(this.uploadDir);
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new StorageError('PATH_TRAVERSAL', 'Invalid storage key path', 400);
    }
    return resolvedPath;
  }

  public getClient(): S3Client {
    return this.s3Client;
  }

  public getBucket(): string {
    return this.bucket;
  }

  public async ensureBucketExists(): Promise<void> {
    if (this.isLocal()) {
      await fs.promises.mkdir(this.uploadDir, { recursive: true }).catch(() => {});
      return;
    }

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch {
        // Bucket may already exist or concurrent creation
      }
    }
  }

  public sanitizeFileName(fileName: string): string {
    return fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
  }

  public async generatePresignedUpload(
    userId: string,
    params: PresignedUploadParams
  ): Promise<PresignedUploadResult> {
    const { fileName, contentType, fileSize } = params;

    if (fileSize > MAX_FILE_SIZE) {
      throw new StorageError(
        'FILE_TOO_LARGE',
        `File size ${fileSize} exceeds maximum limit of 5MB (${MAX_FILE_SIZE} bytes)`,
        422
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
      throw new StorageError(
        'INVALID_MIME_TYPE',
        `Content-Type '${contentType}' is not permitted. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        422
      );
    }

    const cleanName = this.sanitizeFileName(fileName);
    const uniqueId = randomUUID();
    const s3Key = `marketplace/proofs/${userId}/${uniqueId}-${cleanName}`;
    const expiresIn = 900; // 15 minutes
    const cdnUrl = `/api/v1/media/${s3Key}`;

    if (this.isLocal()) {
      const uploadUrl = `/api/v1/marketplace/uploads/binary/${s3Key}`;
      return {
        uploadUrl,
        s3Key,
        cdnUrl,
        expiresIn,
      };
    }

    await this.ensureBucketExists().catch(() => {});

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: fileSize,
      Tagging: 'status=uncommitted',
    });

    const uploadUrl = await getSignedUrl(this.signerClient, command, { expiresIn });

    return {
      uploadUrl,
      s3Key,
      cdnUrl,
      expiresIn,
    };
  }

  public async saveLocalObject(s3Key: string, data: Buffer, contentType?: string): Promise<void> {
    const filePath = this.getLocalFilePath(s3Key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);

    const metaPath = `${filePath}.meta.json`;
    const meta = {
      s3Key,
      contentType: contentType || 'image/jpeg',
      tags: { status: 'uncommitted' },
      createdAt: Date.now(),
      size: data.length,
    };
    await fs.promises.writeFile(metaPath, JSON.stringify(meta), 'utf-8').catch(() => {});
  }

  public async getObjectHeader(s3Key: string, byteLength: number = 16): Promise<Buffer> {
    const filePath = this.getLocalFilePath(s3Key);
    try {
      if (fs.existsSync(filePath)) {
        const handle = await fs.promises.open(filePath, 'r');
        try {
          const buffer = Buffer.alloc(byteLength);
          const { bytesRead } = await handle.read(buffer, 0, byteLength, 0);
          return buffer.subarray(0, bytesRead);
        } finally {
          await handle.close();
        }
      }
    } catch {
      // Fall through to S3
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Range: `bytes=0-${byteLength - 1}`,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new StorageError('EMPTY_RESPONSE', 'S3 response body is empty', 422);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  public async deleteObject(s3Key: string): Promise<void> {
    const filePath = this.getLocalFilePath(s3Key);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
        await fs.promises.unlink(`${filePath}.meta.json`).catch(() => {});
      }
    } catch {
      // Ignore
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      await this.s3Client.send(command);
    } catch {
      // S3 command may fail if mocked or offline in local mode
    }
  }

  public async tagObject(s3Key: string, key: string, value: string): Promise<void> {
    const filePath = this.getLocalFilePath(s3Key);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(filePath)) {
      try {
        let meta: { tags?: Record<string, string> } = {};
        try {
          const raw = await fs.promises.readFile(metaPath, 'utf-8');
          meta = JSON.parse(raw);
        } catch {
          meta = { tags: {} };
        }
        meta.tags = meta.tags || {};
        meta.tags[key] = value;
        await fs.promises.writeFile(metaPath, JSON.stringify(meta), 'utf-8');
      } catch {
        // Ignore local tag failures
      }
    }

    try {
      const command = new PutObjectTaggingCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Tagging: {
          TagSet: [{ Key: key, Value: value }],
        },
      });
      await this.s3Client.send(command);
    } catch {
      // Ignore
    }
  }

  public async getObjectTagging(s3Key: string): Promise<Record<string, string>> {
    const filePath = this.getLocalFilePath(s3Key);
    const metaPath = `${filePath}.meta.json`;
    if (fs.existsSync(filePath)) {
      try {
        const raw = await fs.promises.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        return meta.tags || {};
      } catch {
        // Fall through
      }
    }

    try {
      const command = new GetObjectTaggingCommand({
        Bucket: this.bucket,
        Key: s3Key,
      });
      const res = await this.s3Client.send(command);
      const tags: Record<string, string> = {};
      for (const tag of res.TagSet || []) {
        if (tag.Key && tag.Value) {
          tags[tag.Key] = tag.Value;
        }
      }
      return tags;
    } catch {
      return {};
    }
  }

  public async configureLifecyclePolicy(expirationDays: number = 2): Promise<void> {
    try {
      const command = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'purge-uncommitted-proofs',
              Status: 'Enabled',
              Filter: {
                Prefix: 'marketplace/proofs/',
                Tag: {
                  Key: 'status',
                  Value: 'uncommitted',
                },
              },
              Expiration: {
                Days: expirationDays,
              },
            },
          ],
        },
      });
      await this.s3Client.send(command);
    } catch {
      // Ignore
    }
  }

  public async cleanupOrphanedUploads(
    activeKeys: Set<string>,
    maxAgeMs: number = 24 * 60 * 60 * 1000
  ): Promise<string[]> {
    const deletedKeys: string[] = [];

    const baseDir = path.join(this.uploadDir, 'marketplace/proofs');
    if (fs.existsSync(baseDir)) {
      const scanDirectory = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && !entry.name.endsWith('.meta.json')) {
            const relKey = path.relative(this.uploadDir, fullPath).replace(/\\/g, '/');
            const stat = await fs.promises.stat(fullPath);
            const isReferenced = activeKeys.has(relKey);
            const isExpired = Date.now() - stat.mtimeMs > maxAgeMs;
            if (!isReferenced && isExpired) {
              await this.deleteObject(relKey);
              deletedKeys.push(relKey);
            }
          }
        }
      };

      await scanDirectory(baseDir);
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'marketplace/proofs/',
      });
      const response = await this.s3Client.send(command);
      const now = Date.now();
      for (const obj of response.Contents || []) {
        if (!obj.Key) continue;
        const isReferenced = activeKeys.has(obj.Key);
        const isExpired = obj.LastModified ? now - obj.LastModified.getTime() > maxAgeMs : false;
        if (!isReferenced && isExpired) {
          await this.deleteObject(obj.Key);
          if (!deletedKeys.includes(obj.Key)) {
            deletedKeys.push(obj.Key);
          }
        }
      }
    } catch {
      // Ignore
    }

    return deletedKeys;
  }
}
