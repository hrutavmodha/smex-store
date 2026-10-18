# Bug: Tournament Bracket Generation Permitted in `upcoming` State Without Lifecycle Shift

- **Bug ID**: 6
- **Category**: Correctness
- **Severity**: Medium
- **Target Files**:
  - `server/src/routes/tournaments.ts` (lines 405, 454–461)
  - `server/src/services/tournament-lifecycle.service.ts` (lines 42–47, 224–232)
- **Status**: Identified

---

## 1. Description

In `server/src/routes/tournaments.ts`:
```ts
// Line 405
if (tourney.status !== 'registration_open' && tourney.status !== 'upcoming') {
  return reply.code(400).send(
    formatRfc7807(400, 'INVALID_TOURNAMENT_STATE', 'Bad Request', ...)
  );
}
// ...
// Line 454
if (tourney.status === 'registration_open') {
  await TournamentLifecycleService.transitionStatus(id, 'ongoing', fastify.db, fastify.redis);
}
```
If bracket generation is triggered on a tournament in `'upcoming'` state:
1. Line 405 allows generation to proceed.
2. Brackets and matches are inserted into the database.
3. Line 454 checks only for `tourney.status === 'registration_open'`, so it skips transitioning the tournament to `'ongoing'`.
4. The tournament remains in `'upcoming'` state while having active match nodes.
5. Furthermore, `TournamentLifecycleService.ALLOWED_TRANSITIONS.upcoming` only permits transitioning to `registration_open`. It is impossible to advance this tournament to `ongoing`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/tournament-engine.md` Section 1: "State machine: upcoming -> registration_open -> ongoing -> completed. Brackets may only be generated once registrations close."

---

## 3. Reproduction Steps / Proof of Concept

1. Create a tournament (initial state is `upcoming`).
2. Directly insert 2 test participants or call bracket generation.
3. Call `POST /api/v1/tournaments/:id/bracket/generate`.
4. Brackets are generated, but the tournament status remains `upcoming`.
5. Subsequent calls to update match scores or transition to `ongoing` fail with `INVALID_STATUS_TRANSITION`.

---

## 4. Impact

Tournaments can become permanently frozen in the `upcoming` state with generated match brackets.

---

## 5. Recommended Remediation

In `server/src/routes/tournaments.ts` line 405, restrict bracket generation strictly to tournaments in `registration_open` state:
```ts
if (tourney.status !== 'registration_open') {
  return reply.code(400).send(
    formatRfc7807(
      400,
      'INVALID_TOURNAMENT_STATE',
      'Bad Request',
      `Cannot generate brackets for tournament in '${tourney.status}' state. Status must be 'registration_open'.`
    )
  );
}
```
