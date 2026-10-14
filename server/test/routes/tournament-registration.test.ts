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
});
