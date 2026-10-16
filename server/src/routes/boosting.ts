import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BoostingRateService } from '../services/boosting-rate.service.js';
import {
  calculateBoostingPrice,
  ValidationError,
  DEFAULT_SURCHARGES,
} from '../services/boosting-calc.service.js';
import {
  BoostingDispatchService,
  generateOrderRef,
} from '../services/boosting-dispatch.service.js';
import { type AccessTokenPayload } from '../plugins/auth.js';

const calculateSchema = z.object({
  pricingMode: z.enum(['fixed_tier', 'per_star', 'composite']).optional().default('per_star'),
  startingRank: z.string().min(1),
  targetRank: z.string().min(1),
  startingStars: z.number().int().min(0).optional().default(0),
  targetStars: z.number().int().min(0).optional().default(0),
  addons: z
    .object({
      rolePriority: z.string().optional(),
      restrictedHeroPool: z.array(z.string()).optional(),
      duoPlayWithBooster: z.boolean().optional(),
    })
    .optional(),
});

const createOrderSchema = z.object({
  pricingMode: z.enum(['fixed_tier', 'per_star', 'composite']).optional().default('per_star'),
  startingRank: z.string().min(1),
  targetRank: z.string().min(1),
  startingStars: z.number().int().min(0).optional().default(0),
  targetStars: z.number().int().min(0).optional().default(0),
  customerIgn: z.string().min(1).max(50),
  serverId: z.string().max(50).optional().nullable(),
  contactChannel: z.enum(['whatsapp', 'instagram']).default('whatsapp'),
  addons: z
    .object({
      rolePriority: z.string().optional(),
      restrictedHeroPool: z.array(z.string()).optional(),
      duoPlayWithBooster: z.boolean().optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

const boostingRoutes: FastifyPluginAsync = async (fastify) => {
  const dispatchService = new BoostingDispatchService();

  /**
   * GET /api/v1/boosting/rates
   * Returns all active rates and surcharge multipliers
   */
  fastify.get('/api/v1/boosting/rates', async (_request, reply) => {
    const rates = await BoostingRateService.getActiveRates(fastify.db);
    return reply.code(200).send({
      rates,
      surcharges: DEFAULT_SURCHARGES,
    });
  });

  /**
   * POST /api/v1/boosting/calculate
   * Validates and performs authoritative price calculation
   */
  fastify.post('/api/v1/boosting/calculate', async (request, reply) => {
    const parseResult = calculateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid calculation parameters',
        issues: parseResult.error.issues,
      });
    }

    const rates = await BoostingRateService.getActiveRates(fastify.db);

    try {
      const calculation = calculateBoostingPrice({
        ...parseResult.data,
        rates,
      });

      return reply.code(200).send(calculation);
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        return reply.code(err.statusCode).send({
          statusCode: err.statusCode,
          error: 'Unprocessable Entity',
          message: err.message,
          code: err.code,
        });
      }
      throw err;
    }
  });

  /**
   * POST /api/v1/boosting/orders
   * Persists customer booking inquiry and returns external dispatch details
   */
  fastify.post('/api/v1/boosting/orders', async (request, reply) => {
    const parseResult = createOrderSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid order input data',
        issues: parseResult.error.issues,
      });
    }

    const data = parseResult.data;

    // Optional customer authentication check
    let customerId: string | null = null;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const payload = fastify.jwt.verify<AccessTokenPayload>(token);
        if (payload && payload.sub) {
          customerId = payload.sub;
        }
      } catch {
        // Guest mode fallback
      }
    }

    // Authoritative server-side price recalculation
    const rates = await BoostingRateService.getActiveRates(fastify.db);
    let calculation;
    try {
      calculation = calculateBoostingPrice({
        pricingMode: data.pricingMode,
        startingRank: data.startingRank,
        targetRank: data.targetRank,
        startingStars: data.startingStars,
        targetStars: data.targetStars,
        addons: data.addons,
        rates,
      });
    } catch (err: unknown) {
      if (err instanceof ValidationError) {
        return reply.code(err.statusCode).send({
          statusCode: err.statusCode,
          error: 'Unprocessable Entity',
          message: err.message,
          code: err.code,
        });
      }
      throw err;
    }

    const orderRef = generateOrderRef();

    const dispatch = dispatchService.resolveDispatch(data.contactChannel, {
      orderRef,
      customerIgn: data.customerIgn,
      serverId: data.serverId,
      startingRank: data.startingRank,
      targetRank: data.targetRank,
      startingStars: data.startingStars,
      targetStars: data.targetStars,
      pricingMode: data.pricingMode,
      totalPriceInr: calculation.totalPriceInr,
      addons: data.addons,
    });

    const dbPricingMode = data.pricingMode === 'composite' ? 'per_star' : data.pricingMode;

    const order = await BoostingRateService.createOrder(
      {
        customerId,
        gameSlug: 'mlbb',
        pricingMode: dbPricingMode as 'fixed_tier' | 'per_star',
        startingRank: data.startingRank,
        targetRank: data.targetRank,
        startingStars: data.startingStars,
        targetStars: data.targetStars,
        calculatedPriceInr: calculation.totalPriceInr,
        customerIgn: data.customerIgn,
        contactChannel: data.contactChannel,
        status: 'inquiry',
        notes: data.notes
          ? `${data.notes} | Ref: ${orderRef} | Channel: ${data.contactChannel}`
          : `Ref: ${orderRef} | Channel: ${data.contactChannel}`,
      },
      fastify.db
    );

    return reply.code(201).send({
      orderId: order.id,
      orderRef,
      status: 'inquiry',
      calculatedPriceInr: calculation.totalPriceInr,
      dispatch: {
        channel: data.contactChannel,
        destinationUrl: dispatch.destinationUrl,
        formattedText: dispatch.formattedText,
      },
    });
  });
};

export default boostingRoutes;
