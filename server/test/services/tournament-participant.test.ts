import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { tournaments, tournamentParticipants } from '../../src/db/schema/tournaments.js';
import { TeamService } from '../../src/services/team.service.js';
import { TournamentLifecycleService, TournamentLifecycleError } from '../../src/services/tournament-lifecycle.service.js';
import { TournamentParticipantService } from '../../src/services/tournament-participant.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'tpart') {
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
  return user;
}

describe('TournamentParticipantService Unit Suite (BUG-M5-006)', () => {
  test('registerSquad registers squad directly and assigns seed', async (t) => {
    const app = await build(t);
    const user = await createVerifiedUser(app, 'tpart_c1');
    const { team } = await TeamService.createTeam(
      user.id,
      { name: `ServiceTeam_${Date.now()}`, tag: 'ST1' },
      app.db
    );

    const tourney = await TournamentLifecycleService.createTournament(
      {
        title: `ServiceTourney_${Date.now()}`,
        status: 'registration_open',
        startTime: new Date(Date.now() + 86400000),
        maxTeams: 8,
      },
      app.db
    );

    const participant = await TournamentParticipantService.registerSquad(
      tourney.id,
      team.id,
      user.id,
      'user',
      app.db
    );

    assert.equal(participant.tournamentId, tourney.id);
    assert.equal(participant.teamId, team.id);
    assert.equal(participant.seed, 1);
  });

  test('registerSquad throws CAPTAIN_PERMISSION_REQUIRED when non-captain attempts registration', async (t) => {
    const app = await build(t);
    const captain = await createVerifiedUser(app, 'tpart_c2');
    const stranger = await createVerifiedUser(app, 'tpart_s2');
    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `CaptainTeam_${Date.now()}`, tag: 'CT1' },
      app.db
    );

    const tourney = await TournamentLifecycleService.createTournament(
      {
        title: `PermTourney_${Date.now()}`,
        status: 'registration_open',
        startTime: new Date(Date.now() + 86400000),
        maxTeams: 8,
      },
      app.db
    );

    await assert.rejects(
      async () => {
        await TournamentParticipantService.registerSquad(
          tourney.id,
          team.id,
          stranger.id,
          'user',
          app.db
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof TournamentLifecycleError);
        assert.equal(err.code, 'CAPTAIN_PERMISSION_REQUIRED');
        assert.equal(err.statusCode, 403);
        return true;
      }
    );
  });

  test('withdrawSquad removes squad and re-compacts seeds', async (t) => {
    const app = await build(t);
    const cap1 = await createVerifiedUser(app, 'tpart_w1');
    const cap2 = await createVerifiedUser(app, 'tpart_w2');
    const cap3 = await createVerifiedUser(app, 'tpart_w3');

    const { team: t1 } = await TeamService.createTeam(cap1.id, { name: `WTeam1_${Date.now()}`, tag: 'WT1' }, app.db);
    const { team: t2 } = await TeamService.createTeam(cap2.id, { name: `WTeam2_${Date.now()}`, tag: 'WT2' }, app.db);
    const { team: t3 } = await TeamService.createTeam(cap3.id, { name: `WTeam3_${Date.now()}`, tag: 'WT3' }, app.db);

    const tourney = await TournamentLifecycleService.createTournament(
      {
        title: `WithdrawTourney_${Date.now()}`,
        status: 'registration_open',
        startTime: new Date(Date.now() + 86400000),
        maxTeams: 8,
      },
      app.db
    );

    await TournamentParticipantService.registerSquad(tourney.id, t1.id, cap1.id, 'user', app.db);
    await TournamentParticipantService.registerSquad(tourney.id, t2.id, cap2.id, 'user', app.db);
    await TournamentParticipantService.registerSquad(tourney.id, t3.id, cap3.id, 'user', app.db);

    // Withdraw t2
    await TournamentParticipantService.withdrawSquad(tourney.id, t2.id, cap2.id, 'user', app.db);

    const remaining = await app.db
      .select()
      .from(tournamentParticipants)
      .where(eq(tournamentParticipants.tournamentId, tourney.id))
      .orderBy(tournamentParticipants.seed);

    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].teamId, t1.id);
    assert.equal(remaining[0].seed, 1);
    assert.equal(remaining[1].teamId, t3.id);
    assert.equal(remaining[1].seed, 2);
  });
});
