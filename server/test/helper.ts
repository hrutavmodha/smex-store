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

async function build(t?: TestContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Wrap appPlugin with fastify-plugin to ensure all decorators are exposed at the root instance
  await app.register(fp(appPlugin as any, { name: 'app-test-wrapper' }), defaultOptions);
  await app.ready();

  // Clear any residual rate-limit keys from prior runs to ensure test determinism
  if (app.redis) {
    const rlKeys = await app.redis.keys('fastify-rate-limit-*');
    if (rlKeys.length > 0) {
      await app.redis.del(...rlKeys);
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

export { config, build, cleanupTestData };
