import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { build, createVerifiedUser } from '../helper.js';
import { tournaments } from '../../src/db/schema/tournaments.js';
import { teams } from '../../src/db/schema/teams.js';
import { marketplaceListings } from '../../src/db/schema/marketplace.js';
import { profiles } from '../../src/db/schema/users.js';
import { eq, inArray, sql } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('PostgreSQL Trigram Universal Search Engine Suite (LLT 2.3)', () => {
  test('Test 11: Multi-entity exact search query matching', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'srch_seed1');

    // 1. Seed Tournament
    const [t1] = await app.db
      .insert(tournaments)
      .values({
        title: 'Mythic Legends Championship',
        gameSlug: 'mlbb',
        format: 'single_elimination',
        status: 'registration_open',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    // 2. Seed Team
    const [team1] = await app.db
      .insert(teams)
      .values({
        name: `Mythic Warriors ${Date.now()}`,
        tag: 'MYTH',
        captainId: user.id,
        gameSlug: 'mlbb',
        memberCap: 5,
        status: 'open',
      })
      .returning();

    // 3. Seed Player Profile
    await app.db
      .update(profiles)
      .set({
        username: `MythicPlayer_${Date.now().toString().slice(-4)}`,
        inGameId: 'Mythic_VIP',
        playstyle: 'Assassin',
      })
      .where(eq(profiles.userId, user.id));

    // 4. Seed Active Marketplace Listing
    const [m1] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: user.id,
        title: 'Mythic MLBB 60 Skins Account',
        gameSlug: 'mlbb',
        rankTier: 'Mythic',
        priceInr: '1500.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919876543210',
        status: 'active',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=mythic',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.query, 'mythic');
    assert.equal(body.category, 'all');
    assert.ok(body.totalMatches >= 4, `Expected at least 4 matches across all entities, got ${body.totalMatches}`);
    assert.ok(body.results.tournaments.some((x: any) => x.id === t1.id));
    assert.ok(body.results.teams.some((x: any) => x.id === team1.id));
    assert.ok(body.results.players.some((x: any) => x.id === user.id));
    assert.ok(body.results.marketplace.some((x: any) => x.id === m1.id));
  });

  test('Test 12: Typo-tolerant trigram fuzzy search matching', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'srch_seed2');

    const [tFuzzy] = await app.db
      .insert(tournaments)
      .values({
        title: `Mythic Glory Invitational ${Date.now()}`,
        gameSlug: 'mlbb',
        status: 'upcoming',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    // Clear any stale cached search responses from Redis
    const searchKeys = await app.redis.keys('search:*');
    if (searchKeys.length > 0) {
      await app.redis.del(...searchKeys);
    }

    // Intentional typo search "myhtic"
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=myhtic',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.totalMatches >= 1, 'Trigram similarity should match typo "myhtic" to "Mythic"');
    assert.ok(
      body.results.tournaments?.some((x: any) => x.id === tFuzzy.id),
      'Fuzzy tournament must be included in results'
    );
  });

  test('Test 13: Category filter: tournaments only', async (t) => {
    const app = await build(t);

    const [tFilter] = await app.db
      .insert(tournaments)
      .values({
        title: `OnlyTourney_${Date.now()}`,
        gameSlug: 'mlbb',
        status: 'ongoing',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=OnlyTourney&category=tournaments`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.category, 'tournaments');
    assert.ok(body.results.tournaments?.length >= 1);
    assert.equal(body.results.teams, undefined);
    assert.equal(body.results.players, undefined);
    assert.equal(body.results.marketplace, undefined);
  });

  test('Test 14: Category filter: teams only', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'srch_seed4');

    const [teamFilter] = await app.db
      .insert(teams)
      .values({
        name: `DarkRaiders_${Date.now()}`,
        tag: 'DARK',
        captainId: user.id,
        memberCap: 5,
        status: 'open',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=DarkRaiders&category=teams`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.category, 'teams');
    assert.ok(body.results.teams?.length >= 1);
    assert.ok(body.results.teams?.some((x: any) => x.id === teamFilter.id));
    assert.equal(body.results.tournaments, undefined);
  });

  test('Test 15: Category filter: players only', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'srch_seed5');

    await app.db
      .update(profiles)
      .set({
        username: `ShadowSniper_${Date.now().toString().slice(-4)}`,
        inGameId: 'ShadowViper',
      })
      .where(eq(profiles.userId, user.id));

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=ShadowSniper&category=players`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.category, 'players');
    assert.ok(body.results.players?.length >= 1);
    assert.ok(body.results.players?.some((x: any) => x.id === user.id));
    assert.equal(body.results.teams, undefined);
  });

  test('Test 16: Category filter: marketplace only', async (t) => {
    const app = await build(t);
    const { user } = await createVerifiedUser(app, 'srch_seed6');

    // 1. Active listing
    const [activeListing] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: user.id,
        title: `SmexGamer Active Account ${Date.now()}`,
        rankTier: 'Epic',
        priceInr: '900.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919999999999',
        status: 'active',
      })
      .returning();

    // 2. Sold listing (must be excluded)
    const [soldListing] = await app.db
      .insert(marketplaceListings)
      .values({
        sellerId: user.id,
        title: `SmexGamer Sold Account ${Date.now()}`,
        rankTier: 'Epic',
        priceInr: '900.00',
        contactChannel: 'whatsapp',
        contactHandle: '+919999999999',
        status: 'sold',
      })
      .returning();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/search?q=SmexGamer&category=marketplace`,
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.category, 'marketplace');
    assert.ok(body.results.marketplace?.some((x: any) => x.id === activeListing.id));
    assert.ok(!body.results.marketplace?.some((x: any) => x.id === soldListing.id), 'Sold listing must be excluded');
  });

  test('Test 17: Query string minimum length validation', async (t) => {
    const app = await build(t);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=a',
    });

    assert.equal(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.equal(body.code, 'QUERY_TOO_SHORT');
    assert.equal(body.status, 400);
  });

  test('Test 18: SQL wildcard characters (% and _) are escaped to prevent greedy pattern injection (BUG-M8-006)', async (t) => {
    const app = await build(t);

    // Seed tournaments without literal underscores
    const [t1] = await app.db
      .insert(tournaments)
      .values({
        title: `AlphaCup_${Date.now()}`,
        gameSlug: 'mlbb',
        status: 'upcoming',
        startTime: new Date(Date.now() + 86400000),
      })
      .returning();

    // Query with __ (double underscore). If unescaped, ILIKE '%__%' matches all titles with 2+ characters.
    // When escaped, it searches for literal '__' which does not exist in standard titles.
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=____&category=tournaments',
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    const matches = body.results.tournaments || [];
    assert.ok(
      !matches.some((x: any) => x.id === t1.id),
      'Double/quadruple underscore query must not match normal text via unescaped wildcard expansion'
    );
  });

  test('Test 19: totalMatches accurately calculates total matching records across limits/pagination (BUG-M8-008)', async (t) => {
    const app = await build(t);
    const uniqueWord = `Zeta${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    // Seed 3 tournaments with distinct names containing uniqueWord
    const seeded = await app.db
      .insert(tournaments)
      .values([
        {
          title: `${uniqueWord} Tournament Alpha`,
          gameSlug: 'mlbb',
          status: 'upcoming',
          startTime: new Date(Date.now() + 86400000),
        },
        {
          title: `${uniqueWord} Tournament Beta`,
          gameSlug: 'mlbb',
          status: 'upcoming',
          startTime: new Date(Date.now() + 86400000),
        },
        {
          title: `${uniqueWord} Tournament Gamma`,
          gameSlug: 'mlbb',
          status: 'upcoming',
          startTime: new Date(Date.now() + 86400000),
        },
      ])
      .returning();

    try {
      // Query with limit = 1
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/search?q=${uniqueWord.toLowerCase()}&category=tournaments&limit=1`,
      });

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.results.tournaments.length, 1, 'Paginated slice should contain only 1 item');
      assert.equal(body.totalMatches, 3, 'totalMatches must reflect true count of matching records (3), not slice length');
    } finally {
      const seededIds = seeded.map((s) => s.id);
      await app.db.delete(tournaments).where(inArray(tournaments.id, seededIds));
    }
  });
});

