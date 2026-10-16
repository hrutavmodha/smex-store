import { test, describe, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { build } from '../helper.js';
import {
  users,
  profiles,
  sessions,
  teams,
  teamMembers,
  tournaments,
  tournamentParticipants,
  tournamentMatches,
  boostingRates,
  boostingOrders,
  marketplaceListings,
  listingProofs,
  sellerRatings,
  activityLogs,
} from '../../src/db/schema/index.js';

function hasPgErrorCode(err: any, expectedCode: string): boolean {
  const inner = err?.cause || err;
  return (
    inner?.code === expectedCode ||
    err?.code === expectedCode ||
    Boolean(inner?.message?.includes(expectedCode)) ||
    Boolean(err?.message?.includes(expectedCode))
  );
}

describe('Relational Schema Constraints and Cascades Suite', () => {
  let app: any;
  let db: any;

  beforeAll(async () => {
    app = await build();
    db = app.db;
  });

  afterAll(async () => {
    await app?.close();
  });

  test('Test 4: User unique email constraint enforcement', async () => {
    const email = `player_${Date.now()}@smexstore.com`;

    await db.insert(users).values({
      email,
      passwordHash: 'dummy_hash',
    });

    await assert.rejects(
      async () => {
        await db.insert(users).values({
          email,
          passwordHash: 'dummy_hash_duplicate',
        });
      },
      (err: any) => hasPgErrorCode(err, '23505'),
      'Duplicate email must be rejected with unique constraint error 23505'
    );
  });

  test('Test 5: User to profile foreign key cascade deletion', async () => {
    const email = `cascade_${Date.now()}@smexstore.com`;
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash: 'hash' })
      .returning();

    await db.insert(profiles).values({
      userId: user.id,
      username: `casc_${Date.now().toString().slice(-8)}`,
    });

    const [insertedProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));
    assert.ok(insertedProfile);

    // Delete user
    await db.delete(users).where(eq(users.id, user.id));

    // Profile must be automatically cascaded and removed
    const remainingProfile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));
    assert.strictEqual(remainingProfile.length, 0);
  });

  test('Test 6: Profile username uniqueness and default attributes', async () => {
    const [u1] = await db
      .insert(users)
      .values({ email: `u1_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();
    const [u2] = await db
      .insert(users)
      .values({ email: `u2_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const username = `gamer_${Date.now().toString().slice(-8)}`;

    const [p1] = await db
      .insert(profiles)
      .values({ userId: u1.id, username })
      .returning();

    assert.strictEqual(p1.avatarPreset, 'preset_default_01');
    assert.strictEqual(p1.themePref, 'dark');
    assert.strictEqual(p1.densityPref, 'comfortable');
    assert.strictEqual(p1.activityPrivacy, 'public');

    // Duplicate username must be rejected
    await assert.rejects(
      async () => {
        await db.insert(profiles).values({ userId: u2.id, username });
      },
      (err: any) => hasPgErrorCode(err, '23505')
    );
  });

  test('Test 7: Session foreign key cascade on user account deletion', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `session_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash: 'hash1',
      deviceName: 'Pixel 9 Pro',
      ipAddress: '127.0.0.1',
      userAgent: 'Chrome',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const existingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    assert.strictEqual(existingSessions.length, 1);

    // Delete user
    await db.delete(users).where(eq(users.id, user.id));

    // Sessions must be cascaded
    const remainingSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id));
    assert.strictEqual(remainingSessions.length, 0);
  });

  test('Test 8: Captain account deletion restriction (ON DELETE RESTRICT)', async () => {
    const [captain] = await db
      .insert(users)
      .values({ email: `captain_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    await db.insert(teams).values({
      name: `Squad_${Date.now().toString().slice(-6)}`,
      tag: 'SQD',
      captainId: captain.id,
    });

    // Attempting to delete captain must be rejected with 23503 foreign key restriction
    await assert.rejects(
      async () => {
        await db.delete(users).where(eq(users.id, captain.id));
      },
      (err: any) => hasPgErrorCode(err, '23503')
    );
  });

  test('Test 9: Team member capacity boundary check constraint', async () => {
    const [captain] = await db
      .insert(users)
      .values({ email: `cap9_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    // Capacity 0 (< 1) must be rejected
    await assert.rejects(
      async () => {
        await db.insert(teams).values({
          name: `Cap0_${Date.now().toString().slice(-6)}`,
          tag: 'C0',
          captainId: captain.id,
          memberCap: 0,
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );

    // Capacity 15 (> 10) must be rejected
    await assert.rejects(
      async () => {
        await db.insert(teams).values({
          name: `Cap15_${Date.now().toString().slice(-6)}`,
          tag: 'C15',
          captainId: captain.id,
          memberCap: 15,
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );
  });

  test('Test 10: Team member composite uniqueness and dynamic open slots', async () => {
    const [captain] = await db
      .insert(users)
      .values({ email: `cap10_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();
    const [member] = await db
      .insert(users)
      .values({ email: `mem10_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const [team] = await db
      .insert(teams)
      .values({
        name: `Team10_${Date.now().toString().slice(-6)}`,
        tag: 'T10',
        captainId: captain.id,
        memberCap: 5,
      })
      .returning();

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: member.id,
    });

    // Duplicate membership must be rejected with 23505
    await assert.rejects(
      async () => {
        await db.insert(teamMembers).values({
          teamId: team.id,
          userId: member.id,
        });
      },
      (err: any) => hasPgErrorCode(err, '23505')
    );

    // Dynamic open slots computation: member_cap - COUNT(team_members)
    const [slotCalc] = await db
      .select({
        memberCap: teams.memberCap,
        activeCount: sql<number>`cast(count(${teamMembers.id}) as integer)`,
        openSlots: sql<number>`${teams.memberCap} - cast(count(${teamMembers.id}) as integer)`,
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
      .where(eq(teams.id, team.id))
      .groupBy(teams.id, teams.memberCap);

    assert.strictEqual(slotCalc.memberCap, 5);
    assert.strictEqual(slotCalc.activeCount, 1);
    assert.strictEqual(slotCalc.openSlots, 4);
  });

  test('Test 11: Tournament participant composite uniqueness', async () => {
    const [captain] = await db
      .insert(users)
      .values({ email: `cap11_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();
    const [team] = await db
      .insert(teams)
      .values({
        name: `Team11_${Date.now().toString().slice(-6)}`,
        tag: 'T11',
        captainId: captain.id,
      })
      .returning();

    const [tourney] = await db
      .insert(tournaments)
      .values({
        title: `Tourney11_${Date.now().toString().slice(-6)}`,
        startTime: new Date(),
      })
      .returning();

    await db.insert(tournamentParticipants).values({
      tournamentId: tourney.id,
      teamId: team.id,
      seed: 1,
    });

    // Duplicate participant registration must be rejected with 23505
    await assert.rejects(
      async () => {
        await db.insert(tournamentParticipants).values({
          tournamentId: tourney.id,
          teamId: team.id,
          seed: 2,
        });
      },
      (err: any) => hasPgErrorCode(err, '23505')
    );
  });

  test('Test 12: Tournament match round ordering and winner team foreign key', async () => {
    const [captain] = await db
      .insert(users)
      .values({ email: `cap12_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();
    const [team] = await db
      .insert(teams)
      .values({
        name: `Team12_${Date.now().toString().slice(-6)}`,
        tag: 'T12',
        captainId: captain.id,
      })
      .returning();

    const [tourney] = await db
      .insert(tournaments)
      .values({
        title: `Tourney12_${Date.now().toString().slice(-6)}`,
        startTime: new Date(),
      })
      .returning();

    const [match] = await db
      .insert(tournamentMatches)
      .values({
        tournamentId: tourney.id,
        roundNumber: 1,
        matchOrder: 1,
        teamAId: team.id,
        winnerId: team.id,
        status: 'completed',
      })
      .returning();

    assert.strictEqual(match.winnerId, team.id);

    // Deleting the winning team should set winner_id to NULL (ON DELETE SET NULL)
    await db.delete(teams).where(eq(teams.id, team.id));

    const [updatedMatch] = await db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.id, match.id));
    assert.strictEqual(updatedMatch.winnerId, null);
  });

  test('Test 13: Boosting rate positive price check constraint', async () => {
    await assert.rejects(
      async () => {
        await db.insert(boostingRates).values({
          pricingMode: 'fixed_tier',
          fromTier: 'epic',
          toTier: 'legend',
          priceInr: '-50.00',
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );
  });

  test('Test 14: Boosting order initial status default and exact price precision', async () => {
    const [order] = await db
      .insert(boostingOrders)
      .values({
        pricingMode: 'fixed_tier',
        startingRank: 'Epic V',
        targetRank: 'Mythic',
        calculatedPriceInr: '600.00',
        customerIgn: 'SmexMaster#123',
        contactChannel: 'whatsapp',
      })
      .returning();

    assert.strictEqual(order.status, 'inquiry');
    assert.strictEqual(order.calculatedPriceInr, '600.00');
  });

  test('Test 15: Marketplace price floor boundary check constraint', async () => {
    const [seller] = await db
      .insert(users)
      .values({ email: `seller15_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    await assert.rejects(
      async () => {
        await db.insert(marketplaceListings).values({
          sellerId: seller.id,
          title: 'Cheap Account',
          rankTier: 'Mythic',
          priceInr: '50.00', // Below ₹100 floor
          contactChannel: 'whatsapp',
          contactHandle: '+919999999999',
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );
  });

  test('Test 16: Marketplace listing cascade deletion to screenshot proofs', async () => {
    const [seller] = await db
      .insert(users)
      .values({ email: `seller16_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const [listing] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Mythical Immortal Account',
        rankTier: 'Mythical Immortal',
        priceInr: '2500.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919876543210',
      })
      .returning();

    await db.insert(listingProofs).values({
      listingId: listing.id,
      s3Key: 'proofs/acc1_winrate.png',
      cdnUrl: 'https://cdn.smexstore.com/proofs/acc1_winrate.png',
      displayOrder: 0,
    });

    const proofs = await db
      .select()
      .from(listingProofs)
      .where(eq(listingProofs.listingId, listing.id));
    assert.strictEqual(proofs.length, 1);

    // Delete listing
    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, listing.id));

    // Linked proofs must be cascaded
    const remainingProofs = await db
      .select()
      .from(listingProofs)
      .where(eq(listingProofs.listingId, listing.id));
    assert.strictEqual(remainingProofs.length, 0);
  });

  test('Test 17: Seller review self-rating prohibition check constraint', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `self17_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const [listing] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: user.id,
        title: 'Self Rating Account',
        rankTier: 'Legend',
        priceInr: '500.00',
        contactChannel: 'instagram',
        contactHandle: 'smex_user',
      })
      .returning();

    // Seller rating self-review must be rejected with check constraint error 23514
    await assert.rejects(
      async () => {
        await db.insert(sellerRatings).values({
          sellerId: user.id,
          buyerId: user.id, // Self review
          listingId: listing.id,
          rating: 5,
          reviewText: 'Great seller (me)!',
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );
  });

  test('Test 18: Seller rating score boundary and duplicate review enforcement', async () => {
    const [seller] = await db
      .insert(users)
      .values({ email: `seller18_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();
    const [buyer] = await db
      .insert(users)
      .values({ email: `buyer18_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const [listing] = await db
      .insert(marketplaceListings)
      .values({
        sellerId: seller.id,
        title: 'Review Account',
        rankTier: 'Legend',
        priceInr: '500.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919876543211',
      })
      .returning();

    // Score 6 (> 5) must be rejected
    await assert.rejects(
      async () => {
        await db.insert(sellerRatings).values({
          sellerId: seller.id,
          buyerId: buyer.id,
          listingId: listing.id,
          rating: 6,
        });
      },
      (err: any) => hasPgErrorCode(err, '23514')
    );

    // Valid review
    await db.insert(sellerRatings).values({
      sellerId: seller.id,
      buyerId: buyer.id,
      listingId: listing.id,
      rating: 5,
      reviewText: 'Flawless transaction',
    });

    // Duplicate review from same buyer for same listing must be rejected with 23505
    await assert.rejects(
      async () => {
        await db.insert(sellerRatings).values({
          sellerId: seller.id,
          buyerId: buyer.id,
          listingId: listing.id,
          rating: 4,
          reviewText: 'Duplicate review',
        });
      },
      (err: any) => hasPgErrorCode(err, '23505')
    );
  });

  test('Test 19: Activity log JSONB metadata persistence and retrieval', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: `act19_${Date.now()}@smexstore.com`, passwordHash: 'hash' })
      .returning();

    const testPayload = {
      action: 'view_tournament',
      targetId: 't-12345',
      metrics: { latency: 42, cached: true },
    };

    const [log] = await db
      .insert(activityLogs)
      .values({
        userId: user.id,
        actionType: 'tournament_view',
        metadataJson: testPayload,
      })
      .returning();

    const [fetched] = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.id, log.id));

    assert.deepStrictEqual(fetched.metadataJson, testPayload);
  });
});
