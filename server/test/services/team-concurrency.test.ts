import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teams, teamMembers, teamJoinRequests } from '../../src/db/schema/teams.js';
import { TeamService } from '../../src/services/team.service.js';
import { TeamJoinService } from '../../src/services/team-join.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'concu') {
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

describe('Concurrency-Safe Vacancy Locking & Race Condition Prevention (LLT 2.4)', () => {
  test('Test 13: Successful atomic join request approval', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'conc_c13');
    const { user: applicant } = await createVerifiedUser(app, 'conc_a13');

    // Create squad with memberCap = 5
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `AtomicSquad_${Date.now()}`, tag: 'ATOM', memberCap: 5 },
      app.db
    );

    // Create join request
    const joinReq = await TeamJoinService.submitJoinRequest(
      team.id,
      applicant.id,
      { playerIgn: 'AtomApplicant', playerRole: 'Tank' },
      app.db
    );

    // Captain approves join request
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${team.id}/join-requests/${joinReq.id}`,
      headers: { authorization: `Bearer ${captToken}` },
      payload: { action: 'accept' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.success, true);
    assert.equal(body.status, 'accepted');

    // Verify applicant added to team_members
    const [memberRecord] = await app.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.userId, applicant.id));
    assert.ok(memberRecord);
    assert.equal(memberRecord.teamId, team.id);
    assert.equal(memberRecord.memberRole, 'member');

    // Verify join request status updated to accepted
    const [dbReq] = await app.db
      .select()
      .from(teamJoinRequests)
      .where(eq(teamJoinRequests.id, joinReq.id));
    assert.equal(dbReq.status, 'accepted');
  });

  test('Test 14: Simultaneous approval race condition prevention on last open slot', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'conc_c14');
    const { user: app1 } = await createVerifiedUser(app, 'conc_a14_1');
    const { user: app2 } = await createVerifiedUser(app, 'conc_a14_2');

    // Create squad with memberCap = 2 (Captain takes 1 slot, exactly 1 slot remains!)
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `RaceSquad_${Date.now()}`, tag: 'RACE', memberCap: 2 },
      app.db
    );

    // Submit two join requests for the single available slot
    const req1 = await TeamJoinService.submitJoinRequest(
      team.id,
      app1.id,
      { playerIgn: 'PlayerOne', playerRole: 'Assassin' },
      app.db
    );

    const req2 = await TeamJoinService.submitJoinRequest(
      team.id,
      app2.id,
      { playerIgn: 'PlayerTwo', playerRole: 'Mage' },
      app.db
    );

    // Fire 2 concurrent approval transactions in parallel
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/v1/teams/${team.id}/join-requests/${req1.id}`,
        headers: { authorization: `Bearer ${captToken}` },
        payload: { action: 'accept' },
      }),
      app.inject({
        method: 'PATCH',
        url: `/api/v1/teams/${team.id}/join-requests/${req2.id}`,
        headers: { authorization: `Bearer ${captToken}` },
        payload: { action: 'accept' },
      }),
    ]);

    const statuses = [res1.statusCode, res2.statusCode];
    // Exactly one approval succeeds (HTTP 200) and the other fails with HTTP 409 Conflict (TEAM_ROSTER_FULL)
    assert.ok(statuses.includes(200), 'Exactly one request must succeed with HTTP 200');
    assert.ok(statuses.includes(409), 'The second request must fail with HTTP 409 Conflict');

    const conflictRes = res1.statusCode === 409 ? res1 : res2;
    const conflictBody = JSON.parse(conflictRes.body);
    assert.equal(conflictBody.code, 'TEAM_ROSTER_FULL');

    // Total roster count must not exceed capacity (must be exactly 2)
    const members = await app.db.select().from(teamMembers).where(eq(teamMembers.teamId, team.id));
    assert.equal(members.length, 2);
  });

  test('Test 15: Automatic squad status closure when roster reaches capacity', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'conc_c15');
    const { user: applicant } = await createVerifiedUser(app, 'conc_a15');

    // Create squad with memberCap = 2 (Captain is member 1, cap is 2)
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `AutoCloseSquad_${Date.now()}`, tag: 'AUTO', memberCap: 2 },
      app.db
    );
    assert.equal(team.status, 'open');

    // Submit join request
    const req = await TeamJoinService.submitJoinRequest(
      team.id,
      applicant.id,
      { playerIgn: 'FinalMember', playerRole: 'Marksman' },
      app.db
    );

    // Captain accepts final applicant
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${team.id}/join-requests/${req.id}`,
      headers: { authorization: `Bearer ${captToken}` },
      payload: { action: 'accept' },
    });
    assert.equal(res.statusCode, 200);

    // Check team status in DB: Must be automatically transitioned to 'closed'
    const [teamAfter] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    assert.equal(teamAfter.status, 'closed');
  });

  test('Test 16: Captaincy transfer serialized against concurrent member removal/leave (BUG-M4-006)', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'conc_c16');
    const { user: member, token: memberToken } = await createVerifiedUser(app, 'conc_m16');

    // Create squad with memberCap = 5
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `RaceTransferSquad_${Date.now()}`, tag: 'TXFR', memberCap: 5 },
      app.db
    );

    await app.db.insert(teamMembers).values({
      teamId: team.id,
      userId: member.id,
      memberRole: 'member',
    });

    // Fire captain transfer and member voluntary leave concurrently
    const [transferRes, leaveRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/teams/${team.id}/transfer-captaincy`,
        headers: { authorization: `Bearer ${captToken}` },
        payload: { newCaptainId: member.id },
      }),
      app.inject({
        method: 'DELETE',
        url: `/api/v1/teams/${team.id}/members/${member.id}`,
        headers: { authorization: `Bearer ${memberToken}` },
      }),
    ]);

    // Relational invariant verification:
    // Case A: Transfer won the race and committed first.
    //   -> Transfer succeeds (200).
    //   -> Member is now captain, so Member's leave request fails with 400 (CAPTAIN_CANNOT_LEAVE).
    //   -> team.captainId === member.id, and member has memberRole === 'captain'.
    // Case B: Leave won the race and committed first.
    //   -> Leave succeeds (200). Member is removed from squad.
    //   -> Transfer fails with 400 (TARGET_NOT_A_MEMBER).
    //   -> team.captainId === captain.id, captain remains memberRole === 'captain'.
    // In NO case is the database left in an inconsistent state (e.g. captainId = member.id while member not in team_members).

    const [finalTeam] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    const members = await app.db.select().from(teamMembers).where(eq(teamMembers.teamId, team.id));

    if (transferRes.statusCode === 200) {
      assert.equal(leaveRes.statusCode, 400, 'If transfer won, member is now captain and cannot leave without transferring');
      assert.equal(finalTeam.captainId, member.id);
      const newCaptInRoster = members.find((m) => m.userId === member.id);
      assert.ok(newCaptInRoster);
      assert.equal(newCaptInRoster.memberRole, 'captain');
    } else {
      assert.equal(transferRes.statusCode, 400, 'If leave won, transfer must fail because target is not a member');
      assert.equal(leaveRes.statusCode, 200);
      assert.equal(finalTeam.captainId, captain.id);
      const oldCaptInRoster = members.find((m) => m.userId === captain.id);
      assert.ok(oldCaptInRoster);
      assert.equal(oldCaptInRoster.memberRole, 'captain');
      const targetInRoster = members.find((m) => m.userId === member.id);
      assert.equal(targetInRoster, undefined);
    }
  });
});
