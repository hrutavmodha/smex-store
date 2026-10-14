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
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { teams } from './teams.js';

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'single_elimination',
  'double_elimination',
  'round_robin',
]);
export const tournamentStatusEnum = pgEnum('tournament_status', [
  'upcoming',
  'registration_open',
  'ongoing',
  'completed',
]);
export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'live', 'completed', 'bye']);

export const tournaments = pgTable(
  'tournaments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 100 }).notNull(),
    gameSlug: varchar('game_slug', { length: 50 }).notNull().default('mlbb'),
    format: tournamentFormatEnum('format').notNull().default('single_elimination'),
    status: tournamentStatusEnum('status').notNull().default('upcoming'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    prizePoolInr: numeric('prize_pool_inr', { precision: 10, scale: 2 }).notNull().default('0.00'),
    maxTeams: integer('max_teams').notNull().default(16),
    rulesMarkdown: text('rules_markdown'),
    winnerTeamId: uuid('winner_team_id').references(() => teams.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('tournaments_max_teams_chk', sql`${t.maxTeams} >= 2 AND ${t.maxTeams} <= 128`),
  ]
);

export const tournamentParticipants = pgTable(
  'tournament_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('tournament_participants_unq').on(t.tournamentId, t.teamId),
  ]
);

export const tournamentMatches = pgTable(
  'tournament_matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    matchOrder: integer('match_order').notNull(),
    teamAId: uuid('team_a_id').references(() => teams.id, { onDelete: 'set null' }),
    teamBId: uuid('team_b_id').references(() => teams.id, { onDelete: 'set null' }),
    teamAScore: integer('team_a_score').notNull().default(0),
    teamBScore: integer('team_b_score').notNull().default(0),
    winnerId: uuid('winner_id').references(() => teams.id, { onDelete: 'set null' }),
    status: matchStatusEnum('status').notNull().default('scheduled'),
    bracketType: varchar('bracket_type', { length: 20 }).notNull().default('upper'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tournament_matches_round_idx').on(t.tournamentId, t.roundNumber),
  ]
);

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type NewTournamentParticipant = typeof tournamentParticipants.$inferInsert;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type NewTournamentMatch = typeof tournamentMatches.$inferInsert;
