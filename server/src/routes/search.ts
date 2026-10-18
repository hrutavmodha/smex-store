import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SearchService } from '../services/search.service.js';
import { type SearchCategory } from '@smex/shared';
import { searchRateLimitConfig } from '../plugins/rate-limit.js';
import { formatRfc7807 } from '../utils/errors.js';

const searchQuerySchema = z.object({
  q: z.string().default(''),
  category: z
    .enum(['all', 'tournaments', 'teams', 'players', 'marketplace'])
    .default('all'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/search',
    {
      config: {
        rateLimit: searchRateLimitConfig,
      },
    },
    async (request, reply) => {
      const parsed = searchQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.code(400).send(
          formatRfc7807(
            400,
            'VALIDATION_FAILED',
            'Validation Error',
            parsed.error.issues[0]?.message ?? 'Invalid search query',
            request.url
          )
        );
      }

      const { q, category, limit, offset } = parsed.data;
      if (!q || q.trim().length < 2) {
        return reply.code(400).send(
          formatRfc7807(
            400,
            'QUERY_TOO_SHORT',
            'Validation Error',
            'Search query must be at least 2 characters long',
            request.url
          )
        );
      }

      try {
        const results = await SearchService.search(
          q,
          {
            category: category as SearchCategory,
            limit,
            offset,
          },
          fastify.db,
          fastify.redis
        );

        return reply.code(200).send(results);
      } catch (err: unknown) {
        const error = err as { statusCode?: number; code?: string; message?: string };
        if (error.code === 'QUERY_TOO_SHORT' || error.statusCode === 400) {
          return reply.code(400).send(
            formatRfc7807(
              400,
              'QUERY_TOO_SHORT',
              'Validation Error',
              error.message ?? 'Search query must be at least 2 characters long',
              request.url
            )
          );
        }
        throw err;
      }
    }
  );
};

export default searchRoutes;
