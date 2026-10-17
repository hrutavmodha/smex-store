import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import appPlugin, { options as defaultOptions } from '../src/app.js';
import { cleanupTestData } from '../src/db/cleanup.js';

export type TestContext = {
  after?: (fn: () => any) => void;
  onTestFinished?: (fn: () => any) => void;
};

function config() {
  return {
    skipOverride: true,
  };
}

async function build(
  t?: TestContext,
  configure?: (app: FastifyInstance) => Promise<void> | void
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Wrap appPlugin with fastify-plugin to ensure all decorators are exposed at the root instance
  await app.register(fp(appPlugin as any, { name: 'app-test-wrapper' }), defaultOptions);
  if (configure) {
    await configure(app);
  }
  await app.ready();

  // Clear any residual rate-limit or search cache keys from prior runs to ensure test determinism
  if (app.redis) {
    const rlKeys = await app.redis.keys('fastify-rate-limit-*');
    if (rlKeys.length > 0) {
      await app.redis.del(...rlKeys);
    }
    const searchKeys = await app.redis.keys('search:*');
    if (searchKeys.length > 0) {
      await app.redis.del(...searchKeys);
    }
  }

  if (t) {
    if ('onTestFinished' in t && typeof (t as any).onTestFinished === 'function') {
      (t as any).onTestFinished(() => void app.close());
    } else if ('after' in t && typeof (t as any).after === 'function') {
      (t as any).after(() => void app.close());
    }
  }

  return app;
}

async function createVerifiedUser(app: FastifyInstance, prefix = 'u') {
  const { users } = await import('../src/db/schema/users.js');
  const { eq } = await import('drizzle-orm');
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

export { config, build, cleanupTestData, createVerifiedUser };

