import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build, createVerifiedUser } from '../helper.js';
import { marketplaceListings, listingProofs } from '../../src/db/schema/marketplace.js';

describe('Marketplace Listing CRUD Lifecycle Suite (LLT 2.3)', () => {
  it('Test 11: Create valid marketplace listing with proof images', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_create');

    const payload = {
      title: 'Mythic Account - 50 Skins',
      gameSlug: 'mlbb',
      rankTier: 'Mythic',
      priceInr: 1200,
      contactChannel: 'whatsapp',
      contactHandle: '15550100100',
      proofImages: [
        { s3Key: `marketplace/proofs/${user.id}/p1.png`, cdnUrl: '/media/p1.png', displayOrder: 0 },
        { s3Key: `marketplace/proofs/${user.id}/p2.png`, cdnUrl: '/media/p2.png', displayOrder: 1 },
      ],
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);

    assert.ok(body.id);
    assert.equal(body.sellerId, user.id);
    assert.equal(body.title, payload.title);
    assert.equal(body.status, 'active');
    assert.equal(body.priceInr, '1200.00');
    assert.equal(body.baselinePriceInr, '1200.00');
    assert.equal(body.badgeType, 'none');
    assert.equal(body.proofImages.length, 2);

    // Verify database records
    const [dbListing] = await app.db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, body.id));
    assert.ok(dbListing);
    assert.equal(dbListing.status, 'active');

    const dbProofs = await app.db
      .select()
      .from(listingProofs)
      .where(eq(listingProofs.listingId, body.id));
    assert.equal(dbProofs.length, 2);
  });

  it('Test 12: Price floor check constraint violation rejection', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_cheap');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Cheap Account',
        rankTier: 'Master',
        priceInr: 50.0, // Below minimum ₹100 floor
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
      },
    });

    assert.equal(res.statusCode, 422);
    const body = JSON.parse(res.payload);
    assert.equal(body.code, 'INVALID_PRICE_FLOOR');
  });

  it('Test 13: Filtered catalog query by rank tier and price range', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_filter');

    // Create a listing that matches
    await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Matching Mythic Listing',
        rankTier: 'Mythic',
        priceInr: 1000,
        contactChannel: 'instagram',
        contactHandle: 'gamer123',
      },
    });

    // Create a listing that does NOT match (different rank tier and price)
    await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Non-Matching Epic Listing',
        rankTier: 'Epic',
        priceInr: 300,
        contactChannel: 'instagram',
        contactHandle: 'gamer123',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/listings?rankTier=Mythic&minPrice=500&maxPrice=1500',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.listings));
    assert.ok(body.listings.length >= 1);

    for (const listing of body.listings) {
      assert.equal(listing.rankTier, 'Mythic');
      const price = parseFloat(listing.priceInr);
      assert.ok(price >= 500 && price <= 1500);
      assert.equal(listing.status, 'active');
    }
  });

  it('Test 14: Single listing detail retrieval with ordered proofs', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_detail');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Ordered Proofs Account',
        rankTier: 'Legend',
        priceInr: 1500,
        contactChannel: 'instagram',
        contactHandle: 'seller_hero',
        proofImages: [
          { s3Key: `marketplace/proofs/${user.id}/second.png`, cdnUrl: '/media/second.png', displayOrder: 1 },
          { s3Key: `marketplace/proofs/${user.id}/first.png`, cdnUrl: '/media/first.png', displayOrder: 0 },
        ],
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/marketplace/listings/${created.id}`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.id, created.id);
    assert.ok(body.seller);
    assert.ok(typeof body.seller.reputationScore === 'number');
    assert.ok(Array.isArray(body.proofImages));
    assert.equal(body.proofImages.length, 2);

    // Verify proofImages ordered by displayOrder ascending
    assert.equal(body.proofImages[0].displayOrder, 0);
    assert.equal(body.proofImages[0].s3Key, `marketplace/proofs/${user.id}/first.png`);
    assert.equal(body.proofImages[1].displayOrder, 1);
    assert.equal(body.proofImages[1].s3Key, `marketplace/proofs/${user.id}/second.png`);
  });

  it('Test 15: Non-owner update attempt rejection', async (t) => {
    const app = await build(t);
    const { token: ownerToken } = await createVerifiedUser(app, 'owner_u');
    const { token: otherToken } = await createVerifiedUser(app, 'other_u');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        title: 'Original Title',
        rankTier: 'Epic',
        priceInr: 500,
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
      },
    });
    const created = JSON.parse(createRes.payload);

    // User B tries to update User A's listing
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${created.id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        title: 'Hijacked Title',
      },
    });

    assert.equal(updateRes.statusCode, 403);
    const body = JSON.parse(updateRes.payload);
    assert.equal(body.code, 'NOT_LISTING_OWNER');
  });

  it('Test 16: Owner updates price and contact handle', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'owner_update');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Original Price Account',
        rankTier: 'Epic',
        priceInr: 1000,
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
      },
    });
    const created = JSON.parse(createRes.payload);

    // Drop price from 1000 to 800 (20% drop -> triggers good_deal badge)
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        priceInr: 800,
        contactHandle: '15559999999',
      },
    });

    assert.equal(updateRes.statusCode, 200);
    const updated = JSON.parse(updateRes.payload);
    assert.equal(updated.priceInr, '800.00');
    assert.equal(updated.contactHandle, '15559999999');
    assert.equal(updated.badgeType, 'good_deal');
    assert.equal(updated.baselinePriceInr, '1000.00');
  });

  it('Test 17: Mark listing as sold', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_sold');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Will Be Sold Account',
        rankTier: 'Mythic',
        priceInr: 2000,
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
      },
    });
    const created = JSON.parse(createRes.payload);

    const statusRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${created.id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        status: 'sold',
      },
    });

    assert.equal(statusRes.statusCode, 200);
    const updated = JSON.parse(statusRes.payload);
    assert.equal(updated.status, 'sold');

    // Verify it is excluded from default catalog queries
    const catalogRes = await app.inject({
      method: 'GET',
      url: `/api/v1/marketplace/listings?q=Will+Be+Sold+Account`,
    });
    const catalog = JSON.parse(catalogRes.payload);
    assert.ok(!catalog.listings.some((l: any) => l.id === created.id));
  });

  it('Test 18: Listing deletion and proof cascading', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_delete');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'To Be Deleted Account',
        rankTier: 'Master',
        priceInr: 800,
        contactChannel: 'instagram',
        contactHandle: 'delete_acc',
        proofImages: [
          { s3Key: `marketplace/proofs/${user.id}/del1.png`, cdnUrl: '/media/del1.png', displayOrder: 0 },
        ],
      },
    });
    const created = JSON.parse(createRes.payload);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/marketplace/listings/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(deleteRes.statusCode, 200);

    // Verify listing status is 'deleted' and child proofs are removed
    const [dbListing] = await app.db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, created.id));
    assert.ok(dbListing);
    assert.equal(dbListing.status, 'deleted');

    const dbProofs = await app.db
      .select()
      .from(listingProofs)
      .where(eq(listingProofs.listingId, created.id));
    assert.equal(dbProofs.length, 0);
  });

  it('Test 18b: Error handling for 404 not found and validation errors', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_errors');
    const fakeId = '00000000-0000-0000-0000-000000000000';

    // 404 GET
    const notFoundGet = await app.inject({
      method: 'GET',
      url: `/api/v1/marketplace/listings/${fakeId}`,
    });
    assert.equal(notFoundGet.statusCode, 404);

    // 404 PATCH
    const notFoundPatch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${fakeId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New' },
    });
    assert.equal(notFoundPatch.statusCode, 404);

    // 404 PATCH status
    const notFoundStatus = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${fakeId}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'sold' },
    });
    assert.equal(notFoundStatus.statusCode, 404);

    // 404 DELETE
    const notFoundDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/marketplace/listings/${fakeId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(notFoundDelete.statusCode, 404);

    // 400 Invalid body on create
    const invalidCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'x' }, // missing required fields
    });
    assert.equal(invalidCreate.statusCode, 400);

    // 400 Invalid query on catalog
    const invalidQuery = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/listings?page=-1',
    });
    assert.equal(invalidQuery.statusCode, 400);
  });

  it('Test 18c: Catalog sorting and price update floor constraint', async (t) => {
    const app = await build(t);
    const { token } = await createVerifiedUser(app, 'seller_sort');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Floor Update Test Account',
        rankTier: 'Legend',
        priceInr: 500,
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
      },
    });
    const created = JSON.parse(createRes.payload);

    // Update with price < 100 rejected
    const invalidPriceUpdate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { priceInr: 49 },
    });
    assert.equal(invalidPriceUpdate.statusCode, 422);

    // Sort price_asc and price_desc
    const ascRes = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/listings?sortBy=price_asc',
    });
    assert.equal(ascRes.statusCode, 200);

    const descRes = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/listings?sortBy=price_desc',
    });
    assert.equal(descRes.statusCode, 200);

    // Filter by badgeType
    const badgeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/marketplace/listings?badgeType=none',
    });
    assert.equal(badgeRes.statusCode, 200);
  });

  it('Test 18d: Update listing proof images and metadata', async (t) => {
    const app = await build(t);
    const { token, user } = await createVerifiedUser(app, 'seller_proof_update');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/marketplace/listings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Original Proofs Listing',
        rankTier: 'Epic I',
        priceInr: 600,
        contactChannel: 'whatsapp',
        contactHandle: '15550100100',
        proofImages: [{ s3Key: `marketplace/proofs/${user.id}/old.png`, cdnUrl: '/media/old.png' }],
      },
    });
    const created = JSON.parse(createRes.payload);

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/marketplace/listings/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Updated Proofs Listing',
        proofImages: [
          { s3Key: `marketplace/proofs/${user.id}/new1.png`, cdnUrl: '/media/new1.png', displayOrder: 0 },
          { s3Key: `marketplace/proofs/${user.id}/new2.png`, cdnUrl: '/media/new2.png', displayOrder: 1 },
        ],
      },
    });

    assert.equal(updateRes.statusCode, 200);
    const updated = JSON.parse(updateRes.payload);
    assert.equal(updated.title, 'Updated Proofs Listing');
    assert.equal(updated.proofImages.length, 2);
  });
});


