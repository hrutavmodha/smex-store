import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { StorageService, StorageError } from '../../services/storage.service.js';
import { MediaInspectorService, MediaInspectionError } from '../../services/media-inspector.service.js';
import { presignedUploadRateLimitConfig } from '../../plugins/rate-limit.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

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

  const ALLOWED_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const EXTENSION_MIME_MAP: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  /**
   * GET /api/v1/media/*
   * Serves public media streams from object storage
   */
  fastify.get('/api/v1/media/*', async (request, reply) => {
    const s3Key = (request.params as { '*': string })['*'];
    if (!s3Key || !S3_KEY_REGEX.test(s3Key) || s3Key.includes('..')) {
      return reply.code(400).send({
        type: 'https://api.smexstore.com/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Invalid media key format',
        code: 'INVALID_MEDIA_KEY',
        error: 'Invalid media key',
      });
    }

    try {
      const command = new GetObjectCommand({
        Bucket: storageService.getBucket(),
        Key: s3Key,
      });
      const s3Res = await storageService.getClient().send(command);

      const ext = s3Key.split('.').pop()?.toLowerCase() || '';
      const fallbackMime = EXTENSION_MIME_MAP[ext] || 'image/jpeg';
      const resolvedContentType =
        s3Res.ContentType && ALLOWED_MEDIA_MIME_TYPES.has(s3Res.ContentType)
          ? s3Res.ContentType
          : fallbackMime;

      reply.header('Content-Type', resolvedContentType);
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(s3Res.Body);
    } catch {
      return reply.code(404).send({
        type: 'https://api.smexstore.com/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Media not found',
        code: 'MEDIA_NOT_FOUND',
        error: 'Media not found',
      });
    }
  });
};

export default marketplaceUploadsRoutes;
