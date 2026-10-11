import { type FastifyPluginAsync } from 'fastify';
import { SessionService } from '../services/session.service.js';

const devicesRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/devices/sessions
  fastify.get(
    '/api/v1/devices/sessions',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const activeSessions = await SessionService.getActiveSessions(
        request.user.sub,
        request.user.sessionId,
        fastify.db
      );

      return reply.code(200).send({
        sessions: activeSessions,
      });
    }
  );

  // 2. DELETE /api/v1/devices/sessions/others (Must be declared before :sessionId to avoid route param collision)
  fastify.delete(
    '/api/v1/devices/sessions/others',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const revokedCount = await SessionService.revokeOtherSessions(
        request.user.sub,
        request.user.sessionId,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send({
        success: true,
        message: 'All other sessions revoked',
        revokedCount,
      });
    }
  );

  // 3. DELETE /api/v1/devices/sessions/:sessionId
  fastify.delete(
    '/api/v1/devices/sessions/:sessionId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };

      if (!sessionId) {
        return reply.code(400).send({
          type: 'https://api.smexstore.com/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Session ID is required',
          code: 'MISSING_SESSION_ID',
        });
      }

      await SessionService.revokeSession(
        request.user.sub,
        sessionId,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send({
        success: true,
        message: 'Session revoked successfully',
      });
    }
  );
};

export default devicesRoutes;
