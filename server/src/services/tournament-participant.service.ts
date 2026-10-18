import { eq, sql, and } from 'drizzle-orm';
import type { SmexDatabase } from '../db/index.js';
import {
  tournaments,
  tournamentParticipants,
  type TournamentParticipant,
} from '../db/schema/tournaments.js';
import { teams } from '../db/schema/teams.js';
import { TournamentLifecycleError } from './tournament-lifecycle.service.js';

export class TournamentParticipantService {
  /**
   * Registers a squad into an open tournament with capacity and permission checks.
   */
  static async registerSquad(
    tournamentId: string,
    teamId: string,
    userId: string,
    userRole: string | undefined,
    db: SmexDatabase
  ): Promise<TournamentParticipant> {
    return await db.transaction(async (tx) => {
      // 1. Verify tournament exists and state is registration_open (with row lock)
      const [tourney] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
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

      // 2. Verify caller is captain of squad or admin
      const [teamRecord] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!teamRecord) {
        throw new TournamentLifecycleError('TEAM_NOT_FOUND', 404, 'Team not found');
      }

      if (teamRecord.captainId !== userId && userRole !== 'admin') {
        throw new TournamentLifecycleError(
          'CAPTAIN_PERMISSION_REQUIRED',
          403,
          'Only the squad captain may register the team for a tournament'
        );
      }

      // 3. Check if already registered
      const [existingParticipant] = await tx
        .select()
        .from(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, tournamentId),
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

      // 4. Check capacity limit
      const [countRecord] = await tx
        .select({ count: sql<number>`CAST(count(*) AS integer)` })
        .from(tournamentParticipants)
        .where(eq(tournamentParticipants.tournamentId, tournamentId));

      const currentCount = countRecord?.count ?? 0;
      if (currentCount >= tourney.maxTeams) {
        throw new TournamentLifecycleError(
          'TOURNAMENT_FULL',
          422,
          'Tournament has reached maximum squad capacity'
        );
      }

      // 5. Assign next seed
      const assignedSeed = currentCount + 1;

      const [inserted] = await tx
        .insert(tournamentParticipants)
        .values({
          tournamentId,
          teamId,
          seed: assignedSeed,
          registeredAt: new Date(),
        })
        .returning();

      return inserted;
    });
  }

  /**
   * Withdraws a squad prior to bracket generation and re-compacts seeds.
   */
  static async withdrawSquad(
    tournamentId: string,
    teamId: string,
    userId: string,
    userRole: string | undefined,
    db: SmexDatabase
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Verify tournament exists and state is registration_open (with row lock)
      const [tourney] = await tx
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
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
          'Squads can only be withdrawn while tournament is in registration_open state'
        );
      }

      // 2. Verify caller is captain of squad or admin
      const [teamRecord] = await tx
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);

      if (!teamRecord) {
        throw new TournamentLifecycleError('TEAM_NOT_FOUND', 404, 'Team not found');
      }

      if (teamRecord.captainId !== userId && userRole !== 'admin') {
        throw new TournamentLifecycleError(
          'FORBIDDEN',
          403,
          'Only the squad captain or an administrator may withdraw this squad'
        );
      }

      // 3. Verify squad is registered
      const [participant] = await tx
        .select()
        .from(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, tournamentId),
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

      // 4. Delete squad participant record
      await tx
        .delete(tournamentParticipants)
        .where(
          and(
            eq(tournamentParticipants.tournamentId, tournamentId),
            eq(tournamentParticipants.teamId, teamId)
          )
        );

      // 5. Re-compact seeds of remaining participants sequentially (BUG-M5-003)
      await TournamentParticipantService.recompactSeeds(tournamentId, tx);
    });
  }

  /**
   * Re-compacts seeds of remaining participants sequentially (1 to N).
   */
  static async recompactSeeds(
    tournamentId: string,
    db: SmexDatabase | Parameters<Parameters<SmexDatabase['transaction']>[0]>[0]
  ): Promise<void> {
    const remaining = await db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournamentId))
      .orderBy(tournamentParticipants.seed, tournamentParticipants.registeredAt);

    for (let i = 0; i < remaining.length; i++) {
      const newSeed = i + 1;
      if (remaining[i].seed !== newSeed) {
        await db
          .update(tournamentParticipants)
          .set({ seed: newSeed })
          .where(
            and(
              eq(tournamentParticipants.tournamentId, tournamentId),
              eq(tournamentParticipants.teamId, remaining[i].teamId)
            )
          );
      }
    }
  }
}
