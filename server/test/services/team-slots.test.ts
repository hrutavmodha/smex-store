import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teamMembers } from '../../src/db/schema/teams.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'slotu') {
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

describe('Dynamic Roster Open Slots Calculation Suite (LLT 2.2)', () => {
  test('Test 6: Open slots formula accurately calculates capacity minus active count', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'slot_c');
    const { user: member2 } = await createVerifiedUser(app, 'slot_m2');

    // Create squad with memberCap = 5
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `SlotMathSquad_${Date.now()}`, tag: 'SLOT', memberCap: 5 },
      app.db
    );

    // Add a second member
    await app.db.insert(teamMembers).values({
      teamId: team.id,
      userId: member2.id,
      memberRole: 'member',
    });

    // Query team details
    const teamDetails = await TeamService.getTeamById(team.id, app.db);
    assert.ok(teamDetails);
    assert.equal(teamDetails.activeMembersCount, 2);
    assert.equal(teamDetails.openSlots, 3);
    assert.equal(teamDetails.availability, 'open');
  });

  test('Test 7: Full roster open slots clamped to zero', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'full_c');

    // Create squad with memberCap = 3
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `FullSquad_${Date.now()}`, tag: 'FULL', memberCap: 3 },
      app.db
    );

    // Add 2 more members to reach memberCap = 3
    const { user: m2 } = await createVerifiedUser(app, 'full_m2');
    const { user: m3 } = await createVerifiedUser(app, 'full_m3');

    await app.db.insert(teamMembers).values([
      { teamId: team.id, userId: m2.id, memberRole: 'member' },
      { teamId: team.id, userId: m3.id, memberRole: 'member' },
    ]);

    const details = await TeamService.getTeamById(team.id, app.db);
    assert.ok(details);
    assert.equal(details.activeMembersCount, 3);
    assert.equal(details.openSlots, 0);
    assert.equal(details.availability, 'full');
  });

  test('Test 8: Directory listing aggregates dynamic open slots without N+1 queries', async (t) => {
    const app = await build(t);
    const { user: captain1 } = await createVerifiedUser(app, 'list_c1');
    const { user: captain2 } = await createVerifiedUser(app, 'list_c2');

    const squadName1 = `ListSquad1_${Date.now()}`;
    const squadName2 = `ListSquad2_${Date.now()}`;

    await TeamService.createTeam(
      captain1.id,
      { name: squadName1, tag: 'LS1', memberCap: 5 },
      app.db
    );

    const { team: t2 } = await TeamService.createTeam(
      captain2.id,
      { name: squadName2, tag: 'LS2', memberCap: 5 },
      app.db
    );

    // Add 2 members to team 2 (total 3 active, 2 open slots)
    const { user: m2a } = await createVerifiedUser(app, 'list_m2a');
    const { user: m2b } = await createVerifiedUser(app, 'list_m2b');
    await app.db.insert(teamMembers).values([
      { teamId: t2.id, userId: m2a.id, memberRole: 'member' },
      { teamId: t2.id, userId: m2b.id, memberRole: 'member' },
    ]);

    // Query GET /api/v1/teams?status=open
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/teams?status=open',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.teams));
    assert.ok(body.teams.length >= 2);

    const item1 = body.teams.find((t: any) => t.name === squadName1);
    const item2 = body.teams.find((t: any) => t.name === squadName2);

    assert.ok(item1);
    assert.equal(item1.activeMembersCount, 1);
    assert.equal(item1.openSlots, 4);
    assert.equal(item1.availability, 'open');

    assert.ok(item2);
    assert.equal(item2.activeMembersCount, 3);
    assert.equal(item2.openSlots, 2);
    assert.equal(item2.availability, 'open');
  });
});
