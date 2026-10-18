import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  UserModerationService,
  UserModerationError,
} from '../../services/user-moderation.service.js';

const disbandTeamSchema = z.object({
  reason: z.string().optional(),
});

const adminTeamsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * POST /api/v1/admin/teams/:id/disband
   * Disbands a squad, purges upcoming tournament registrations, and alerts members
   */
  fastify.post('/api/v1/admin/teams/:id/disband', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = disbandTeamSchema.safeParse(request.body || {});
    const reason = parseResult.success && parseResult.data.reason ? parseResult.data.reason : 'Disbanded by platform administration';

    try {
      const result = await UserModerationService.disbandTeam(
        id,
        reason,
        request.user.sub,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof UserModerationError) {
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

export default adminTeamsRoutes;
