import { afterAll } from 'vitest';
import { createDbPool, createDbClient } from '../src/db/index.js';
import { cleanupTestData } from '../src/db/cleanup.js';

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
