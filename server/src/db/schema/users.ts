import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'manager', 'admin']);
export const themePrefEnum = pgEnum('theme_preference', ['dark', 'amoled', 'light']);
export const densityPrefEnum = pgEnum('density_preference', ['compact', 'comfortable', 'spacious']);
export const privacyPrefEnum = pgEnum('privacy_preference', ['public', 'friends', 'private']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique('users_email_unique_idx'),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  promotedBy: uuid('promoted_by').references((): any => users.id, { onDelete: 'set null' }),
  promotedAt: timestamp('promoted_at', { withTimezone: true }),
  emailVerified: boolean('email_verified').notNull().default(true),
  isBanned: boolean('is_banned').notNull().default(false),
  banReason: text('ban_reason'),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    username: varchar('username', { length: 50 }).notNull().unique('profiles_username_unique_idx'),
    inGameId: varchar('in_game_id', { length: 50 }),
    avatarPreset: varchar('avatar_preset', { length: 50 }).notNull().default('preset_default_01'),
    playstyle: varchar('playstyle', { length: 50 }),
    bio: text('bio'),
    themePref: themePrefEnum('theme_pref').notNull().default('dark'),
    densityPref: densityPrefEnum('density_pref').notNull().default('comfortable'),
    activityPrivacy: privacyPrefEnum('activity_privacy').notNull().default('public'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('profiles_username_trgm_idx').using('gin', sql`${t.username} gin_trgm_ops`),
    index('profiles_in_game_id_trgm_idx').using('gin', sql`${t.inGameId} gin_trgm_ops`),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
