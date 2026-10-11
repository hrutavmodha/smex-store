import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { build } from '../helper.js';
import { seed, PRESET_AVATARS } from '../../src/db/seed.js';
import { users, profiles, boostingRates, tournaments, type BoostingRate } from '../../src/db/schema/index.js';

test('Database Seeding Pipeline Suite', async (suite) => {
  const app = await build(suite);
  const db = app.db;

  await suite.test('Test 22: Initial platform admin account provisioning', async () => {
    await seed(db);

    const adminEmail = 'admin@smexstore.com';
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail));

    assert.ok(adminUser, 'Admin user record must exist');
    assert.strictEqual(adminUser.role, 'admin');
    assert.strictEqual(adminUser.emailVerified, true);

    const [adminProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, adminUser.id));

    assert.ok(adminProfile, 'Admin profile must exist');
    assert.strictEqual(adminProfile.username, 'smex_admin');
    assert.strictEqual(adminProfile.avatarPreset, 'preset_admin_01');
  });

  await suite.test('Test 23: Default MLBB boosting pricing matrix population', async () => {
    await seed(db);

    const rates = await db.select().from(boostingRates);
    const fixedRates = rates.filter((r: BoostingRate) => r.pricingMode === 'fixed_tier');
    const perStarRates = rates.filter((r: BoostingRate) => r.pricingMode === 'per_star');

    assert.ok(fixedRates.length >= 3, 'Must contain at least 3 fixed tier jump rates');
    assert.ok(perStarRates.length >= 4, 'Must contain at least 4 per-star rates');

    // Verify fixed rate prices: ₹400, ₹300, ₹600
    const prices = fixedRates.map((r: BoostingRate) => r.priceInr);
    assert.ok(prices.includes('400.00'));
    assert.ok(prices.includes('300.00'));
    assert.ok(prices.includes('600.00'));

    // Verify per-star rate prices: ₹20, ₹30, ₹35, ₹40
    const starPrices = perStarRates.map((r: BoostingRate) => r.priceInr);
    assert.ok(starPrices.includes('20.00'));
    assert.ok(starPrices.includes('30.00'));
    assert.ok(starPrices.includes('35.00'));
    assert.ok(starPrices.includes('40.00'));
  });

  await suite.test('Test 24: Preset gaming avatars catalog initialization', async () => {
    const result = await seed(db);

    assert.strictEqual(
      result.presetAvatarsCount,
      12,
      'Preset avatars catalog must contain exactly 12 presets'
    );
    assert.strictEqual(PRESET_AVATARS.length, 12);
    assert.ok(PRESET_AVATARS.includes('preset_default_01'));
    assert.ok(PRESET_AVATARS.includes('preset_default_12'));
  });

  await suite.test('Test 25: Seeding pipeline consecutive execution idempotency', async () => {
    // Initial run
    await seed(db);

    const initialUsers = await db.select().from(users);
    const initialRates = await db.select().from(boostingRates);
    const initialTourneys = await db.select().from(tournaments);

    // Second consecutive execution
    const rerunResult = await seed(db);
    assert.ok(rerunResult);

    const afterUsers = await db.select().from(users);
    const afterRates = await db.select().from(boostingRates);
    const afterTourneys = await db.select().from(tournaments);

    assert.strictEqual(afterUsers.length, initialUsers.length, 'User count must remain unchanged');
    assert.strictEqual(afterRates.length, initialRates.length, 'Boosting rate count must remain unchanged');
    assert.strictEqual(afterTourneys.length, initialTourneys.length, 'Tournaments count must remain unchanged');
  });
});
