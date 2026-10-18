import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';

describe('WebSocket Channel Authorization Suite (BUG-M8-005)', () => {
  it('Reject unauthorized eavesdropping on private user channel', async (t) => {
    const app = await build(t);
    const { user: victim } = await createVerifiedUser(app, 'ws_victim');
    const { token: attackerToken } = await createVerifiedUser(app, 'ws_attacker');

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };
    const port = address.port;

    // 1. Unauthenticated guest attempts to subscribe to victim channel
    const guestWs = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      guestWs.addEventListener('open', () => resolve());
      guestWs.addEventListener('error', (e) => reject(e));
    });

    const guestResponsePromise = new Promise<any>((resolve) => {
      guestWs.addEventListener('message', (event) => {
        resolve(JSON.parse(event.data.toString()));
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
    guestWs.close();

    // 2. Authenticated attacker attempts to subscribe to victim channel
    const attackerWs = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${attackerToken}`);
    await new Promise<void>((resolve, reject) => {
      attackerWs.addEventListener('open', () => resolve());
      attackerWs.addEventListener('error', (e) => reject(e));
    });

    const attackerResponsePromise = new Promise<any>((resolve) => {
      attackerWs.addEventListener('message', (event) => {
        resolve(JSON.parse(event.data.toString()));
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
    attackerWs.close();

    // 3. Authorized user can subscribe to their own private channel
    const { user: selfUser, token: selfToken } = await createVerifiedUser(app, 'ws_self');
    const selfWs = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${selfToken}`);
    await new Promise<void>((resolve, reject) => {
      selfWs.addEventListener('open', () => resolve());
      selfWs.addEventListener('error', (e) => reject(e));
    });

    const selfResponsePromise = new Promise<any>((resolve) => {
      selfWs.addEventListener('message', (event) => {
        resolve(JSON.parse(event.data.toString()));
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
    selfWs.close();
  });
});
