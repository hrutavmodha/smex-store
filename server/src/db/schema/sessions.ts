import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    deviceFingerprint: varchar('device_fingerprint', { length: 128 }),
    deviceName: varchar('device_name', { length: 150 }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_active_idx').on(t.userId, t.isActive),
    index('sessions_expires_at_idx').on(t.expiresAt),
  ]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
