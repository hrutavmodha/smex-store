import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, sql, and } from 'drizzle-orm';
import {
  TournamentLifecycleService,
  TournamentLifecycleError,
} from '../services/tournament-lifecycle.service.js';
import { BracketGeneratorService } from '../services/bracket-generator.service.js';
import { MatchService, MatchError } from '../services/match.service.js';
import {
  tournaments,
  tournamentParticipants,
  tournamentMatches,
} from '../db/schema/tournaments.js';
import { teams } from '../db/schema/teams.js';

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
  if (err instanceof TournamentLifecycleError || err instanceof MatchError) {
    return reply
      .code(err.statusCode)
      .send(formatRfc7807(err.statusCode, err.code, err.name, err.message));
  }

  const code = err.code || err.cause?.code;
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

  const statusCode = err.statusCode || 500;
  const errCode = err.code || 'INTERNAL_ERROR';
  const detail = err.message || 'An unexpected error occurred';

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
          current = await TournamentLifecycleService.transitionStatus(
            id,
            input.status,
            fastify.db,
            fastify.redis,
            { winnerTeamId: input.winnerTeamId }
          );
        }

        // Handle field updates
        const updateFields: Record<string, any> = {};
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
        const participant = await fastify.db.transaction(async (tx) => {
          // Verify tournament exists and state is registration_open
          const [tourney] = await tx
            .select()
            .from(tournaments)
            .where(eq(tournaments.id, id))
            .for('update')
            .limit(1);

          if (!tourney) {
            throw new TournamentLifecycleError(
              'TOURNAMENT_NOT_FOUND',
              404,
              'Tournament not found'
            );
          }

          if (tourney.status !== 'registration_open') {
            throw new TournamentLifecycleError(
              'REGISTRATION_CLOSED',
              400,
              `Registrations are not open for this tournament (current status: ${tourney.status})`
            );
          }

          // Verify caller is captain of squad
          const [teamRecord] = await tx
            .select()
            .from(teams)
            .where(eq(teams.id, teamId))
            .limit(1);

          if (!teamRecord) {
            throw new TournamentLifecycleError('TEAM_NOT_FOUND', 404, 'Team not found');
          }

          if (teamRecord.captainId !== userId && request.user.role !== 'admin') {
            throw new TournamentLifecycleError(
              'CAPTAIN_PERMISSION_REQUIRED',
              403,
              'Only the squad captain may register the team for a tournament'
            );
          }

          // Check if already registered
          const [existingParticipant] = await tx
            .select()
            .from(tournamentParticipants)
            .where(
              and(
                eq(tournamentParticipants.tournamentId, id),
                eq(tournamentParticipants.teamId, teamId)
              )
            )
            .limit(1);

          if (existingParticipant) {
            throw new TournamentLifecycleError(
              'DUPLICATE_REGISTRATION',
              409,
              'This squad is already registered in this tournament'
            );
          }

          // Check capacity limit
          const [countRecord] = await tx
            .select({ count: sql<number>`CAST(count(*) AS integer)` })
            .from(tournamentParticipants)
            .where(eq(tournamentParticipants.tournamentId, id));

          const currentCount = countRecord?.count ?? 0;
          if (currentCount >= tourney.maxTeams) {
            throw new TournamentLifecycleError(
              'TOURNAMENT_FULL',
              422,
              'Tournament has reached maximum squad capacity'
            );
          }

          // Assign next seed
          const assignedSeed = currentCount + 1;

          const [inserted] = await tx
            .insert(tournamentParticipants)
            .values({
              tournamentId: id,
              teamId,
              seed: assignedSeed,
              registeredAt: new Date(),
            })
            .returning();

          return inserted;
        });

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

        if (tourney.status !== 'registration_open') {
          return reply
            .code(400)
            .send(
              formatRfc7807(
                400,
                'REGISTRATION_CLOSED',
                'Bad Request',
                'Squads can only be withdrawn while tournament is in registration_open state'
              )
            );
        }

        const [teamRecord] = await fastify.db
          .select()
          .from(teams)
          .where(eq(teams.id, teamId))
          .limit(1);

        if (!teamRecord) {
          return reply
            .code(404)
            .send(formatRfc7807(404, 'TEAM_NOT_FOUND', 'Not Found', 'Team not found'));
        }

        if (teamRecord.captainId !== userId && request.user.role !== 'admin') {
          return reply
            .code(403)
            .send(
              formatRfc7807(
                403,
                'FORBIDDEN',
                'Forbidden',
                'Only the squad captain or an administrator may withdraw this squad'
              )
            );
        }

        await fastify.db.transaction(async (tx) => {
          const [participant] = await tx
            .select()
            .from(tournamentParticipants)
            .where(
              and(
                eq(tournamentParticipants.tournamentId, id),
                eq(tournamentParticipants.teamId, teamId)
              )
            )
            .limit(1);

          if (!participant) {
            throw new TournamentLifecycleError(
              'PARTICIPANT_NOT_FOUND',
              404,
              'Squad is not registered in this tournament'
            );
          }

          await tx
            .delete(tournamentParticipants)
            .where(
              and(
                eq(tournamentParticipants.tournamentId, id),
                eq(tournamentParticipants.teamId, teamId)
              )
            );

          // BUG-M5-003: Re-compact seeds of remaining participants sequentially
          const remaining = await tx
            .select()
            .from(tournamentParticipants)
            .where(eq(tournamentParticipants.tournamentId, id))
            .orderBy(tournamentParticipants.seed, tournamentParticipants.registeredAt);

          for (let i = 0; i < remaining.length; i++) {
            const newSeed = i + 1;
            if (remaining[i].seed !== newSeed) {
              await tx
                .update(tournamentParticipants)
                .set({ seed: newSeed })
                .where(
                  and(
                    eq(tournamentParticipants.tournamentId, id),
                    eq(tournamentParticipants.teamId, remaining[i].teamId)
                  )
                );
            }
          }
        });

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

        return reply.code(200).send(result);
      } catch (err) {
        return handleError(reply, err);
      }
    }
  );
};

export default tournamentsRoutes;
