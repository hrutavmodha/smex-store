import { ne } from 'drizzle-orm';
import { createDbPool, createDbClient, type SmexDatabase } from './index.js';
import {
  users,
  teams,
  tournamentParticipants,
  tournamentMatches,
  boostingOrders,
  marketplaceListings,
} from './schema/index.js';

export interface CleanupResult {
  deletedUsers: number;
  deletedTeams: number;
  deletedOrders: number;
  deletedListings: number;
}

/**
 * Purges all non-admin test records from the database.
 * Preserves the seeded administrator account (admin@smexstore.com), boosting rates catalog,
 * and official platform tournaments.
 */
export async function cleanupTestData(db: SmexDatabase): Promise<CleanupResult> {
  // 1. Delete tournament matches and participants linked to test teams
  await db.delete(tournamentMatches);
  await db.delete(tournamentParticipants);

  // 2. Delete test boosting orders
  const deletedOrders = await db.delete(boostingOrders).returning();

  // 3. Delete test marketplace listings (proofs & ratings cascade automatically)
  const deletedListings = await db.delete(marketplaceListings).returning();

  // 4. Delete test teams (team_members cascade automatically)
  const deletedTeams = await db.delete(teams).returning();

  // 5. Delete all non-admin users (profiles, sessions, and activity logs cascade automatically)
  const deletedUsers = await db
    .delete(users)
    .where(ne(users.email, 'admin@smexstore.com'))
    .returning();

  return {
    deletedUsers: deletedUsers.length,
    deletedTeams: deletedTeams.length,
    deletedOrders: deletedOrders.length,
    deletedListings: deletedListings.length,
  };
}

// Standalone execution wrapper
async function run() {
  const pool = createDbPool();
  const db = createDbClient(pool);

  try {
    console.log('Starting Smex Store test data cleanup...');
    const result = await cleanupTestData(db);
    console.log('Cleanup completed successfully:', result);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during test data cleanup:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('cleanup.ts') || process.argv[1]?.endsWith('cleanup.js')) {
  run();
}
