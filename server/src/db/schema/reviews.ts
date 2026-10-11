import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, text, timestamp, unique, check, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { marketplaceListings } from './marketplace.js';

export const sellerRatings = pgTable(
  'seller_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => marketplaceListings.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewText: text('review_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('seller_ratings_buyer_listing_unq').on(t.buyerId, t.listingId),
    check('seller_ratings_range_chk', sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
    check('seller_ratings_no_self_review_chk', sql`${t.sellerId} <> ${t.buyerId}`),
    index('seller_ratings_seller_idx').on(t.sellerId),
  ]
);

export type SellerRating = typeof sellerRatings.$inferSelect;
export type NewSellerRating = typeof sellerRatings.$inferInsert;
