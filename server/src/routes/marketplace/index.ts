import { type FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ListingService,
  type ListingServiceError,
  type CreateListingInput,
  type UpdateListingInput,
} from '../../services/listing.service.js';
import { StorageService } from '../../services/storage.service.js';
import { formatRfc7807 } from '../../utils/errors.js';

const proofImageSchema = z.object({
  s3Key: z.string().trim().min(1, 's3Key is required'),
  cdnUrl: z.string().trim().min(1, 'cdnUrl is required'),
  displayOrder: z.number().int().min(0).optional(),
});

const createListingSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  gameSlug: z.string().trim().max(50).optional().default('mlbb'),
  rankTier: z.string().trim().min(1, 'Rank tier is required').max(50),
  priceInr: z.coerce.number().positive('Price must be positive'),
  contactChannel: z.enum(['whatsapp', 'instagram']),
  contactHandle: z.string().trim().min(1, 'Contact handle is required').max(100),
  proofImages: z.array(proofImageSchema).optional().default([]),
});

const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  gameSlug: z.string().trim().max(50).optional(),
  rankTier: z.string().trim().min(1).max(50).optional(),
  priceInr: z.coerce.number().positive().optional(),
  contactChannel: z.enum(['whatsapp', 'instagram']).optional(),
  contactHandle: z.string().trim().min(1).max(100).optional(),
  proofImages: z.array(proofImageSchema).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'sold', 'deleted']),
});

const getListingsQuerySchema = z.object({
  q: z.string().optional(),
  gameSlug: z.string().optional(),
  rankTier: z
    .union([z.string(), z.array(z.string())])
    .transform((val) => {
      if (Array.isArray(val)) return val;
      if (val.includes(',')) return val.split(',').map((s) => s.trim());
      return val;
    })
    .optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  badgeType: z.enum(['none', 'good_deal', 'hot']).optional(),
  status: z.enum(['active', 'sold', 'deleted', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest']).optional().default('newest'),
});

export const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  const storageService = new StorageService();

  /**
   * GET /api/v1/marketplace/listings
   * Public filtered listing catalog
   */
  fastify.get('/api/v1/marketplace/listings', async (request, reply) => {
    const parseResult = getListingsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(422).send(
        formatRfc7807(422, 'VALIDATION_FAILED', 'Validation Failed', parseResult.error.issues.map((i) => i.message).join(', '))
      );
    }

    const { page, limit, ...filters } = parseResult.data;
    const offset = (page - 1) * limit;

    const { listings, total } = await ListingService.getListings(fastify.db, {
      ...filters,
      limit,
      offset,
    });

    return reply.code(200).send({
      listings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  });

  /**
   * GET /api/v1/marketplace/listings/:id
   * Public single listing detail with ordered proof images
   */
  fastify.get('/api/v1/marketplace/listings/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const listing = await ListingService.getListingById(fastify.db, id);
      return reply.code(200).send(listing);
    } catch (err: unknown) {
      const error = err as ListingServiceError;
      if (error.statusCode) {
        return reply.code(error.statusCode).send(
          formatRfc7807(error.statusCode, error.code, 'Listing Error', error.message)
        );
      }
      request.log.error(err, 'Failed to fetch listing');
      return reply.code(500).send(
        formatRfc7807(500, 'INTERNAL_SERVER_ERROR', 'Server Error', 'Failed to retrieve listing')
      );
    }
  });

  /**
   * POST /api/v1/marketplace/listings
   * Authenticated create listing with proof images
   */
  fastify.post(
    '/api/v1/marketplace/listings',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const parseResult = createListingSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(422).send(
          formatRfc7807(422, 'VALIDATION_FAILED', 'Validation Failed', parseResult.error.issues.map((i) => i.message).join(', '))
        );
      }

      const userId = request.user.sub;

      try {
        const listing = await ListingService.createListing(
          fastify.db,
          userId,
          parseResult.data as CreateListingInput
        );
        return reply.code(201).send(listing);
      } catch (err: unknown) {
        const error = err as ListingServiceError;
        if (error.statusCode) {
          return reply.code(error.statusCode).send(
            formatRfc7807(error.statusCode, error.code, 'Listing Error', error.message)
          );
        }
        request.log.error(err, 'Failed to create listing');
        return reply.code(500).send(
          formatRfc7807(500, 'INTERNAL_SERVER_ERROR', 'Server Error', 'Failed to create listing')
        );
      }
    }
  );

  /**
   * PATCH /api/v1/marketplace/listings/:id
   * Authenticated update listing metadata or price
   */
  fastify.patch(
    '/api/v1/marketplace/listings/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateListingSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(422).send(
          formatRfc7807(422, 'VALIDATION_FAILED', 'Validation Failed', parseResult.error.issues.map((i) => i.message).join(', '))
        );
      }

      const userId = request.user.sub;
      const isAdmin = request.user.role === 'admin';

      try {
        const updated = await ListingService.updateListing(
          fastify.db,
          id,
          userId,
          isAdmin,
          parseResult.data as UpdateListingInput,
          storageService
        );
        return reply.code(200).send(updated);
      } catch (err: unknown) {
        const error = err as ListingServiceError;
        if (error.statusCode) {
          return reply.code(error.statusCode).send(
            formatRfc7807(error.statusCode, error.code, 'Listing Error', error.message)
          );
        }
        request.log.error(err, 'Failed to update listing');
        return reply.code(500).send(
          formatRfc7807(500, 'INTERNAL_SERVER_ERROR', 'Server Error', 'Failed to update listing')
        );
      }
    }
  );

  /**
   * PATCH /api/v1/marketplace/listings/:id/status
   * Authenticated mark listing as sold or deleted
   */
  fastify.patch(
    '/api/v1/marketplace/listings/:id/status',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(422).send(
          formatRfc7807(422, 'VALIDATION_FAILED', 'Validation Failed', parseResult.error.issues.map((i) => i.message).join(', '))
        );
      }

      const userId = request.user.sub;
      const isAdmin = request.user.role === 'admin';

      try {
        const updated = await ListingService.updateListingStatus(
          fastify.db,
          id,
          userId,
          isAdmin,
          parseResult.data.status
        );
        return reply.code(200).send(updated);
      } catch (err: unknown) {
        const error = err as ListingServiceError;
        if (error.statusCode) {
          return reply.code(error.statusCode).send(
            formatRfc7807(error.statusCode, error.code, 'Listing Error', error.message)
          );
        }
        request.log.error(err, 'Failed to update listing status');
        return reply.code(500).send(
          formatRfc7807(500, 'INTERNAL_SERVER_ERROR', 'Server Error', 'Failed to update listing status')
        );
      }
    }
  );

  /**
   * DELETE /api/v1/marketplace/listings/:id
   * Authenticated listing removal
   */
  fastify.delete(
    '/api/v1/marketplace/listings/:id',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.user.sub;
      const isAdmin = request.user.role === 'admin';

      try {
        const result = await ListingService.deleteListing(fastify.db, id, userId, isAdmin, storageService);
        return reply.code(200).send(result);
      } catch (err: unknown) {
        const error = err as ListingServiceError;
        if (error.statusCode) {
          return reply.code(error.statusCode).send(
            formatRfc7807(error.statusCode, error.code, 'Listing Error', error.message)
          );
        }
        request.log.error(err, 'Failed to delete listing');
        return reply.code(500).send(
          formatRfc7807(500, 'INTERNAL_SERVER_ERROR', 'Server Error', 'Failed to delete listing')
        );
      }
    }
  );
};

export default marketplaceRoutes;
