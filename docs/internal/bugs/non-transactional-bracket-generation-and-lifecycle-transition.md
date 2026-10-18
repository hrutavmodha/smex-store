# Bug: Non-Transactional Bracket Generation and Tournament Lifecycle State Transition

- **Bug ID**: 24
- **Category**: Reliability / Concurrency
- **Severity**: High
- **Target Files**:
  - `server/src/routes/tournaments.ts` (lines 446–459)
  - `server/src/services/bracket-generator.service.ts` (lines 17–35)
  - `server/src/services/tournament-lifecycle.service.ts` (lines 45–60)
- **Status**: Identified

---

## 1. Description

In `server/src/routes/tournaments.ts`, the bracket generation handler coordinates match generation and tournament lifecycle status transition across two separate, uncoordinated steps:

```ts
// Generate bracket matches (deletes old matches and inserts new ones)
const matches = await BracketGeneratorService.generateBracket(
  id,
  tourney.format,
  validParticipants,
  fastify.db
);

// Transition tournament status to ongoing
await TournamentLifecycleService.transitionStatus(
  id,
  'ongoing',
  fastify.db,
  fastify.redis
);
```

Inside `BracketGeneratorService.generateBracket`:
```ts
// Delete existing matches for clean regeneration
await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));

if (format === 'single_elimination') {
  return this.generateSingleElimination(tournamentId, participants, db);
}
// ...
```

Neither `generateBracket` nor the caller in `tournaments.ts` runs inside an ACID database transaction (`db.transaction`).
If an unhandled exception occurs during match insertion, or if `TournamentLifecycleService.transitionStatus` fails (e.g., Redis publish timeout, connection glitch, or validation guard failure), the database is left in a corrupt partial state:
- Old matches were already permanently deleted.
- New matches may have been inserted.
- The tournament status remains in its previous state (`registration_open`) instead of `ongoing`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/tournament-operations.md` Section 3: "Bracket Generation and State Synchronization: Bracket creation and status transition to 'ongoing' must execute atomically within a single database transaction."
- `docs/internal/roadmap.md` Section 5.3: "Bracket Generation Algorithm and State Machine."

---

## 3. Reproduction Steps / Proof of Concept

1. Set up a tournament in `registration_open` state with 4 participating teams.
2. Simulate a failure during the second step by mocking `TournamentLifecycleService.transitionStatus` to throw an error:
   ```ts
   vi.spyOn(TournamentLifecycleService, 'transitionStatus').mockRejectedValueOnce(new Error('Redis connection lost'));
   ```
3. Invoke `POST /api/v1/tournaments/:id/bracket/generate`.
4. The request fails with HTTP 500.
5. Query the database:
   - Matches have been generated in `tournament_matches`.
   - The tournament record in `tournaments` remains in `registration_open` state.
   - Subsequent calls may duplicate matches or fail due to mismatched tournament state.

---

## 4. Impact

Tournaments can become permanently desynchronized with orphan bracket matches while remaining open for registrations, violating system invariants and requiring manual database surgery.

---

## 5. Recommended Remediation

Wrap the match generation, deletion, and status transition inside a single ACID database transaction:

```ts
const matches = await fastify.db.transaction(async (tx) => {
  const generatedMatches = await BracketGeneratorService.generateBracket(
    id,
    tourney.format,
    validParticipants,
    tx
  );

  await TournamentLifecycleService.transitionStatus(
    id,
    'ongoing',
    tx,
    fastify.redis
  );

  return generatedMatches;
});
```
Ensure `BracketGeneratorService` accepts either `SmexDatabase` or `PgTransaction` as its database parameter.
