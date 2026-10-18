# Bug: Missing `pg_trgm` PostgreSQL Extension in Database Migrations Causing Universal Search Crashes

- **Bug ID**: BUG-M8-001
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search
- **Severity**: Critical (Deployment Failure / Database Execution Error)
- **Target Files**:
  - `server/src/db/migrations/` (no migration enables `pg_trgm`)
  - `server/src/services/search.service.ts` (lines 130–266)
- **Status**: Identified

---

## 1. Description

Milestone 8 introduced cross-entity universal search (`UniversalSearchService`) backed by PostgreSQL trigram operators and functions:
```sql
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
```

These functions (`similarity`, `word_similarity`) and operator (`%`) are not native built-in PostgreSQL core primitives; they are provided exclusively by the `pg_trgm` contrib extension.

However, an inspection of all migration scripts in `server/src/db/migrations/` (`0000` through `0005`) reveals that `CREATE EXTENSION IF NOT EXISTS pg_trgm;` is completely absent from all database migrations.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 8 Section 8.2:
  > "**Cross-Entity Universal Search**: Fast SQL search index with trigram matching across Tournaments, Teams, and Players."
- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 3.1:
  > Explicitly documents trigram similarity and word-similarity ranking for fuzzy matching.

---

## 3. Reproduction Steps / Proof of Concept

1. Spin up a clean PostgreSQL instance or container:
   ```bash
   docker run --name smex-clean-db -e POSTGRES_PASSWORD=smex -p 5433:5432 -d postgres:16-alpine
   ```
2. Run database migrations via Drizzle Kit:
   ```bash
   pnpm db:migrate
   ```
3. Start the server and query the universal search endpoint:
   ```http
   GET /api/v1/search?q=mythic HTTP/1.1
   Host: localhost:5000
   ```
4. **Result**: The query immediately crashes with HTTP 500:
   `error: function similarity(character varying, unknown) does not exist` or `operator does not exist: character varying % unknown`.

---

## 4. Impact

- **Total Feature Breakdown on Fresh Deployments**: Any new developer setup, CI pipeline with fresh ephemeral databases, staging environment, or production cluster running `drizzle-kit migrate` fails with HTTP 500 errors on all universal search queries.

---

## 5. Recommended Remediation

1. **Add Migration for `pg_trgm`**:
   Create a new migration script (e.g. `server/src/db/migrations/0006_fuzzy_search_trgm.sql`) or prepend to schema initialization:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
2. **Include in Drizzle Schema Initialization**:
   Ensure migration scripts and schema seeds execute `CREATE EXTENSION IF NOT EXISTS pg_trgm;` prior to creating tables or trigram indexes.
