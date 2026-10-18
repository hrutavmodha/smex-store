# Bug: Universal Search Calculates `totalMatches` as Sum of Truncated Result Slices Rather than True Match Count

- **Bug ID**: BUG-M8-008
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search
- **Severity**: Low / Minor Data Inaccuracy
- **Target Files**:
  - `server/src/services/search.service.ts` (lines 80–104)
- **Status**: Identified

---

## 1. Description

In `UniversalSearchService.search` (`server/src/services/search.service.ts`), queries execute against individual entity tables with `LIMIT ${limit} OFFSET ${offset}`:

```typescript
// server/src/services/search.service.ts:79-104
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
```

`totalMatches` is computed by summing the lengths of the *returned, paginated array slices* (`tournaments.length`, etc.).

If a database query matches 150 tournaments, but `limit = 10`, `tournaments.length` is 10. `totalMatches` is set to `10`, communicating to the client and user that only 10 total matches exist across the platform, rather than 150.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 3.2:
  > `totalMatches` represents the total count of matching records across queried entity domains.

---

## 3. Impact

- The search UI and client consumers receive false total match indicators, preventing proper pagination calculations or accurate "X results found" badges.

---

## 4. Recommended Remediation

1. In each search query method, include `count(*) OVER() AS total_count` in the SQL projection or execute a parallel `COUNT(*)` query:
   ```sql
   SELECT id, title, count(*) OVER() AS full_count ...
   ```
2. Sum the authoritative full counts rather than the truncated slice lengths to populate `totalMatches`.
