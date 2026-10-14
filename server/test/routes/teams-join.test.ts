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
        playerRole: 'Hyper',
        message: 'Looking for a competitive team',
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.ok(body.joinRequest);
    assert.equal(body.joinRequest.teamId, team.id);
    assert.equal(body.joinRequest.userId, applicant.id);
    assert.equal(body.joinRequest.playerIgn, 'Valkyrie99');
    assert.equal(body.joinRequest.playerRole, 'Hyper');
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
      payload: { playerIgn: 'Valkyrie99', playerRole: 'Hyper' },
    });
    assert.equal(res1.statusCode, 201);

    // Second request while first is pending fails with 409 Conflict
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'Valkyrie99', playerRole: 'Hyper' },
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
      payload: { playerIgn: 'CaptainIGN', playerRole: 'Roam' },
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
      payload: { playerIgn: 'HopefulPlayer', playerRole: 'Roam' },
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'TEAM_CLOSED');
  });

  test('BUG-M4-001: Applicant cancels pending join request and can re-apply', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'cancel_c1');
    const { user: applicant, token: applicantToken } = await createVerifiedUser(app, 'cancel_a1');
    const { token: otherToken } = await createVerifiedUser(app, 'cancel_other');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `CancelTestSquad_${Date.now()}`, tag: 'CTS', memberCap: 5 },
      app.db
    );

    // 1. Submit join request
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'OldIGN', playerRole: 'Mid' },
    });
    assert.equal(createRes.statusCode, 201);
    const { joinRequest } = JSON.parse(createRes.body);

    // 2. Unauthorized user cannot cancel another user's request (403)
    const unauthorizedRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/join-requests/${joinRequest.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert.equal(unauthorizedRes.statusCode, 403);

    // 3. Applicant cancels their own pending join request (200)
    const cancelRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/join-requests/${joinRequest.id}`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(cancelRes.statusCode, 200);
    const cancelBody = JSON.parse(cancelRes.body);
    assert.equal(cancelBody.success, true);
    assert.equal(cancelBody.message, 'Join request cancelled');

    // 4. Cannot cancel an already cancelled request (400)
    const repeatCancelRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/join-requests/${joinRequest.id}`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(repeatCancelRes.statusCode, 400);

    // 5. Applicant can submit a new join request without unique constraint violation
    const reapplyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'CorrectedIGN', playerRole: 'Hyper' },
    });
    assert.equal(reapplyRes.statusCode, 201);
  });

  test('Test 14: Applicant join request query mechanism and status reflection (BUG-M4-003)', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'join_c14');
    const { user: applicant, token: applicantToken } = await createVerifiedUser(app, 'join_a14');
    const { token: otherToken } = await createVerifiedUser(app, 'join_o14');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `QuerySquad_${Date.now()}`, tag: 'QRY', memberCap: 5 },
      app.db
    );

    // 1. Before submitting request: GET /teams/:id reports hasPendingRequest: false
    const preTeamRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(preTeamRes.statusCode, 200);
    const preTeamData = JSON.parse(preTeamRes.body);
    assert.equal(preTeamData.team.hasPendingRequest, false);

    // 2. Before submitting request: GET /teams/:id/my-request reports hasPendingRequest: false
    const preMyReqRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}/my-request`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(preMyReqRes.statusCode, 200);
    const preMyReqData = JSON.parse(preMyReqRes.body);
    assert.equal(preMyReqData.hasPendingRequest, false);
    assert.equal(preMyReqData.request, null);

    // 3. Applicant submits join request
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'QueryTester', playerRole: 'Roam' },
    });
    assert.equal(joinRes.statusCode, 201);
    const { joinRequest } = JSON.parse(joinRes.body);

    // 4. After submitting: GET /teams/:id with applicant token returns hasPendingRequest: true
    const postTeamRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(postTeamRes.statusCode, 200);
    const postTeamData = JSON.parse(postTeamRes.body);
    assert.equal(postTeamData.team.hasPendingRequest, true);
    assert.equal(postTeamData.team.myJoinRequest.id, joinRequest.id);

    // 5. Guest without auth header sees hasPendingRequest: false
    const guestTeamRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}`,
    });
    assert.equal(guestTeamRes.statusCode, 200);
    assert.equal(JSON.parse(guestTeamRes.body).team.hasPendingRequest, false);

    // 6. Dedicated endpoint GET /teams/:id/my-request returns applicant's request
    const postMyReqRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}/my-request`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(postMyReqRes.statusCode, 200);
    const postMyReqData = JSON.parse(postMyReqRes.body);
    assert.equal(postMyReqData.hasPendingRequest, true);
    assert.equal(postMyReqData.request.id, joinRequest.id);

    // 7. Another user querying my-request gets hasPendingRequest: false
    const otherMyReqRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}/my-request`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert.equal(otherMyReqRes.statusCode, 200);
    assert.equal(JSON.parse(otherMyReqRes.body).hasPendingRequest, false);

    // 8. When applicant cancels request, status flips back to false
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/join-requests/${joinRequest.id}`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });

    const cancelledMyReqRes = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${team.id}/my-request`,
      headers: { authorization: `Bearer ${applicantToken}` },
    });
    assert.equal(cancelledMyReqRes.statusCode, 200);
    assert.equal(JSON.parse(cancelledMyReqRes.body).hasPendingRequest, false);
  });

  test('Test 15: Invalid competitive playerRole rejection with 422 (BUG-M4-008)', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'role_c');
    const { token: applicantToken } = await createVerifiedUser(app, 'role_a');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `RoleSquad_${Date.now()}`, tag: 'ROLE', memberCap: 5 },
      app.db
    );

    // 1. Non-standardized role rejected with 422 VALIDATION_FAILED
    const invalidRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'RoleTester', playerRole: 'InvalidRole' },
    });
    assert.equal(invalidRes.statusCode, 422);
    const invalidBody = JSON.parse(invalidRes.body);
    assert.equal(invalidBody.code, 'VALIDATION_FAILED');
    assert.ok(invalidBody.detail.includes('Roam') || invalidBody.detail.includes('Invalid'));

    // 2. Standardized roles (Roam, Hyper, Exp, Gold, Mid) all succeed with 201
    const validRoles = ['Roam', 'Hyper', 'Exp', 'Gold', 'Mid'] as const;
    for (const role of validRoles) {
      const { token } = await createVerifiedUser(app, `role_${role.toLowerCase()}`);
      const validRes = await app.inject({
        method: 'POST',
        url: `/api/v1/teams/${team.id}/join-requests`,
        headers: { authorization: `Bearer ${token}` },
        payload: { playerIgn: `${role}Player`, playerRole: role },
      });
      assert.equal(validRes.statusCode, 201);
      const validBody = JSON.parse(validRes.body);
      assert.equal(validBody.joinRequest.playerRole, role);
    }
  });
});
