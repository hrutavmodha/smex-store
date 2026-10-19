import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  check,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const listingStatusEnum = pgEnum('listing_status', ['active', 'sold', 'deleted']);
export const listingBadgeEnum = pgEnum('listing_badge', ['none', 'good_deal', 'hot']);
export const contactChannelEnum = pgEnum('contact_channel', ['whatsapp', 'instagram']);


export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 150 }).notNull(),
    gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
    rankTier: varchar('rank_tier', { length: 50 }).notNull(),
    priceInr: numeric('price_inr', { precision: 10, scale: 2 }).notNull(),
    baselinePriceInr: numeric('baseline_price_inr', { precision: 10, scale: 2 }),
    badgeType: listingBadgeEnum('badge_type').notNull().default('none'),
    status: listingStatusEnum('status').notNull().default('active'),
    contactChannel: contactChannelEnum('contact_channel').notNull(),
    contactHandle: varchar('contact_handle', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('marketplace_price_floor_chk', sql`${t.priceInr} >= 100`),
    index('marketplace_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
  ]
);

export const listingProofs = pgTable('listing_proofs', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  s3Key: text('s3_key').notNull(),
  cdnUrl: text('cdn_url').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type NewMarketplaceListing = typeof marketplaceListings.$inferInsert;
export type ListingProof = typeof listingProofs.$inferSelect;
export type NewListingProof = typeof listingProofs.$inferInsert;
