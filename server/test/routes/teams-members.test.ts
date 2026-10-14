import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq, and } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teams, teamMembers } from '../../src/db/schema/teams.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'memu') {
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

describe('Roster Member & Captaincy Management Suite (LLT 2.5)', () => {
  test('Test 16: Captain kicks non-captain member from roster', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'mem_c16');
    const { user: member } = await createVerifiedUser(app, 'mem_m16');

    // Create squad with memberCap = 5
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `KickSquad_${Date.now()}`, tag: 'KICK', memberCap: 5 },
      app.db
    );

    // Add member to roster
    await app.db.insert(teamMembers).values({
      teamId: team.id,
      userId: member.id,
      memberRole: 'member',
    });

    // Check before count
    const teamBefore = await TeamService.getTeamById(team.id, app.db);
    assert.equal(teamBefore?.activeMembersCount, 2);
    assert.equal(teamBefore?.openSlots, 3);

    // Captain kicks member
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${member.id}`,
      headers: { authorization: `Bearer ${captToken}` },
    });
    assert.equal(res.statusCode, 200);

    // Member row removed from team_members
    const [memberDb] = await app.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, member.id)));
    assert.equal(memberDb, undefined);

    // Open slots incremented
    const teamAfter = await TeamService.getTeamById(team.id, app.db);
    assert.equal(teamAfter?.activeMembersCount, 1);
    assert.equal(teamAfter?.openSlots, 4);
  });

  test('Test 17: Member voluntarily leaves squad', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'mem_c17');
    const { user: member, token: memberToken } = await createVerifiedUser(app, 'mem_m17');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `LeaveSquad_${Date.now()}`, tag: 'LEAV', memberCap: 5 },
      app.db
    );

    await app.db.insert(teamMembers).values({
      teamId: team.id,
      userId: member.id,
      memberRole: 'member',
    });

    // Captain attempts to voluntarily leave -> blocked with 400 Bad Request
    const captLeaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${captain.id}`,
      headers: { authorization: `Bearer ${captToken}` },
    });
    assert.equal(captLeaveRes.statusCode, 400);
    const captLeaveBody = JSON.parse(captLeaveRes.body);
    assert.equal(captLeaveBody.code, 'CAPTAIN_CANNOT_LEAVE');

    // Member voluntarily leaves -> 200 OK
    const memberLeaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${member.id}`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    assert.equal(memberLeaveRes.statusCode, 200);

    // Member no longer in squad
    const [dbMember] = await app.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, member.id)));
    assert.equal(dbMember, undefined);
  });

  test('Test 17b: Member removal does not involuntarily reopen squad closed by captain (BUG-M4-005)', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'mem_c17b');
    const { user: member1, token: memberToken1 } = await createVerifiedUser(app, 'mem_m17b1');
    const { user: member2 } = await createVerifiedUser(app, 'mem_m17b2');

    // 1. Captain creates squad with memberCap = 5 (Captain is member 1)
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `StayClosed_${Date.now()}`, tag: 'STAY', memberCap: 5 },
      app.db
    );

    // 2. Add 2 members (Total 3 active members: captain + 2 members, 2 slots open)
    await app.db.insert(teamMembers).values([
      { teamId: team.id, userId: member1.id, memberRole: 'member' },
      { teamId: team.id, userId: member2.id, memberRole: 'member' },
    ]);

    // 3. Captain explicitly closes the squad
    const closeRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${team.id}`,
      headers: { authorization: `Bearer ${captToken}` },
      payload: { status: 'closed' },
    });
    assert.equal(closeRes.statusCode, 200);

    const [closedTeam] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    assert.equal(closedTeam.status, 'closed');

    // 4. One member voluntarily leaves the squad
    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${member1.id}`,
      headers: { authorization: `Bearer ${memberToken1}` },
    });
    assert.equal(leaveRes.statusCode, 200);

    // 5. Verify squad status is STILL 'closed', NOT involuntarily reopened to 'open'
    const [teamAfterLeave] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    assert.equal(teamAfterLeave.status, 'closed');

    // 6. Captain kicks second member
    const kickRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${member2.id}`,
      headers: { authorization: `Bearer ${captToken}` },
    });
    assert.equal(kickRes.statusCode, 200);

    // 7. Verify squad status remains 'closed' after kick
    const [teamAfterKick] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    assert.equal(teamAfterKick.status, 'closed');
  });

  test('Test 18: Captaincy transfer reassigns team ownership', async (t) => {
    const app = await build(t);
    const { user: oldCaptain, token: captToken } = await createVerifiedUser(app, 'mem_c18');
    const { user: newCaptain } = await createVerifiedUser(app, 'mem_nc18');

    const { team } = await TeamService.createTeam(
      oldCaptain.id,
      { name: `TransferSquad_${Date.now()}`, tag: 'XFER', memberCap: 5 },
      app.db
    );

    await app.db.insert(teamMembers).values({
      teamId: team.id,
      userId: newCaptain.id,
      memberRole: 'member',
    });

    // Captain transfers captaincy to newCaptain
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/transfer-captaincy`,
      headers: { authorization: `Bearer ${captToken}` },
      payload: { newCaptainId: newCaptain.id },
    });
    assert.equal(res.statusCode, 200);

    // Check teams table: captain_id updated
    const [teamDb] = await app.db.select().from(teams).where(eq(teams.id, team.id));
    assert.equal(teamDb.captainId, newCaptain.id);

    // Check old captain role in team_members: demoted to 'member'
    const [oldCaptMember] = await app.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, oldCaptain.id)));
    assert.equal(oldCaptMember.memberRole, 'member');

    // Check new captain role in team_members: promoted to 'captain'
    const [newCaptMember] = await app.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, newCaptain.id)));
    assert.equal(newCaptMember.memberRole, 'captain');
  });

  test('Test 19: Non-captain unauthorized mutation rejection', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'mem_c19');
    const { user: member1, token: member1Token } = await createVerifiedUser(app, 'mem_m19_1');
    const { user: member2 } = await createVerifiedUser(app, 'mem_m19_2');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `UnauthSquad_${Date.now()}`, tag: 'NOPE', memberCap: 5 },
      app.db
    );

    await app.db.insert(teamMembers).values([
      { teamId: team.id, userId: member1.id, memberRole: 'member' },
      { teamId: team.id, userId: member2.id, memberRole: 'member' },
    ]);

    // Regular member attempts to kick another member -> 403 Forbidden
    const kickRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${team.id}/members/${member2.id}`,
      headers: { authorization: `Bearer ${member1Token}` },
    });
    assert.equal(kickRes.statusCode, 403);
    const kickBody = JSON.parse(kickRes.body);
    assert.equal(kickBody.code, 'CAPTAIN_PERMISSION_REQUIRED');

    // Regular member attempts to update squad metadata -> 403 Forbidden
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${team.id}`,
      headers: { authorization: `Bearer ${member1Token}` },
      payload: { tag: 'MUTATE' },
    });
    assert.equal(patchRes.statusCode, 403);
    const patchBody = JSON.parse(patchRes.body);
    assert.equal(patchBody.code, 'CAPTAIN_PERMISSION_REQUIRED');
  });
});
