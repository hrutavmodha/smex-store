import { pgTable, uuid, varchar, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),
    metadataJson: jsonb('metadata_json').notNull().default({}),
    isPrivate: boolean('is_private').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('activity_logs_user_created_idx').on(t.userId, t.createdAt),
  ]
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
