import { pgTable, uuid, varchar, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const loginStatusEnum = pgEnum('login_status', ['success', 'failed']);

export const loginHistory = pgTable('login_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  deviceName: varchar('device_name', { length: 150 }),
  status: loginStatusEnum('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type LoginHistory = typeof loginHistory.$inferSelect;
export type NewLoginHistory = typeof loginHistory.$inferInsert;
