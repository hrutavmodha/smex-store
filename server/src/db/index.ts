import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { getEnv, type EnvConfig } from '../config/env.js';

export * from './schema/index.js';

export interface DbPoolConfig {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  allowExitOnIdle: boolean;
}

export type SmexDatabase = NodePgDatabase<typeof schema>;

export function getDbPoolConfig(
  envConfig?: EnvConfig,
  overrides?: Partial<DbPoolConfig>
): DbPoolConfig {
  const env = envConfig ?? getEnv();
  const isProd = env.NODE_ENV === 'production';

  return {
    connectionString: env.DATABASE_URL,
    max: isProd ? 20 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: false,
    ...overrides,
  };
}

export function createDbPool(
  overrides?: Partial<DbPoolConfig>,
  envConfig?: EnvConfig
): pg.Pool {
  const config = getDbPoolConfig(envConfig, overrides);
  return new pg.Pool(config);
}

export function createDbClient(pool: pg.Pool): SmexDatabase {
  return drizzle(pool, { schema });
}
