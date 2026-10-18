# Bug: Missing Trigram GIN/GiST Indexes Causing Full Table Scans During Universal Search

- **Bug ID**: BUG-M8-003
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search
- **Severity**: Medium (Database Performance Bottleneck / Full Table Scans)
- **Target Files**:
  - `server/src/db/schema/tournaments.ts`
  - `server/src/db/schema/teams.ts`
  - `server/src/db/schema/users.ts`
  - `server/src/db/schema/marketplace.ts`
  - `server/src/services/search.service.ts` (lines 130–266)
- **Status**: Identified

---

## 1. Description

In `UniversalSearchService` (`server/src/services/search.service.ts`), fuzzy text search is executed across four tables using trigram distance calculations:
- `tournaments.title` (`similarity(title, ${query})`, `word_similarity(${query}, title)`, `title % ${query}`)
- `teams.name`
- `profiles.ign` and `profiles.display_name`
- `marketplace_listings.title`

In PostgreSQL, trigram similarity operators (`%`, `similarity()`) can be indexed using Generalized Inverted Indexes (`GIN`) with `gin_trgm_ops` or Generalized Search Trees (`GiST`) with `gist_trgm_ops`.

Without these indexes, PostgreSQL is forced to perform **sequential full-table scans (`Seq Scan`)**, computing `similarity()` and `word_similarity()` algorithms row-by-row on every single record in all four tables concurrently on every single search request.

An inspection of the schema definitions and migration files reveals that zero GIN trigram indexes have been defined on any of these four tables.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 8 Section 8.2:
  > "**Cross-Entity Universal Search**: Fast SQL search index with trigram matching across Tournaments, Teams, and Players."
- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 3.1:
  > Explicitly specifies "Fast SQL search index with trigram matching".

---

## 3. Reproduction Steps / Proof of Concept

1. Seed each table (`tournaments`, `teams`, `profiles`, `marketplace_listings`) with 10,000 mock records.
2. Run `EXPLAIN ANALYZE` on the query executed by `UniversalSearchService`:
   ```sql
   EXPLAIN ANALYZE
   SELECT id, title, game_slug, status,
          greatest(similarity(title, 'mythic'), word_similarity('mythic', title)) AS score
   FROM tournaments
   WHERE (
     title % 'mythic'
     OR similarity(title, 'mythic') > 0.2
     OR word_similarity('mythic', title) > 0.2
     OR title ILIKE '%mythic%'
   )
   ORDER BY score DESC, created_at DESC
   LIMIT 10 OFFSET 0;
   ```
3. **Execution Plan Output**:
   ```
   Seq Scan on tournaments (cost=0.00..852.00 rows=1000 width=142)
     Filter: ((title % 'mythic'::text) OR (similarity((title)::text, 'mythic'::text) > 0.2) OR ...)
   ```
   Sequential scan across every row, taking tens of milliseconds for a single small table. Across 4 queries on large datasets, this generates severe CPU spikes and latency spikes.

---

## 4. Impact

- **Severe Query Latency Under Scale**: As data volume expands, universal search latency grows linearly ($O(N)$ across all 4 tables), leading to query timeouts and high database server CPU utilization.
- **Degraded User Experience**: Autocomplete in `UniversalSearchModal.tsx` will experience noticeable lag.

---

## 5. Recommended Remediation

1. In each schema file (or a dedicated migration script), define GIN trigram indexes using `gin_trgm_ops`:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_tournaments_title_trgm ON tournaments USING gin (title gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS idx_teams_name_trgm ON teams USING gin (name gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS idx_profiles_ign_trgm ON profiles USING gin (ign gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm ON profiles USING gin (display_name gin_trgm_ops);
   CREATE INDEX IF NOT EXISTS idx_marketplace_title_trgm ON marketplace_listings USING gin (title gin_trgm_ops);
   ```
2. Verify with `EXPLAIN` that PostgreSQL uses `Bitmap Index Scan using idx_tournaments_title_trgm`.
