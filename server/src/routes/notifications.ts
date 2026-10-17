import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { NotificationService } from '../services/notification.service.js';

function formatRfc7807(
  statusCode: number,
  code: string,
  title: string,
  detail: string,
  instance?: string
) {
  return {
    type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
    ...(instance ? { instance } : {}),
  };
}

const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const notificationParamsSchema = z.object({
  id: z.string().uuid('Invalid notification ID format'),
});

const notificationsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/notifications
  fastify.get(
    '/api/v1/notifications',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parsedQuery = getNotificationsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.code(400).send(
          formatRfc7807(
            400,
            'VALIDATION_FAILED',
            'Validation Error',
            parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters',
            request.url
          )
        );
      }

      const { page, limit } = parsedQuery.data;
      const result = await NotificationService.getNotifications(
        request.user.sub,
        { page, limit },
        fastify.db
      );

      return reply.code(200).send(result);
    }
  );

  // 2. PATCH /api/v1/notifications/read-all
  // Declared before :id to prevent route param collision
  fastify.patch(
    '/api/v1/notifications/read-all',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const result = await NotificationService.markAllAsRead(
        request.user.sub,
        fastify.db
      );

      return reply.code(200).send({
        success: true,
        updatedCount: result.updatedCount,
        unreadCount: 0,
      });
    }
  );

  // 3. PATCH /api/v1/notifications/:id/read
  fastify.patch(
    '/api/v1/notifications/:id/read',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parsedParams = notificationParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send(
          formatRfc7807(
            400,
            'VALIDATION_FAILED',
            'Validation Error',
            parsedParams.error.issues[0]?.message ?? 'Invalid notification ID',
            request.url
          )
        );
      }

      const result = await NotificationService.markAsRead(
        parsedParams.data.id,
        request.user.sub,
        fastify.db
      );

      if (!result) {
        return reply.code(404).send(
          formatRfc7807(
            404,
            'NOTIFICATION_NOT_FOUND',
            'Not Found',
            'Notification not found or unauthorized to access',
            request.url
          )
        );
      }

      return reply.code(200).send({
        success: true,
        notification: result.notification,
        unreadCount: result.unreadCount,
      });
    }
  );

  // 4. DELETE /api/v1/notifications/:id
  fastify.delete(
    '/api/v1/notifications/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parsedParams = notificationParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send(
          formatRfc7807(
            400,
            'VALIDATION_FAILED',
            'Validation Error',
            parsedParams.error.issues[0]?.message ?? 'Invalid notification ID',
            request.url
          )
        );
      }

      const deleted = await NotificationService.deleteNotification(
        parsedParams.data.id,
        request.user.sub,
        fastify.db
      );

      if (!deleted) {
        return reply.code(404).send(
          formatRfc7807(
            404,
            'NOTIFICATION_NOT_FOUND',
            'Not Found',
            'Notification not found or unauthorized to access',
            request.url
          )
        );
      }

      return reply.code(200).send({
        success: true,
        message: 'Notification deleted',
      });
    }
  );
};

export default notificationsRoutes;
