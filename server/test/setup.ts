import { beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDbPool, createDbClient } from '../src/db/index.js';
import { cleanupTestData } from '../src/db/cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

beforeAll(async () => {
  const pool = createDbPool();
  const db = createDbClient(pool);

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, '../src/db/migrations'),
    });
  } catch (err) {
    // If migrations cannot be applied or are already managed, log non-fatal error
    console.warn('Migration run during test setup:', err);
  } finally {
    await pool.end();
  }
});

afterAll(async () => {
  const pool = createDbPool();
  const db = createDbClient(pool);

  try {
    await cleanupTestData(db);
  } catch (err) {
    // Suppress non-fatal cleanup errors during test teardown
  } finally {
    await pool.end();
  }
});

