import type { Redis } from 'ioredis';
import { eq, and, desc } from 'drizzle-orm';
import type { SmexDatabase } from '../db/index.js';
import { marketplaceListings, listingProofs } from '../db/schema/marketplace.js';
import { users, profiles } from '../db/schema/users.js';
import { activityLogs } from '../db/schema/activity.js';
import { StorageService } from './storage.service.js';
import { NotificationService } from './notification.service.js';
import { SessionService } from './session.service.js';
import type { WsGatewayDecorator } from '../plugins/websocket.js';

export interface MarketplaceModerationErrorOptions {
  code: string;
  statusCode: number;
}

export class MarketplaceModerationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, options: MarketplaceModerationErrorOptions) {
    super(message);
    this.name = 'MarketplaceModerationError';
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

export interface ModerationQueueItem {
  id: string;
  title: string;
  gameSlug: string;
  rankTier: string;
  priceInr: string;
  badgeType: string;
  status: string;
  sellerId: string;
  sellerUsername?: string | null;
  sellerEmail?: string | null;
  sellerIsBanned: boolean;
  createdAt: Date;
  proofs: Array<{
    id: string;
    cdnUrl: string;
    s3Key: string;
    displayOrder: number;
  }>;
}

export interface TakedownListingResult {
  success: boolean;
  listingId: string;
  deletedProofsCount: number;
  takedownReason: string;
}

export interface SuspendSellerResult {
  success: boolean;
  sellerId: string;
  listingsDeletedCount: number;
}

export class MarketplaceModerationService {
  /**
   * Retrieves the moderation queue of listings (e.g. active or flagged items with seller and proof metadata)
   */
  static async getModerationQueue(db: SmexDatabase): Promise<{ queue: ModerationQueueItem[] }> {
    const listings = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        gameSlug: marketplaceListings.gameSlug,
        rankTier: marketplaceListings.rankTier,
        priceInr: marketplaceListings.priceInr,
        badgeType: marketplaceListings.badgeType,
        status: marketplaceListings.status,
        sellerId: marketplaceListings.sellerId,
        sellerUsername: profiles.username,
        sellerEmail: users.email,
        sellerIsBanned: users.isBanned,
        createdAt: marketplaceListings.createdAt,
      })
      .from(marketplaceListings)
      .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
      .leftJoin(profiles, eq(marketplaceListings.sellerId, profiles.userId))
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(50);

    const queue: ModerationQueueItem[] = [];

    for (const listing of listings) {
      const proofs = await db
        .select({
          id: listingProofs.id,
          cdnUrl: listingProofs.cdnUrl,
          s3Key: listingProofs.s3Key,
          displayOrder: listingProofs.displayOrder,
        })
        .from(listingProofs)
        .where(eq(listingProofs.listingId, listing.id))
        .orderBy(listingProofs.displayOrder);

      queue.push({
        ...listing,
        proofs,
      });
    }

