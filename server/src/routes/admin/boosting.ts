import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BoostingRateService } from '../../services/boosting-rate.service.js';

const updateRateSchema = z.object({
  priceInr: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
  minStars: z.number().int().optional(),
  maxStars: z.number().int().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['inquiry', 'confirmed', 'in_progress', 'completed', 'cancelled']),
  notes: z.string().optional(),
});

const adminBoostingRoutes: FastifyPluginAsync = async (fastify) => {
  // Apply authentication and admin role enforcement
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
    if (reply.sent) return;
    await fastify.adminGuard(request, reply);
  });

  /**
   * GET /api/v1/admin/boosting/rates
   * Fetches all rates including inactive or historical rate rows
   */
  fastify.get('/api/v1/admin/boosting/rates', async (_request, reply) => {
    const rates = await BoostingRateService.getAllRates(fastify.db);
    return reply.code(200).send({ rates });
  });

  /**
   * PATCH /api/v1/admin/boosting/rates/:id
   * Updates pricing or star boundaries for a specific rate row
   */
  fastify.patch('/api/v1/admin/boosting/rates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateRateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid rate update parameters',
        issues: parseResult.error.issues,
      });
    }

    const updated = await BoostingRateService.updateRate(id, parseResult.data, fastify.db);
    if (!updated) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Rate row not found',
      });
    }

    return reply.code(200).send(updated);
  });

  /**
   * GET /api/v1/admin/boosting/orders
   * Lists all boosting orders with optional status/channel filters and pagination
   */
  fastify.get('/api/v1/admin/boosting/orders', async (request, reply) => {
    const query = request.query as {
      status?: string;
      channel?: string;
      page?: string;
      limit?: string;
    };

    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const offset = (page - 1) * limit;

    const orders = await BoostingRateService.getOrders(
      {
        status: query.status,
        channel: query.channel,
        limit,
        offset,
      },
      fastify.db
    );

    return reply.code(200).send({ orders, page, limit });
  });

  /**
   * PATCH /api/v1/admin/boosting/orders/:id/status
   * Transitions order lifecycle status and updates administrative notes
   */
  fastify.patch('/api/v1/admin/boosting/orders/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateOrderStatusSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid status update parameters',
        issues: parseResult.error.issues,
      });
    }

    const { status, notes } = parseResult.data;
    try {
      const updated = await BoostingRateService.updateOrderStatus(id, status, notes, fastify.db);
      if (!updated) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Order not found',
        });
      }
      return reply.code(200).send(updated);
    } catch (err: any) {
      if (err.name === 'ValidationError' || err.statusCode) {
        return reply.code(err.statusCode || 400).send({
          statusCode: err.statusCode || 400,
          error: err.code || 'Bad Request',
          message: err.message,
        });
      }
      throw err;
    }
  });
};

export default adminBoostingRoutes;
