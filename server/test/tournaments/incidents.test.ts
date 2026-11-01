import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { tournaments, tournamentMatches, tournamentIncidents } from '../../src/db/schema/tournaments.js';
import { notifications } from '../../src/db/schema/notifications.js';
import { TeamService } from '../../src/services/team.service.js';
import { registerSocket } from '../../src/plugins/websocket.js';
import type { UserRole } from '@smex/shared';

function createToken(app: any, userId: string, role: UserRole) {
  return app.jwt.sign({
    sub: userId,
    role,
    sessionId: crypto.randomUUID(),
  });
}

describe('Sprint 1 - Module 3: Tournament Live Monitoring & Incident Reporting', () => {
  it('TC-I1.1: Standing Manager submits incident report on ongoing match -> 201 Created', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_i1');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));
    const managerToken = createToken(app, managerUser.id, 'manager');

    const { user: cap1 } = await createVerifiedUser(app, 'cap1_i1');
    const { user: cap2 } = await createVerifiedUser(app, 'cap2_i1');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `IncTeam1_${Date.now()}`, tag: 'IT1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `IncTeam2_${Date.now()}`, tag: 'IT2' }, app.db);

    const [tourney] = await app.db.insert(tournaments).values({
      title: `Tourney_${Date.now()}`,
      startTime: new Date(),
    }).returning();

    const [match] = await app.db.insert(tournamentMatches).values({
      tournamentId: tourney.id,
      roundNumber: 1,
      matchOrder: 1,
      teamAId: team1.id,
      teamBId: team2.id,
      status: 'live',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/matches/${match.id}/incidents`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        incidentType: 'suspected_cheat',
        severity: 'critical',
        description: 'Suspicious map-awareness reported in Game 2 by observer.',
        targetTeamId: team1.id,
        targetPlayerIgn: 'SuspectPlayer99',
        evidenceUrl: 'https://clips.twitch.tv/sample-clip',
      },
    });

    assert.equal(res.statusCode, 201, 'Manager filing incident must receive HTTP 201');
    const body = JSON.parse(res.payload);
    assert.ok(body.incident.id);
    assert.equal(body.incident.status, 'flagged');
    assert.equal(body.incident.severity, 'critical');
    assert.equal(body.incident.incidentType, 'suspected_cheat');
    assert.equal(body.incident.reportedBy, managerUser.id);

    // Verify persisted in DB
    const [dbIncident] = await app.db
      .select()
      .from(tournamentIncidents)
      .where(eq(tournamentIncidents.id, body.incident.id));

    assert.ok(dbIncident);
    assert.equal(dbIncident.description, 'Suspicious map-awareness reported in Game 2 by observer.');
  });

  it('TC-I1.2: Normal user attempts to submit incident report on a match -> 403 Forbidden', async (t) => {
    const app = await build(t);

    const { user: normalUser, token: normalToken } = await createVerifiedUser(app, 'norm_i2');
    const { user: cap1 } = await createVerifiedUser(app, 'cap1_i2');
    const { user: cap2 } = await createVerifiedUser(app, 'cap2_i2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `IncTeam1_${Date.now()}`, tag: 'IT1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `IncTeam2_${Date.now()}`, tag: 'IT2' }, app.db);

    const [tourney] = await app.db.insert(tournaments).values({
      title: `Tourney_${Date.now()}`,
      startTime: new Date(),
    }).returning();

    const [match] = await app.db.insert(tournamentMatches).values({
      tournamentId: tourney.id,
      roundNumber: 1,
      matchOrder: 1,
      teamAId: team1.id,
      teamBId: team2.id,
      status: 'live',
    }).returning();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/matches/${match.id}/incidents`,
      headers: { authorization: `Bearer ${normalToken}` },
      payload: {
        incidentType: 'toxic_behavior',
        severity: 'medium',
        description: 'Verbal harassment in match lobby chat.',
      },
    });

    assert.equal(res.statusCode, 403, 'Normal user must be forbidden from filing incidents');
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INSUFFICIENT_PERMISSIONS');
  });

  it('TC-I1.3: Incident report validation (invalid severity or description < 10 chars)', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_i3');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));
    const managerToken = createToken(app, managerUser.id, 'manager');

    const fakeMatchId = crypto.randomUUID();

    // 1. Description too short (< 10 chars)
    const resShort = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/matches/${fakeMatchId}/incidents`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        incidentType: 'suspected_cheat',
        severity: 'high',
        description: 'cheat', // < 10 chars
      },
    });
    assert.equal(resShort.statusCode, 422, 'Short description must return 422');

    // 2. Invalid severity
    const resSev = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/matches/${fakeMatchId}/incidents`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        incidentType: 'suspected_cheat',
        severity: 'apocalyptic', // invalid enum
        description: 'Valid long enough description for report',
      },
    });
    assert.equal(resSev.statusCode, 422, 'Invalid severity enum must return 422');
  });

  it('TC-I1.4: Incident alert routing to Clan Leader and Admins via WebSockets and notifications', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_i4');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));
    const managerToken = createToken(app, managerUser.id, 'manager');

    const { user: cap1 } = await createVerifiedUser(app, 'cap1_i4');
    const { user: cap2 } = await createVerifiedUser(app, 'cap2_i4');
    const { user: adminUser } = await createVerifiedUser(app, 'admin_i4');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));

    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `OmegaElites_${Date.now()}`, tag: 'OMG' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `AlphaSquad_${Date.now()}`, tag: 'ALP' }, app.db);

    const [tourney] = await app.db.insert(tournaments).values({
      title: `Tourney_${Date.now()}`,
      startTime: new Date(),
    }).returning();

    const [match] = await app.db.insert(tournamentMatches).values({
      tournamentId: tourney.id,
      roundNumber: 1,
      matchOrder: 1,
      teamAId: team1.id,
      teamBId: team2.id,
      status: 'live',
    }).returning();

    // Setup mock WebSocket sockets for Clan Leader (cap1) and Admin
    const cap1Frames: any[] = [];
    const fakeSocketCap1 = new EventEmitter() as any;
    fakeSocketCap1.readyState = 1;
    fakeSocketCap1.send = (msg: string) => cap1Frames.push(JSON.parse(msg));
    registerSocket(fakeSocketCap1, app.wsGateway.clients, app.log, cap1.id);

    const adminFrames: any[] = [];
    const fakeSocketAdmin = new EventEmitter() as any;
    fakeSocketAdmin.readyState = 1;
    fakeSocketAdmin.send = (msg: string) => adminFrames.push(JSON.parse(msg));
    registerSocket(fakeSocketAdmin, app.wsGateway.clients, app.log, adminUser.id);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/matches/${match.id}/incidents`,
      headers: { authorization: `Bearer ${managerToken}` },
      payload: {
        incidentType: 'unauthorized_substitute',
        severity: 'high',
        description: 'Unregistered ringer player detected on team Omega Elites.',
        targetTeamId: team1.id,
      },
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    // Verify WebSocket frame delivered to Clan Leader
    const cap1Frame = cap1Frames.find((f) => f.event === 'TOURNAMENT_INCIDENT_FLAGGED');
    assert.ok(cap1Frame, 'Clan Leader socket must receive TOURNAMENT_INCIDENT_FLAGGED');
    assert.equal(cap1Frame.payload.incidentId, body.incident.id);
    assert.equal(cap1Frame.payload.matchId, match.id);
    assert.equal(cap1Frame.payload.severity, 'high');

    // Verify WebSocket frame delivered to Admin
    const adminFrame = adminFrames.find((f) => f.event === 'TOURNAMENT_INCIDENT_FLAGGED');
    assert.ok(adminFrame, 'Admin socket must receive TOURNAMENT_INCIDENT_FLAGGED');

    // Verify durable DB notifications inserted
    const cap1Notifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, cap1.id));
    assert.ok(cap1Notifs.length >= 1, 'Clan Leader must receive durable notification in DB');

    const adminNotifs = await app.db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, adminUser.id));
    assert.ok(adminNotifs.length >= 1, 'Admin must receive durable notification in DB');
  });

  it('TC-I1.5: Clan Leader resolves incident for own match -> 200 OK', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_i5');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    const { user: cap1, token: cap1Token } = await createVerifiedUser(app, 'cap1_i5');
    const { user: cap2 } = await createVerifiedUser(app, 'cap2_i5');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `TeamOwn1_${Date.now()}`, tag: 'TO1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `TeamOwn2_${Date.now()}`, tag: 'TO2' }, app.db);

    const [tourney] = await app.db.insert(tournaments).values({
      title: `Tourney_${Date.now()}`,
      startTime: new Date(),
    }).returning();

    const [match] = await app.db.insert(tournamentMatches).values({
      tournamentId: tourney.id,
      roundNumber: 1,
      matchOrder: 1,
      teamAId: team1.id,
      teamBId: team2.id,
      status: 'live',
    }).returning();

    const [incident] = await app.db.insert(tournamentIncidents).values({
      tournamentId: tourney.id,
      matchId: match.id,
      reportedBy: managerUser.id,
      incidentType: 'connection_manipulation',
      severity: 'medium',
      description: 'Lobby ping spikes during draft phase.',
      status: 'flagged',
    }).returning();

    // Clan Leader cap1 resolves the incident
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/incidents/${incident.id}/resolve`,
      headers: { authorization: `Bearer ${cap1Token}` },
      payload: {
        status: 'resolved',
        resolutionNotes: 'Network issue verified as local ISP drop; match remade by mutual consent.',
      },
    });

    assert.equal(res.statusCode, 200, 'Clan Leader must be able to resolve own match incident');
    const body = JSON.parse(res.payload);
    assert.equal(body.incident.status, 'resolved');
    assert.equal(body.incident.resolvedBy, cap1.id);
    assert.ok(body.incident.resolvedAt);

    // Verify in DB
    const [dbIncident] = await app.db
      .select()
      .from(tournamentIncidents)
      .where(eq(tournamentIncidents.id, incident.id));
    assert.equal(dbIncident.status, 'resolved');
    assert.equal(dbIncident.resolvedBy, cap1.id);
  });

  it('TC-I1.6: Unrelated Clan Leader attempts to resolve incident for another squad match -> 403 Forbidden', async (t) => {
    const app = await build(t);

    const { user: managerUser } = await createVerifiedUser(app, 'mgr_i6');
    await app.db.update(users).set({ role: 'manager' }).where(eq(users.id, managerUser.id));

    const { user: cap1 } = await createVerifiedUser(app, 'cap1_i6');
    const { user: cap2 } = await createVerifiedUser(app, 'cap2_i6');
    const { user: capUnrelated, token: capUnrelatedToken } = await createVerifiedUser(app, 'cap_other');

    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `TeamA_${Date.now()}`, tag: 'TA' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `TeamB_${Date.now()}`, tag: 'TB' }, app.db);
    // capUnrelated owns team3, which is NOT in this match
    await TeamService.createTeam(capUnrelated.id, { name: `TeamUnrelated_${Date.now()}`, tag: 'TU' }, app.db);

    const [tourney] = await app.db.insert(tournaments).values({
      title: `Tourney_${Date.now()}`,
      startTime: new Date(),
    }).returning();

    const [match] = await app.db.insert(tournamentMatches).values({
      tournamentId: tourney.id,
      roundNumber: 1,
      matchOrder: 1,
      teamAId: team1.id,
      teamBId: team2.id,
      status: 'live',
    }).returning();

    const [incident] = await app.db.insert(tournamentIncidents).values({
      tournamentId: tourney.id,
      matchId: match.id,
      reportedBy: managerUser.id,
      incidentType: 'suspected_cheat',
      severity: 'critical',
      description: 'Suspicious gameplay under review.',
      status: 'flagged',
    }).returning();

    // capUnrelated attempts to resolve incident for another team's match
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/incidents/${incident.id}/resolve`,
      headers: { authorization: `Bearer ${capUnrelatedToken}` },
      payload: {
        status: 'dismissed',
        resolutionNotes: 'I am dismissing this incident even though it is not my squad.',
      },
    });

    assert.equal(res.statusCode, 403, 'Unrelated Clan Leader must receive HTTP 403 Forbidden');
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INSUFFICIENT_PERMISSIONS');
  });
});
