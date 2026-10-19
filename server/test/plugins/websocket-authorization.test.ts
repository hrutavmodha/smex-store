import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';

describe('WebSocket Channel Authorization Suite (BUG-M8-005)', () => {
  it('Reject unauthorized eavesdropping on private user channel', async (t) => {
    const app = await build(t);
    const { user: victim } = await createVerifiedUser(app, 'ws_victim');
    const { token: attackerToken } = await createVerifiedUser(app, 'ws_attacker');

    // 1. Unauthenticated guest attempts to subscribe to victim channel
    const guestWs = await app.injectWS('/ws', { socket: { remoteAddress: '127.0.0.1' } });

    const guestResponsePromise = new Promise<any>((resolve) => {
      guestWs.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    guestWs.send(
      JSON.stringify({
        action: 'subscribe',
        channel: `user:${victim.id}`,
      })
    );

    const guestResponse = await guestResponsePromise;
    assert.equal(guestResponse.event, 'error');
    assert.equal(guestResponse.code, 'FORBIDDEN_CHANNEL');
    assert.ok(guestResponse.message.includes('not authorized'));
    guestWs.terminate();

    // 2. Authenticated attacker attempts to subscribe to victim channel
    const attackerWs = await app.injectWS(`/ws?token=${attackerToken}`, {
      socket: { remoteAddress: '127.0.0.1' },
    });

    const attackerResponsePromise = new Promise<any>((resolve) => {
      attackerWs.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    attackerWs.send(
      JSON.stringify({
        action: 'subscribe',
        channel: `user:${victim.id}`,
      })
    );

    const attackerResponse = await attackerResponsePromise;
    assert.equal(attackerResponse.event, 'error');
    assert.equal(attackerResponse.code, 'FORBIDDEN_CHANNEL');
    attackerWs.terminate();

    // 3. Authorized user can subscribe to their own private channel
    const { user: selfUser, token: selfToken } = await createVerifiedUser(app, 'ws_self');
    const selfWs = await app.injectWS(`/ws?token=${selfToken}`, {
      socket: { remoteAddress: '127.0.0.1' },
    });

    const selfResponsePromise = new Promise<any>((resolve) => {
      selfWs.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    selfWs.send(
      JSON.stringify({
        action: 'subscribe',
        channel: `user:${selfUser.id}`,
      })
    );

    const selfResponse = await selfResponsePromise;
    assert.equal(selfResponse.event, 'subscribed');
    assert.equal(selfResponse.channel, `user:${selfUser.id}`);
    selfWs.terminate();
  });
});
