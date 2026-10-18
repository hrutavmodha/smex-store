# Bug: Unescaped SQL Wildcard Characters (`%`, `_`) in Universal Search ILIKE Queries

- **Bug ID**: BUG-M8-006
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search
- **Severity**: Medium (Search Quality Degradation / SQL Pattern Injection)
- **Target Files**:
  - `server/src/services/search.service.ts` (lines 124, 160, 197, 246)
- **Status**: Identified

---

## 1. Description

In `UniversalSearchService` (`server/src/services/search.service.ts`), fuzzy text matching combines PostgreSQL trigram functions with standard `ILIKE` wildcard queries across tournaments, teams, profiles, and marketplace listings:

```typescript
// server/src/services/search.service.ts:124-140
const pattern = `%${query}%`;
const res = await db.execute<{ ... }>(sql`
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
```

This pattern is identical in `searchTeams`, `searchPlayers`, and `searchMarketplace`.

The service interpolates `query` directly into `${pattern}` without escaping SQL `LIKE`/`ILIKE` special characters:
- `%` represents zero or more arbitrary characters.
- `_` represents any single arbitrary character.

If a user inputs a query containing `%` or `_` (e.g. `__`, `%a%`, `_VIP`), the `ILIKE` clause bypasses the intended similarity ranking and performs a greedy pattern match that matches every single record containing characters matching the wildcard positions.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 3.1:
  > Specifies deterministic trigram search with relevance scoring.

---

## 3. Reproduction Steps / Proof of Concept

1. Populate the database with 50 tournaments with distinct titles.
2. Call the universal search endpoint with a wildcard query:
   ```http
   GET /api/v1/search?q=__ HTTP/1.1
   Host: localhost:5000
   ```
3. Because `_` matches any single character, `pattern` becomes `%__%`, which matches any string with 2 or more characters.
4. **Result**: The `title ILIKE '%__%'` clause evaluates to `TRUE` for every single row in the database, nullifying fuzzy scoring and dumping arbitrary unordered records from all tables.

---

## 4. Impact

- **Search Relevancy Failure**: Users typing legitimate queries containing underscores or percentage signs experience degraded search results.
- **Uncontrolled Query Scope**: Wildcard searches force sequential scanning across all rows matching the wildcard pattern, bypassing index boundaries.

---

## 5. Recommended Remediation

1. Implement a helper to escape SQL wildcard characters before constructing the pattern:
   ```typescript
   function escapeLikeWildcards(str: string): string {
     return str.replace(/([%_\\])/g, '\\$1');
   }
   ```
2. Use the escaped string when constructing the pattern:
   ```typescript
   const safeQuery = escapeLikeWildcards(query);
   const pattern = `%${safeQuery}%`;
   ```
