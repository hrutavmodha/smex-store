import { eq, and, sql, desc, asc, gte, lte, inArray, ilike } from 'drizzle-orm';
import type { SmexDatabase } from '../db/index.js';
import {
  marketplaceListings,
  listingProofs,
  type MarketplaceListing,
  type ListingProof,
} from '../db/schema/marketplace.js';
import { profiles } from '../db/schema/users.js';
import { sellerRatings } from '../db/schema/reviews.js';
import { BadgeService, type BadgeType } from './badge.service.js';

export interface ListingServiceError extends Error {
  statusCode: number;
  code: string;
}

export function createListingError(
  message: string,
  statusCode: number,
  code: string
): ListingServiceError {
  const err = new Error(message) as ListingServiceError;
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

export interface ProofImageInput {
  s3Key: string;
  cdnUrl: string;
  displayOrder?: number;
}

export interface CreateListingInput {
  title: string;
  gameSlug?: string;
  rankTier: string;
  priceInr: number;
  contactChannel: 'whatsapp' | 'instagram';
  contactHandle: string;
  proofImages?: ProofImageInput[];
}

export interface UpdateListingInput {
  title?: string;
  gameSlug?: string;
  rankTier?: string;
  priceInr?: number;
  contactChannel?: 'whatsapp' | 'instagram';
  contactHandle?: string;
  proofImages?: ProofImageInput[];
}


export interface ListingFilterOptions {
  q?: string;
  gameSlug?: string;
  rankTier?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  badgeType?: BadgeType;
  status?: 'active' | 'sold' | 'deleted' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'newest';
}

export interface ListingDetail extends MarketplaceListing {
  discountPct?: number;
  proofImages: ListingProof[];
  seller: {
    userId: string;
    username: string;
    avatarPreset: string;
    inGameId?: string | null;
    reputationScore: number;
    reviewCount: number;
    completedSales: number;
  };
}

export class ListingService {
  public static async createListing(
    db: SmexDatabase,
    userId: string,
    input: CreateListingInput
  ): Promise<MarketplaceListing & { proofImages: ListingProof[] }> {
    const {
      title,
      gameSlug = 'mlbb',
      rankTier,
      priceInr,
      contactChannel,
      contactHandle,
      proofImages = [],
    } = input;

    if (priceInr < 100) {
      throw createListingError(
        'Listing price must be at least ₹100',
        422,
        'INVALID_PRICE_FLOOR'
      );
    }

    const initialBadge = BadgeService.computeInitialBadge({ priceInr, rankTier });
    const formattedPrice = priceInr.toFixed(2);

    return await db.transaction(async (tx) => {
      const [listing] = await tx
        .insert(marketplaceListings)
        .values({
          sellerId: userId,
          title: title.trim(),
          gameSlug: gameSlug.trim(),
          rankTier: rankTier.trim(),
          priceInr: formattedPrice,
          baselinePriceInr: formattedPrice,
          badgeType: initialBadge.badgeType,
          status: 'active',
          contactChannel,
          contactHandle: contactHandle.trim(),
        })
        .returning();

      let createdProofs: ListingProof[] = [];
      if (proofImages.length > 0) {
        const proofsToInsert = proofImages.map((proof, idx) => ({
          listingId: listing.id,
          s3Key: proof.s3Key,
          cdnUrl: proof.cdnUrl,
          displayOrder: proof.displayOrder ?? idx,
        }));

        createdProofs = await tx
          .insert(listingProofs)
          .values(proofsToInsert)
          .returning();
      }

      return {
        ...listing,
        proofImages: createdProofs.sort((a, b) => a.displayOrder - b.displayOrder),
      };
    });
  }

  public static async getListings(
    db: SmexDatabase,
    filters: ListingFilterOptions = {}
  ): Promise<{ listings: ListingDetail[]; total: number }> {
    const {
      q,
      gameSlug,
      rankTier,
      minPrice,
      maxPrice,
      badgeType,
      status = 'active',
      limit = 20,
      offset = 0,
      sortBy = 'newest',
    } = filters;

    const conditions = [];

    if (status !== 'all') {
      conditions.push(eq(marketplaceListings.status, status));
    } else {
      conditions.push(sql`${marketplaceListings.status} != 'deleted'`);
    }

    if (gameSlug) {
      conditions.push(eq(marketplaceListings.gameSlug, gameSlug));
    }

    if (rankTier) {
      if (Array.isArray(rankTier)) {
        if (rankTier.length > 0) {
          conditions.push(inArray(marketplaceListings.rankTier, rankTier));
        }
      } else {
        conditions.push(eq(marketplaceListings.rankTier, rankTier));
      }
    }

    if (minPrice !== undefined) {
      conditions.push(gte(marketplaceListings.priceInr, minPrice.toFixed(2)));
    }

    if (maxPrice !== undefined) {
      conditions.push(lte(marketplaceListings.priceInr, maxPrice.toFixed(2)));
    }

    if (badgeType) {
      conditions.push(eq(marketplaceListings.badgeType, badgeType));
    }

    if (q) {
      conditions.push(ilike(marketplaceListings.title, `%${q.trim()}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderByClause;
    if (sortBy === 'price_asc') {
      orderByClause = asc(marketplaceListings.priceInr);
    } else if (sortBy === 'price_desc') {
      orderByClause = desc(marketplaceListings.priceInr);
    } else {
      orderByClause = desc(marketplaceListings.createdAt);
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceListings)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const baseListings = await db
      .select({
        listing: marketplaceListings,
        sellerUsername: profiles.username,
        sellerAvatar: profiles.avatarPreset,
        sellerInGameId: profiles.inGameId,
      })
      .from(marketplaceListings)
      .leftJoin(profiles, eq(marketplaceListings.sellerId, profiles.userId))
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    if (baseListings.length === 0) {
      return { listings: [], total };
    }

    const listingIds = baseListings.map((r) => r.listing.id);
    const allProofs = await db
      .select()
      .from(listingProofs)
      .where(inArray(listingProofs.listingId, listingIds))
      .orderBy(asc(listingProofs.displayOrder));

    const proofsByListing = new Map<string, ListingProof[]>();
    for (const proof of allProofs) {
      const list = proofsByListing.get(proof.listingId) || [];
      list.push(proof);
      proofsByListing.set(proof.listingId, list);
    }

    const detailedListings: ListingDetail[] = baseListings.map((row) => {
      const listing = row.listing;
      const proofs = proofsByListing.get(listing.id) || [];

      let discountPct = 0;
      if (listing.badgeType === 'good_deal' && listing.baselinePriceInr) {
        const baseline = Number(listing.baselinePriceInr);
        const current = Number(listing.priceInr);
        if (baseline > current) {
          discountPct = Math.round(((baseline - current) / baseline) * 100);
        }
      }

      return {
        ...listing,
        discountPct,
        proofImages: proofs,
        seller: {
          userId: listing.sellerId,
          username: row.sellerUsername || 'Anonymous Gamer',
          avatarPreset: row.sellerAvatar || 'preset_default_01',
          inGameId: row.sellerInGameId || null,
          reputationScore: 5.0,
          reviewCount: 0,
          completedSales: 0,
        },
      };
    });

    return { listings: detailedListings, total };
  }

  public static async getListingById(
    db: SmexDatabase,
    id: string
  ): Promise<ListingDetail> {
    const [row] = await db
      .select({
        listing: marketplaceListings,
        sellerUsername: profiles.username,
        sellerAvatar: profiles.avatarPreset,
        sellerInGameId: profiles.inGameId,
      })
      .from(marketplaceListings)
      .leftJoin(profiles, eq(marketplaceListings.sellerId, profiles.userId))
      .where(eq(marketplaceListings.id, id));

    if (!row) {
      throw createListingError('Listing not found', 404, 'LISTING_NOT_FOUND');
    }

    const listing = row.listing;

    const proofs = await db
      .select()
      .from(listingProofs)
      .where(eq(listingProofs.listingId, id))
      .orderBy(asc(listingProofs.displayOrder));

    const [ratingResult] = await db
      .select({
        avgRating: sql<number>`coalesce(round(avg(${sellerRatings.rating})::numeric, 1), 5.0)::float`,
        reviewCount: sql<number>`count(${sellerRatings.id})::int`,
      })
      .from(sellerRatings)
      .where(eq(sellerRatings.sellerId, listing.sellerId));

    const [salesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.sellerId, listing.sellerId),
          eq(marketplaceListings.status, 'sold')
        )
      );

    let discountPct = 0;
    if (listing.badgeType === 'good_deal' && listing.baselinePriceInr) {
      const baseline = Number(listing.baselinePriceInr);
      const current = Number(listing.priceInr);
      if (baseline > current) {
        discountPct = Math.round(((baseline - current) / baseline) * 100);
      }
    }

    return {
      ...listing,
      discountPct,
      proofImages: proofs,
      seller: {
        userId: listing.sellerId,
        username: row.sellerUsername || 'Anonymous Gamer',
        avatarPreset: row.sellerAvatar || 'preset_default_01',
        inGameId: row.sellerInGameId || null,
        reputationScore: ratingResult?.avgRating ?? 5.0,
        reviewCount: ratingResult?.reviewCount ?? 0,
        completedSales: salesResult?.count ?? 0,
      },
    };
  }

  public static async updateListing(
    db: SmexDatabase,
    id: string,
    userId: string,
    isAdmin: boolean,
    input: UpdateListingInput
  ): Promise<MarketplaceListing & { proofImages: ListingProof[] }> {
    const [existing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id));

    if (!existing) {
      throw createListingError('Listing not found', 404, 'LISTING_NOT_FOUND');
    }

    if (existing.sellerId !== userId && !isAdmin) {
      throw createListingError(
        'You are not authorized to update this listing',
        403,
        'NOT_LISTING_OWNER'
      );
    }

    const updates: Partial<typeof marketplaceListings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) {
      updates.title = input.title.trim();
    }
    if (input.gameSlug !== undefined) {
      updates.gameSlug = input.gameSlug.trim();
    }
    if (input.rankTier !== undefined) {
      updates.rankTier = input.rankTier.trim();
    }
    if (input.contactChannel !== undefined) {
      updates.contactChannel = input.contactChannel;
    }
    if (input.contactHandle !== undefined) {
      updates.contactHandle = input.contactHandle.trim();
    }

    if (input.priceInr !== undefined) {
      if (input.priceInr < 100) {
        throw createListingError(
          'Listing price must be at least ₹100',
          422,
          'INVALID_PRICE_FLOOR'
        );
      }

      const baseline = Number(existing.baselinePriceInr || existing.priceInr);
      const rankTier = input.rankTier || existing.rankTier;
      const badgeCalc = BadgeService.computeUpdatedBadge({
        newPriceInr: input.priceInr,
        baselinePriceInr: baseline,
        rankTier,
      });

      updates.priceInr = input.priceInr.toFixed(2);
      updates.baselinePriceInr = badgeCalc.baselinePriceInr.toFixed(2);
      updates.badgeType = badgeCalc.badgeType;
    }

    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(marketplaceListings)
        .set(updates)
        .where(eq(marketplaceListings.id, id))
        .returning();

      if (input.proofImages) {
        await tx.delete(listingProofs).where(eq(listingProofs.listingId, id));

        if (input.proofImages.length > 0) {
          const proofsToInsert = input.proofImages.map((proof, idx) => ({
            listingId: id,
            s3Key: proof.s3Key,
            cdnUrl: proof.cdnUrl,
            displayOrder: proof.displayOrder ?? idx,
          }));
          await tx.insert(listingProofs).values(proofsToInsert);
        }
      }

      const currentProofs = await tx
        .select()
        .from(listingProofs)
        .where(eq(listingProofs.listingId, id))
        .orderBy(asc(listingProofs.displayOrder));

      return {
        ...updated,
        proofImages: currentProofs,
      };
    });
  }

  public static async updateListingStatus(
    db: SmexDatabase,
    id: string,
    userId: string,
    isAdmin: boolean,
    status: 'active' | 'sold' | 'deleted'
  ): Promise<MarketplaceListing> {
    const [existing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id));

    if (!existing) {
      throw createListingError('Listing not found', 404, 'LISTING_NOT_FOUND');
    }

    if (existing.sellerId !== userId && !isAdmin) {
      throw createListingError(
        'You are not authorized to modify this listing status',
        403,
        'NOT_LISTING_OWNER'
      );
    }

    const [updated] = await db
      .update(marketplaceListings)
      .set({ status, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();

    return updated;
  }

  public static async deleteListing(
    db: SmexDatabase,
    id: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{ success: boolean; id: string }> {
    const [existing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id));

    if (!existing) {
      throw createListingError('Listing not found', 404, 'LISTING_NOT_FOUND');
    }

    if (existing.sellerId !== userId && !isAdmin) {
      throw createListingError(
        'You are not authorized to delete this listing',
        403,
        'NOT_LISTING_OWNER'
      );
    }

    await db.transaction(async (tx) => {
      // Cascade delete proofs
      await tx.delete(listingProofs).where(eq(listingProofs.listingId, id));
      // Soft-delete listing status per specification
      await tx
        .update(marketplaceListings)
        .set({ status: 'deleted', updatedAt: new Date() })
        .where(eq(marketplaceListings.id, id));
    });

    return { success: true, id };
  }
}
