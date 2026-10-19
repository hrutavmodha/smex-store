import { test, describe, vi } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { build } from '../helper.js';
import { BracketGeneratorService } from '../../src/services/bracket-generator.service.js';
import { TournamentLifecycleService } from '../../src/services/tournament-lifecycle.service.js';
import { tournaments, tournamentParticipants, tournamentMatches } from '../../src/db/schema/tournaments.js';
import { TeamService } from '../../src/services/team.service.js';
import { users } from '../../src/db/schema/users.js';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'bgu') {
  const ip = `10.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`;
  const username = `${prefix}_${Date.now().toString().slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
  const password = 'ValidPassword123!';

  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    remoteAddress: ip,
    payload: { email, password, username },
  });
  const user = JSON.parse(regRes.body);

  await app.db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    remoteAddress: ip,
    payload: { email, password },
  });
  const { accessToken } = JSON.parse(loginRes.body);

  return { user, token: accessToken };
}

function createAdminToken(app: FastifyInstance, userId: string) {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: crypto.randomUUID(),
  });
}

describe('Bracket Generation Algorithms Suite (LLT 2.3)', () => {
  // Test 9: Single elimination power-of-two bracket generation
  test('Test 9: Single elimination power-of-two bracket generation', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'bg_admin9');
    const adminToken = createAdminToken(app, admin.id);

    // Create 8-team single elimination tournament
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `Bracket8_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 8,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });

    // Register 8 teams
    for (let i = 1; i <= 8; i++) {
      const { user: cap } = await createVerifiedUser(app, `bg9_cap_${i}`);
      const { team } = await TeamService.createTeam(
        cap.id,
        { name: `Squad_8_${i}_${Date.now()}`, tag: `S8${i}` },
        app.db
      );
      await app.inject({
        method: 'POST',
        url: `/api/v1/tournaments/${tournament.id}/register`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teamId: team.id },
      });
    }

    // Trigger bracket generation
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(genRes.statusCode, 200);
    const body = JSON.parse(genRes.body);

    // Total 7 matches generated across 3 rounds
    assert.equal(body.matchesCount, 7);
    const matches = body.matches;

    const round1 = matches.filter((m: any) => m.roundNumber === 1);
    const round2 = matches.filter((m: any) => m.roundNumber === 2);
    const round3 = matches.filter((m: any) => m.roundNumber === 3);

    assert.equal(round1.length, 4); // 4 Round 1 matches
    assert.equal(round2.length, 2); // 2 Semifinals
    assert.equal(round3.length, 1); // 1 Championship Final
  });

  // Test 10: Single elimination automated bye allocation
  test('Test 10: Single elimination automated bye allocation', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'bg_admin10');
    const adminToken = createAdminToken(app, admin.id);

    // Create single elimination tournament with 5 teams
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `Bracket5_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 8,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });

    const registeredTeamIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const { user: cap } = await createVerifiedUser(app, `bg10_cap_${i}`);
      const { team } = await TeamService.createTeam(
        cap.id,
        { name: `Squad_5_${i}_${Date.now()}`, tag: `S5${i}` },
        app.db
      );
      registeredTeamIds.push(team.id);

      await app.inject({
        method: 'POST',
        url: `/api/v1/tournaments/${tournament.id}/register`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teamId: team.id },
      });
    }

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(genRes.statusCode, 200);
    const body = JSON.parse(genRes.body);
    const matches = body.matches;

    // For N = 5, P = 8, Automated byes = 8 - 5 = 3
    const byeMatches = matches.filter((m: any) => m.status === 'bye');
    assert.equal(byeMatches.length, 3);

    // Top 3 seeds (seeds 1, 2, 3) must receive automated byes
    const byeWinnerIds = byeMatches.map((m: any) => m.winnerId);
    assert.ok(byeWinnerIds.includes(registeredTeamIds[0])); // Seed 1
    assert.ok(byeWinnerIds.includes(registeredTeamIds[1])); // Seed 2
    assert.ok(byeWinnerIds.includes(registeredTeamIds[2])); // Seed 3

    // Round 2 must pre-populate the bye winners
    const round2Matches = matches.filter((m: any) => m.roundNumber === 2);
    const round2Teams = round2Matches.flatMap((m: any) => [m.teamAId, m.teamBId]);
    assert.ok(round2Teams.includes(registeredTeamIds[0]));
    assert.ok(round2Teams.includes(registeredTeamIds[1]));
    assert.ok(round2Teams.includes(registeredTeamIds[2]));
  });

  // Helper to create valid tournament for testing
  async function createTestTourney(app: FastifyInstance, title = 'Tourney') {
    const [t] = await app.db
      .insert(tournaments)
      .values({
        title: `${title}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        startTime: new Date(Date.now() + 86400000),
        maxTeams: 16,
      })
      .returning();
    return t;
  }

  // Helper to create N real teams
  async function createTestTeams(app: FastifyInstance, count: number, prefix: string) {
    const list = [];
    for (let i = 1; i <= count; i++) {
      const { user } = await createVerifiedUser(app, `${prefix}_u_${i}`);
      const { team } = await TeamService.createTeam(
        user.id,
        {
          name: `${prefix}_Squad_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          tag: `${prefix.slice(0, 3).toUpperCase()}${i}`,
        },
        app.db
      );
      list.push(team);
    }
    return list;
  }

  // Test 11: Seed folding pairing formula validation
  test('Test 11: Seed folding pairing formula validation', async (t) => {
    const app = await build(t);
    const tourney = await createTestTourney(app, 'FoldTourney');
    const teams = await createTestTeams(app, 8, 'fold11');

    const participants = teams.map((team, idx) => ({
      teamId: team.id,
      seed: idx + 1,
    }));

    // Seed folding: Match m pairs Seed m with Seed (P + 1 - m)
    // Match 1: 1 vs 8, Match 2: 2 vs 7, Match 3: 3 vs 6, Match 4: 4 vs 5
    const matches = await BracketGeneratorService.generateSingleElimination(
      tourney.id,
      participants,
      app.db
    );

    const round1 = matches.filter((m) => m.roundNumber === 1);
    round1.sort((a, b) => a.matchOrder - b.matchOrder);

    // Match 1: Seed 1 vs Seed 8
    assert.equal(round1[0].teamAId, participants[0].teamId);
    assert.equal(round1[0].teamBId, participants[7].teamId);

    // Match 2: Seed 2 vs Seed 7
    assert.equal(round1[1].teamAId, participants[1].teamId);
    assert.equal(round1[1].teamBId, participants[6].teamId);

    // Match 3: Seed 3 vs Seed 6
    assert.equal(round1[2].teamAId, participants[2].teamId);
    assert.equal(round1[2].teamBId, participants[5].teamId);

    // Match 4: Seed 4 vs Seed 5
    assert.equal(round1[3].teamAId, participants[3].teamId);
    assert.equal(round1[3].teamBId, participants[4].teamId);
  });

  // Test 12: Double elimination upper and lower bracket generation
  test('Test 12: Double elimination upper and lower bracket generation', async (t) => {
    const app = await build(t);
    const tourney = await createTestTourney(app, 'DETourney');
    const teams = await createTestTeams(app, 4, 'de12');

    const participants = teams.map((team, idx) => ({
      teamId: team.id,
      seed: idx + 1,
    }));

    const matches = await BracketGeneratorService.generateDoubleElimination(
      tourney.id,
      participants,
      app.db
    );

    const upperMatches = matches.filter((m) => m.bracketType === 'upper');
    const lowerMatches = matches.filter((m) => m.bracketType === 'lower');
    const grandFinalMatches = matches.filter((m) => m.bracketType === 'grand_final');

    assert.ok(upperMatches.length > 0, 'Upper Bracket nodes must be generated');
    assert.ok(lowerMatches.length > 0, 'Lower Bracket nodes must be generated');
    assert.ok(grandFinalMatches.length > 0, 'Grand Final node must be generated');

    // Verify Upper Bracket structure (Round 1: 2 matches, Round 2: 1 match)
    assert.equal(upperMatches.filter((m) => m.roundNumber === 1).length, 2);
    assert.equal(upperMatches.filter((m) => m.roundNumber === 2).length, 1);

    // Verify Grand Final
    assert.equal(grandFinalMatches.length, 1);
    assert.equal(grandFinalMatches[0].roundNumber, 3);
  });

  // Test 12b: Dynamic double elimination bracket generation for 8 teams allocating 14 matches
  test('Test 12b: Dynamic double elimination bracket generation for 8 teams allocating 14 matches (BUG-M5-001)', async (t) => {
    const app = await build(t);
    const tourney = await createTestTourney(app, 'DE8Tourney');
    const teams = await createTestTeams(app, 8, 'de8');

    const participants = teams.map((team, idx) => ({
      teamId: team.id,
      seed: idx + 1,
    }));

    const matches = await BracketGeneratorService.generateDoubleElimination(
      tourney.id,
      participants,
      app.db
    );

    // Total 14 matches generated for 8-team double elimination: 2N - 2 = 14
    assert.equal(matches.length, 14);

    const upperMatches = matches.filter((m) => m.bracketType === 'upper');
    const lowerMatches = matches.filter((m) => m.bracketType === 'lower');
    const grandFinalMatches = matches.filter((m) => m.bracketType === 'grand_final');

    // Upper: 7 matches across 3 rounds (4 in R1, 2 in R2, 1 in R3)
    assert.equal(upperMatches.length, 7);
    assert.equal(upperMatches.filter((m) => m.roundNumber === 1).length, 4);
    assert.equal(upperMatches.filter((m) => m.roundNumber === 2).length, 2);
    assert.equal(upperMatches.filter((m) => m.roundNumber === 3).length, 1);

    // Lower: 6 matches across 4 rounds (2 in R1, 2 in R2, 1 in R3, 1 in R4)
    assert.equal(lowerMatches.length, 6);
    assert.equal(lowerMatches.filter((m) => m.roundNumber === 1).length, 2);
    assert.equal(lowerMatches.filter((m) => m.roundNumber === 2).length, 2);
    assert.equal(lowerMatches.filter((m) => m.roundNumber === 3).length, 1);
    assert.equal(lowerMatches.filter((m) => m.roundNumber === 4).length, 1);

    // Grand Final: 1 match at Round 5
    assert.equal(grandFinalMatches.length, 1);
    assert.equal(grandFinalMatches[0].roundNumber, 5);

    // All 8 teams seeded in Upper Round 1
    const r1 = upperMatches.filter((m) => m.roundNumber === 1).sort((a, b) => a.matchOrder - b.matchOrder);
    assert.equal(r1[0].teamAId, participants[0].teamId); // Seed 1
    assert.equal(r1[0].teamBId, participants[7].teamId); // Seed 8
    assert.equal(r1[1].teamAId, participants[1].teamId); // Seed 2
    assert.equal(r1[1].teamBId, participants[6].teamId); // Seed 7
    assert.equal(r1[2].teamAId, participants[2].teamId); // Seed 3
    assert.equal(r1[2].teamBId, participants[5].teamId); // Seed 6
    assert.equal(r1[3].teamAId, participants[3].teamId); // Seed 4
    assert.equal(r1[3].teamBId, participants[4].teamId); // Seed 5
  });

  // Test 13: Round robin Berger pairing algorithm
  test('Test 13: Round robin Berger pairing algorithm', async (t) => {
    const app = await build(t);
    const tourney = await createTestTourney(app, 'RRTourney');
    const teams = await createTestTeams(app, 6, 'rr13');

    const participants = teams.map((team, idx) => ({
      teamId: team.id,
      seed: idx + 1,
    }));

    const matches = await BracketGeneratorService.generateRoundRobin(
      tourney.id,
      participants,
      app.db
    );

    // For N = 6 teams: 5 rounds, 3 matches per round, total 15 matches
    assert.equal(matches.length, 15);

    const rounds = new Set(matches.map((m) => m.roundNumber));
    assert.equal(rounds.size, 5);

    for (let r = 1; r <= 5; r++) {
      const roundMatches = matches.filter((m) => m.roundNumber === r);
      assert.equal(roundMatches.length, 3);
    }

    // Verify that every team plays every other team exactly once
    const pairs = new Set<string>();
    for (const m of matches) {
      assert.ok(m.teamAId && m.teamBId);
      const pair = [m.teamAId, m.teamBId].sort().join(':');
      assert.ok(!pairs.has(pair), `Duplicate pairing detected: ${pair}`);
      pairs.add(pair);
    }
    // 6 choose 2 = 15 pairs
    assert.equal(pairs.size, 15);
  });

  // Test 14: Odd team count round robin ghost bye allocation
  test('Test 14: Odd team count round robin ghost bye allocation', async (t) => {
    const app = await build(t);
    const tourney = await createTestTourney(app, 'RROddTourney');
    const teams = await createTestTeams(app, 5, 'rr14');

    const participants = teams.map((team, idx) => ({
      teamId: team.id,
      seed: idx + 1,
    }));

    const matches = await BracketGeneratorService.generateRoundRobin(
      tourney.id,
      participants,
      app.db
    );

    // For N = 5 teams: normalized with Ghost to 6 teams -> 5 rounds, 3 matches/round
    assert.equal(matches.length, 15);

    // Exactly 1 match per round must be an automated bye
    for (let r = 1; r <= 5; r++) {
      const roundMatches = matches.filter((m) => m.roundNumber === r);
      assert.equal(roundMatches.length, 3);

      const roundByes = roundMatches.filter((m) => m.status === 'bye');
      assert.equal(roundByes.length, 1, `Round ${r} must contain exactly 1 bye match`);
      assert.ok(roundByes[0].winnerId, 'Bye match must have winner declared');
    }

    const allByes = matches.filter((m) => m.status === 'bye');
    assert.equal(allByes.length, 5);

    // Each of the 5 teams must receive exactly 1 bye
    const byeRecipients = new Set(allByes.map((m) => m.winnerId));
    assert.equal(byeRecipients.size, 5);
  });

  // Test 15: Transactional bracket generation rolls back match insertion and status transition on lifecycle failure (Bug 24)
  test('Test 15: Transactional bracket generation rolls back match insertion and status transition on lifecycle failure (Bug 24)', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'bg_admin15');
    const adminToken = createAdminToken(app, admin.id);

    // Create 4-team single elimination tournament
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `BracketTxRollback_${Date.now()}`,
        gameSlug: 'mlbb',
        format: 'single_elimination',
        maxTeams: 4,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert.equal(createRes.statusCode, 201);
    const tournament = JSON.parse(createRes.body);

    // Set tournament status to registration_open
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });

    // Register 4 teams
    for (let i = 1; i <= 4; i++) {
      const { user: cap } = await createVerifiedUser(app, `bg15_cap_${i}`);
      const { team } = await TeamService.createTeam(
        cap.id,
        { name: `Squad_Tx_${i}_${Date.now()}`, tag: `ST${i}` },
        app.db
      );

      await app.inject({
        method: 'POST',
        url: `/api/v1/tournaments/${tournament.id}/register`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teamId: team.id },
      });
    }

    // Simulate failure during status transition step
    const transitionSpy = vi
      .spyOn(TournamentLifecycleService, 'transitionStatus')
      .mockRejectedValueOnce(new Error('Simulated Redis / guard failure'));

    // Attempt bracket generation
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    transitionSpy.mockRestore();

    // Must fail
    assert.equal(genRes.statusCode, 500);

    // Assert ACID rollback: No matches must remain in database for this tournament
    const matchesInDb = await app.db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournament.id));
    assert.equal(
      matchesInDb.length,
      0,
      'Matches inserted prior to lifecycle failure must be rolled back completely'
    );

    // Assert tournament status remains registration_open (not ongoing)
    const [tourneyRecord] = await app.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id))
      .limit(1);
    assert.equal(
      tourneyRecord.status,
      'registration_open',
      'Tournament status must not transition to ongoing if transaction failed'
    );
  });
});

