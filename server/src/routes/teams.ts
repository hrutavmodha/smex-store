import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TeamService } from '../services/team.service.js';
import { TeamJoinService } from '../services/team-join.service.js';
import { type AccessTokenPayload } from '../plugins/auth.js';

const createTeamSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name cannot exceed 50 characters'),
  tag: z.string().trim().min(2, 'Tag must be at least 2 characters').max(10, 'Tag cannot exceed 10 characters'),
  memberCap: z.number().int().optional(),
  gameSlug: z.string().trim().max(50).optional(),
  description: z.string().trim().max(1000).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  tag: z.string().trim().min(2).max(10).optional(),
  memberCap: z.number().int().optional(),
  status: z.enum(['open', 'closed']).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const STANDARDIZED_ROLES = ['Roam', 'Hyper', 'Exp', 'Gold', 'Mid'] as const;
export type StandardizedRole = (typeof STANDARDIZED_ROLES)[number];

const joinRequestSchema = z.object({
  playerIgn: z.string().trim().min(1, 'In-game name is required').max(50),
  playerRole: z.enum(STANDARDIZED_ROLES),
  message: z.string().trim().max(500).optional(),
});

const resolveJoinRequestSchema = z.object({
  action: z.enum(['accept', 'reject']),
});

const transferCaptaincySchema = z.object({
  newCaptainId: z.string().uuid('Invalid new captain user ID'),
});

