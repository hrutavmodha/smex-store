import { sql } from 'drizzle-orm';
import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const boostingPricingModeEnum = pgEnum('boosting_pricing_mode', ['fixed_tier', 'per_star']);
export const boostingContactChannelEnum = pgEnum('boosting_contact_channel', ['whatsapp', 'instagram']);
export const boostingOrderStatusEnum = pgEnum('boosting_order_status', [
  'inquiry',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

export const boostingRates = pgTable(
  'boosting_rates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
    pricingMode: boostingPricingModeEnum('pricing_mode').notNull(),
    fromTier: varchar('from_tier', { length: 50 }),
    toTier: varchar('to_tier', { length: 50 }),
    starTier: varchar('star_tier', { length: 50 }),
    minStars: integer('min_stars'),
    maxStars: integer('max_stars'),
    priceInr: numeric('price_inr', { precision: 10, scale: 2 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('boosting_rates_mode_idx').on(t.pricingMode, t.isActive),
    check('boosting_rates_price_positive_chk', sql`${t.priceInr} > 0`),
  ]
);

export const boostingOrders = pgTable('boosting_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id').references(() => users.id, { onDelete: 'set null' }),
  gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
  pricingMode: boostingPricingModeEnum('pricing_mode').notNull(),
  startingRank: varchar('starting_rank', { length: 50 }).notNull(),
  targetRank: varchar('target_rank', { length: 50 }).notNull(),
  startingStars: integer('starting_stars').notNull().default(0),
  targetStars: integer('target_stars').notNull().default(0),
  calculatedPriceInr: numeric('calculated_price_inr', { precision: 10, scale: 2 }).notNull(),
  customerIgn: varchar('customer_ign', { length: 50 }).notNull(),
  contactChannel: boostingContactChannelEnum('contact_channel').notNull(),
  status: boostingOrderStatusEnum('status').notNull().default('inquiry'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BoostingRate = typeof boostingRates.$inferSelect;
export type NewBoostingRate = typeof boostingRates.$inferInsert;
export type BoostingOrder = typeof boostingOrders.$inferSelect;
export type NewBoostingOrder = typeof boostingOrders.$inferInsert;