    return { queue };
  }

  /**
   * Takes down a fraudulent or rule-breaking listing:
   * Sets status = 'deleted', purges proofs from S3 object storage, records activity log,
   * and notifies the seller.
   */
  static async takedownListing(
    listingId: string,
    reason: string,
    adminId: string,
    db: SmexDatabase,
    storageService?: StorageService
  ): Promise<TakedownListingResult> {
    if (!reason || reason.trim().length === 0) {
      throw new MarketplaceModerationError('Takedown reason is required', {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
      });
    }

    const [listing] = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        sellerId: marketplaceListings.sellerId,
        status: marketplaceListings.status,
      })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);

    if (!listing) {
      throw new MarketplaceModerationError(`Marketplace listing with id '${listingId}' not found`, {
        code: 'LISTING_NOT_FOUND',
        statusCode: 404,
      });
    }

    const cleanReason = reason.trim();

    // 1. Mark listing as deleted in PostgreSQL
    await db
      .update(marketplaceListings)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    // 2. Fetch and purge associated S3 proof blobs
    const proofs = await db
      .select({ id: listingProofs.id, s3Key: listingProofs.s3Key })
      .from(listingProofs)
      .where(eq(listingProofs.listingId, listingId));

    const s3 = storageService || new StorageService();
    let deletedCount = 0;

    for (const proof of proofs) {
      try {
        await s3.deleteObject(proof.s3Key);
        deletedCount++;
      } catch {
        // Log S3 cleanup error without blocking transactional takedown
      }
    }

    // 3. Record takedown in activity_logs
    await db.insert(activityLogs).values({
      userId: adminId,
      actionType: 'admin_listing_takedown',
      entityType: 'marketplace_listing',
      entityId: listingId,
      metadataJson: {
        listingId,
        title: listing.title,
        sellerId: listing.sellerId,
        takedownReason: cleanReason,
        adminId,
        purgedProofsCount: deletedCount,
      },
    });

    // 4. Dispatch system notification to seller
    await NotificationService.dispatchNotification(
      listing.sellerId,
      'system',
      'Listing Removed by Administration',
      `Your marketplace listing '${listing.title}' has been removed: ${cleanReason}`,
      {
        entityType: 'marketplace',
        entityId: listingId,
        metadata: {
          listingId,
          reason: cleanReason,
        },
      },
      db
    );

    return {
      success: true,
      listingId,
      deletedProofsCount: deletedCount,
      takedownReason: cleanReason,
    };
  }

  /**
   * Suspends a seller account and executes bulk takedown of all active seller listings
   * in a single atomic database transaction, then evicts all active seller sessions.
   */
  static async suspendSeller(
    sellerId: string,
    reason: string,
    adminId: string,
    db: SmexDatabase,
    redis: Redis,
    wsGateway?: WsGatewayDecorator,
    storageService?: StorageService
  ): Promise<SuspendSellerResult> {
    const cleanReason = (reason && reason.trim()) || 'Seller account suspended for fraudulent activity';

    const [seller] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);

    if (!seller) {
      throw new MarketplaceModerationError(`Seller with id '${sellerId}' not found`, {
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    }

    if (seller.role === 'admin' || sellerId === adminId) {
      throw new MarketplaceModerationError('Cannot suspend an administrative account', {
        code: 'CANNOT_BAN_ADMIN',
        statusCode: 400,
      });
    }

    const bannedAt = new Date();

    // 1. Transactional user ban and bulk listing takedown
    const activeListings = await db
      .select({ id: marketplaceListings.id })
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.sellerId, sellerId),
          eq(marketplaceListings.status, 'active')
        )
      );

    await db.transaction(async (tx) => {
      // Ban seller
      await tx
        .update(users)
        .set({
          isBanned: true,
          banReason: cleanReason,
          bannedAt,
          updatedAt: bannedAt,
        })
        .where(eq(users.id, sellerId));

      // Bulk update active listings to 'deleted'
      if (activeListings.length > 0) {
        await tx
          .update(marketplaceListings)
          .set({
            status: 'deleted',
            updatedAt: bannedAt,
          })
          .where(
            and(
              eq(marketplaceListings.sellerId, sellerId),
              eq(marketplaceListings.status, 'active')
            )
          );
      }

      // Record activity log
      await tx.insert(activityLogs).values({
        userId: adminId,
        actionType: 'admin_seller_suspend',
        entityType: 'user',
        entityId: sellerId,
        metadataJson: {
          sellerId,
          reason: cleanReason,
          adminId,
          bulkListingsDeleted: activeListings.length,
        },
      });
    });

    // 2. Set Redis ban cache
    await redis.set(`banned_user:${sellerId}`, '1', 'EX', 86400 * 30);

    // 3. Purge S3 proofs for deleted listings in background
    const s3 = storageService || new StorageService();
    for (const item of activeListings) {
      const proofs = await db
        .select({ s3Key: listingProofs.s3Key })
        .from(listingProofs)
        .where(eq(listingProofs.listingId, item.id));

      for (const proof of proofs) {
        try {
          await s3.deleteObject(proof.s3Key);
        } catch {
          // Non-fatal proof cleanup error
        }
      }
    }

    // 4. Evict seller sessions in Redis and DB
    await SessionService.revokeAllSessions(sellerId, db, redis, wsGateway);

    // 5. Broadcast WebSocket session:revoked frame
    if (wsGateway) {
      wsGateway.broadcastToChannel(`user:${sellerId}`, {
        event: 'session:revoked',
        channel: `user:${sellerId}`,
        timestamp: Date.now(),
        reason: 'account_banned',
        payload: {
          reason: 'account_banned',
          banReason: cleanReason,
        },
      });
      wsGateway.terminateUserSockets(sellerId);
    }

    return {
      success: true,
      sellerId,
      listingsDeletedCount: activeListings.length,
    };
  }
}