function formatRfc7807(statusCode: number, code: string, title: string, detail: string) {
  return {
    type: `https://api.smexstore.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status: statusCode,
    detail,
    code,
  };
}

function handleError(reply: any, err: any) {
  const code = err.code || err.cause?.code;
  if (code === '23505' || code === 'DUPLICATE_TEAM_NAME') {
    return reply.code(409).send(
      formatRfc7807(409, 'DUPLICATE_TEAM_NAME', 'Conflict', 'A squad with this name already exists')
    );
  }
  if (code === 'DUPLICATE_PENDING_REQUEST') {
    return reply.code(409).send(
      formatRfc7807(409, 'DUPLICATE_PENDING_REQUEST', 'Conflict', 'You already have a pending join request for this squad')
    );
  }
  if (code === '23514' || code === 'INVALID_MEMBER_CAP') {
    return reply.code(422).send(
      formatRfc7807(422, 'INVALID_MEMBER_CAP', 'Unprocessable Entity', 'Member capacity must be between 1 and 10')
    );
  }
  if (code === 'CAPACITY_BELOW_MEMBER_COUNT') {
    return reply.code(400).send(
      formatRfc7807(400, 'CAPACITY_BELOW_MEMBER_COUNT', 'Bad Request', err.message || 'Cannot reduce member capacity below active member count')
    );
  }

  const statusCode = err.statusCode || err.cause?.statusCode;
  const errCode = err.code || err.cause?.code || 'ERROR';
  const detail = err.message || err.cause?.message || 'Error occurred';

  if (statusCode) {
    return reply.code(statusCode).send(formatRfc7807(statusCode, errCode, 'Error', detail));
  }

  throw err;
}

const teamsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/teams - List squads with open slots & filters
  fastify.get('/api/v1/teams', async (request, reply) => {
    const query = request.query as {
      q?: string;
      gameSlug?: string;
      status?: 'open' | 'closed' | 'all';
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await TeamService.listTeams(
      {
        q: query.q,
        gameSlug: query.gameSlug,
        status: query.status,
        limit,
        offset,
      },
      fastify.db
    );

    return reply.code(200).send(result);
  });

  // 2. POST /api/v1/teams - Create squad profile
  fastify.post(
    '/api/v1/teams',
    {
      preHandler: [fastify.authenticate, fastify.emailVerifiedGuard],
    },
    async (request, reply) => {
      const parseResult = createTeamSchema.safeParse(request.body);
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

      const input = parseResult.data;

      // Validate member capacity boundary
      if (input.memberCap !== undefined && (input.memberCap < 1 || input.memberCap > 10)) {
        return reply.code(422).send(
          formatRfc7807(
            422,
            'INVALID_MEMBER_CAP',
            'Unprocessable Entity',
            'Member capacity must be between 1 and 10'
          )
        );
      }

      try {
        const { team, captainMember } = await TeamService.createTeam(
          request.user.sub,
          input,
          fastify.db
        );

        return reply.code(201).send({
          team,
          captainMember,
        });
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 3. GET /api/v1/teams/:id - Detailed squad profile & active roster
  fastify.get('/api/v1/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    let callerId: string | undefined;
    try {
      const payload = await request.jwtVerify<AccessTokenPayload>();
      if (payload?.sub && payload?.sessionId) {
        const isRevoked = await fastify.redis.exists(`revoked_token:${payload.sessionId}`);
        if (!isRevoked) {
          callerId = payload.sub;
        }
      }
    } catch {
      // Unauthenticated / guest caller - proceed without callerId
    }

    const team = await TeamService.getTeamById(id, fastify.db, callerId);
    if (!team) {
      return reply.code(404).send(
        formatRfc7807(404, 'TEAM_NOT_FOUND', 'Not Found', 'Squad not found')
      );
    }

    return reply.code(200).send({ team });
  });

  // 4. PATCH /api/v1/teams/:id - Update squad metadata (Captain only)
  fastify.patch(
    '/api/v1/teams/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateTeamSchema.safeParse(request.body);
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

      const input = parseResult.data;

      if (input.memberCap !== undefined && (input.memberCap < 1 || input.memberCap > 10)) {
        return reply.code(422).send(
          formatRfc7807(
            422,
            'INVALID_MEMBER_CAP',
            'Unprocessable Entity',
            'Member capacity must be between 1 and 10'
          )
        );
      }

      try {
        const updated = await TeamService.updateTeam(id, request.user.sub, input, fastify.db);
        return reply.code(200).send({ team: updated });
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 5. DELETE /api/v1/teams/:id - Disband squad (Captain only)
  fastify.delete(
    '/api/v1/teams/:id',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const result = await TeamService.disbandTeam(id, request.user.sub, fastify.db);
        return reply.code(200).send(result);
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 6. POST /api/v1/teams/:id/join-requests - Submit join request
  fastify.post(
    '/api/v1/teams/:id/join-requests',
    {
      preHandler: [fastify.authenticate, fastify.emailVerifiedGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = joinRequestSchema.safeParse(request.body);
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
        const joinRequest = await TeamJoinService.submitJoinRequest(
          id,
          request.user.sub,
          parseResult.data,
          fastify.db,
          fastify.redis,
          fastify.wsGateway
        );

        return reply.code(201).send({ joinRequest });
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 7. GET /api/v1/teams/:id/join-requests - View join requests (Captain only)
  fastify.get(
    '/api/v1/teams/:id/join-requests',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const requests = await TeamJoinService.listJoinRequests(id, request.user.sub, fastify.db);
        return reply.code(200).send({ requests });
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 7b. GET /api/v1/teams/:id/my-request - View caller's own join request (Applicant)
  fastify.get(
    '/api/v1/teams/:id/my-request',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const myRequest = await TeamJoinService.getMyJoinRequest(id, request.user.sub, fastify.db);
        return reply.code(200).send({
          hasPendingRequest: !!myRequest,
          request: myRequest || null,
        });
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 8. PATCH /api/v1/teams/:id/join-requests/:requestId - Resolve join request (Captain only)
  fastify.patch(
    '/api/v1/teams/:id/join-requests/:requestId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id, requestId } = request.params as { id: string; requestId: string };
      const parseResult = resolveJoinRequestSchema.safeParse(request.body);
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
        const result = await TeamJoinService.resolveJoinRequest(
          id,
          requestId,
          request.user.sub,
          parseResult.data.action,
          fastify.db,
          fastify.redis,
          fastify.wsGateway
        );

        return reply.code(200).send(result);
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 9. DELETE /api/v1/teams/:id/join-requests/:requestId - Cancel pending join request (Applicant only)
  fastify.delete(
    '/api/v1/teams/:id/join-requests/:requestId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id, requestId } = request.params as { id: string; requestId: string };

      try {
        const result = await TeamJoinService.cancelJoinRequest(
          id,
          requestId,
          request.user.sub,
          fastify.db
        );
        return reply.code(200).send(result);
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 10. DELETE /api/v1/teams/:id/members/:userId - Remove member (Kick by captain / Voluntary leave)
  fastify.delete(
    '/api/v1/teams/:id/members/:userId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };

      try {
        const result = await TeamService.removeMember(id, userId, request.user.sub, fastify.db);
        return reply.code(200).send(result);
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );

  // 10. POST /api/v1/teams/:id/transfer-captaincy - Transfer captaincy (Captain only)
  fastify.post(
    '/api/v1/teams/:id/transfer-captaincy',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = transferCaptaincySchema.safeParse(request.body);
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
        const result = await TeamService.transferCaptaincy(
          id,
          request.user.sub,
          parseResult.data.newCaptainId,
          fastify.db
        );

        return reply.code(200).send(result);
      } catch (err: any) {
        return handleError(reply, err);
      }
    }
  );
};

export default teamsRoutes;
