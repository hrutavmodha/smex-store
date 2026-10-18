import { type FastifyPluginAsync } from 'fastify';
import { eq, or, sql } from 'drizzle-orm';
import { users } from '../../db/schema/users.js';
import { marketplaceListings } from '../../db/schema/marketplace.js';
import { tournaments } from '../../db/schema/tournaments.js';

const adminMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * GET /api/v1/admin/metrics
   * Aggregates platform health, active users, active listings, and tournament metrics
   */
  fastify.get('/api/v1/admin/metrics', async (_request, reply) => {
    const startTime = performance.now();
    let databaseStatus: 'ok' | 'degraded' | 'down' = 'ok';

    try {
      await fastify.db.execute(sql`SELECT 1`);
    } catch {
      databaseStatus = 'degraded';
    }
    const dbLatencyMs = Math.round((performance.now() - startTime) * 100) / 100;

    const [userCount] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.isBanned, false));

    const [listingCount] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.status, 'active'));

    const [tournamentCount] = await fastify.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournaments)
      .where(or(eq(tournaments.status, 'ongoing'), eq(tournaments.status, 'registration_open')));

    return reply.code(200).send({
      activeUsers: userCount?.count || 0,
      activeListings: listingCount?.count || 0,
      liveTournaments: tournamentCount?.count || 0,
      databaseStatus,
      dbLatencyMs,
    });
  });
};

export default adminMetricsRoutes;
