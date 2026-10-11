import { sql } from 'drizzle-orm';
import { pgEnum, pgTable, uuid, varchar, text, integer, timestamp, check, unique } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const teamStatusEnum = pgEnum('team_status', ['open', 'closed']);

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

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
