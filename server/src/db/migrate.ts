import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbPool, createDbClient } from './index.js';
import { loadEnv } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const env = loadEnv();
  const pool = createDbPool(undefined, env);
  const db = createDbClient(pool);

  try {
    const migrationsFolder = path.resolve(__dirname, 'migrations');
    console.log(`[Migrations] Applying Drizzle migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log('[Migrations] All migrations successfully applied.');
  } finally {
    await pool.end();
  }
}

const isMain =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('migrate.ts') ||
    process.argv[1].endsWith('migrate.js') ||
    process.argv[1].endsWith('migrate.mjs'));

if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migrations] Migration failed:', err);
      process.exit(1);
    });
}
