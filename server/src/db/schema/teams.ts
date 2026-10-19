import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, uuid, varchar, text, integer, timestamp, check, unique, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const teamStatusEnum = pgEnum('team_status', ['open', 'closed', 'disbanded']);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique('teams_name_unique_idx'),
    tag: varchar('tag', { length: 10 }).notNull(),
    captainId: uuid('captain_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
    memberCap: integer('member_cap').notNull().default(5),
    status: teamStatusEnum('status').notNull().default('open'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('teams_member_cap_chk', sql`${t.memberCap} >= 1 AND ${t.memberCap} <= 10`),
    index('teams_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
  ]
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    memberRole: varchar('member_role', { length: 50 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('team_members_team_user_unq').on(t.teamId, t.userId),
  ]
);

export const joinRequestStatusEnum = pgEnum('join_request_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
]);

export const teamJoinRequests = pgTable(
  'team_join_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    playerIgn: varchar('player_ign', { length: 50 }).notNull(),
    playerRole: varchar('player_role', { length: 50 }).notNull(),
    message: text('message'),
    status: joinRequestStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('team_join_requests_pending_unq')
      .on(t.teamId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    index('team_join_requests_team_status_idx').on(t.teamId, t.status),
    index('team_join_requests_user_idx').on(t.userId),
  ]
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type TeamJoinRequest = typeof teamJoinRequests.$inferSelect;
export type NewTeamJoinRequest = typeof teamJoinRequests.$inferInsert;
