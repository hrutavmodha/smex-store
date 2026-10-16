import { eq, sql, and, ne } from 'drizzle-orm';
import { type SmexDatabase } from '../db/index.js';
import {
  tournamentMatches,
  tournaments,
  tournamentParticipants,
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

      // Invariant 1: Prevent re-scoring already completed matches
      if (lockedMatch.status === 'completed') {
        throw new MatchError(
          'MATCH_ALREADY_COMPLETED',
          400,
          'Cannot record score on a match that is already completed'
        );
      }

      // Invariant 2: Cannot score uncontested matches where competitors are not yet determined
      if (!lockedMatch.teamAId || !lockedMatch.teamBId) {
        throw new MatchError(
          'UNCONTESTED_MATCH',
          400,
          'Cannot record score on an uncontested match until both competitors are populated'
        );
      }

      // Query tournament record to check format
      const [tournamentRecord] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .for('update')
        .limit(1);

      if (!tournamentRecord) {
        throw new MatchError('TOURNAMENT_NOT_FOUND', 404, 'Tournament not found');
      }

      // Invariant 3: Winner must belong to this match
      if (
        input.winnerId !== lockedMatch.teamAId &&
        input.winnerId !== lockedMatch.teamBId
      ) {
        throw new MatchError(
          'INVALID_WINNER',
          400,
          'Winner must be one of the participating squads in this match'
        );
      }

      // Invariant 4: Score parity - declared winner must have strictly higher score than loser
      if (
        input.winnerId === lockedMatch.teamAId &&
        input.teamAScore <= input.teamBScore
      ) {
        throw new MatchError(
          'INVALID_SCORE',
          400,
          'Winner score must be greater than loser score'
        );
      }

      if (
        input.winnerId === lockedMatch.teamBId &&
        input.teamBScore <= input.teamAScore
      ) {
        throw new MatchError(
          'INVALID_SCORE',
          400,
          'Winner score must be greater than loser score'
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

      const isRoundRobin =
        tournamentRecord.format === 'round_robin' ||
        lockedMatch.bracketType === 'round_robin';
      const isDoubleElim = tournamentRecord.format === 'double_elimination';

      if (isRoundRobin) {
        // Round Robin: pairings are pre-computed and static. No bracket tree advancement.
        // Check if all tournament matches have concluded (status === 'completed' or 'bye')
        const [incompleteMatch] = await tx
          .select({ id: tournamentMatches.id })
          .from(tournamentMatches)
          .where(
            and(
              eq(tournamentMatches.tournamentId, tournamentId),
              ne(tournamentMatches.status, 'completed'),
              ne(tournamentMatches.status, 'bye')
            )
          )
          .limit(1);

        if (!incompleteMatch) {
          // All matches concluded! Compute standings to crown legitimate champion.
          const allMatches = await tx
            .select()
            .from(tournamentMatches)
            .where(eq(tournamentMatches.tournamentId, tournamentId));

          const participants = await tx
            .select({ teamId: tournamentParticipants.teamId })
            .from(tournamentParticipants)
            .where(eq(tournamentParticipants.tournamentId, tournamentId));

          const standingsMap = new Map<
            string,
            {
              teamId: string;
              points: number;
              wins: number;
              scoreFor: number;
              scoreAgainst: number;
              scoreDiff: number;
            }
          >();

          participants.forEach((p) => {
            standingsMap.set(p.teamId, {
              teamId: p.teamId,
              points: 0,
              wins: 0,
              scoreFor: 0,
              scoreAgainst: 0,
              scoreDiff: 0,
            });
          });

          for (const m of allMatches) {
            if (m.teamAId && !standingsMap.has(m.teamAId)) {
              standingsMap.set(m.teamAId, {
                teamId: m.teamAId,
                points: 0,
                wins: 0,
                scoreFor: 0,
                scoreAgainst: 0,
                scoreDiff: 0,
              });
            }
            if (m.teamBId && !standingsMap.has(m.teamBId)) {
              standingsMap.set(m.teamBId, {
                teamId: m.teamBId,
                points: 0,
                wins: 0,
                scoreFor: 0,
                scoreAgainst: 0,
                scoreDiff: 0,
              });
            }

            if (m.status === 'bye') {
              if (m.winnerId && standingsMap.has(m.winnerId)) {
                const s = standingsMap.get(m.winnerId)!;
                s.points += 3;
                s.wins += 1;
              }
            } else if (m.status === 'completed' && m.teamAId && m.teamBId) {
              const standingA = standingsMap.get(m.teamAId);
              const standingB = standingsMap.get(m.teamBId);

              if (standingA) {
                standingA.scoreFor += m.teamAScore ?? 0;
                standingA.scoreAgainst += m.teamBScore ?? 0;
              }
              if (standingB) {
                standingB.scoreFor += m.teamBScore ?? 0;
                standingB.scoreAgainst += m.teamAScore ?? 0;
              }

              if (m.winnerId === m.teamAId) {
                if (standingA) {
                  standingA.points += 3;
                  standingA.wins += 1;
                }
              } else if (m.winnerId === m.teamBId) {
                if (standingB) {
                  standingB.points += 3;
                  standingB.wins += 1;
                }
              } else if (m.teamAScore === m.teamBScore) {
                if (standingA) standingA.points += 1;
                if (standingB) standingB.points += 1;
              }
            }
          }

          for (const s of standingsMap.values()) {
            s.scoreDiff = s.scoreFor - s.scoreAgainst;
          }

          const ranked = Array.from(standingsMap.values()).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
            if (b.scoreFor !== a.scoreFor) return b.scoreFor - a.scoreFor;
            return b.wins - a.wins;
          });

          if (ranked.length > 0) {
            const championTeamId = ranked[0].teamId;
            isChampionshipMatch = true;
            const previousStatus = tournamentRecord.status ?? 'ongoing';

            await tx
              .update(tournaments)
              .set({
                winnerTeamId: championTeamId,
                status: 'completed',
                updatedAt: new Date(),
              })
              .where(eq(tournaments.id, tournamentId));

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
      } else if (isDoubleElim) {
        if (lockedMatch.bracketType === 'upper') {
          // 1. Advance Upper Winner
          const nextRound = lockedMatch.roundNumber + 1;
          const nextMatchOrder = Math.ceil(lockedMatch.matchOrder / 2);
          const isTeamASlot = lockedMatch.matchOrder % 2 === 1;

          const [nextUpperMatch] = await tx
            .select()
            .from(tournamentMatches)
            .where(
              and(
                eq(tournamentMatches.tournamentId, tournamentId),
                eq(tournamentMatches.roundNumber, nextRound),
                eq(tournamentMatches.matchOrder, nextMatchOrder),
                eq(tournamentMatches.bracketType, 'upper')
              )
            )
            .for('update')
            .limit(1);

          if (nextUpperMatch) {
            nextMatchId = nextUpperMatch.id;
            const updatePayload = isTeamASlot
              ? { teamAId: input.winnerId, updatedAt: new Date() }
              : { teamBId: input.winnerId, updatedAt: new Date() };

            await tx
              .update(tournamentMatches)
              .set(updatePayload)
              .where(eq(tournamentMatches.id, nextUpperMatch.id));
          } else {
            // Upper Final concludes: advance winner to Grand Final as Team A
            const [grandFinal] = await tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.tournamentId, tournamentId),
                  eq(tournamentMatches.bracketType, 'grand_final')
                )
              )
              .for('update')
              .limit(1);

            if (grandFinal) {
              nextMatchId = grandFinal.id;
              await tx
                .update(tournamentMatches)
                .set({ teamAId: input.winnerId, updatedAt: new Date() })
                .where(eq(tournamentMatches.id, grandFinal.id));
            }
          }

          // 2. Route Upper Loser to Lower Bracket
          const loserId =
            lockedMatch.teamAId === input.winnerId
              ? lockedMatch.teamBId
              : lockedMatch.teamAId;

          if (loserId) {
            let targetLowerRound: number;
            let targetLowerMatchOrder: number;
            let targetLowerSlot: 'teamAId' | 'teamBId';

            if (lockedMatch.roundNumber === 1) {
              targetLowerRound = 1;
              targetLowerMatchOrder = Math.ceil(lockedMatch.matchOrder / 2);
              targetLowerSlot = lockedMatch.matchOrder % 2 === 1 ? 'teamAId' : 'teamBId';
            } else {
              targetLowerRound = 2 * lockedMatch.roundNumber - 2;
              targetLowerMatchOrder = lockedMatch.matchOrder;
              targetLowerSlot = 'teamBId';
            }

            const [lowerMatch] = await tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.tournamentId, tournamentId),
                  eq(tournamentMatches.roundNumber, targetLowerRound),
                  eq(tournamentMatches.matchOrder, targetLowerMatchOrder),
                  eq(tournamentMatches.bracketType, 'lower')
                )
              )
              .for('update')
              .limit(1);

            if (lowerMatch) {
              await tx
                .update(tournamentMatches)
                .set(
                  targetLowerSlot === 'teamAId'
                    ? { teamAId: loserId, updatedAt: new Date() }
                    : { teamBId: loserId, updatedAt: new Date() }
                )
                .where(eq(tournamentMatches.id, lowerMatch.id));
            }
          }
        } else if (lockedMatch.bracketType === 'lower') {
          // Lower Bracket advancement
          const isOddRound = lockedMatch.roundNumber % 2 === 1;
          const nextLowerRound = lockedMatch.roundNumber + 1;
          const nextLowerMatchOrder = isOddRound
            ? lockedMatch.matchOrder
            : Math.ceil(lockedMatch.matchOrder / 2);
          const isTeamASlot = isOddRound || lockedMatch.matchOrder % 2 === 1;

          const [nextLowerMatch] = await tx
            .select()
            .from(tournamentMatches)
            .where(
              and(
                eq(tournamentMatches.tournamentId, tournamentId),
                eq(tournamentMatches.roundNumber, nextLowerRound),
                eq(tournamentMatches.matchOrder, nextLowerMatchOrder),
                eq(tournamentMatches.bracketType, 'lower')
              )
            )
            .for('update')
            .limit(1);

          if (nextLowerMatch) {
            nextMatchId = nextLowerMatch.id;
            const updatePayload = isTeamASlot
              ? { teamAId: input.winnerId, updatedAt: new Date() }
              : { teamBId: input.winnerId, updatedAt: new Date() };

            await tx
              .update(tournamentMatches)
              .set(updatePayload)
              .where(eq(tournamentMatches.id, nextLowerMatch.id));
          } else {
            // Lower Final concludes: advance winner to Grand Final as Team B
            const [grandFinal] = await tx
              .select()
              .from(tournamentMatches)
              .where(
                and(
                  eq(tournamentMatches.tournamentId, tournamentId),
                  eq(tournamentMatches.bracketType, 'grand_final')
                )
              )
              .for('update')
              .limit(1);

            if (grandFinal) {
              nextMatchId = grandFinal.id;
              await tx
                .update(tournamentMatches)
                .set({ teamBId: input.winnerId, updatedAt: new Date() })
                .where(eq(tournamentMatches.id, grandFinal.id));
            }
          }
        } else if (lockedMatch.bracketType === 'grand_final') {
          // Grand Championship Final concludes!
          isChampionshipMatch = true;
          const previousStatus = tournamentRecord.status ?? 'ongoing';

          await tx
            .update(tournaments)
            .set({
              winnerTeamId: input.winnerId,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(tournaments.id, tournamentId));

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
      } else {
        // Single elimination / standard tree progression
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
            const previousStatus = tournamentRecord.status ?? 'ongoing';

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
