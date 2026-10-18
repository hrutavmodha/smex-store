import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  AnnouncementService,
  AnnouncementError,
} from '../../services/announcement.service.js';

const announcementSchema = z.object({
  message: z.string().min(1, 'Announcement message is required'),
  level: z.enum(['info', 'warning', 'alert']),
  isActive: z.boolean().default(true),
  actionUrl: z.string().optional(),
  expiresAt: z.string().optional(),
});

const adminSystemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * GET /api/v1/admin/system/announcement
   * Reads current sitewide announcement configuration from Redis
   */
  fastify.get('/api/v1/admin/system/announcement', async (_request, reply) => {
    const announcement = await AnnouncementService.getAnnouncement(fastify.redis);
    return reply.code(200).send({ announcement });
  });

  /**
   * POST /api/v1/admin/system/announcement
   * Updates sitewide announcement in Redis and broadcasts announcement:update frame
   */
  fastify.post('/api/v1/admin/system/announcement', async (request, reply) => {
    const parseResult = announcementSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_FAILED',
        message: 'Invalid announcement parameters',
        issues: parseResult.error.issues,
      });
    }

    try {
      const announcement = await AnnouncementService.setAnnouncement(
        parseResult.data,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send({ success: true, announcement });
    } catch (err) {
      if (err instanceof AnnouncementError) {
        return reply.code(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.code,
          code: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });
};

export default adminSystemRoutes;
