import { eq, sql, and } from 'drizzle-orm';
import { type SmexDatabase } from '../db/index.js';
import {
  tournamentMatches,
  tournaments,
  type TournamentMatch,
} from '../db/schema/tournaments.js';
import { type Redis } from 'ioredis';

export interface UpdateMatchScoreInput {
  teamAScore: number;
  teamBScore: number;
  winnerId: string;
}

export class MatchError extends Error {
  code: string;
  statusCode: number;

  constructor(
    code: string,
    statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'MatchError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class MatchService {
  /**
   * Concurrency-safe match score reporting, winner declaration, and automatic bracket advancement.
   * Employs strict SELECT ... FOR UPDATE row locks to serialize concurrent mutations.
   */
  static async updateMatchScore(
    tournamentId: string,
    matchId: string,
    input: UpdateMatchScoreInput,
    db: SmexDatabase,
    redis?: Redis
  ): Promise<{
    match: TournamentMatch;
    nextMatchId: string | null;
    isChampionshipMatch: boolean;
  }> {
    return await db.transaction(async (tx) => {
      // 1. Concurrency row lock: SELECT FOR UPDATE
      const [lockedMatch] = await tx
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.id, matchId),
            eq(tournamentMatches.tournamentId, tournamentId)
          )
        )
        .for('update')
        .limit(1);

      if (!lockedMatch) {
        throw new MatchError('MATCH_NOT_FOUND', 404, 'Tournament match not found');
      }

      // Invariant: Winner must belong to this match
      if (
        input.winnerId !== lockedMatch.teamAId &&
        input.winnerId !== lockedMatch.teamBId
      ) {
        throw new MatchError(
          'INVALID_WINNER',
          422,
          'Winner must be one of the participating squads in this match'
        );
      }

      // 2. Update current match node
      const [updatedMatch] = await tx
        .update(tournamentMatches)
        .set({
          teamAScore: input.teamAScore,
          teamBScore: input.teamBScore,
          winnerId: input.winnerId,
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatches.id, matchId))
        .returning();

      // 3. Check for next round match advancement
      let nextMatchId: string | null = null;
      let isChampionshipMatch = false;

      const nextRound = lockedMatch.roundNumber + 1;
      const nextMatchOrder = Math.ceil(lockedMatch.matchOrder / 2);
      const isTeamASlot = lockedMatch.matchOrder % 2 === 1;

      // Locate subsequent round match node
      const [nextMatch] = await tx
        .select()
        .from(tournamentMatches)
        .where(
          and(
            eq(tournamentMatches.tournamentId, tournamentId),
            eq(tournamentMatches.roundNumber, nextRound),
            eq(tournamentMatches.matchOrder, nextMatchOrder),
            eq(tournamentMatches.bracketType, lockedMatch.bracketType)
          )
        )
        .for('update')
        .limit(1);

      if (nextMatch) {
        nextMatchId = nextMatch.id;
        const updatePayload = isTeamASlot
          ? { teamAId: input.winnerId, updatedAt: new Date() }
          : { teamBId: input.winnerId, updatedAt: new Date() };

        await tx
          .update(tournamentMatches)
          .set(updatePayload)
          .where(eq(tournamentMatches.id, nextMatch.id));
      } else {
        // No subsequent match node exists: check if this is the championship final match
        const [higherRoundMatch] = await tx
          .select({ id: tournamentMatches.id })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, tournamentId),
              sql`${tournamentMatches.roundNumber} > ${lockedMatch.roundNumber}`
            )
          )
          .limit(1);

        if (!higherRoundMatch) {
          // Final Championship Match concludes: crown champion and transition tournament to completed
          isChampionshipMatch = true;

          const [tournamentRecord] = await tx
            .select()
            .from(tournaments)
            .where(eq(tournaments.id, tournamentId))
            .for('update')
            .limit(1);

          const previousStatus = tournamentRecord?.status ?? 'ongoing';

          await tx
            .update(tournaments)
            .set({
              winnerTeamId: input.winnerId,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(tournaments.id, tournamentId));

          // Broadcast tournament:state completion event
          if (redis) {
            const stateEnvelope = {
              event: 'tournament:state',
              channel: `tournament:${tournamentId}`,
              timestamp: Date.now(),
              payload: {
                tournamentId,
                previousStatus,
                newStatus: 'completed',
              },
            };
            try {
              await redis.publish(
                `tournament:${tournamentId}`,
                JSON.stringify(stateEnvelope)
              );
            } catch (err) {
              console.error('Failed to publish tournament:state completion event:', err);
            }
          }
        }
      }

      // 4. Broadcast live bracket:update event
      if (redis) {
        const bracketEnvelope = {
          event: 'bracket:update',
          channel: `tournament:${tournamentId}`,
          timestamp: Date.now(),
          payload: {
            matchId: updatedMatch.id,
            roundNumber: updatedMatch.roundNumber,
            matchOrder: updatedMatch.matchOrder,
            teamAScore: updatedMatch.teamAScore,
            teamBScore: updatedMatch.teamBScore,
            winnerId: updatedMatch.winnerId,
            status: updatedMatch.status,
            nextMatchId,
          },
        };

        try {
          await redis.publish(
            `tournament:${tournamentId}`,
            JSON.stringify(bracketEnvelope)
          );
        } catch (err) {
          console.error('Failed to publish bracket:update event to Redis:', err);
        }
      }

      return {
        match: updatedMatch,
        nextMatchId,
        isChampionshipMatch,
      };
    });
  }
}
