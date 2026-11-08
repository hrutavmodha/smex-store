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
}

export class StorageService {
  private s3Client: S3Client;
  private signerClient: S3Client;
  private bucket: string;

  constructor(options?: StorageServiceOptions) {
    const env = getEnv();
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

  public getClient(): S3Client {
    return this.s3Client;
  }

  public getBucket(): string {
    return this.bucket;
  }

  public async ensureBucketExists(): Promise<void> {
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

    await this.ensureBucketExists().catch(() => {});

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: fileSize,
      Tagging: 'status=uncommitted',
    });

    const uploadUrl = await getSignedUrl(this.signerClient, command, { expiresIn });
    const cdnUrl = `/api/v1/media/${s3Key}`;

    return {
      uploadUrl,
      s3Key,
      cdnUrl,
      expiresIn,
    };
  }

  public async getObjectHeader(s3Key: string, byteLength: number = 16): Promise<Buffer> {
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
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
    });
    await this.s3Client.send(command);
  }

  public async tagObject(s3Key: string, key: string, value: string): Promise<void> {
    const command = new PutObjectTaggingCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Tagging: {
        TagSet: [{ Key: key, Value: value }],
      },
    });
    await this.s3Client.send(command);
  }

  public async getObjectTagging(s3Key: string): Promise<Record<string, string>> {
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
  }

  public async configureLifecyclePolicy(expirationDays: number = 2): Promise<void> {
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
  }

  public async cleanupOrphanedUploads(
    activeKeys: Set<string>,
    maxAgeMs: number = 24 * 60 * 60 * 1000
  ): Promise<string[]> {
    const deletedKeys: string[] = [];
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
        deletedKeys.push(obj.Key);
      }
    }
    return deletedKeys;
  }
}
