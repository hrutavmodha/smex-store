import { type FastifyPluginAsync, type FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, inArray, desc, and } from 'drizzle-orm';
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
  tournamentMatches,
  tournamentIncidents,
} from '../db/schema/tournaments.js';
import { teams, teamMembers } from '../db/schema/teams.js';
import { users, profiles } from '../db/schema/users.js';
import { NotificationService } from '../services/notification.service.js';
import { formatRfc7807 } from '@smex/shared';
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
  status: z
    .enum(['upcoming', 'registration_open', 'ongoing', 'completed'])
    .default('upcoming'),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  maxTeams: z
    .number()
    .int()
    .min(2, 'Max teams must be at least 2')
    .max(128, 'Max teams cannot exceed 128')
    .default(16),
  rulesMarkdown: z.string().optional(),
  winnerName: z.string().trim().max(100).optional(),
  runnerUpName: z.string().trim().max(100).optional(),
  mvpName: z.string().trim().max(100).optional(),
});

const updateTournamentSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  gameSlug: z.string().trim().optional(),
  format: z.enum(['single_elimination', 'double_elimination', 'round_robin']).optional(),
  status: z.enum(['upcoming', 'registration_open', 'ongoing', 'completed']).optional(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  maxTeams: z.number().int().min(2).max(128).optional(),
  rulesMarkdown: z.string().optional(),
  winnerTeamId: z.string().uuid().optional(),
  winnerName: z.string().trim().max(100).optional(),
  runnerUpName: z.string().trim().max(100).optional(),
  mvpName: z.string().trim().max(100).optional(),
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

const createIncidentSchema = z.object({
  incidentType: z.enum([
    'suspected_cheat',
    'unauthorized_substitute',
    'toxic_behavior',
    'connection_manipulation',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  targetTeamId: z.string().uuid().optional().nullable(),
  targetPlayerIgn: z.string().max(50).optional().nullable(),
  evidenceUrl: z.string().url().optional().or(z.literal('')).nullable(),
});

const resolveIncidentSchema = z.object({
  status: z.enum(['under_review', 'resolved', 'dismissed']),
  resolutionNotes: z.string().min(5, 'Resolution notes must be at least 5 characters'),
});

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
          status: input.status,
          startTime: input.startTime ? new Date(input.startTime) : null,
          endTime: input.endTime ? new Date(input.endTime) : null,
          maxTeams: input.maxTeams,
          rulesMarkdown: input.rulesMarkdown ?? null,
          winnerName: input.winnerName ?? null,
          runnerUpName: input.runnerUpName ?? null,
          mvpName: input.mvpName ?? null,
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
            { winnerTeamId: input.winnerTeamId, winnerName: input.winnerName }
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
        if (input.startTime !== undefined) updateFields.startTime = input.startTime ? new Date(input.startTime) : null;
        if (input.endTime !== undefined) updateFields.endTime = input.endTime ? new Date(input.endTime) : null;
        if (input.maxTeams !== undefined) updateFields.maxTeams = input.maxTeams;
        if (input.rulesMarkdown !== undefined) updateFields.rulesMarkdown = input.rulesMarkdown;
        if (input.winnerTeamId !== undefined) updateFields.winnerTeamId = input.winnerTeamId;
        if (input.winnerName !== undefined) updateFields.winnerName = input.winnerName;
        if (input.runnerUpName !== undefined) updateFields.runnerUpName = input.runnerUpName;
        if (input.mvpName !== undefined) updateFields.mvpName = input.mvpName;

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

  // 4b. DELETE /api/v1/tournaments/:id - Admin deletes tournament
  fastify.delete(
    '/api/v1/tournaments/:id',
    {
      preHandler: [fastify.authenticate, fastify.adminGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [deleted] = await fastify.db
        .delete(tournaments)
        .where(eq(tournaments.id, id))
        .returning();

      if (!deleted) {
        return reply
          .code(404)
          .send(formatRfc7807(404, 'TOURNAMENT_NOT_FOUND', 'Not Found', 'Tournament not found'));
      }

      return reply.code(200).send({ message: 'Tournament deleted successfully', id: deleted.id });
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

        // Guard against bracket generation on invalid tournament state (Bug 6)
        if (tourney.status !== 'registration_open') {
          return reply.code(400).send(
            formatRfc7807(
              400,
              'INVALID_TOURNAMENT_STATE',
              'Bad Request',
              `Cannot generate brackets for tournament in '${tourney.status}' state. Status must be 'registration_open'.`
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

        // Generate bracket matches and transition status atomically in a transaction (Bug 24)
        const matches = await fastify.db.transaction(async (tx) => {
          const generatedMatches = await BracketGeneratorService.generateBracket(
            id,
            tourney.format,
            validParticipants,
            tx
          );

          await TournamentLifecycleService.transitionStatus(
            id,
            'ongoing',
            tx,
            fastify.redis
          );

          return generatedMatches;
        });

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

  // 9. POST /api/v1/tournaments/matches/:id/incidents - Manager or Admin flags a live match incident
  fastify.post(
    '/api/v1/tournaments/matches/:id/incidents',
    {
      preHandler: [fastify.authenticate, fastify.managerGuard],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = createIncidentSchema.safeParse(request.body);
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

      const [match] = await fastify.db
        .select()
        .from(tournamentMatches)
        .where(eq(tournamentMatches.id, id))
        .limit(1);

      if (!match) {
        return reply.code(404).send(
          formatRfc7807(404, 'MATCH_NOT_FOUND', 'Not Found', 'Tournament match not found')
        );
      }

      const input = parseResult.data;

      // 1. Insert incident into DB
      const [incident] = await fastify.db
        .insert(tournamentIncidents)
        .values({
          tournamentId: match.tournamentId,
          matchId: match.id,
          reportedBy: request.user.sub,
          targetTeamId: input.targetTeamId || null,
          targetPlayerIgn: input.targetPlayerIgn || null,
          incidentType: input.incidentType,
          severity: input.severity,
          description: input.description,
          evidenceUrl: input.evidenceUrl || null,
          status: 'flagged',
        })
        .returning();

      // 2. Fetch reporter IGN
      let reportedByIgn = 'Staff Manager';
      const [reporterProfile] = await fastify.db
        .select({ username: profiles.username })
        .from(profiles)
        .where(eq(profiles.userId, request.user.sub))
        .limit(1);
      if (reporterProfile?.username) {
        reportedByIgn = reporterProfile.username;
      }

      // 3. Fetch target team name if provided
      let targetTeamName: string | undefined;
      if (input.targetTeamId) {
        const [targetTeam] = await fastify.db
          .select({ name: teams.name })
          .from(teams)
          .where(eq(teams.id, input.targetTeamId))
          .limit(1);
        if (targetTeam?.name) {
          targetTeamName = targetTeam.name;
        }
      }

      // 4. Determine alert recipients: Clan Leader(s) of teamA / teamB + active Admins
      const clanLeaderIds = new Set<string>();
      if (match.teamAId || match.teamBId) {
        const teamIds = [match.teamAId, match.teamBId].filter(Boolean) as string[];
        const teamRows = await fastify.db
          .select({ captainId: teams.captainId })
          .from(teams)
          .where(inArray(teams.id, teamIds));
        for (const t of teamRows) {
          if (t.captainId) clanLeaderIds.add(t.captainId);
        }
      }

      const adminRows = await fastify.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isBanned, false)));

      const adminIds = adminRows.map((a) => a.id);
      const recipientIds = Array.from(new Set([...Array.from(clanLeaderIds), ...adminIds]));

      // 5. Construct real-time WebSocket frame
      const nowIso = new Date().toISOString();
      const wsFrame = {
        event: 'TOURNAMENT_INCIDENT_FLAGGED',
        payload: {
          incidentId: incident.id,
          tournamentId: incident.tournamentId,
          matchId: incident.matchId,
          reportedByIgn,
          targetTeamName: targetTeamName || 'Match Participant',
          incidentType: incident.incidentType,
          severity: incident.severity,
          summary: incident.description.slice(0, 100),
          timestamp: nowIso,
        },
      };

      const notifTitle = `🚨 Match Incident Flagged`;
      const notifMessage = `Manager ${reportedByIgn} flagged an incident (${incident.incidentType}, ${incident.severity}) in Match #${incident.matchId.slice(0, 8)}.`;

      for (const recipientId of recipientIds) {
        const channel = `user:${recipientId}`;
        if (fastify.redis) {
          await fastify.redis.publish(channel, JSON.stringify(wsFrame)).catch(() => {});
        } else if (fastify.wsGateway) {
          fastify.wsGateway.broadcastToChannel(channel, wsFrame);
        }

        try {
          await NotificationService.dispatchNotification(
            recipientId,
            'update',
            notifTitle,
            notifMessage,
            {
              actionUrl: `/tournaments/${incident.tournamentId}`,
              entityType: 'tournament_incident',
              entityId: incident.id,
              metadata: {
                ...wsFrame.payload,
                event: 'TOURNAMENT_INCIDENT_FLAGGED',
              },
            },
            fastify.db,
            fastify.redis,
            fastify.wsGateway
          );
        } catch {
          // Non-blocking notification dispatch
        }
      }

      return reply.code(201).send({ incident });
    }
  );

  // 10. GET /api/v1/tournaments/matches/:id/incidents - Fetch incidents for a match
  fastify.get(
    '/api/v1/tournaments/matches/:id/incidents',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const [match] = await fastify.db
        .select()
        .from(tournamentMatches)
        .where(eq(tournamentMatches.id, id))
        .limit(1);

      if (!match) {
        return reply.code(404).send(
          formatRfc7807(404, 'MATCH_NOT_FOUND', 'Not Found', 'Tournament match not found')
        );
      }

      // Authorization check: Admin, Manager, or Clan Leader of competing teams
      const userRole = request.user.role;
      let isAuthorized = userRole === 'admin' || userRole === 'manager';

      if (!isAuthorized && (match.teamAId || match.teamBId)) {
        const teamIds = [match.teamAId, match.teamBId].filter(Boolean) as string[];
        const teamRows = await fastify.db
          .select({ captainId: teams.captainId })
          .from(teams)
          .where(inArray(teams.id, teamIds));
        if (teamRows.some((t) => t.captainId === request.user.sub)) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return reply.code(403).send(
          formatRfc7807(
            403,
            'INSUFFICIENT_PERMISSIONS',
            'Forbidden',
            'You do not have permission to view incidents for this match'
          )
        );
      }

      const incidents = await fastify.db
        .select()
        .from(tournamentIncidents)
        .where(eq(tournamentIncidents.matchId, id))
        .orderBy(desc(tournamentIncidents.createdAt));

      return reply.code(200).send({ incidents });
    }
  );

  // 11. PATCH /api/v1/tournaments/incidents/:id/resolve - Resolve or dismiss incident
  fastify.patch(
    '/api/v1/tournaments/incidents/:id/resolve',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = resolveIncidentSchema.safeParse(request.body);
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

      const [incident] = await fastify.db
        .select()
        .from(tournamentIncidents)
        .where(eq(tournamentIncidents.id, id))
        .limit(1);

      if (!incident) {
        return reply.code(404).send(
          formatRfc7807(404, 'INCIDENT_NOT_FOUND', 'Not Found', 'Tournament incident not found')
        );
      }

      // Check match and team captain authorization
      const [match] = await fastify.db
        .select()
        .from(tournamentMatches)
        .where(eq(tournamentMatches.id, incident.matchId))
        .limit(1);

      const userRole = request.user.role;
      let isAuthorized = userRole === 'admin';

      if (!isAuthorized && match && (match.teamAId || match.teamBId)) {
        const teamIds = [match.teamAId, match.teamBId].filter(Boolean) as string[];
        const teamRows = await fastify.db
          .select({ captainId: teams.captainId })
          .from(teams)
          .where(inArray(teams.id, teamIds));
        if (teamRows.some((t) => t.captainId === request.user.sub)) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return reply.code(403).send(
          formatRfc7807(
            403,
            'INSUFFICIENT_PERMISSIONS',
            'Forbidden',
            'Only Platform Admins or competing Clan Leaders can resolve match incidents'
          )
        );
      }

      const input = parseResult.data;
      const now = new Date();

      const [updated] = await fastify.db
        .update(tournamentIncidents)
        .set({
          status: input.status,
          resolutionNotes: input.resolutionNotes,
          resolvedBy: request.user.sub,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(tournamentIncidents.id, id))
        .returning();

      return reply.code(200).send({ incident: updated });
    }
  );
};

export default tournamentsRoutes;
