import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { teams, teamMembers } from '../../src/db/schema/teams.js';
import { tournaments, tournamentParticipants } from '../../src/db/schema/tournaments.js';
import { notifications } from '../../src/db/schema/notifications.js';

function createAdminToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000001') {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: `test_admin_sess_${Date.now()}_${Math.random()}`,
  });
}

describe('Milestone 9: Squad Disbandment and Roster Moderation (LLT 2.3 Tests 11-12)', () => {
  it('Test 11: Admin disbands rule-breaking squad and withdraws from upcoming tournaments', async (t) => {
    const app = await build(t);
    const { user: captain } = await createVerifiedUser(app, 'team_capt');
    const { user: adminUser } = await createVerifiedUser(app, 'team_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create a squad
    const [team] = await app.db
      .insert(teams)
      .values({
        name: `ToxicSquad_${Date.now()}`,
        tag: 'TOXIC',
        captainId: captain.id,
        memberCap: 5,
        status: 'open',
      })
      .returning();

    // Create an upcoming tournament
    const [tournament] = await app.db
      .insert(tournaments)
      .values({
        title: `Tournament_${Date.now()}`,
        gameSlug: 'mlbb',
        status: 'upcoming',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    // Register team to tournament
    await app.db.insert(tournamentParticipants).values({
      tournamentId: tournament.id,
      teamId: team.id,
    });

    // Admin disbands squad
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${team.id}/disband`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Match fixing and unsportsmanlike conduct',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.teamId, team.id);

    // Verify team status in DB transitioned to 'disbanded'
    const [updatedTeam] = await app.db
      .select({ status: teams.status })
      .from(teams)
      .where(eq(teams.id, team.id));
    assert.equal(updatedTeam.status, 'disbanded');

    // Verify team was withdrawn from upcoming tournament
    const participants = await app.db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.teamId, team.id));
    assert.equal(participants.length, 0, 'Squad must be purged from upcoming tournament participants');
  });

  it('Test 12: Disbandment notification delivery to roster', async (t) => {
    const app = await build(t);
    const ts = Date.now();
    const rosterUsers = await app.db
      .insert(users)
      .values([
        { email: `notif_capt_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`, passwordHash: 'hash', emailVerified: true },
        { email: `notif_m1_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`, passwordHash: 'hash', emailVerified: true },
        { email: `notif_m2_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`, passwordHash: 'hash', emailVerified: true },
        { email: `notif_m3_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`, passwordHash: 'hash', emailVerified: true },
        { email: `notif_m4_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`, passwordHash: 'hash', emailVerified: true },
      ])
      .returning();

    const captain = rosterUsers[0];
    const [adminUser] = await app.db
      .insert(users)
      .values({
        email: `notif_adm_${ts}_${Math.random().toString(36).slice(2, 6)}@smexstore.com`,
        passwordHash: 'hash',
        role: 'admin',
        emailVerified: true,
      })
      .returning();
    const adminToken = createAdminToken(app, adminUser.id);

    // Create a squad
    const [team] = await app.db
      .insert(teams)
      .values({
        name: `Roster5_${Date.now()}`,
        tag: 'R5',
        captainId: captain.id,
        memberCap: 5,
        status: 'open',
      })
      .returning();

    // Add 5 members to roster (captain + 4 members)
    for (const u of rosterUsers) {
      await app.db.insert(teamMembers).values({
        teamId: team.id,
        userId: u.id,
        memberRole: u.id === captain.id ? 'captain' : 'member',
      });
    }

    // Admin disbands squad
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${team.id}/disband`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Inactivity and roster abandonment',
      },
    });

    assert.equal(res.statusCode, 200);

    // Verify 5 system notification records inserted into notifications table
    for (const u of rosterUsers) {
      const userNotifs = await app.db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, u.id));

      const disbandNotif = userNotifs.find(
        (n) => n.type === 'system' && n.title === 'Squad Disbanded'
      );
      assert.ok(disbandNotif, `Member ${u.id} must receive squad disbandment notification`);
      assert.ok(
        disbandNotif.message.includes(`Squad '${team.name}' has been disbanded`),
        `Expected disbandment message, received: ${disbandNotif.message}`
      );
    }
  });
});
