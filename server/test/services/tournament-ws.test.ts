import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

function createAdminToken(app: FastifyInstance, userId: string) {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: crypto.randomUUID(),
  });
}

function waitForMessage(ws: any, predicate: (msg: any) => boolean, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for WebSocket message after ${timeoutMs}ms`));
    }, timeoutMs);

    function onMessage(data: any) {
      try {
        const text = typeof data === 'string' ? data : data.toString();
        const parsed = JSON.parse(text);
        if (predicate(parsed)) {
          cleanup();
          resolve(parsed);
        }
      } catch {
        // Ignore unparseable
      }
    }

    function cleanup() {
      clearTimeout(timer);
      ws.off('message', onMessage);
    }

    ws.on('message', onMessage);
  });
}

describe('Real-Time WebSocket Lobby and Event Dispatch Suite (LLT 2.5)', () => {
  // Test 19: Client channel subscription to tournament lobby
  test('Test 19: Client channel subscription to tournament lobby', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'ws_sub19');

    const ws = await app.injectWS(`/ws?token=${token}`);

    try {
      const subscribePromise = waitForMessage(ws, (msg) => msg.event === 'subscribed');

      ws.send(JSON.stringify({ action: 'subscribe', channel: 'tournament:test_channel_19' }));

      const confirmation = await subscribePromise;
      assert.equal(confirmation.event, 'subscribed');
      assert.equal(confirmation.channel, 'tournament:test_channel_19');
    } finally {
      ws.close();
    }
  });

  // Test 20: Bracket update event broadcast
  test('Test 20: Bracket update event broadcast', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'ws_admin20');
    const adminToken = createAdminToken(app, admin.id);

    const { user: cap1 } = await createVerifiedUser(app, 'ws20_cap1');
    const { user: cap2 } = await createVerifiedUser(app, 'ws20_cap2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `WS20_T1_${Date.now()}`, tag: 'W1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `WS20_T2_${Date.now()}`, tag: 'W2' }, app.db);

    // Create tournament and generate match
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `WSBracketTest_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 2,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team2.id },
    });

    const genRes = await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/bracket/generate`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const { matches } = JSON.parse(genRes.body);
    const match = matches[0];

    // Connect client and subscribe to tournament channel
    const { token: clientToken } = await createVerifiedUser(app, 'ws_client20');
    const ws = await app.injectWS(`/ws?token=${clientToken}`);

    try {
      const subPromise = waitForMessage(ws, (msg) => msg.event === 'subscribed');
      ws.send(JSON.stringify({ action: 'subscribe', channel: `tournament:${tournament.id}` }));
      await subPromise;

      // Prepare listener for bracket:update
      const bracketUpdatePromise = waitForMessage(
        ws,
        (msg) => msg.event === 'bracket:update' && msg.payload?.matchId === match.id
      );

      // Admin reports match score via REST
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tournaments/${tournament.id}/matches/${match.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          teamAScore: 2,
          teamBScore: 1,
          winnerId: team1.id,
        },
      });
      assert.equal(patchRes.statusCode, 200);

      // Verify WebSocket receives pushed bracket:update frame
      const received = await bracketUpdatePromise;
      assert.equal(received.event, 'bracket:update');
      assert.equal(received.channel, `tournament:${tournament.id}`);
      assert.equal(received.payload.matchId, match.id);
      assert.equal(received.payload.teamAScore, 2);
      assert.equal(received.payload.teamBScore, 1);
      assert.equal(received.payload.winnerId, team1.id);
    } finally {
      ws.close();
    }
  });

  // Test 21: Tournament state shift event broadcast
  test('Test 21: Tournament state shift event broadcast', async (t) => {
    const app = await build(t);
    const { user: admin } = await createVerifiedUser(app, 'ws_admin21');
    const adminToken = createAdminToken(app, admin.id);

    const { user: cap1 } = await createVerifiedUser(app, 'ws21_cap1');
    const { user: cap2 } = await createVerifiedUser(app, 'ws21_cap2');
    const { team: team1 } = await TeamService.createTeam(cap1.id, { name: `WS21_T1_${Date.now()}`, tag: 'W1' }, app.db);
    const { team: team2 } = await TeamService.createTeam(cap2.id, { name: `WS21_T2_${Date.now()}`, tag: 'W2' }, app.db);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/tournaments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: `WSStateShift_${Date.now()}`,
        format: 'single_elimination',
        maxTeams: 2,
        startTime: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    const tournament = JSON.parse(createRes.body);

    await app.inject({
      method: 'PATCH',
      url: `/api/v1/tournaments/${tournament.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'registration_open' },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team1.id },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/tournaments/${tournament.id}/register`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { teamId: team2.id },
    });

    // Connect client and subscribe to tournament channel
    const { token: clientToken } = await createVerifiedUser(app, 'ws_client21');
    const ws = await app.injectWS(`/ws?token=${clientToken}`);

    try {
      const subPromise = waitForMessage(ws, (msg) => msg.event === 'subscribed');
      ws.send(JSON.stringify({ action: 'subscribe', channel: `tournament:${tournament.id}` }));
      await subPromise;

      // Prepare listener for tournament:state
      const stateUpdatePromise = waitForMessage(
        ws,
        (msg) => msg.event === 'tournament:state' && msg.payload?.newStatus === 'ongoing'
      );

      // Launch tournament into ongoing
      const launchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/tournaments/${tournament.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { status: 'ongoing' },
      });
      assert.equal(launchRes.statusCode, 200);

      // Verify WebSocket receives pushed tournament:state frame
      const received = await stateUpdatePromise;
      assert.equal(received.event, 'tournament:state');
      assert.equal(received.channel, `tournament:${tournament.id}`);
      assert.equal(received.payload.previousStatus, 'registration_open');
      assert.equal(received.payload.newStatus, 'ongoing');
    } finally {
      ws.close();
    }
  });
});
