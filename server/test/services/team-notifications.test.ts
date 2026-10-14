import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { TeamService } from '../../src/services/team.service.js';
import type { FastifyInstance } from 'fastify';

async function createVerifiedUser(app: FastifyInstance, prefix = 'notifu') {
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

describe('Real-Time Event Dispatch Suite (LLT 2.6)', () => {
  test('Test 20: Join request submission dispatches WebSocket event to captain', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'notif_c20');
    const { user: applicant, token: applicantToken } = await createVerifiedUser(app, 'notif_a20');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `NotifSquad1_${Date.now()}`, tag: 'NTF1', memberCap: 5 },
      app.db
    );

    // Setup Redis subscriber on captain channel user:{captainId}
    const subscriber = app.redis.duplicate();
    await subscriber.connect();

    const receivedMessages: any[] = [];
    await subscriber.subscribe(`user:${captain.id}`);
    subscriber.on('message', (ch, msg) => {
      if (ch === `user:${captain.id}`) {
        receivedMessages.push(JSON.parse(msg));
      }
    });

    // Applicant submits join request
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'Valkyrie99', playerRole: 'Hyper' },
    });
    assert.equal(res.statusCode, 201);
    const reqId = JSON.parse(res.body).joinRequest.id;

    // Small delay to allow Pub/Sub message delivery
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(receivedMessages.length >= 1, 'Captain must receive notification message');
    const notif = receivedMessages[0];
    assert.equal(notif.event, 'team:join_request');
    assert.equal(notif.channel, `user:${captain.id}`);
    assert.equal(notif.data.teamId, team.id);
    assert.equal(notif.data.requestId, reqId);
    assert.equal(notif.data.applicantId, applicant.id);
    assert.equal(notif.data.playerIgn, 'Valkyrie99');
    assert.equal(notif.data.playerRole, 'Hyper');

    await subscriber.quit();
  });

  test('Test 21: Request resolution dispatches status event to applicant', async (t) => {
    const app = await build(t);
    const { user: captain, token: captToken } = await createVerifiedUser(app, 'notif_c21');
    const { user: applicant, token: applicantToken } = await createVerifiedUser(app, 'notif_a21');

    const { team } = await TeamService.createTeam(
      captain.id,
      { name: `NotifSquad2_${Date.now()}`, tag: 'NTF2', memberCap: 5 },
      app.db
    );

    // Submit join request
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/v1/teams/${team.id}/join-requests`,
      headers: { authorization: `Bearer ${applicantToken}` },
      payload: { playerIgn: 'NinjaGamer', playerRole: 'Exp' },
    });
    assert.equal(joinRes.statusCode, 201);
    const reqId = JSON.parse(joinRes.body).joinRequest.id;

    // Setup Redis subscriber on applicant channel user:{applicantId}
    const subscriber = app.redis.duplicate();
    await subscriber.connect();

    const receivedMessages: any[] = [];
    await subscriber.subscribe(`user:${applicant.id}`);
    subscriber.on('message', (ch, msg) => {
      if (ch === `user:${applicant.id}`) {
        receivedMessages.push(JSON.parse(msg));
      }
    });

    // Captain accepts join request
    const acceptRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${team.id}/join-requests/${reqId}`,
      headers: { authorization: `Bearer ${captToken}` },
      payload: { action: 'accept' },
    });
    assert.equal(acceptRes.statusCode, 200);

    // Small delay to allow Pub/Sub message delivery
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(receivedMessages.length >= 1, 'Applicant must receive status notification');
    const notif = receivedMessages[0];
    assert.equal(notif.event, 'team:request_status');
    assert.equal(notif.channel, `user:${applicant.id}`);
    assert.equal(notif.data.teamId, team.id);
    assert.equal(notif.data.status, 'accepted');

    await subscriber.quit();
  });
});
