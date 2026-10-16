import fp from 'fastify-plugin';
import { type FastifyPluginAsync } from 'fastify';
import type pg from 'pg';
import {
  createDbPool,
  createDbClient,
  type SmexDatabase,
  type DbPoolConfig,
} from '../db/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: SmexDatabase;
    dbPool: pg.Pool;
  }
}

export interface DbPluginOptions {
  poolConfig?: Partial<DbPoolConfig>;
}

const dbPlugin: FastifyPluginAsync<DbPluginOptions> = async (fastify, opts) => {
  const pool = createDbPool(opts.poolConfig, fastify.config);
  const db = createDbClient(pool);

  fastify.decorate('dbPool', pool);
  fastify.decorate('db', db);

interface ClosablePool extends pg.Pool {
  ending: boolean;
  ended: boolean;
}

  fastify.addHook('onClose', async (instance) => {
    const poolInstance = instance.dbPool as ClosablePool | undefined;
    if (
      poolInstance &&
      !poolInstance.ending &&
      !poolInstance.ended
    ) {
      await poolInstance.end();
    }
  });
};

export default fp(dbPlugin, {
  name: 'db',
});
