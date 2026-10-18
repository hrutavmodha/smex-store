import { type FastifyPluginAsync, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  TournamentLifecycleService,
  TournamentLifecycleError,
} from '../services/tournament-lifecycle.service.js';
import { TournamentParticipantService } from '../services/tournament-participant.service.js';
import { BracketGeneratorService } from '../services/bracket-generator.service.js';
import { MatchService, MatchError } from '../services/match.service.js';
import {
  tournaments,
  tournamentParticipants,
} from '../db/schema/tournaments.js';
import { teams, teamMembers } from '../db/schema/teams.js';
import { NotificationService } from '../services/notification.service.js';
import { formatRfc7807 } from '../utils/errors.js';
import type { SmexDatabase } from '../db/index.js';

async function getTournamentParticipantUserIds(tournamentId: string, db: SmexDatabase): Promise<string[]> {
  const memberRows = await db
    .select({ userId: teamMembers.userId })
    .from(tournamentParticipants)
    .innerJoin(teamMembers, eq(tournamentParticipants.teamId, teamMembers.teamId))
    .where(eq(tournamentParticipants.tournamentId, tournamentId));

  const captainRows = await db
    .select({ captainId: teams.captainId })
    .from(tournamentParticipants)
    .innerJoin(teams, eq(tournamentParticipants.teamId, teams.id))
    .where(eq(tournamentParticipants.tournamentId, tournamentId));

  const userIds = new Set<string>();
  for (const r of memberRows) {
    if (r.userId) userIds.add(r.userId);
  }
  for (const r of captainRows) {
    if (r.captainId) userIds.add(r.captainId);
  }
  return Array.from(userIds);
}

const createTournamentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  gameSlug: z.string().trim().default('mlbb'),
  format: z
    .enum(['single_elimination', 'double_elimination', 'round_robin'])
    .default('single_elimination'),
  startTime: z.string().datetime({ message: 'Invalid start time ISO format' }),
  endTime: z.string().datetime({ message: 'Invalid end time ISO format' }).optional(),
  prizePoolInr: z.string().or(z.number()).default('0.00'),
  maxTeams: z
    .number()
    .int()
    .min(2, 'Max teams must be at least 2')
    .max(128, 'Max teams cannot exceed 128')
    .default(16),
  rulesMarkdown: z.string().optional(),
});

const updateTournamentSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  gameSlug: z.string().trim().optional(),
  format: z.enum(['single_elimination', 'double_elimination', 'round_robin']).optional(),
  status: z.enum(['upcoming', 'registration_open', 'ongoing', 'completed']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  prizePoolInr: z.string().or(z.number()).optional(),
  maxTeams: z.number().int().min(2).max(128).optional(),
  rulesMarkdown: z.string().optional(),
  winnerTeamId: z.string().uuid().optional(),
});

const registerSquadSchema = z.object({
  teamId: z.string().uuid('Invalid team ID format'),
});

const updateMatchScoreSchema = z.object({
  teamAScore: z.number().int().min(0, 'Score cannot be negative'),
  teamBScore: z.number().int().min(0, 'Score cannot be negative'),
  winnerId: z.string().uuid('Invalid winner team ID format'),
});

interface TournamentRouteError {
  code?: string;
  statusCode?: number;
  message?: string;
  cause?: { code?: string };
}

function handleError(reply: FastifyReply, err: unknown) {
  if (err instanceof TournamentLifecycleError || err instanceof MatchError) {
    return reply
      .code(err.statusCode)
      .send(formatRfc7807(err.statusCode, err.code, err.name, err.message));
  }

  const errorObj = err as TournamentRouteError;
  const code = errorObj?.code || errorObj?.cause?.code;
  if (code === '23505' || code === 'DUPLICATE_REGISTRATION') {
    return reply
      .code(409)
      .send(
        formatRfc7807(
          409,
          'DUPLICATE_REGISTRATION',
          'Conflict',
          'This squad is already registered in this tournament'
        )
      );
  }

  const statusCode = errorObj?.statusCode || 500;
  const errCode = errorObj?.code || 'INTERNAL_ERROR';
  const detail = errorObj?.message || 'An unexpected error occurred';

  if (statusCode < 500) {
    return reply.code(statusCode).send(formatRfc7807(statusCode, errCode, 'Error', detail));
  }

  throw err;
}

const tournamentsRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/tournaments - Public tournament catalog with filters
  fastify.get('/api/v1/tournaments', async (request, reply) => {
    const query = request.query as {
      status?: string;
      gameSlug?: string;
      limit?: string;
      offset?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const result = await TournamentLifecycleService.listTournaments(
      {
        status: query.status,
        gameSlug: query.gameSlug,
        limit,
        offset,
      },
      fastify.db
    );

    return reply.code(200).send(result);
  });

  // 2. POST /api/v1/tournaments - Admin creates tournament
  fastify.post(
    '/api/v1/tournaments',
    {
      preHandler: [fastify.authenticate, fastify.adminGuard],
    },
    async (request, reply) => {
      const parseResult = createTournamentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .code(422)
          .send(
            formatRfc7807(
              422,
              'VALIDATION_FAILED',
              'Validation Failed',
              parseResult.error.issues.map((i) => i.message).join(', ')
            )
          );
      }

      const input = parseResult.data;
      const tournament = await TournamentLifecycleService.createTournament(
        {
          title: input.title,
          gameSlug: input.gameSlug,
          format: input.format,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : null,
          prizePoolInr: String(input.prizePoolInr),
          maxTeams: input.maxTeams,
          rulesMarkdown: input.rulesMarkdown ?? null,
        },
        fastify.db
      );

      return reply.code(201).send(tournament);
    }
  );

  // 3. GET /api/v1/tournaments/:id - Public tournament detail view
  fastify.get('/api/v1/tournaments/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tournament = await TournamentLifecycleService.getTournamentById(id, fastify.db);

    if (!tournament) {
      return reply
        .code(404)
        .send(
          formatRfc7807(
            404,
            'TOURNAMENT_NOT_FOUND',
            'Not Found',
            'Tournament not found'
          )
        );
    }

    return reply.code(200).send(tournament);
  });

  // 4. PATCH /api/v1/tournaments/:id - Admin updates details or lifecycle status
  fastify.patch(
    '/api/v1/tournaments/:id',
    {
      preHandler: [fastify.authenticate, fastify.adminGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateTournamentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .code(422)
          .send(
            formatRfc7807(
              422,
              'VALIDATION_FAILED',
              'Validation Failed',
              parseResult.error.issues.map((i) => i.message).join(', ')
            )
          );
      }

      const input = parseResult.data;

      try {
        let current = await fastify.db
          .select()
          .from(tournaments)
          .where(eq(tournaments.id, id))
          .limit(1)
          .then((rows) => rows[0]);

        if (!current) {
          return reply
            .code(404)
            .send(
              formatRfc7807(
                404,
                'TOURNAMENT_NOT_FOUND',
                'Not Found',
                'Tournament not found'
              )
            );
        }

        // Handle status transition if requested
        if (input.status && input.status !== current.status) {
          const oldStatus = current.status;
          current = await TournamentLifecycleService.transitionStatus(
            id,
            input.status,
            fastify.db,
            fastify.redis,
            { winnerTeamId: input.winnerTeamId }
          );

          try {
            const participantUserIds = await getTournamentParticipantUserIds(id, fastify.db);
            await NotificationService.notifyTournamentScheduleAlert(
              participantUserIds,
              id,
              `Tournament '${current.title}' transitioned from '${oldStatus}' to '${input.status}'.`,
              fastify.db,
              fastify.redis,
              fastify.wsGateway
            );
          } catch {
            // Non-blocking notification dispatch
          }
        }

        // Handle field updates
        const updateFields: Partial<typeof tournaments.$inferInsert> = {};
        if (input.title !== undefined) updateFields.title = input.title;
        if (input.gameSlug !== undefined) updateFields.gameSlug = input.gameSlug;
        if (input.format !== undefined) updateFields.format = input.format;
        if (input.startTime !== undefined) updateFields.startTime = new Date(input.startTime);
        if (input.endTime !== undefined) updateFields.endTime = new Date(input.endTime);
        if (input.prizePoolInr !== undefined) updateFields.prizePoolInr = String(input.prizePoolInr);
        if (input.maxTeams !== undefined) updateFields.maxTeams = input.maxTeams;
        if (input.rulesMarkdown !== undefined) updateFields.rulesMarkdown = input.rulesMarkdown;
        if (input.winnerTeamId !== undefined) updateFields.winnerTeamId = input.winnerTeamId;

        if (Object.keys(updateFields).length > 0) {
          updateFields.updatedAt = new Date();
          const [updated] = await fastify.db
            .update(tournaments)
            .set(updateFields)
            .where(eq(tournaments.id, id))
            .returning();
          current = updated;
        }

        return reply.code(200).send(current);
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );

  // 5. POST /api/v1/tournaments/:id/register - Captain registers squad into open tournament
  fastify.post(
    '/api/v1/tournaments/:id/register',
    {
      preHandler: [fastify.authenticate, fastify.emailVerifiedGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = registerSquadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply
          .code(422)
          .send(
            formatRfc7807(
              422,
              'VALIDATION_FAILED',
              'Validation Failed',
              parseResult.error.issues.map((i) => i.message).join(', ')
            )
          );
      }

      const { teamId } = parseResult.data;
      const userId = request.user.sub;

      try {
        const participant = await TournamentParticipantService.registerSquad(
          id,
          teamId,
          userId,
          request.user.role,
          fastify.db
        );

        return reply.code(201).send(participant);
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );

  // 6. DELETE /api/v1/tournaments/:id/participants/:teamId - Withdraw squad prior to bracket generation
  fastify.delete(
    '/api/v1/tournaments/:id/participants/:teamId',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id, teamId } = request.params as { id: string; teamId: string };
      const userId = request.user.sub;

      try {
        await TournamentParticipantService.withdrawSquad(
          id,
          teamId,
          userId,
          request.user.role,
          fastify.db
        );

        return reply.code(200).send({ message: 'Squad successfully withdrawn from tournament' });
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );

  // 7. POST /api/v1/tournaments/:id/bracket/generate - Admin generates bracket and launches tournament
  fastify.post(
    '/api/v1/tournaments/:id/bracket/generate',
    {
      preHandler: [fastify.authenticate, fastify.adminGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const [tourney] = await fastify.db
          .select()
          .from(tournaments)
          .where(eq(tournaments.id, id))
          .limit(1);

        if (!tourney) {
          return reply
            .code(404)
            .send(formatRfc7807(404, 'TOURNAMENT_NOT_FOUND', 'Not Found', 'Tournament not found'));
        }

        // BUG-M5-006: Guard against bracket generation on ongoing or completed tournaments
        if (tourney.status !== 'registration_open' && tourney.status !== 'upcoming') {
          return reply.code(400).send(
            formatRfc7807(
              400,
              'INVALID_TOURNAMENT_STATE',
              'Bad Request',
              `Cannot generate brackets for tournament in '${tourney.status}' state`
            )
          );
        }

        // Fetch participants
        const participants = await fastify.db
          .select({
            teamId: tournamentParticipants.teamId,
            seed: tournamentParticipants.seed,
          })
          .from(tournamentParticipants)
          .where(eq(tournamentParticipants.tournamentId, id))
          .orderBy(tournamentParticipants.seed, tournamentParticipants.registeredAt);

        if (participants.length < 2) {
          return reply
            .code(422)
            .send(
              formatRfc7807(
                422,
                'INSUFFICIENT_TEAMS_FOR_TOURNAMENT',
                'Unprocessable Entity',
                'A minimum of 2 registered teams is required to generate brackets'
              )
            );
        }

        // BUG-M5-003: Contiguous seed mapping
        const validParticipants = participants.map((p, idx) => ({
          teamId: p.teamId,
          seed: idx + 1,
        }));

        // Generate bracket matches
        const matches = await BracketGeneratorService.generateBracket(
          id,
          tourney.format,
          validParticipants,
          fastify.db
        );

        // Transition tournament status to ongoing if it was registration_open
        if (tourney.status === 'registration_open') {
          await TournamentLifecycleService.transitionStatus(
            id,
            'ongoing',
            fastify.db,
            fastify.redis
          );
        }

        return reply.code(200).send({
          tournamentId: id,
          format: tourney.format,
          matchesCount: matches.length,
          matches,
        });
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );

  // 8. PATCH /api/v1/tournaments/:id/matches/:matchId - Admin updates match score and advances winner
  fastify.patch(
    '/api/v1/tournaments/:id/matches/:matchId',
    {
      preHandler: [fastify.authenticate, fastify.adminGuard],
    },
    async (request, reply) => {
      const { id, matchId } = request.params as { id: string; matchId: string };
      const parseResult = updateMatchScoreSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply
          .code(422)
          .send(
            formatRfc7807(
              422,
              'VALIDATION_FAILED',
              'Validation Failed',
              parseResult.error.issues.map((i) => i.message).join(', ')
            )
          );
      }

      const input = parseResult.data;

      try {
        const result = await MatchService.updateMatchScore(
          id,
          matchId,
          input,
          fastify.db,
          fastify.redis
        );

        try {
          const participantUserIds = await getTournamentParticipantUserIds(id, fastify.db);
          await NotificationService.notifyTournamentScheduleAlert(
            participantUserIds,
            id,
            `Match result updated for Round ${result.match.roundNumber}: winner declared.`,
            fastify.db,
            fastify.redis,
            fastify.wsGateway
          );
        } catch {
          // Non-blocking notification dispatch
        }

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );
};

export default tournamentsRoutes;
