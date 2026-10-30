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
export type SmexTransaction = Parameters<Parameters<SmexDatabase['transaction']>[0]>[0];
export type DbOrTx = SmexDatabase | SmexTransaction;

export function getDbPoolConfig(
  envConfig?: EnvConfig,
  overrides?: Partial<DbPoolConfig>
): DbPoolConfig {
  const connectionString =
    overrides?.connectionString ||
    envConfig?.DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/smex_store';

  const isProd = (envConfig?.NODE_ENV || process.env.NODE_ENV) === 'production';

  return {
    connectionString,
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
