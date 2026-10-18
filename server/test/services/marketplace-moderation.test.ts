import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { type FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { users } from '../../src/db/schema/users.js';
import { marketplaceListings, listingProofs } from '../../src/db/schema/marketplace.js';
import { activityLogs } from '../../src/db/schema/activity.js';

function createAdminToken(app: FastifyInstance, userId = '00000000-0000-0000-0000-000000000001') {
  return app.jwt.sign({
    sub: userId,
    role: 'admin',
    sessionId: `test_admin_sess_${Date.now()}_${Math.random()}`,
  });
}

describe('Milestone 9: Marketplace Moderation (LLT 2.4 Tests 13-16)', () => {
  it('Test 13: Query moderation queue', async (t) => {
    const app = await build(t);
    const { user: seller } = await createVerifiedUser(app, 'queue_seller');
    const { user: adminUser } = await createVerifiedUser(app, 'queue_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create a listing with proof
    const [listing] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Mythical Immortal MLBB Account 150 Stars',
        gameSlug: 'mlbb',
        rankTier: 'Mythical Immortal',
        priceInr: '3500.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919876543210',
        status: 'active',
      })
      .returning();

    await app.db.insert(listingProofs).values({
      listingId: listing.id,
      s3Key: `marketplace/proofs/${seller.id}/test-proof.jpg`,
      cdnUrl: `/api/v1/media/marketplace/proofs/${seller.id}/test-proof.jpg`,
      displayOrder: 0,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/marketplace/queue',
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.queue));
    const item = body.queue.find((q: any) => q.id === listing.id);
    assert.ok(item, 'Expected listing to appear in moderation queue');
    assert.equal(item.title, 'Mythical Immortal MLBB Account 150 Stars');
    assert.ok(Array.isArray(item.proofs));
    assert.equal(item.proofs.length, 1);
  });

  it('Test 14: Fraudulent listing takedown and proof purge', async (t) => {
    const app = await build(t);
    const { user: seller } = await createVerifiedUser(app, 'takedown_seller');
    const { user: adminUser } = await createVerifiedUser(app, 'takedown_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    const [listing] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Fraudulent Account Fake Proofs',
        gameSlug: 'mlbb',
        rankTier: 'Epic',
        priceInr: '500.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919999999999',
        status: 'active',
      })
      .returning();

    await app.db.insert(listingProofs).values({
      listingId: listing.id,
      s3Key: `marketplace/proofs/${seller.id}/fake-proof.jpg`,
      cdnUrl: `/api/v1/media/marketplace/proofs/${seller.id}/fake-proof.jpg`,
      displayOrder: 0,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/marketplace/listings/${listing.id}/takedown`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Fraudulent account proof screenshots',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.listingId, listing.id);

    // Verify in database: status changed to 'deleted'
    const [dbListing] = await app.db
      .select({ status: marketplaceListings.status })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listing.id));
    assert.equal(dbListing.status, 'deleted');
  });

  it('Test 15: Takedown audit log generation', async (t) => {
    const app = await build(t);
    const { user: seller } = await createVerifiedUser(app, 'audit_seller');
    const { user: adminUser } = await createVerifiedUser(app, 'audit_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    const [listing] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Audit Log Test Listing',
        gameSlug: 'mlbb',
        rankTier: 'Legend',
        priceInr: '800.00',
        contactChannel: 'instagram',
        contactHandle: '@auditseller',
        status: 'active',
      })
      .returning();

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/marketplace/listings/${listing.id}/takedown`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Violation of seller terms',
      },
    });

    // Check activity_logs table for audit entry
    const logs = await app.db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.userId, adminUser.id),
          eq(activityLogs.actionType, 'admin_listing_takedown'),
          eq(activityLogs.entityId, listing.id)
        )
      );

    assert.equal(logs.length, 1, 'Expected exactly 1 audit log entry for listing takedown');
    assert.equal(logs[0].entityType, 'marketplace_listing');
    assert.equal((logs[0].metadataJson as any).takedownReason, 'Violation of seller terms');
  });

  it('Test 16: Seller account suspension and bulk listing deletion', async (t) => {
    const app = await build(t);
    const { user: seller } = await createVerifiedUser(app, 'bulk_seller');
    const { user: adminUser } = await createVerifiedUser(app, 'suspend_admin');
    await app.db.update(users).set({ role: 'admin' }).where(eq(users.id, adminUser.id));
    const adminToken = createAdminToken(app, adminUser.id);

    // Create 3 active listings by the seller
    const [l1] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Bulk Listing 1',
        gameSlug: 'mlbb',
        rankTier: 'Mythic',
        priceInr: '1200.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919111111111',
        status: 'active',
      })
      .returning();

    const [l2] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Bulk Listing 2',
        gameSlug: 'mlbb',
        rankTier: 'Legend',
        priceInr: '800.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919111111111',
        status: 'active',
      })
      .returning();

    const [l3] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Bulk Listing 3',
        gameSlug: 'mlbb',
        rankTier: 'Epic',
        priceInr: '400.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919111111111',
        status: 'active',
      })
      .returning();

    // Admin suspends the seller
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/marketplace/sellers/${seller.id}/suspend`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        reason: 'Multiple fraudulent listings reported',
      },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.success, true);
    assert.equal(body.sellerId, seller.id);
    assert.equal(body.listingsDeletedCount, 3);

    // Verify seller is banned in DB
    const [dbSeller] = await app.db
      .select({ isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, seller.id));
    assert.equal(dbSeller.isBanned, true);

    // Verify all 3 listings are now status = 'deleted'
    const listings = await app.db
      .select({ id: marketplaceListings.id, status: marketplaceListings.status })
      .from(marketplaceListings)
      .where(eq(marketplaceListings.sellerId, seller.id));

    assert.equal(listings.length, 3);
    for (const item of listings) {
      assert.equal(item.status, 'deleted', `Listing ${item.id} must be deleted`);
    }
  });
});
