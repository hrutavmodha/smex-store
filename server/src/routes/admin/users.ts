import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  UserModerationService,
  UserModerationError,
} from '../../services/user-moderation.service.js';
import { formatRfc7807, type UserRole } from '@smex/shared';

const banUserSchema = z.object({
  reason: z.string().min(1, 'Ban reason is required'),
});

const updateRoleSchema = z.object({
  role: z.enum(['user', 'manager', 'admin']),
});

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * GET /api/v1/admin/users
   * Paginated directory of registered users with role and ban filters
   */
  fastify.get('/api/v1/admin/users', async (request, reply) => {
    const query = request.query as {
      role?: UserRole;
      isBanned?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const isBanned =
      query.isBanned !== undefined
        ? query.isBanned === 'true' || query.isBanned === '1'
        : undefined;

    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const result = await UserModerationService.getUsers(
      {
        role: query.role,
        isBanned,
        search: query.search,
        page,
        limit,
      },
      fastify.db
    );

    return reply.code(200).send(result);
  });

  /**
   * POST /api/v1/admin/users/:id/ban
   * Suspends a user account, revokes sessions, dispatches real-time session:revoked frame
   */
  fastify.post('/api/v1/admin/users/:id/ban', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = banUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(422).send(
        formatRfc7807(
          422,
          'VALIDATION_FAILED',
          'Validation Failed',
          parseResult.error.issues.map((i) => i.message).join(', ')
        )
      );
    }

    try {
      const result = await UserModerationService.banUser(
        id,
        parseResult.data.reason,
        request.user.sub,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof UserModerationError) {
        return reply.code(err.statusCode).send(
          formatRfc7807(err.statusCode, err.code, 'Moderation Error', err.message)
        );
      }
      throw err;
    }
  });

  /**
   * POST /api/v1/admin/users/:id/unban
   * Restores a banned user account and removes Redis ban tombstone
   */
  fastify.post('/api/v1/admin/users/:id/unban', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const result = await UserModerationService.unbanUser(
        id,
        request.user.sub,
        fastify.db,
        fastify.redis
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof UserModerationError) {
        return reply.code(err.statusCode).send(
          formatRfc7807(err.statusCode, err.code, 'Moderation Error', err.message)
        );
      }
      throw err;
    }
  });

  /**
   * PATCH /api/v1/admin/users/:id/role
   * Updates a user's role (promote to manager, demote to user, etc.)
   */
  fastify.patch('/api/v1/admin/users/:id/role', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(422).send(
        formatRfc7807(
          422,
          'VALIDATION_FAILED',
          'Validation Failed',
          parseResult.error.issues.map((i) => i.message).join(', ')
        )
      );
    }

    try {
      const result = await UserModerationService.updateUserRole(
        id,
        parseResult.data.role,
        request.user.sub,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof UserModerationError) {
        return reply.code(err.statusCode).send(
          formatRfc7807(err.statusCode, err.code, 'Moderation Error', err.message)
        );
      }
      throw err;
    }
  });
};

export default adminUsersRoutes;
