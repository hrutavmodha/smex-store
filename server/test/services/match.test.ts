import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import {
  tournaments,
  tournamentParticipants,
  tournamentMatches,
} from '../../src/db/schema/tournaments.js';
import { TeamService } from '../../src/services/team.service.js';
import { MatchService } from '../../src/services/match.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'matchu') {
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

describe('Match Progression & Concurrency Score Reporting Suite (LLT 2.4)', () => {
  // Test 15: Match score update and winner declaration
  test('Test 15: Match score update and winner declaration', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'm_admin15');
    const adminToken = createAdminToken(app, admin.id);

    // Setup 4-team tournament
    const { user: cap1 } = await createVerifiedUser(app, 'm15_cap1');
    const { user: cap2 } = await createVerifiedUser(app, 'm15_cap2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `M15_T1_${Date.now()}`, tag: 'M1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `M15_T2_${Date.now()}`, tag: 'M2' }, app.db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `MatchUpdateTest_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 4,
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

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team2.id },
    });

    // Generate bracket
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { matches } = JSON.parse(genRes.body);
    const round1Match = matches.find((m: any) => m.roundNumber === 1 && m.teamAId && m.teamBId);
    assert.ok(round1Match, 'Round 1 competitive match must exist');

    // Admin updates score to 2-1 and declares team1 winner
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${round1Match.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        teamAScore: 2,
        teamBScore: 1,
        winnerId: team1.id,
      },
    });

    assert.equal(patchRes.statusCode, 200);
    const { match } = JSON.parse(patchRes.body);
    assert.equal(match.status, 'completed');
    assert.equal(match.teamAScore, 2);
    assert.equal(match.teamBScore, 1);
    assert.equal(match.winnerId, team1.id);
  });

  // Test 16: Automatic winner advancement to next round match slot
  test('Test 16: Automatic winner advancement to next round match slot', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'm_admin16');
    const adminToken = createAdminToken(app, admin.id);

    // Setup 4 teams for 2 rounds
    const teamsList = [];
    for (let i = 1; i <= 4; i++) {
      const { user: cap } = await createVerifiedUser(app, `m16_cap_${i}`);
      const { team } = await TeamService.createTeam(cap.id, { name: `M16_T${i}_${Date.now()}`, tag: `M16${i}` }, app.db);
      teamsList.push(team);
    }

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `AdvanceTest_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 4,
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

    for (const t of teamsList) {
      await app.inject({
        method: 'POST',
        url: `/api/v1/tournaments/${tournament.id}/register`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { teamId: t.id },
      });
    }

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { matches } = JSON.parse(genRes.body);

    // Round 1 Match 1
    const r1m1 = matches.find((m: any) => m.roundNumber === 1 && m.matchOrder === 1);
    assert.ok(r1m1);
    const winnerTeamId = r1m1.teamAId;

    // Complete Round 1 Match 1
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${r1m1.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        teamAScore: 2,
        teamBScore: 0,
        winnerId: winnerTeamId,
      },
    });
    assert.equal(patchRes.statusCode, 200);

    // Verify Round 2 Match 1 has winner populated in teamAId slot
    const [r2m1] = await app.db
      .select()
      .from(tournamentMatches)
      .where(
        eq(tournamentMatches.tournamentId, tournament.id)
      );

    const nextMatch = (await app.db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id)))
      .find((m) => m.roundNumber === 2 && m.matchOrder === 1);

    assert.ok(nextMatch, 'Round 2 Match 1 must exist');
    assert.equal(nextMatch.teamAId, winnerTeamId, 'Winner must automatically populate Round 2 teamA slot');
  });

  // Test 17: Championship match completion populates tournament winner
  test('Test 17: Championship match completion populates tournament winner', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'm_admin17');
    const adminToken = createAdminToken(app, admin.id);

    const { user: cap1 } = await createVerifiedUser(app, 'm17_cap1');
    const { user: cap2 } = await createVerifiedUser(app, 'm17_cap2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `Finalist1_${Date.now()}`, tag: 'FN1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `Finalist2_${Date.now()}`, tag: 'FN2' }, app.db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `FinalMatchTest_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 2,
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

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team2.id },
    });

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { matches } = JSON.parse(genRes.body);
    const finalMatch = matches[0]; // 2 teams -> 1 championship final match

    // Complete championship match
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${finalMatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        teamAScore: 3,
        teamBScore: 1,
        winnerId: team1.id,
      },
    });

    assert.equal(patchRes.statusCode, 200);
    const result = JSON.parse(patchRes.body);
    assert.equal(result.isChampionshipMatch, true);

    // Verify tournament record updated with champion and status completed
    const [updatedTourney] = await app.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id));

    assert.equal(updatedTourney.status, 'completed');
    assert.equal(updatedTourney.winnerTeamId, team1.id);
  });

  // Test 18: Concurrency row lock prevents conflicting score writes
  test('Test 18: Concurrency row lock prevents conflicting score writes', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'm_admin18');
    const adminToken = createAdminToken(app, admin.id);

    const { user: cap1 } = await createVerifiedUser(app, 'm18_cap1');
    const { user: cap2 } = await createVerifiedUser(app, 'm18_cap2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `ConcTeam1_${Date.now()}`, tag: 'CT1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `ConcTeam2_${Date.now()}`, tag: 'CT2' }, app.db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `ConcurrencyTest_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 2,
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

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team2.id },
    });

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { matches } = JSON.parse(genRes.body);
    const targetMatch = matches[0];

    // Fire two concurrent score updates on the same match
    const p1 = app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${targetMatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        teamAScore: 2,
        teamBScore: 0,
        winnerId: team1.id,
      },
    });

    const p2 = app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${targetMatch.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        teamAScore: 2,
        teamBScore: 1,
        winnerId: team2.id,
      },
    });

    const [res1, res2] = await Promise.all([p1, p2]);

    // Both requests must complete cleanly without 500 errors or deadlock
    assert.equal(res1.statusCode, 200);
    assert.equal(res2.statusCode, 200);

    // Final state in database must be coherent and correspond to one of the complete transactions
    const [finalMatch] = await app.db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.id, targetMatch.id));

    assert.equal(finalMatch.status, 'completed');
    assert.ok(finalMatch.winnerId === team1.id || finalMatch.winnerId === team2.id);
  });

  // Test 19: Double elimination loser drop routing, grand final qualification, and championship crown (BUG-M5-001)
  test('Test 19: Double elimination loser drop routing, grand final qualification, and championship crown (BUG-M5-001)', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'm_admin19');
    const adminToken = createAdminToken(app, admin.id);

    // Setup 4 teams for Double Elimination
    const teamsList = [];
    for (let i = 1; i <= 4; i++) {
      const { user: cap } = await createVerifiedUser(app, `m19_cap_${i}`);
      const { team } = await TeamService.createTeam(cap.id, { name: `M19_T${i}_${Date.now()}`, tag: `M19${i}` }, app.db);
      teamsList.push(team);
    }

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `DEDropTest_${Date.now()}`,
        format: 'double_elimination',
        maxTeams: 4,
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

    for (const team of teamsList) {
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
    const { matches } = JSON.parse(genRes.body);

    const u_r1m1 = matches.find((m: any) => m.bracketType === 'upper' && m.roundNumber === 1 && m.matchOrder === 1);
    const u_r1m2 = matches.find((m: any) => m.bracketType === 'upper' && m.roundNumber === 1 && m.matchOrder === 2);

    assert.ok(u_r1m1);
    assert.ok(u_r1m2);

    // 1. Complete Upper R1 Match 1: Team 1 wins, Team 4 loses
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${u_r1m1.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 2, teamBScore: 0, winnerId: u_r1m1.teamAId },
    });

    // 2. Complete Upper R1 Match 2: Team 2 wins, Team 3 loses
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${u_r1m2.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 2, teamBScore: 0, winnerId: u_r1m2.teamAId },
    });

    // Verify Upper R2 Match 1 has Team 1 and Team 2
    const allMatches = await app.db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id));
    const u_r2m1 = allMatches.find((m) => m.bracketType === 'upper' && m.roundNumber === 2 && m.matchOrder === 1);
    assert.equal(u_r2m1?.teamAId, u_r1m1.teamAId);
    assert.equal(u_r2m1?.teamBId, u_r1m2.teamAId);

    // Verify Lower R1 Match 1 received the two losers: Team 4 and Team 3 (Loser Drop Routing)
    const l_r1m1 = allMatches.find((m) => m.bracketType === 'lower' && m.roundNumber === 1 && m.matchOrder === 1);
    assert.equal(l_r1m1?.teamAId, u_r1m1.teamBId, 'Upper R1 Match 1 loser must drop to Lower R1 teamAId');
    assert.equal(l_r1m1?.teamBId, u_r1m2.teamBId, 'Upper R1 Match 2 loser must drop to Lower R1 teamBId');

    // 3. Complete Upper Final (Upper R2 M1): Team 1 wins, Team 2 loses
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${u_r2m1!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 2, teamBScore: 1, winnerId: u_r1m1.teamAId },
    });

    const matchesAfterUpperFinal = await app.db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id));
    const gfMatch = matchesAfterUpperFinal.find((m) => m.bracketType === 'grand_final');
    const l_r2m1 = matchesAfterUpperFinal.find((m) => m.bracketType === 'lower' && m.roundNumber === 2 && m.matchOrder === 1);

    // Winner of Upper Final advances to Grand Final as Team A
    assert.equal(gfMatch?.teamAId, u_r1m1.teamAId, 'Upper Final winner must advance to Grand Final teamAId');
    // Loser of Upper Final drops to Lower Final as Team B
    assert.equal(l_r2m1?.teamBId, u_r1m2.teamAId, 'Upper Final loser must drop to Lower Final teamBId');

    // 4. Complete Lower Semis (Lower R1 M1): Team 3 wins
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${l_r1m1!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 0, teamBScore: 2, winnerId: l_r1m1!.teamBId! },
    });

    const matchesAfterLowerSemis = await app.db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id));
    const l_final = matchesAfterLowerSemis.find((m) => m.bracketType === 'lower' && m.roundNumber === 2 && m.matchOrder === 1);
    assert.equal(l_final?.teamAId, l_r1m1!.teamBId, 'Lower Semis winner must advance to Lower Final teamAId');

    // 5. Complete Lower Final: Team 2 wins
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${l_final!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 1, teamBScore: 2, winnerId: l_final!.teamBId! },
    });

    const matchesAfterLowerFinal = await app.db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id));
    const gfReady = matchesAfterLowerFinal.find((m) => m.bracketType === 'grand_final');
    assert.equal(gfReady?.teamBId, l_final!.teamBId, 'Lower Final winner must advance to Grand Final teamBId');

    // 6. Complete Grand Final: Team 1 wins Championship
    const gfRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}/matches/${gfReady!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamAScore: 3, teamBScore: 1, winnerId: gfReady!.teamAId! },
    });

    assert.equal(gfRes.statusCode, 200);
    const gfBody = JSON.parse(gfRes.body);
    assert.equal(gfBody.isChampionshipMatch, true);

    // Verify tournament is finalized and champion crowned
    const [finalTourney] = await app.db.select().from(tournaments).where(eq(tournaments.id, tournament.id));
    assert.equal(finalTourney.status, 'completed');
    assert.equal(finalTourney.winnerTeamId, gfReady!.teamAId);
  });
});
