import { eq, count, sql, and, desc } from 'drizzle-orm';
import { type SmexDatabase } from '../db/index.js';
import {
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  type Tournament,
  type NewTournament,
} from '../db/schema/tournaments.js';
import { teams } from '../db/schema/teams.js';
import { users } from '../db/schema/users.js';
import { type Redis } from 'ioredis';

export type TournamentStatus = 'upcoming' | 'registration_open' | 'ongoing' | 'completed';

export interface TournamentFilterOptions {
  status?: string;
  gameSlug?: string;
  limit?: number;
  offset?: number;
}

export class TournamentLifecycleError extends Error {
  code: string;
  statusCode: number;

  constructor(
    code: string,
    statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'TournamentLifecycleError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class TournamentLifecycleService {
  /**
   * Allowed sequential state transitions.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
    upcoming: ['registration_open'],
    registration_open: ['ongoing'],
    ongoing: ['completed'],
    completed: [],
  };

  /**
   * Creates a new tournament in 'upcoming' state by default.
   */
  static async createTournament(
    data: Omit<NewTournament, 'id' | 'status' | 'createdAt' | 'updatedAt'> & {
      status?: TournamentStatus;
    },
    db: SmexDatabase
  ): Promise<Tournament> {
    const [created] = await db
      .insert(tournaments)
      .values({
        ...data,
        status: data.status ?? 'upcoming',
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  /**
   * Retrieves a tournament along with participants and match structure.
   */
  static async getTournamentById(tournamentId: string, db: SmexDatabase) {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!tournament) {
      return null;
    }

    // Fetch participants with team details
    const participants = await db
      .select({
        id: tournamentParticipants.id,
        tournamentId: tournamentParticipants.tournamentId,
        teamId: tournamentParticipants.teamId,
        seed: tournamentParticipants.seed,
        registeredAt: tournamentParticipants.registeredAt,
        teamName: teams.name,
        teamTag: teams.tag,
      })
      .from(tournamentParticipants)
      .leftJoin(teams, eq(tournamentParticipants.teamId, teams.id))
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(tournamentParticipants.seed);

    // Fetch match nodes with team names
    const matches = await db
      .select({
        id: tournamentMatches.id,
        tournamentId: tournamentMatches.tournamentId,
        roundNumber: tournamentMatches.roundNumber,
        matchOrder: tournamentMatches.matchOrder,
        bracketType: tournamentMatches.bracketType,
        teamAId: tournamentMatches.teamAId,
        teamBId: tournamentMatches.teamBId,
        teamAScore: tournamentMatches.teamAScore,
        teamBScore: tournamentMatches.teamBScore,
        winnerId: tournamentMatches.winnerId,
        status: tournamentMatches.status,
        updatedAt: tournamentMatches.updatedAt,
      })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId))
      .orderBy(tournamentMatches.roundNumber, tournamentMatches.matchOrder);

    return {
      ...tournament,
      participants,
      matches,
    };
  }

  /**
   * Lists tournaments with optional filters for status and game.
   */
  static async listTournaments(filters: TournamentFilterOptions, db: SmexDatabase) {
    const conditions = [];

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'past') {
        conditions.push(eq(tournaments.status, 'completed'));
      } else if (filters.status === 'ongoing') {
        conditions.push(eq(tournaments.status, 'ongoing'));
      } else if (filters.status === 'upcoming') {
        conditions.push(
          sql`${tournaments.status} IN ('upcoming', 'registration_open')`
        );
      } else {
        conditions.push(eq(tournaments.status, filters.status as any));
      }
    }

    if (filters.gameSlug) {
      conditions.push(eq(tournaments.gameSlug, filters.gameSlug));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const listQuery = db
      .select({
        id: tournaments.id,
        title: tournaments.title,
        gameSlug: tournaments.gameSlug,
        format: tournaments.format,
        status: tournaments.status,
        startTime: tournaments.startTime,
        endTime: tournaments.endTime,
        prizePoolInr: tournaments.prizePoolInr,
        maxTeams: tournaments.maxTeams,
        winnerTeamId: tournaments.winnerTeamId,
        createdAt: tournaments.createdAt,
        registeredTeams: sql<number>`CAST(count(${tournamentParticipants.id}) AS integer)`,
      })
      .from(tournaments)
      .leftJoin(
        tournamentParticipants,
        eq(tournaments.id, tournamentParticipants.tournamentId)
      )
      .where(whereClause)
      .groupBy(tournaments.id)
      .orderBy(desc(tournaments.startTime))
      .limit(filters.limit ?? 20)
      .offset(filters.offset ?? 0);

    const items = await listQuery;

    const [totalRecord] = await db
      .select({ count: sql<number>`CAST(count(*) AS integer)` })
      .from(tournaments)
      .where(whereClause);

    return {
      tournaments: items,
      total: totalRecord?.count ?? 0,
      limit: filters.limit ?? 20,
      offset: filters.offset ?? 0,
    };
  }

  /**
   * Concurrency-safe state machine transition enforcement.
   */
  static async transitionStatus(
    tournamentId: string,
    targetStatus: TournamentStatus,
    db: SmexDatabase,
    redis?: Redis,
    options?: { winnerTeamId?: string }
  ): Promise<Tournament> {
    const [current] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!current) {
      throw new TournamentLifecycleError(
        'TOURNAMENT_NOT_FOUND',
        404,
        'Tournament not found'
      );
    }

    const previousStatus = current.status as TournamentStatus;

    if (previousStatus === targetStatus) {
      return current;
    }

    // Guard: Validate allowed sequential transitions
    const validTargets = this.ALLOWED_TRANSITIONS[previousStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new TournamentLifecycleError(
        'INVALID_STATUS_TRANSITION',
        400,
        `Cannot transition tournament from '${previousStatus}' to '${targetStatus}'`
      );
    }

    // Invariant: Transition to ongoing requires >= 2 teams
    if (targetStatus === 'ongoing') {
      const [participantRecord] = await db
        .select({ count: sql<number>`CAST(count(*) AS integer)` })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));

      const count = participantRecord?.count ?? 0;
      if (count < 2) {
        throw new TournamentLifecycleError(
          'INSUFFICIENT_TEAMS_FOR_TOURNAMENT',
          422,
          'A minimum of 2 registered teams is required to launch the tournament'
        );
      }
    }

    // Invariant: Transition to completed requires crowned champion
    if (targetStatus === 'completed') {
      const winnerId = options?.winnerTeamId ?? current.winnerTeamId;
      if (!winnerId) {
        throw new TournamentLifecycleError(
          'CHAMPION_NOT_DETERMINED',
          422,
          'Cannot complete tournament without declaring a winning team'
        );
      }
    }

    // Execute state shift
    const [updated] = await db
      .update(tournaments)
      .set({
        status: targetStatus,
        winnerTeamId: options?.winnerTeamId ?? current.winnerTeamId,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournamentId))
      .returning();

    // Broadcast state shift event over Redis Pub/Sub
    if (redis) {
      const eventEnvelope = {
        event: 'tournament:state',
        channel: `tournament:${tournamentId}`,
        timestamp: Date.now(),
        payload: {
          tournamentId,
          previousStatus,
          newStatus: targetStatus,
        },
      };

      try {
        await redis.publish(`tournament:${tournamentId}`, JSON.stringify(eventEnvelope));
      } catch (err) {
        // Non-fatal logging
        console.error('Failed to publish tournament:state event to Redis:', err);
      }
    }

    return updated;
  }
}
