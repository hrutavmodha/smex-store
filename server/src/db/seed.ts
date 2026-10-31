import { eq, and, sql } from 'drizzle-orm';
import { createDbPool, createDbClient, type SmexDatabase } from './index.js';
import {
  users,
  profiles,
  boostingRates,
  tournaments,
} from './schema/index.js';

export const PRESET_AVATARS = [
  'preset_default_01',
  'preset_default_02',
  'preset_default_03',
  'preset_default_04',
  'preset_default_05',
  'preset_default_06',
  'preset_default_07',
  'preset_default_08',
  'preset_default_09',
  'preset_default_10',
  'preset_default_11',
  'preset_default_12',
] as const;

export interface SeedResult {
  adminEmail: string;
  presetAvatarsCount: number;
  boostingRatesCount: number;
  tournamentsCount: number;
}

export async function seed(db: SmexDatabase): Promise<SeedResult> {
  // Ensure required PostgreSQL extensions and trigram GIN indexes are enabled
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS tournaments_title_trgm_idx ON tournaments USING gin (title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS teams_name_trgm_idx ON teams USING gin (name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx ON profiles USING gin (username gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS profiles_in_game_id_trgm_idx ON profiles USING gin (in_game_id gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS marketplace_title_trgm_idx ON marketplace_listings USING gin (title gin_trgm_ops);
  `);

  // 1. Provision Default Admin Account if not existing
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@smexstore.com';
  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));

  let adminId: string;
  if (existingAdmin.length === 0) {
    let passwordHash =
      '$argon2id$v=19$m=65536,p=4,t=3$wOaU+cpxCu59q6dBChpuEw$nlSV74uZdt3L6DedvkUcZIYrkk3dVepmqgwMfIJ1PGk';
    if (process.env.ADMIN_INITIAL_PASSWORD) {
      const argon2 = await import('argon2');
      passwordHash = await argon2.hash(process.env.ADMIN_INITIAL_PASSWORD);
    }

    const [newAdmin] = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash,
        role: 'admin',
        emailVerified: true,
      })
      .returning();

    adminId = newAdmin.id;

    await db.insert(profiles).values({
      userId: adminId,
      username: process.env.ADMIN_USERNAME || 'smex_admin',
      avatarPreset: 'preset_admin_01',
      bio: 'Official Smex Store Platform Administrator',
      themePref: 'dark',
      densityPref: 'comfortable',
      activityPrivacy: 'public',
    });
  } else {
    // Security: Do NOT overwrite an existing administrator's password during seeding
    adminId = existingAdmin[0].id;
  }

  // 2. Verified Preset Avatars Catalog
  // 12 curated avatars defined by PRESET_AVATARS
  const presetAvatarsCount = PRESET_AVATARS.length;

  // 3. Upsert Default MLBB Boosting Pricing Matrix (7 rates)
  const defaultBoostingRates = [
    // Fixed Tier Jump Rates
    {
      gameSlug: 'mlbb',
      pricingMode: 'fixed_tier' as const,
      fromTier: 'epic',
      toTier: 'legend',
      starTier: null,
      minStars: null,
      maxStars: null,
      priceInr: '400.00',
      isActive: true,
    },
    {
      gameSlug: 'mlbb',
      pricingMode: 'fixed_tier' as const,
      fromTier: 'legend',
      toTier: 'mythic',
      starTier: null,
      minStars: null,
      maxStars: null,
      priceInr: '300.00',
      isActive: true,
    },
    {
      gameSlug: 'mlbb',
      pricingMode: 'fixed_tier' as const,
      fromTier: 'epic',
      toTier: 'mythic',
      starTier: null,
      minStars: null,
      maxStars: null,
      priceInr: '600.00',
      isActive: true,
    },
    // Progressive Per-Star Rates
    {
      gameSlug: 'mlbb',
      pricingMode: 'per_star' as const,
      fromTier: null,
      toTier: null,
      starTier: 'mythic',
      minStars: 0,
      maxStars: 24,
      priceInr: '20.00',
      isActive: true,
    },
    {
      gameSlug: 'mlbb',
      pricingMode: 'per_star' as const,
      fromTier: null,
      toTier: null,
      starTier: 'mythical_honor',
      minStars: 25,
      maxStars: 49,
      priceInr: '30.00',
      isActive: true,
    },
    {
      gameSlug: 'mlbb',
      pricingMode: 'per_star' as const,
      fromTier: null,
      toTier: null,
      starTier: 'mythical_glory',
      minStars: 50,
      maxStars: 99,
      priceInr: '35.00',
      isActive: true,
    },
    {
      gameSlug: 'mlbb',
      pricingMode: 'per_star' as const,
      fromTier: null,
      toTier: null,
      starTier: 'mythical_immortal',
      minStars: 100,
      maxStars: 999,
      priceInr: '40.00',
      isActive: true,
    },
  ];

  for (const rate of defaultBoostingRates) {
    if (rate.pricingMode === 'fixed_tier') {
      const existing = await db
        .select()
        .from(boostingRates)
        .where(
          and(
            eq(boostingRates.pricingMode, 'fixed_tier'),
            eq(boostingRates.fromTier, rate.fromTier!),
            eq(boostingRates.toTier, rate.toTier!)
          )
        );
      if (existing.length === 0) {
        await db.insert(boostingRates).values(rate);
      } else {
        await db
          .update(boostingRates)
          .set(rate)
          .where(eq(boostingRates.id, existing[0].id));
      }
    } else {
      const existing = await db
        .select()
        .from(boostingRates)
        .where(
          and(
            eq(boostingRates.pricingMode, 'per_star'),
            eq(boostingRates.starTier, rate.starTier!)
          )
        );
      if (existing.length === 0) {
        await db.insert(boostingRates).values(rate);
      } else {
        await db
          .update(boostingRates)
          .set(rate)
          .where(eq(boostingRates.id, existing[0].id));
      }
    }
  }

  // 4. Upsert Sample Esports Tournaments (Past, Ongoing, Upcoming)
  const sampleTournaments = [
    {
      title: 'Smex Cup Season 1 (S1)',
      gameSlug: 'mlbb',
      format: 'single_elimination' as const,
      status: 'completed' as const,
      prizePoolInr: '5000.00',
      startTime: new Date('2026-09-15T14:00:00Z'),
      endTime: new Date('2026-09-15T20:00:00Z'),
      maxTeams: 16,
      winnerName: 'VO DUDU',
      runnerUpName: 'Goon',
      mvpName: 'Marvelous Grievous',
      rulesMarkdown: 'Official Smex Cup S1 Tournament Rules and Brackets.',
    },
    {
      title: 'Smex Community Clash Vol. 1',
      gameSlug: 'mlbb',
      format: 'single_elimination' as const,
      status: 'completed' as const,
      prizePoolInr: '10000.00',
      startTime: new Date('2026-09-01T12:00:00Z'),
      endTime: new Date('2026-09-02T18:00:00Z'),
      maxTeams: 16,
      rulesMarkdown: 'Standard 5v5 Tournament Rules.',
    },
    {
      title: 'MLBB Regional Invitational 2026',
      gameSlug: 'mlbb',
      format: 'double_elimination' as const,
      status: 'ongoing' as const,
      prizePoolInr: '25000.00',
      startTime: new Date('2026-10-10T10:00:00Z'),
      endTime: new Date('2026-10-15T20:00:00Z'),
      maxTeams: 32,
      rulesMarkdown: 'Double elimination bracket with best-of-3 series.',
    },
    {
      title: 'Mythic Legends Championship',
      gameSlug: 'mlbb',
      format: 'single_elimination' as const,
      status: 'registration_open' as const,
      prizePoolInr: '50000.00',
      startTime: new Date('2026-11-01T10:00:00Z'),
      endTime: new Date('2026-11-05T20:00:00Z'),
      maxTeams: 64,
      rulesMarkdown: 'Grand championship single elimination tournament.',
    },
  ];

  for (const tourney of sampleTournaments) {
    const existing = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.title, tourney.title));
    if (existing.length === 0) {
      await db.insert(tournaments).values(tourney);
    }
  }

  const allRates = await db.select().from(boostingRates);
  const allTourneys = await db.select().from(tournaments);

  return {
    adminEmail,
    presetAvatarsCount,
    boostingRatesCount: allRates.length,
    tournamentsCount: allTourneys.length,
  };
}

// Standalone execution wrapper
async function run() {
  const pool = createDbPool();
  const db = createDbClient(pool);

  try {
    console.log('Starting Smex Store database seed pipeline...');
    const result = await seed(db);
    console.log('Seeding completed successfully:', result);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error during database seeding:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  run();
}
