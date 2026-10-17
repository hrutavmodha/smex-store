export type SearchCategory = 'all' | 'tournaments' | 'teams' | 'players' | 'marketplace';

export interface TournamentSearchResult {
  id: string;
  title: string;
  gameSlug?: string;
  status?: string;
  url: string;
}

export interface TeamSearchResult {
  id: string;
  name: string;
  tag?: string;
  gameSlug?: string;
  url: string;
}

export interface PlayerSearchResult {
  id: string;
  username: string;
  ign?: string;
  role?: string;
  url: string;
}

export interface MarketplaceSearchResult {
  id: string;
  title: string;
  rankTier?: string;
  priceInr?: string | number;
  badgeType?: string;
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

export interface SearchResultItem {
  id: string;
  category: 'tournaments' | 'teams' | 'players' | 'marketplace';
  title: string;
  subtitle?: string;
  badge?: string;
  url: string;
}
