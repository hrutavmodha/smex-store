import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  MarketplaceModerationService,
  MarketplaceModerationError,
} from '../../services/marketplace-moderation.service.js';

const takedownListingSchema = z.object({
  reason: z.string().min(1, 'Takedown reason is required'),
});

const suspendSellerSchema = z.object({
  reason: z.string().optional(),
});

const adminMarketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * GET /api/v1/admin/marketplace/queue
   * Lists reported and pending review marketplace listings with seller transaction history
   */
  fastify.get('/api/v1/admin/marketplace/queue', async (_request, reply) => {
    const result = await MarketplaceModerationService.getModerationQueue(fastify.db);
    return reply.code(200).send(result);
  });

  /**
   * POST /api/v1/admin/marketplace/listings/:id/takedown
   * Deletes a fraudulent listing, triggers S3 cleanup for proofs, and writes audit log
   */
  fastify.post('/api/v1/admin/marketplace/listings/:id/takedown', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = takedownListingSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'VALIDATION_FAILED',
        message: 'Takedown reason is required',
        issues: parseResult.error.issues,
      });
    }

    try {
      const result = await MarketplaceModerationService.takedownListing(
        id,
        parseResult.data.reason,
        request.user.sub,
        fastify.db
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof MarketplaceModerationError) {
        return reply.code(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.code,
          code: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * POST /api/v1/admin/marketplace/sellers/:id/suspend
   * Bans a seller account, bulk-deletes active listings, and evicts all sessions
   */
  fastify.post('/api/v1/admin/marketplace/sellers/:id/suspend', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = suspendSellerSchema.safeParse(request.body || {});
    const reason =
      parseResult.success && parseResult.data.reason
        ? parseResult.data.reason
        : 'Seller account suspended for fraudulent behavior';

    try {
      const result = await MarketplaceModerationService.suspendSeller(
        id,
        reason,
        request.user.sub,
        fastify.db,
        fastify.redis,
        fastify.wsGateway
      );

      return reply.code(200).send(result);
    } catch (err) {
      if (err instanceof MarketplaceModerationError) {
        return reply.code(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.code,
          code: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  });
};

export default adminMarketplaceRoutes;
