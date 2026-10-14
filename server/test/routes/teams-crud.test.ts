import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teams, teamMembers, teamJoinRequests } from '../../src/db/schema/teams.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'u') {
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

describe('Squad CRUD & Capacity Limits Suite (LLT 2.1)', () => {
  test('Test 1: Authenticated squad creation initializes team and sets captain', async (t) => {
    const app = await build(t);
    const { user, token } = await createVerifiedUser(app, 'capt1');

    const squadName = `Omega_${Date.now()}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: squadName,
        tag: 'OMG',
        memberCap: 5,
        description: 'Elite competitive squad',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.equal(body.team.name, squadName);
    assert.equal(body.team.tag, 'OMG');
    assert.equal(body.team.captainId, user.id);
    assert.equal(body.team.status, 'open');
    assert.equal(body.captainMember.userId, user.id);
    assert.equal(body.captainMember.memberRole, 'captain');

    // DB verification
    const [memberInDb] = await app.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, body.team.id));
    assert.ok(memberInDb);
    assert.equal(memberInDb.memberRole, 'captain');
    assert.equal(memberInDb.userId, user.id);
  });

  test('Test 2: Duplicate squad name rejection', async (t) => {
    const app = await build(t);
    const { token: token1 } = await createVerifiedUser(app, 'capt2a');
    const { token: token2 } = await createVerifiedUser(app, 'capt2b');

    const duplicateName = `DuplicateSquad_${Date.now()}`;

    // First team creation succeeds
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: duplicateName, tag: 'DUP1' },
    });
    assert.equal(res1.statusCode, 201);

    // Second team creation with same name fails with 409 Conflict
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${token2}` },
      payload: { name: duplicateName, tag: 'DUP2' },
    });
    assert.equal(res2.statusCode, 409);
    const body = JSON.parse(res2.body);
    assert.equal(body.code, 'DUPLICATE_TEAM_NAME');
  });

  test('Test 3: Member capacity boundary constraint validation', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'capt3');

    // Test memberCap = 0 (boundary failure)
    const resLow = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `LowCap_${Date.now()}`, tag: 'LOW', memberCap: 0 },
    });
    assert.equal(resLow.statusCode, 422);
    const bodyLow = JSON.parse(resLow.body);
    assert.equal(bodyLow.code, 'INVALID_MEMBER_CAP');

    // Test memberCap = 11 (boundary failure)
    const resHigh = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `HighCap_${Date.now()}`, tag: 'HIGH', memberCap: 11 },
    });
    assert.equal(resHigh.statusCode, 422);
    const bodyHigh = JSON.parse(resHigh.body);
    assert.equal(bodyHigh.code, 'INVALID_MEMBER_CAP');
  });

  test('Test 4: Captain updates squad metadata and status', async (t) => {
    const app = await build(t);
    const { token: captainToken } = await createVerifiedUser(app, 'capt4');
    const { token: nonCaptainToken } = await createVerifiedUser(app, 'noncapt4');

    // Create squad
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { name: `MetaSquad_${Date.now()}`, tag: 'META', memberCap: 5 },
    });
    assert.equal(createRes.statusCode, 201);
    const teamId = JSON.parse(createRes.body).team.id;

    // Non-captain attempts update -> 403 Forbidden
    const unauthRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${nonCaptainToken}` },
      payload: { tag: 'HACK' },
    });
    assert.equal(unauthRes.statusCode, 403);
    const unauthBody = JSON.parse(unauthRes.body);
    assert.equal(unauthBody.code, 'CAPTAIN_PERMISSION_REQUIRED');

    // Captain updates tag and status to closed -> 200 OK
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { tag: 'NEWTAG', status: 'closed' },
    });
    assert.equal(updateRes.statusCode, 200);
    const updatedTeam = JSON.parse(updateRes.body).team;
    assert.equal(updatedTeam.tag, 'NEWTAG');
    assert.equal(updatedTeam.status, 'closed');
  });

  test('Test 5: Squad disbanding cascades to members and join requests', async (t) => {
    const app = await build(t);
    const { user: captainUser, token: captainToken } = await createVerifiedUser(app, 'capt5');
    const { user: applicantUser, token: applicantToken } = await createVerifiedUser(app, 'app5');

    // Create squad
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { name: `DisbandSquad_${Date.now()}`, tag: 'DISB', memberCap: 5 },
    });
    const teamId = JSON.parse(createRes.body).team.id;

    // Submit join request
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${teamId}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'Requester1', playerRole: 'Mage' },
    });
    assert.equal(joinRes.statusCode, 201);

    // Verify members and join requests exist in DB
    const preMembers = await app.db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    assert.equal(preMembers.length, 1);
    const preRequests = await app.db.select().from(teamJoinRequests).where(eq(teamJoinRequests.teamId, teamId));
    assert.equal(preRequests.length, 1);

    // Captain disbands squad
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
    });
    assert.equal(deleteRes.statusCode, 200);

    // Verify team is deleted
    const [teamAfter] = await app.db.select().from(teams).where(eq(teams.id, teamId));
    assert.equal(teamAfter, undefined);

    // Verify cascade removed team_members and team_join_requests
    const postMembers = await app.db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId));
    assert.equal(postMembers.length, 0);

    const postRequests = await app.db.select().from(teamJoinRequests).where(eq(teamJoinRequests.teamId, teamId));
    assert.equal(postRequests.length, 0);
  });

  test('Test 4b: Captain cannot reduce member capacity below active member count (BUG-M4-004)', async (t) => {
    const app = await build(t);
    const { token: captainToken } = await createVerifiedUser(app, 'capt4b');
    const { user: member2 } = await createVerifiedUser(app, 'mem4b_2');
    const { user: member3 } = await createVerifiedUser(app, 'mem4b_3');

    // Create squad with memberCap = 5 (1 member: captain)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { name: `CapReduction_${Date.now()}`, tag: 'CAPR', memberCap: 5 },
    });
    assert.equal(createRes.statusCode, 201);
    const teamId = JSON.parse(createRes.body).team.id;

    // Add 2 members (total 3 active members: captain + 2 members)
    await app.db.insert(teamMembers).values([
      { teamId, userId: member2.id, memberRole: 'member' },
      { teamId, userId: member3.id, memberRole: 'member' },
    ]);

    // 1. Captain attempts to reduce memberCap to 2 (below 3 active members) -> 400 Bad Request
    const belowCapRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { memberCap: 2 },
    });
    assert.equal(belowCapRes.statusCode, 400);
    const belowCapBody = JSON.parse(belowCapRes.body);
    assert.equal(belowCapBody.code, 'CAPACITY_BELOW_MEMBER_COUNT');
    assert.ok(belowCapBody.detail.includes('3 active members'));

    // 2. Captain attempts to set memberCap to 3 (equal to active members count) -> 200 OK
    const equalCapRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { memberCap: 3 },
    });
    assert.equal(equalCapRes.statusCode, 200);
    assert.equal(JSON.parse(equalCapRes.body).team.memberCap, 3);

    // 3. Captain increases memberCap to 4 -> 200 OK
    const increaseCapRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { memberCap: 4 },
    });
    assert.equal(increaseCapRes.statusCode, 200);
    assert.equal(JSON.parse(increaseCapRes.body).team.memberCap, 4);

    // 4. Invalid memberCap < 1 still returns 422
    const invalidCapRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { memberCap: 0 },
    });
    assert.equal(invalidCapRes.statusCode, 422);
    assert.equal(JSON.parse(invalidCapRes.body).code, 'INVALID_MEMBER_CAP');
  });
});
