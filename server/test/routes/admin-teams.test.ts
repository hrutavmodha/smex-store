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

  it('Test 13: Admin squad disbandment re-compacts seeds of remaining tournament participants sequentially (Bug 5)', async (t) => {
    const app = await build(t);
    const { user: adminUser } = await createVerifiedUser(app, 'adm_seeds');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create 3 squads: Squad A, Squad B, Squad C
    const squads = [];
    for (let i = 1; i <= 3; i++) {
      const { user: capt } = await createVerifiedUser(app, `capt_s${i}`);
      const [team] = await app.db
        .insert(teams)
        .values({
          name: `SeedSquad_${i}_${Date.now()}`,
          tag: `S${i}`,
          captainId: capt.id,
          memberCap: 5,
          status: 'open',
        })
        .returning();
      squads.push(team);
    }

    // Create an upcoming / registration_open tournament
    const [tournament] = await app.db
      .insert(tournaments)
      .values({
        title: `SeedTournament_${Date.now()}`,
        gameSlug: 'mlbb',
        status: 'registration_open',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    // Register 3 squads with seeds 1, 2, 3
    for (let i = 0; i < 3; i++) {
      await app.db.insert(tournamentParticipants).values({
        tournamentId: tournament.id,
        teamId: squads[i].id,
        seed: i + 1,
      });
    }

    // Admin disbands Squad B (seed 2)
    const disbandRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${squads[1].id}/disband`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Breach of rules',
      },
    });
    assert.equal(disbandRes.statusCode, 200);

    // Inspect remaining tournament participants
    const remaining = await app.db
      .select({ teamId: tournamentParticipants.teamId, seed: tournamentParticipants.seed })
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tournament.id))
      .orderBy(tournamentParticipants.seed);

    assert.equal(remaining.length, 2, 'Only 2 squads should remain in the tournament');
    // Squad A (squads[0]) must have seed 1
    assert.equal(remaining[0].teamId, squads[0].id);
    assert.equal(remaining[0].seed, 1);
    // Squad C (squads[2]) must have seed 2 (re-compacted from seed 3)
    assert.equal(remaining[1].teamId, squads[2].id);
    assert.equal(remaining[1].seed, 2);
  });

  it('Test 14: Disbanded squad members are unlocked from MLBB single squad rule and can create or join squads (Bug 1)', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'b1_capt');
    const { user: member, token: memberToken } = await createVerifiedUser(app, 'b1_member');
    const { user: adminUser } = await createVerifiedUser(app, 'b1_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create a squad with captain
    const [team] = await app.db
      .insert(teams)
      .values({
        name: `DisbandedSquad_${Date.now()}`,
        tag: 'DSQ',
        captainId: captain.id,
        memberCap: 5,
        status: 'open',
        gameSlug: 'mlbb',
      })
      .returning();

    // Add captain and member to roster
    await app.db.insert(teamMembers).values([
      { teamId: team.id, userId: captain.id, memberRole: 'captain' },
      { teamId: team.id, userId: member.id, memberRole: 'member' },
    ]);

    // Admin disbands squad
    const disbandRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/teams/${team.id}/disband`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Violating community guidelines',
      },
    });
    assert.equal(disbandRes.statusCode, 200);

    // Verify roster records purged from teamMembers
    const remainingMembers = await app.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, team.id));
    assert.equal(remainingMembers.length, 0, 'Disbanded team roster records must be purged');

    // Former member creates their own squad in MLBB - must succeed with 201
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: {
        authorization: `Bearer ${memberToken}`,
      },
      payload: {
        name: `NewSquad_${Date.now()}`,
        tag: 'NEWSQ',
        gameSlug: 'mlbb',
        memberCap: 5,
      },
    });
    assert.equal(createRes.statusCode, 201, 'Former member of disbanded squad must be able to create a new squad');

    // Create another squad for testing join request
    const { token: otherCaptToken, user: otherCapt } = await createVerifiedUser(app, 'b1_othercapt');
    const [targetTeam] = await app.db
      .insert(teams)
      .values({
        name: `TargetSquad_${Date.now()}`,
        tag: 'TSQ',
        captainId: otherCapt.id,
        memberCap: 5,
        status: 'open',
        gameSlug: 'mlbb',
      })
      .returning();
    await app.db.insert(teamMembers).values({
      teamId: targetTeam.id,
      userId: otherCapt.id,
      memberRole: 'captain',
    });

    // Former captain can submit join request to another squad without ALREADY_IN_SQUAD error
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${targetTeam.id}/join-requests`,
      headers: {
        authorization: `Bearer ${captToken}`,
      },
      payload: {
        playerIgn: 'FormerCaptain',
        playerRole: 'Exp',
        message: 'Looking for a new team',
      },
    });
    assert.equal(joinRes.statusCode, 201, 'Former captain of disbanded squad must be able to apply to another squad');
  });
});
