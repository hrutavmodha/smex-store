import { type FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import { loadEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const env = fastify.hasDecorator('config') ? fastify.config : loadEnv();
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  fastify.addHook('onClose', async () => {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  });

  fastify.decorate('redis', redis);
};

export default fp(redisPlugin, {
  name: 'redis',
  dependencies: [],
});
