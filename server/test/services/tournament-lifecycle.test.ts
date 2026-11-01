import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { tournaments, tournamentParticipants } from '../../src/db/schema/tournaments.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'tournu') {
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

describe('Tournament Lifecycle State Machine Suite (LLT 2.1)', () => {
  // Test 1: Tournament creation initializes state as upcoming
  test('Test 1: Tournament creation initializes state as upcoming', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'tl_admin1');
    const adminToken = createAdminToken(app, user.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `Clash_${Date.now()}`,
        gameSlug: 'mlbb',
        format: 'single_elimination',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        maxTeams: 16,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'upcoming');
    assert.ok(body.id);
  });

  // Test 2: Registration window opens only on valid transition
  test('Test 2: Registration window opens only on valid transition', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'tl_admin2');
    const adminToken = createAdminToken(app, user.id);

    // Create upcoming tournament
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `TransitionTest_${Date.now()}`,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);
    assert.equal(tournament.status, 'upcoming');

    // 1. Invalid transition attempt: upcoming -> ongoing (skipping registration_open)
    const invalidRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ongoing' },
    });
    assert.equal(invalidRes.statusCode, 400);
    const invalidBody = JSON.parse(invalidRes.body);
    assert.equal(invalidBody.code, 'INVALID_STATUS_TRANSITION');

    // 2. Valid transition: upcoming -> registration_open
    const validRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });
    assert.equal(validRes.statusCode, 200);
    const validBody = JSON.parse(validRes.body);
    assert.equal(validBody.status, 'registration_open');
  });

  // Test 3: Tournament launch requires minimum 2 registered teams
  test('Test 3: Tournament launch requires minimum 2 registered teams', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'tl_admin3');
    const adminToken = createAdminToken(app, user.id);

    // Create tournament and open registration
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `MinTeamsTest_${Date.now()}`,
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

    // Register only 1 squad
    const { user: captain } = await createVerifiedUser(app, 'tl_cap3');
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `SquadOne_${Date.now()}`, tag: 'SQ1' },
      app.db
    );

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team.id },
    });

    // Attempt transition to ongoing with only 1 team
    const launchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ongoing' },
    });

    assert.equal(launchRes.statusCode, 422);
    const launchBody = JSON.parse(launchRes.body);
    assert.equal(launchBody.code, 'INSUFFICIENT_TEAMS_FOR_TOURNAMENT');
  });

  // Test 4: Completion transition crowns champion and finalizes status
  test('Test 4: Completion transition crowns champion and finalizes status', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'tl_admin4');
    const adminToken = createAdminToken(app, user.id);

    const { user: captainA } = await createVerifiedUser(app, 'tl_cap4a');
    const { team: teamA } = await TeamService.createTeam(
      captainA.id,
      { name: `ChampionSquad_${Date.now()}`, tag: 'CHAMP' },
      app.db
    );

    const { user: captainB } = await createVerifiedUser(app, 'tl_cap4b');
    const { team: teamB } = await TeamService.createTeam(
      captainB.id,
      { name: `RunnerUpSquad_${Date.now()}`, tag: 'RUN' },
      app.db
    );

    // Create tournament and register 2 teams
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `ChampionTest_${Date.now()}`,
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

    const regA = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: teamA.id },
    });
    assert.equal(regA.statusCode, 201, `RegA failed: ${regA.body}`);

    const regB = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: teamB.id },
    });
    assert.equal(regB.statusCode, 201, `RegB failed: ${regB.body}`);

    // Launch tournament
    const launchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ongoing' },
    });
    assert.equal(launchRes.statusCode, 200, `Launch failed: ${launchRes.body}`);

    // Transition to completed crowning teamA
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        status: 'completed',
        winnerTeamId: teamA.id,
      },
    });

    assert.equal(completeRes.statusCode, 200);
    const completeBody = JSON.parse(completeRes.body);
    assert.equal(completeBody.status, 'completed');
    assert.equal(completeBody.winnerTeamId, teamA.id);

    // Verify persisted record in PostgreSQL
    const [persisted] = await app.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournament.id));
    assert.equal(persisted.status, 'completed');
    assert.equal(persisted.winnerTeamId, teamA.id);
  });
});
