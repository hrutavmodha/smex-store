import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { StorageService, StorageError, MAX_FILE_SIZE } from '../../services/storage.service.js';
import { MediaInspectorService, MediaInspectionError } from '../../services/media-inspector.service.js';
import { presignedUploadRateLimitConfig } from '../../plugins/rate-limit.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { formatRfc7807 } from '@smex/shared';

const presignedUrlBodySchema = z.object({
  fileName: z.string().trim().min(1, 'File name is required').max(255),
  contentType: z.string().trim().min(1, 'Content-Type is required'),
  fileSize: z.number().int().positive('File size must be a positive integer'),
});

const S3_KEY_REGEX = /^marketplace\/proofs\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.(jpe?g|png|webp)$/i;

const verifyUploadBodySchema = z.object({
  s3Key: z.string().trim().min(1, 'S3 key is required'),
  expectedMime: z.string().trim().min(1, 'Expected MIME type is required'),
});

export const marketplaceUploadsRoutes: FastifyPluginAsync = async (fastify) => {
  const storageService = new StorageService();
  const mediaInspectorService = new MediaInspectorService();

  fastify.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * PUT /api/v1/marketplace/uploads/binary/*
   * Direct binary upload endpoint for local disk storage mode
   */
  fastify.put(
    '/api/v1/marketplace/uploads/binary/*',
    {
      bodyLimit: 10 * 1024 * 1024,
    },
    async (request, reply) => {
      const s3Key = (request.params as { '*': string })['*'];
      if (!s3Key || !S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
        return reply.code(400).send(
          formatRfc7807(400, 'INVALID_STORAGE_KEY', 'Bad Request', 'Invalid storage key format', request.url)
        );
      }

      const buffer = request.body as Buffer;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return reply.code(400).send(
          formatRfc7807(400, 'EMPTY_PAYLOAD', 'Bad Request', 'Binary payload is required', request.url)
        );
      }

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.code(422).send(
          formatRfc7807(422, 'FILE_TOO_LARGE', 'Payload Too Large', 'File size exceeds maximum limit of 5MB', request.url)
        );
      }

      const contentType = (request.headers['content-type'] as string) || 'image/jpeg';
      try {
        await storageService.saveLocalObject(s3Key, buffer, contentType);
        return reply.code(200).send({
          success: true,
          s3Key,
          size: buffer.length,
        });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to save binary upload to disk');
        return reply.code(500).send(
          formatRfc7807(500, 'STORAGE_WRITE_FAILED', 'Internal Server Error', 'Failed to save file to disk', request.url)
        );
      }
    }
  );

  /**
   * POST /api/v1/marketplace/uploads/presigned-url
   * Authenticated endpoint to generate direct S3 PUT presigned URLs
   */
  fastify.post(
    '/api/v1/marketplace/uploads/presigned-url',
    {
      onRequest: [fastify.authenticate],
      config: {
        rateLimit: presignedUploadRateLimitConfig,
      },
    },
    async (request, reply) => {
      const parseResult = presignedUrlBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-error',
          title: 'Bad Request',
          status: 400,
          detail: parseResult.error.issues[0]?.message || 'Invalid payload',
          code: 'VALIDATION_ERROR',
        });
      }

      const userId = request.user.sub;
      try {
        const result = await storageService.generatePresignedUpload(
          userId,
          parseResult.data
        );
        return reply.code(200).send(result);
      } catch (err: unknown) {
        if (err instanceof StorageError) {
          return reply.code(err.statusCode).send({
            type: `https://api.smexstore.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
            title: 'Storage Error',
            status: err.statusCode,
            detail: err.message,
            code: err.code,
          });
        }
        request.log.error(err, 'Failed to generate presigned upload URL');
        return reply.code(500).send({
          type: 'https://api.smexstore.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Unexpected storage error occurred',
          code: 'INTERNAL_STORAGE_ERROR',
        });
      }
    }
  );

  /**
   * POST /api/v1/marketplace/uploads/verify
   * Authenticated endpoint to verify uploaded object magic bytes
   */
  fastify.post(
    '/api/v1/marketplace/uploads/verify',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const parseResult = verifyUploadBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-error',
          title: 'Bad Request',
          status: 400,
          detail: parseResult.error.issues[0]?.message || 'Invalid payload',
          code: 'VALIDATION_ERROR',
        });
      }

      const { s3Key, expectedMime } = parseResult.data;

      if (!S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid S3 key format',
          code: 'VALIDATION_ERROR',
        });
      }

      const userId = request.user.sub;
      const isAdmin = request.user.role === 'admin';
      const expectedPrefix = `marketplace/proofs/${userId}/`;

      if (!isAdmin && !s3Key.startsWith(expectedPrefix)) {
        return reply.code(403).send({
          type: 'https://api.smexstore.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'You are not authorized to verify objects outside your upload directory',
          code: 'UNAUTHORIZED_OBJECT_ACCESS',
        });
      }

      try {
        const result = await mediaInspectorService.inspectAndVerify(
          storageService,
          s3Key,
          expectedMime
        );
        return reply.code(200).send(result);
      } catch (err: unknown) {
        if (err instanceof MediaInspectionError) {
          return reply.code(err.statusCode).send({
            type: `https://api.smexstore.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
            title: 'Media Inspection Error',
            status: err.statusCode,
            detail: err.message,
            code: err.code,
          });
        }
        request.log.error(err, 'Failed to verify uploaded media');
        return reply.code(500).send({
          type: 'https://api.smexstore.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to inspect media',
          code: 'MEDIA_INSPECTION_FAILED',
        });
      }
    }
  );

  const deleteUploadBodySchema = z.object({
    s3Key: z.string().trim().min(1, 'S3 key is required'),
  });

  /**
   * DELETE /api/v1/marketplace/uploads
   * Authenticated endpoint to clean up uncommitted or abandoned uploaded proofs
   */
  fastify.delete(
    '/api/v1/marketplace/uploads',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const parseResult = deleteUploadBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-error',
          title: 'Bad Request',
          status: 400,
          detail: parseResult.error.issues[0]?.message || 'Invalid payload',
          code: 'VALIDATION_ERROR',
        });
      }

      const { s3Key } = parseResult.data;

      if (!S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/validation-error',
          title: 'Bad Request',
          status: 400,
          detail: 'Invalid S3 key format',
          code: 'VALIDATION_ERROR',
        });
      }

      const userId = request.user.sub;
      const isAdmin = request.user.role === 'admin';
      const expectedPrefix = `marketplace/proofs/${userId}/`;

      if (!isAdmin && !s3Key.startsWith(expectedPrefix)) {
        return reply.code(403).send({
          type: 'https://api.smexstore.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'You are not authorized to delete objects outside your upload directory',
          code: 'UNAUTHORIZED_OBJECT_ACCESS',
        });
      }

      try {
        await storageService.deleteObject(s3Key);
        return reply.code(200).send({ success: true, s3Key });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to delete S3 object');
        return reply.code(500).send({
          type: 'https://api.smexstore.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to delete object from storage',
          code: 'STORAGE_DELETE_FAILED',
        });
      }
    }
  );

  const cleanupUploadsBodySchema = z.object({
    maxAgeHours: z.number().int().positive().optional(),
  });

  /**
   * POST /api/v1/marketplace/uploads/cleanup
   * Admin-only endpoint to purge orphaned uncommitted drafts older than maxAgeHours
   */
  fastify.post(
    '/api/v1/marketplace/uploads/cleanup',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      if (request.user.role !== 'admin') {
        return reply.code(403).send({
          type: 'https://api.smexstore.com/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Admin privileges required for storage maintenance',
          code: 'ADMIN_REQUIRED',
        });
      }

      const parseResult = cleanupUploadsBodySchema.safeParse(request.body || {});
      const maxAgeHours = parseResult.success && parseResult.data.maxAgeHours ? parseResult.data.maxAgeHours : 24;
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      try {
        const { listingProofs } = await import('../../db/schema/marketplace.js');
        const activeProofs = await fastify.db.select({ s3Key: listingProofs.s3Key }).from(listingProofs);
        const activeKeys = new Set(activeProofs.map((p) => p.s3Key));

        const purgedKeys = await storageService.cleanupOrphanedUploads(activeKeys, maxAgeMs);
        return reply.code(200).send({
          success: true,
          purgedCount: purgedKeys.length,
          purgedKeys,
        });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to run orphaned uploads cleanup');
        return reply.code(500).send({
          type: 'https://api.smexstore.com/errors/internal-server-error',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Failed to clean up orphaned uploads',
          code: 'STORAGE_CLEANUP_FAILED',
        });
      }
    }
  );

  const ALLOWED_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const EXTENSION_MIME_MAP: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  /**
   * GET /api/v1/media/*
   * Serves public media streams from local disk or object storage
   */
  fastify.get('/api/v1/media/*', async (request, reply) => {
    const s3Key = (request.params as { '*': string })['*'];
    if (!s3Key || !S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
      return reply.code(400).send(
        formatRfc7807(400, 'INVALID_MEDIA_KEY', 'Bad Request', 'Invalid media key format', request.url)
      );
    }

    const ext = s3Key.split('.').pop()?.toLowerCase() || '';
    const fallbackMime = EXTENSION_MIME_MAP[ext] || 'image/jpeg';

    const cleanKey = path.normalize(s3Key).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidatePaths = [
      storageService.getLocalFilePath(s3Key),
      path.resolve('/tmp/smex-uploads', cleanKey),
    ];

    for (const filePath of candidatePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const stream = fs.createReadStream(filePath);

          reply.header('Content-Type', fallbackMime);
          reply.header('X-Content-Type-Options', 'nosniff');
          reply.header('Cache-Control', 'public, max-age=31536000, immutable');
          return reply.send(stream);
        } catch {
          // Fall through
        }
      }
    }

    try {
      const command = new GetObjectCommand({
        Bucket: storageService.getBucket(),
        Key: s3Key,
      });
      const s3Res = await storageService.getClient().send(command);

      const resolvedContentType =
        s3Res.ContentType && ALLOWED_MEDIA_MIME_TYPES.has(s3Res.ContentType)
          ? s3Res.ContentType
          : fallbackMime;

      reply.header('Content-Type', resolvedContentType);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(s3Res.Body);
    } catch {
      return reply.code(404).send(
        formatRfc7807(404, 'MEDIA_NOT_FOUND', 'Not Found', 'Media not found', request.url)
      );
    }
  });
};

export default marketplaceUploadsRoutes;
