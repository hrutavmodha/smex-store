import { eq } from 'drizzle-orm';
import { type DbOrTx } from '../db/index.js';
import {
  tournamentMatches,
  type NewTournamentMatch,
} from '../db/schema/tournaments.js';

export interface ParticipantSeed {
  teamId: string;
  seed: number;
}

export class BracketGeneratorService {
  /**
   * Generates bracket based on tournament format.
   */
  static async generateBracket(
    tournamentId: string,
    format: 'single_elimination' | 'double_elimination' | 'round_robin',
    participants: ParticipantSeed[],
    db: DbOrTx
  ) {
    // Delete existing matches for clean regeneration
    await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));

    if (format === 'single_elimination') {
      return this.generateSingleElimination(tournamentId, participants, db);
    } else if (format === 'double_elimination') {
      return this.generateDoubleElimination(tournamentId, participants, db);
    } else if (format === 'round_robin') {
      return this.generateRoundRobin(tournamentId, participants, db);
    }

    throw new Error(`Unsupported tournament format: ${format}`);
  }

  /**
   * Single-Elimination with Power-of-Two normalization and automated bye allocation.
   */
  static async generateSingleElimination(
    tournamentId: string,
    participants: ParticipantSeed[],
    db: DbOrTx
  ) {
    const N = participants.length;
    if (N < 2) {
      throw new Error('Minimum 2 participants required for single elimination bracket');
    }

    // Sort participants strictly by seed ascending
    const sorted = [...participants].sort((a, b) => a.seed - b.seed);
    const seedMap = new Map<number, string>();
    sorted.forEach((p, idx) => seedMap.set(idx + 1, p.teamId));

    // Power-of-Two Normalization
    const P = Math.pow(2, Math.ceil(Math.log2(N)));
    const totalRounds = Math.log2(P);

    // Track Round 1 winners (including automated byes) to pre-seed Round 2
    const round1Winners = new Map<number, string>(); // matchOrder -> winnerTeamId
    const matchInserts: NewTournamentMatch[] = [];

    // 1. Generate Round 1 Matches
    const round1MatchCount = P / 2;
    for (let m = 1; m <= round1MatchCount; m++) {
      const seedA = m;
      const seedB = P + 1 - m;

      const teamAId = seedMap.get(seedA) ?? null;
      const teamBId = seedMap.get(seedB) ?? null;

      if (teamAId && !teamBId) {
        // Automated Bye: Seed A advances automatically
        round1Winners.set(m, teamAId);
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId: null,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: teamAId,
          status: 'bye',
        });
      } else if (!teamAId && teamBId) {
        // Automated Bye: Seed B advances automatically
        round1Winners.set(m, teamBId);
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId: null,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: teamBId,
          status: 'bye',
        });
      } else {
        // Regular competitive match
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: null,
          status: 'scheduled',
        });
      }
    }

    // 2. Generate Subsequent Rounds (2 through R)
    for (let r = 2; r <= totalRounds; r++) {
      const matchesInRound = P / Math.pow(2, r);

      for (let m = 1; m <= matchesInRound; m++) {
        let teamAId: string | null = null;
        let teamBId: string | null = null;

        // If Round 2, pre-populate if feeder matches were byes
        if (r === 2) {
          const feederA = 2 * m - 1;
          const feederB = 2 * m;
          if (round1Winners.has(feederA)) {
            teamAId = round1Winners.get(feederA)!;
          }
          if (round1Winners.has(feederB)) {
            teamBId = round1Winners.get(feederB)!;
          }
        }

        matchInserts.push({
          tournamentId,
          roundNumber: r,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: null,
          status: 'scheduled',
        });
      }
    }

    const inserted = await db.insert(tournamentMatches).values(matchInserts).returning();
    return inserted;
  }

  /**
   * Double-Elimination bracket generator constructing Upper, Lower, and Grand Final match nodes.
   */
  static async generateDoubleElimination(
    tournamentId: string,
    participants: ParticipantSeed[],
    db: DbOrTx
  ) {
    const N = participants.length;
    if (N < 2) {
      throw new Error('Minimum 2 participants required for double elimination bracket');
    }

    const sorted = [...participants].sort((a, b) => a.seed - b.seed);
    const seedMap = new Map<number, string>();
    sorted.forEach((p, idx) => seedMap.set(idx + 1, p.teamId));

    // Power-of-Two Normalization
    const P = Math.pow(2, Math.ceil(Math.log2(N)));
    const k = Math.log2(P);

    const matchInserts: NewTournamentMatch[] = [];

    // 1. Generate Upper Bracket
    // Track Round 1 winners (including automated byes) to pre-seed Round 2
    const round1Winners = new Map<number, string>();
    const r1MatchCount = P / 2;

    for (let m = 1; m <= r1MatchCount; m++) {
      const seedA = m;
      const seedB = P + 1 - m;

      const teamAId = seedMap.get(seedA) ?? null;
      const teamBId = seedMap.get(seedB) ?? null;

      if (teamAId && !teamBId) {
        round1Winners.set(m, teamAId);
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId: null,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: teamAId,
          status: 'bye',
        });
      } else if (!teamAId && teamBId) {
        round1Winners.set(m, teamBId);
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId: null,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: teamBId,
          status: 'bye',
        });
      } else {
        matchInserts.push({
          tournamentId,
          roundNumber: 1,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: null,
          status: 'scheduled',
        });
      }
    }

    // Subsequent Upper Rounds (2 through k)
    for (let r = 2; r <= k; r++) {
      const matchesInRound = P / Math.pow(2, r);

      for (let m = 1; m <= matchesInRound; m++) {
        let teamAId: string | null = null;
        let teamBId: string | null = null;

        if (r === 2) {
          const feederA = 2 * m - 1;
          const feederB = 2 * m;
          if (round1Winners.has(feederA)) {
            teamAId = round1Winners.get(feederA)!;
          }
          if (round1Winners.has(feederB)) {
            teamBId = round1Winners.get(feederB)!;
          }
        }

        matchInserts.push({
          tournamentId,
          roundNumber: r,
          matchOrder: m,
          bracketType: 'upper',
          teamAId,
          teamBId,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: null,
          status: 'scheduled',
        });
      }
    }

    // 2. Generate Lower Bracket (for P >= 4)
    const totalLowerRounds = k >= 2 ? 2 * (k - 1) : 0;
    for (let r = 1; r <= totalLowerRounds; r++) {
      const matchesInRound = Math.pow(2, k - 1 - Math.ceil(r / 2));

      for (let m = 1; m <= matchesInRound; m++) {
        matchInserts.push({
          tournamentId,
          roundNumber: r,
          matchOrder: m,
          bracketType: 'lower',
          teamAId: null,
          teamBId: null,
          teamAScore: 0,
          teamBScore: 0,
          winnerId: null,
          status: 'scheduled',
        });
      }
    }

    // 3. Generate Grand Final
    const grandFinalRound = (totalLowerRounds > 0 ? totalLowerRounds : k) + 1;
    matchInserts.push({
      tournamentId,
      roundNumber: grandFinalRound,
      matchOrder: 1,
      bracketType: 'grand_final',
      teamAId: null,
      teamBId: null,
      teamAScore: 0,
      teamBScore: 0,
      winnerId: null,
      status: 'scheduled',
    });

    const inserted = await db.insert(tournamentMatches).values(matchInserts).returning();
    return inserted;
  }

  /**
   * Round-Robin generator using Berger Polygon algorithm with ghost team bye allocation.
   */
  static async generateRoundRobin(
    tournamentId: string,
    participants: ParticipantSeed[],
    db: DbOrTx
  ) {
    const N = participants.length;
    if (N < 2) {
      throw new Error('Minimum 2 participants required for round robin tournament');
    }

    const sorted = [...participants].sort((a, b) => a.seed - b.seed);
    const isOdd = N % 2 !== 0;
    const numTeams = isOdd ? N + 1 : N; // Add ghost dummy if odd
    const ghostIndex = isOdd ? numTeams - 1 : -1;

    // Array of team IDs, where ghost team is null
    const teamSlots: (string | null)[] = sorted.map((p) => p.teamId);
    if (isOdd) {
      teamSlots.push(null); // Ghost dummy
    }

    const totalRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;
    const matchInserts: NewTournamentMatch[] = [];

    // Indices array for Berger rotation
    let indices = Array.from({ length: numTeams }, (_, i) => i);

    for (let r = 1; r <= totalRounds; r++) {
      for (let m = 1; m <= matchesPerRound; m++) {
        const idxA = indices[m - 1];
        const idxB = indices[numTeams - m];

        const isGhostA = isOdd && idxA === ghostIndex;
        const isGhostB = isOdd && idxB === ghostIndex;

        if (isGhostA || isGhostB) {
          // Automated Bye for the non-ghost team in this round
          const realTeamId = isGhostA ? teamSlots[idxB] : teamSlots[idxA];
          matchInserts.push({
            tournamentId,
            roundNumber: r,
            matchOrder: m,
            bracketType: 'round_robin',
            teamAId: realTeamId,
            teamBId: null,
            teamAScore: 0,
            teamBScore: 0,
            winnerId: realTeamId,
            status: 'bye',
          });
        } else {
          // Regular competitive round-robin match
          matchInserts.push({
            tournamentId,
            roundNumber: r,
            matchOrder: m,
            bracketType: 'round_robin',
            teamAId: teamSlots[idxA],
            teamBId: teamSlots[idxB],
            teamAScore: 0,
            teamBScore: 0,
            winnerId: null,
            status: 'scheduled',
          });
        }
      }

      // Rotate indices, keeping index 0 permanently fixed
      const fixed = indices[0];
      const rotating = indices.slice(1);
      const last = rotating.pop()!;
      rotating.unshift(last);
      indices = [fixed, ...rotating];
    }

    const inserted = await db.insert(tournamentMatches).values(matchInserts).returning();
    return inserted;
  }
}
