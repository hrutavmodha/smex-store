import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbPool, createDbClient } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(databaseUrl?: string) {
  const pool = createDbPool(databaseUrl ? { connectionString: databaseUrl } : undefined);
  const db = createDbClient(pool);

  try {
    let migrationsFolder = path.resolve(__dirname, 'migrations');
    if (!fs.existsSync(migrationsFolder)) {
      const fallback = path.resolve(__dirname, '../src/db/migrations');
      if (fs.existsSync(fallback)) {
        migrationsFolder = fallback;
      }
    }
    console.log(`[Migrations] Applying Drizzle migrations from ${migrationsFolder}...`);

    // Auto-baseline check for existing production databases:
    // If the database already has the `users` table created, but `drizzle.__drizzle_migrations`
    // has no records yet, baseline up to migration 0011 (1793000000000) so Drizzle skips
    // already-existing tables/types (0000-0011) and only executes newly pending migrations (0012+).
    try {
      await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `);

      const migrationCountRes = await pool.query(
        'SELECT COUNT(*)::int as count FROM drizzle.__drizzle_migrations'
      );
      const hasUsersTableRes = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        ) as exists
      `);

      if (migrationCountRes.rows[0]?.count === 0 && hasUsersTableRes.rows[0]?.exists) {
        console.log(
          '[Migrations] Existing schema detected without migration history. Baselining up to 0011...'
        );
        await pool.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('baseline_0011', 1793000000000)"
        );
        console.log('[Migrations] Baseline recorded. Drizzle will now apply only pending migrations.');
      }
    } catch (baselineErr) {
      console.warn('[Migrations] Baseline pre-check note:', baselineErr);
    }

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
