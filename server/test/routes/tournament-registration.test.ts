import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { tournaments, tournamentParticipants } from '../../src/db/schema/tournaments.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'regu') {
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
  if (regRes.statusCode !== 201) {
    throw new Error(`Registration failed with ${regRes.statusCode}: ${regRes.body}`);
  }
  const user = JSON.parse(regRes.body);

  await app.db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    remoteAddress: ip,
    payload: { email, password },
  });
  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed with ${loginRes.statusCode}: ${loginRes.body}`);
  }
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

describe('Participant Registration and Capacity Suite (LLT 2.2)', () => {
  // Test 5: Team captain registers squad into open tournament
  test('Test 5: Team captain registers squad into open tournament', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin5');
    const adminToken = createAdminToken(app, admin.id);

    const { user: captain, token: captainToken } = await createVerifiedUser(app, 'tr_cap5');
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `RegSquad_${Date.now()}`, tag: 'REG' },
      app.db
    );

    // Create tournament and open registration
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `RegOpenTourney_${Date.now()}`,
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

    // Captain registers squad
    const regRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { teamId: team.id },
    });

    assert.equal(regRes.statusCode, 201);
    const participant = JSON.parse(regRes.body);
    assert.equal(participant.tournamentId, tournament.id);
    assert.equal(participant.teamId, team.id);
    assert.equal(participant.seed, 1);
  });

  // Test 6: Duplicate team registration rejection
  test('Test 6: Duplicate team registration rejection', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin6');
    const adminToken = createAdminToken(app, admin.id);

    const { user: captain, token: captainToken } = await createVerifiedUser(app, 'tr_cap6');
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `DupSquad_${Date.now()}`, tag: 'DUP' },
      app.db
    );

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `DupTourney_${Date.now()}`,
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

    // First registration succeeds
    const reg1 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { teamId: team.id },
    });
    assert.equal(reg1.statusCode, 201);

    // Duplicate registration rejected with 409 Conflict
    const reg2 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { teamId: team.id },
    });
    assert.equal(reg2.statusCode, 409);
    const dupBody = JSON.parse(reg2.body);
    assert.equal(dupBody.code, 'DUPLICATE_REGISTRATION');
  });

  // Test 7: Registration rejection when capacity reached
  test('Test 7: Registration rejection when capacity reached', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin7');
    const adminToken = createAdminToken(app, admin.id);

    // Create tournament with maxTeams = 2
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `CapTourney_${Date.now()}`,
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

    // Register 2 squads to fill capacity
    const { user: capA, token: tokenA } = await createVerifiedUser(app, 'tr_cap7a');
    const { team: teamA } = await TeamService.createTeam(capA.id, { name: `TeamA_${Date.now()}`, tag: 'TMA' }, app.db);
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { teamId: teamA.id },
    });

    const { user: capB, token: tokenB } = await createVerifiedUser(app, 'tr_cap7b');
    const { team: teamB } = await TeamService.createTeam(capB.id, { name: `TeamB_${Date.now()}`, tag: 'TMB' }, app.db);
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { teamId: teamB.id },
    });

    // Attempt to register 3rd squad when capacity is 2
    const { user: capC, token: tokenC } = await createVerifiedUser(app, 'tr_cap7c');
    const { team: teamC } = await TeamService.createTeam(capC.id, { name: `TeamC_${Date.now()}`, tag: 'TMC' }, app.db);

    const fullRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${tokenC}` },
      payload: { teamId: teamC.id },
    });

    assert.equal(fullRes.statusCode, 422);
    const fullBody = JSON.parse(fullRes.body);
    assert.equal(fullBody.code, 'TOURNAMENT_FULL');
  });

  // Test 8: Registration blocked when tournament state is not registration_open
  test('Test 8: Registration blocked when tournament state is not registration_open', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin8');
    const adminToken = createAdminToken(app, admin.id);

    const { user: captain, token: captainToken } = await createVerifiedUser(app, 'tr_cap8');
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `ClosedSquad_${Date.now()}`, tag: 'CLS' },
      app.db
    );

    // Create tournament: status is 'upcoming'
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `ClosedTourney_${Date.now()}`,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);
    assert.equal(tournament.status, 'upcoming');

    // Attempt registration while in 'upcoming' state
    const regRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { teamId: team.id },
    });

    assert.equal(regRes.statusCode, 400);
    const regBody = JSON.parse(regRes.body);
    assert.equal(regBody.code, 'REGISTRATION_CLOSED');
  });

  // Test 8b: Participant withdrawal re-indexes seeds and prevents bracket seed collisions (BUG-M5-003)
  test('Test 8b: Participant withdrawal re-indexes seeds and prevents bracket seed collisions (BUG-M5-003)', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin8b');
    const adminToken = createAdminToken(app, admin.id);

    // Create tournament with maxTeams = 4
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `SeedReindexTourney_${Date.now()}`,
        maxTeams: 4,
        format: 'single_elimination',
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

    // Register Team 1, Team 2, Team 3
    const { user: cap1, token: token1 } = await createVerifiedUser(app, 'tr_cap8b_1');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `Team1_${Date.now()}`, tag: 'TM1' }, app.db);
    const reg1 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { teamId: team1.id },
    });
    assert.equal(reg1.statusCode, 201);
    assert.equal(JSON.parse(reg1.body).seed, 1);

    const { user: cap2, token: token2 } = await createVerifiedUser(app, 'tr_cap8b_2');
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `Team2_${Date.now()}`, tag: 'TM2' }, app.db);
    const reg2 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${token2}` },
      payload: { teamId: team2.id },
    });
    assert.equal(reg2.statusCode, 201);
    assert.equal(JSON.parse(reg2.body).seed, 2);

    const { user: cap3, token: token3 } = await createVerifiedUser(app, 'tr_cap8b_3');
    const { team: team3 } = await TeamService.createTeam(cap3.id, { name: `Team3_${Date.now()}`, tag: 'TM3' }, app.db);
    const reg3 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${token3}` },
      payload: { teamId: team3.id },
    });
    assert.equal(reg3.statusCode, 201);
    assert.equal(JSON.parse(reg3.body).seed, 3);

    // Withdraw Team 2
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/tournaments/${tournament.id}/participants/${team2.id}`,
      headers: { authorization: `Bearer ${token2}` },
    });
    assert.equal(delRes.statusCode, 200);

    // Verify Team 3 seed was re-compacted to seed 2
    const remainingParticipants = await app.db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id))
      .orderBy(tournamentParticipants.seed);

    assert.equal(remainingParticipants.length, 2);
    assert.equal(remainingParticipants[0].teamId, team1.id);
    assert.equal(remainingParticipants[0].seed, 1);
    assert.equal(remainingParticipants[1].teamId, team3.id);
    assert.equal(remainingParticipants[1].seed, 2);

    // Register Team 4 - should receive contiguous seed 3 (not duplicate seed 3)
    const { user: cap4, token: token4 } = await createVerifiedUser(app, 'tr_cap8b_4');
    const { team: team4 } = await TeamService.createTeam(cap4.id, { name: `Team4_${Date.now()}`, tag: 'TM4' }, app.db);
    const reg4 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${token4}` },
      payload: { teamId: team4.id },
    });
    assert.equal(reg4.statusCode, 201);
    assert.equal(JSON.parse(reg4.body).seed, 3);

    // Generate bracket and verify ALL registered teams are scheduled
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(genRes.statusCode, 200);
    const genData = JSON.parse(genRes.body);

    const scheduledTeamIds = new Set<string>();
    for (const m of genData.matches) {
      if (m.teamAId) scheduledTeamIds.add(m.teamAId);
      if (m.teamBId) scheduledTeamIds.add(m.teamBId);
    }
    assert.ok(scheduledTeamIds.has(team1.id), 'Team 1 must be scheduled');
    assert.ok(scheduledTeamIds.has(team3.id), 'Team 3 must be scheduled without being overwritten');
    assert.ok(scheduledTeamIds.has(team4.id), 'Team 4 must be scheduled');
  });

  // Test 8c: Bracket generation rejected on ongoing and completed tournaments (BUG-M5-006)
  test('Test 8c: Bracket generation rejected on ongoing and completed tournaments (BUG-M5-006)', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin8c');
    const adminToken = createAdminToken(app, admin.id);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `LockedBracketTourney_${Date.now()}`,
        maxTeams: 4,
        format: 'single_elimination',
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

    // Register 2 teams
    for (let i = 1; i <= 2; i++) {
      const { user: cap, token } = await createVerifiedUser(app, `tr_cap8c_${i}`);
      const { team } = await TeamService.createTeam(cap.id, { name: `Squad_8c_${i}_${Date.now()}`, tag: `S8C${i}` }, app.db);
      await app.inject({
        method: 'POST',
        url: `/api/v1/tournaments/${tournament.id}/register`,
        headers: { authorization: `Bearer ${token}` },
        payload: { teamId: team.id },
      });
    }

    // Generate bracket initial launch (transitions status to 'ongoing')
    const gen1 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gen1.statusCode, 200);

    // Verify tournament is now ongoing
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/tournaments/${tournament.id}`,
    });
    const ongoingTourney = JSON.parse(checkRes.body);
    assert.equal(ongoingTourney.status, 'ongoing');

    // Attempting bracket generation on ongoing tournament must be rejected with 400 INVALID_TOURNAMENT_STATE
    const gen2 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gen2.statusCode, 400);
    const body2 = JSON.parse(gen2.body);
    assert.equal(body2.code, 'INVALID_TOURNAMENT_STATE');

    // Transition tournament to completed
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'completed' },
    });

    // Attempting bracket generation on completed tournament must be rejected with 400 INVALID_TOURNAMENT_STATE
    const gen3 = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(gen3.statusCode, 400);
    const body3 = JSON.parse(gen3.body);
    assert.equal(body3.code, 'INVALID_TOURNAMENT_STATE');
  });

  // Test 8d: Bracket generation rejected on upcoming tournaments with 400 INVALID_TOURNAMENT_STATE (Bug 6)
  test('Test 8d: Bracket generation rejected on upcoming tournaments with 400 INVALID_TOURNAMENT_STATE (Bug 6)', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'tr_admin8d');
    const adminToken = createAdminToken(app, admin.id);

    // Create tournament in default 'upcoming' state
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `UpcomingBracketTourney_${Date.now()}`,
        maxTeams: 4,
        format: 'single_elimination',
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert.equal(createRes.statusCode, 201);
    const tournament = JSON.parse(createRes.body);
    assert.equal(tournament.status, 'upcoming');

    // Register 2 teams directly into participants table
    for (let i = 1; i <= 2; i++) {
      const { user: cap } = await createVerifiedUser(app, `tr_cap8d_${i}`);
      const { team } = await TeamService.createTeam(
        cap.id,
        { name: `Squad_8d_${i}_${Date.now()}`, tag: `S8D${i}` },
        app.db
      );
      await app.db.insert(tournamentParticipants).values({
        tournamentId: tournament.id,
        teamId: team.id,
        seed: i,
      });
    }

    // Attempting bracket generation on upcoming tournament must be rejected with 400 INVALID_TOURNAMENT_STATE
    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    assert.equal(genRes.statusCode, 400);
    const genBody = JSON.parse(genRes.body);
    assert.equal(genBody.code, 'INVALID_TOURNAMENT_STATE');
    assert.ok(
      genBody.detail.includes('Status must be \'registration_open\'') ||
      genBody.detail.includes('Cannot generate brackets for tournament in \'upcoming\' state')
    );

    // Verify tournament remains in 'upcoming' state in DB
    const [dbTourney] = await app.db
      .select({ status: tournaments.status })
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id));
    assert.equal(dbTourney.status, 'upcoming');
  });
});
