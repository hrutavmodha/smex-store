import type { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { SmexDatabase } from '../db/index.js';

export type SearchCategory =
  | 'all'
  | 'tournaments'
  | 'teams'
  | 'players'
  | 'marketplace';

export interface TournamentSearchResult {
  id: string;
  title: string;
  gameSlug: string;
  status: string;
  url: string;
}

export interface TeamSearchResult {
  id: string;
  name: string;
  tag: string;
  gameSlug: string;
  url: string;
}

export interface PlayerSearchResult {
  id: string;
  username: string;
  ign: string;
  role: string;
  url: string;
}

export interface MarketplaceSearchResult {
  id: string;
  title: string;
  rankTier: string;
  priceInr: string;
  badgeType: string;
  url: string;
}

export interface SearchResultsByCategory {
  tournaments?: TournamentSearchResult[];
  teams?: TeamSearchResult[];
  players?: PlayerSearchResult[];
  marketplace?: MarketplaceSearchResult[];
}

export interface UniversalSearchResponse {
  query: string;
  category: SearchCategory;
  totalMatches: number;
  results: SearchResultsByCategory;
}

export interface SearchOptions {
  category?: SearchCategory;
  limit?: number;
  offset?: number;
}

export class SearchService {
  /**
   * Executes cross-entity universal search using PostgreSQL pg_trgm similarity with Redis caching
   */
  static async search(
    rawQuery: string,
    options: SearchOptions = {},
    db: SmexDatabase,
    redis?: Redis
  ): Promise<UniversalSearchResponse> {
    const query = (rawQuery || '').trim();
    if (query.length < 2) {
      const err = new Error('Search query must be at least 2 characters long');
      (err as unknown as { statusCode: number; code: string }).statusCode = 400;
      (err as unknown as { statusCode: number; code: string }).code = 'QUERY_TOO_SHORT';
      throw err;
    }

    const category: SearchCategory = options.category ?? 'all';
    const limit = Math.max(1, Math.min(50, options.limit ?? 10));
    const offset = Math.max(0, options.offset ?? 0);
    const normalizedQuery = query.toLowerCase();

    // Check Redis Cache (TTL 60s)
    const hash = crypto
      .createHash('sha256')
      .update(`${category}:${normalizedQuery}:${limit}:${offset}`)
      .digest('hex');
    const cacheKey = `search:${hash}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as UniversalSearchResponse;
        }
      } catch {
        // Cache read failure shouldn't block database query execution
      }
    }

    // Execute database search queries based on category
    const shouldFetchTournaments = category === 'all' || category === 'tournaments';
    const shouldFetchTeams = category === 'all' || category === 'teams';
    const shouldFetchPlayers = category === 'all' || category === 'players';
    const shouldFetchMarketplace = category === 'all' || category === 'marketplace';

    const [tournaments, teams, players, marketplace] = await Promise.all([
      shouldFetchTournaments
        ? this.searchTournaments(normalizedQuery, limit, offset, db)
        : Promise.resolve(undefined),
      shouldFetchTeams
        ? this.searchTeams(normalizedQuery, limit, offset, db)
        : Promise.resolve(undefined),
      shouldFetchPlayers
        ? this.searchPlayers(normalizedQuery, limit, offset, db)
        : Promise.resolve(undefined),
      shouldFetchMarketplace
        ? this.searchMarketplace(normalizedQuery, limit, offset, db)
        : Promise.resolve(undefined),
    ]);

    const results: SearchResultsByCategory = {};
    let totalMatches = 0;

    if (tournaments !== undefined) {
      results.tournaments = tournaments;
      totalMatches += tournaments.length;
    }
    if (teams !== undefined) {
      results.teams = teams;
      totalMatches += teams.length;
    }
    if (players !== undefined) {
      results.players = players;
      totalMatches += players.length;
    }
    if (marketplace !== undefined) {
      results.marketplace = marketplace;
      totalMatches += marketplace.length;
    }

    const response: UniversalSearchResponse = {
      query,
      category,
      totalMatches,
      results,
    };

    // Store in Redis with 60s TTL
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
      } catch {
        // Cache write failure shouldn't fail request
      }
    }

    return response;
  }

  private static async searchTournaments(
    query: string,
    limit: number,
    offset: number,
    db: SmexDatabase
  ): Promise<TournamentSearchResult[]> {
    const pattern = `%${query}%`;
    const res = await db.execute<{
      id: string;
      title: string;
      game_slug: string;
      status: string;
    }>(sql`
      SELECT id, title, game_slug, status,
             greatest(similarity(title, ${query}), word_similarity(${query}, title)) AS score
      FROM tournaments
      WHERE (
        title % ${query}
        OR similarity(title, ${query}) > 0.2
        OR word_similarity(${query}, title) > 0.2
        OR title ILIKE ${pattern}
        OR game_slug ILIKE ${pattern}
      )
      ORDER BY score DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return (res.rows || []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      gameSlug: String(row.game_slug),
      status: String(row.status),
      url: `/tournaments/${row.id}`,
    }));
  }

  private static async searchTeams(
    query: string,
    limit: number,
    offset: number,
    db: SmexDatabase
  ): Promise<TeamSearchResult[]> {
    const pattern = `%${query}%`;
    const res = await db.execute<{
      id: string;
      name: string;
      tag: string;
      game_slug: string;
    }>(sql`
      SELECT id, name, tag, game_slug,
             greatest(similarity(name, ${query}), word_similarity(${query}, name)) AS score
      FROM teams
      WHERE (
        name % ${query}
        OR similarity(name, ${query}) > 0.2
        OR word_similarity(${query}, name) > 0.2
        OR name ILIKE ${pattern}
        OR tag ILIKE ${pattern}
        OR similarity(tag, ${query}) > 0.2
      )
      ORDER BY score DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return (res.rows || []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      tag: String(row.tag),
      gameSlug: String(row.game_slug),
      url: `/teams/${row.id}`,
    }));
  }

  private static async searchPlayers(
    query: string,
    limit: number,
    offset: number,
    db: SmexDatabase
  ): Promise<PlayerSearchResult[]> {
    const pattern = `%${query}%`;
    const res = await db.execute<{
      id: string;
      username: string;
      in_game_id: string | null;
      playstyle: string | null;
    }>(sql`
      SELECT u.id, p.username, p.in_game_id, p.playstyle,
             greatest(
               similarity(p.username, ${query}),
               word_similarity(${query}, p.username),
               coalesce(similarity(p.in_game_id, ${query}), 0),
               coalesce(word_similarity(${query}, p.in_game_id), 0)
             ) AS score
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE (
        p.username % ${query}
        OR similarity(p.username, ${query}) > 0.2
        OR word_similarity(${query}, p.username) > 0.2
        OR p.username ILIKE ${pattern}
        OR (
          p.in_game_id IS NOT NULL AND (
            p.in_game_id % ${query}
            OR similarity(p.in_game_id, ${query}) > 0.2
            OR word_similarity(${query}, p.in_game_id) > 0.2
            OR p.in_game_id ILIKE ${pattern}
          )
        )
      )
      ORDER BY score DESC, u.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return (res.rows || []).map((row) => ({
      id: String(row.id),
      username: String(row.username),
      ign: row.in_game_id ? String(row.in_game_id) : String(row.username),
      role: row.playstyle ? String(row.playstyle) : 'Player',
      url: `/profile/${row.id}`,
    }));
  }

  private static async searchMarketplace(
    query: string,
    limit: number,
    offset: number,
    db: SmexDatabase
  ): Promise<MarketplaceSearchResult[]> {
    const pattern = `%${query}%`;
    const res = await db.execute<{
      id: string;
      title: string;
      rank_tier: string;
      price_inr: string | number;
      badge_type: string;
      status: string;
    }>(sql`
      SELECT id, title, rank_tier, price_inr, badge_type, status,
             greatest(similarity(title, ${query}), word_similarity(${query}, title)) AS score
      FROM marketplace_listings
      WHERE status = 'active'
        AND (
          title % ${query}
          OR similarity(title, ${query}) > 0.2
          OR word_similarity(${query}, title) > 0.2
          OR title ILIKE ${pattern}
          OR rank_tier ILIKE ${pattern}
        )
      ORDER BY score DESC, created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `);

    return (res.rows || []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      rankTier: String(row.rank_tier),
      priceInr: String(row.price_inr),
      badgeType: String(row.badge_type),
      url: `/marketplace/${row.id}`,
    }));
  }
}
