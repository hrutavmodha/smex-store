import { type FastifyPluginAsync } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { SessionService } from '../services/session.service.js';
import { loginHistory } from '../db/schema/login-history.js';

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

      const revoked = await SessionService.revokeSession(
        request.user.sub,
        sessionId,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      if (!revoked) {
        return reply.code(404).send({
          type: 'https://api.smexstore.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Session not found or does not belong to the authenticated user',
          code: 'SESSION_NOT_FOUND',
        });
      }

      return reply.code(200).send({
        success: true,
        message: 'Session revoked successfully',
      });
    }
  );

  // 4. GET /api/v1/devices/history
  fastify.get(
    '/api/v1/devices/history',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const history = await fastify.db
        .select({
          id: loginHistory.id,
          ipAddress: loginHistory.ipAddress,
          userAgent: loginHistory.userAgent,
          deviceName: loginHistory.deviceName,
          status: loginHistory.status,
          createdAt: loginHistory.createdAt,
        })
        .from(loginHistory)
        .where(eq(loginHistory.userId, request.user.sub))
        .orderBy(desc(loginHistory.createdAt))
        .limit(50);

      return reply.code(200).send({
        history,
      });
    }
  );
};

export default devicesRoutes;
