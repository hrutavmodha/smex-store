import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teams, teamMembers, teamJoinRequests } from '../../src/db/schema/teams.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'joinu') {
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

describe('Join Request Submission Suite (LLT 2.3)', () => {
  test('Test 9: Player submits join request with valid IGN and role', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'join_c9');
    const { user: applicant, token: applicantToken } = await createVerifiedUser(app, 'join_a9');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `JoinSquad_${Date.now()}`, tag: 'JOIN', memberCap: 5 },
      app.db
    );

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: {
        playerIgn: 'Valkyrie99',
        playerRole: 'Assassin',
        message: 'Looking for a competitive team',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.joinRequest);
    assert.equal(body.joinRequest.teamId, team.id);
    assert.equal(body.joinRequest.userId, applicant.id);
    assert.equal(body.joinRequest.playerIgn, 'Valkyrie99');
    assert.equal(body.joinRequest.playerRole, 'Assassin');
    assert.equal(body.joinRequest.status, 'pending');

    // DB record verification
    const [dbReq] = await app.db
      .select()
      .from(teamJoinRequests)
      .where(eq(teamJoinRequests.id, body.joinRequest.id));
    assert.ok(dbReq);
    assert.equal(dbReq.status, 'pending');
  });

  test('Test 10: Duplicate pending join request rejection', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'join_c10');
    const { token: applicantToken } = await createVerifiedUser(app, 'join_a10');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `DupReqSquad_${Date.now()}`, tag: 'DUPR', memberCap: 5 },
      app.db
    );

    // First request succeeds
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'Valkyrie99', playerRole: 'Assassin' },
    });
    assert.equal(res1.statusCode, 201);

    // Second request while first is pending fails with 409 Conflict
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'Valkyrie99', playerRole: 'Assassin' },
    });
    assert.equal(res2.statusCode, 409);
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.code, 'DUPLICATE_PENDING_REQUEST');
  });

  test('Test 11: Existing squad member join request rejection', async (t) => {
    const app = await build(t);
    const { user: captain, token: captainToken } = await createVerifiedUser(app, 'join_c11');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `MemberJoinSquad_${Date.now()}`, tag: 'MJS', memberCap: 5 },
      app.db
    );

    // Captain (who is already in roster) attempts to submit join request to their own squad
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${captainToken}` },
      payload: { playerIgn: 'CaptainIGN', playerRole: 'IGL' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'ALREADY_ROSTER_MEMBER');
  });

  test('Test 12: Join request to closed squad rejection', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'join_c12');
    const { token: applicantToken } = await createVerifiedUser(app, 'join_a12');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `ClosedSquad_${Date.now()}`, tag: 'CLS', memberCap: 5 },
      app.db
    );

    // Close squad
    await app.db.update(teams).set({ status: 'closed' }).where(eq(teams.id, team.id));

    // Applicant submits request to closed squad
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'HopefulPlayer', playerRole: 'Support' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'TEAM_CLOSED');
  });
});
