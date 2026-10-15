# Bug: Participant Withdrawal Leaves Fragmented Seeds Causing Team Deletion During Bracket Generation

- **Bug ID**: BUG-M5-003
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: High (Bracket Corruption & Permanent Team Exclusion)
- **Target Files**:
  - `server/src/routes/tournaments.ts` (lines 381–392, 465–472)
  - `server/src/services/bracket-generator.service.ts` (lines 40–50)
- **Status**: Identified

---

## 1. Description

When a team registers for a tournament, seeds are assigned sequentially based on the current count of participants:
```typescript
// server/src/routes/tournaments.ts line 382
const assignedSeed = currentCount + 1;
```

When a team withdraws via `DELETE /api/v1/tournaments/:id/participants/:teamId`:
```typescript
// server/src/routes/tournaments.ts lines 465-472
await fastify.db
  .delete(tournamentParticipants)
  .where(
    and(
      eq(tournamentParticipants.tournamentId, id),
      eq(tournamentParticipants.teamId, teamId)
    )
  );
```
The endpoint deletes the participant row, but **does not re-index or compact the seeds of remaining participants**.

### Consequence: Seed Collisions and Team Deletion
Suppose Teams A, B, and C register (assigned seeds 1, 2, 3 respectively).
1. Team B withdraws. Remaining seeds in the database are:
   - Team A: Seed 1
   - Team C: Seed 3
   - Total count: 2
2. A new squad, Team D, registers.
   - `currentCount` = 2.
   - `assignedSeed = currentCount + 1 = 3`.
   - Team D is inserted with `seed = 3`.
3. Now both Team C and Team D have `seed = 3`.
4. When the admin launches bracket generation, `server/src/services/bracket-generator.service.ts` builds a seed map:
   ```typescript
   const seedMap = new Map<number, string>();
   sorted.forEach((p) => {
     seedMap.set(p.seed, p.teamId);
   });
   ```
   Because both Team C and Team D have seed 3, `seedMap.set(3, teamDId)` **silently overwrites** Team C.
5. In the generated bracket matches, Team C is completely missing from the bracket, creating a phantom bye for their scheduled opponent while Team C remains registered but unable to play.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 3.1:
  > Bracket generation requires unique, contiguous seed indices $\in [1, N]$ to map participants accurately to bracket nodes and prevent collisions.

---

## 3. Reproduction Steps / Proof of Concept

1. Create a tournament with `maxTeams = 4`.
2. Register Team 1 (Seed 1), Team 2 (Seed 2), Team 3 (Seed 3).
3. Withdraw Team 2 via `DELETE /api/v1/tournaments/:id/participants/:team2Id`.
4. Register Team 4 via `POST /api/v1/tournaments/:id/participants`.
5. Check `tournament_participants` table:
   - Team 1: `seed = 1`
   - Team 3: `seed = 3`
   - Team 4: `seed = 3`
6. Call `POST /api/v1/tournaments/:id/bracket/generate`.
7. Inspect `tournament_matches`:
   - Only Team 1 and Team 4 appear. Team 3 was overwritten and never scheduled.

---

## 4. Impact

- Registered squads are deleted from tournament brackets without warning.
- Brackets contain unbalanced and phantom byes.

---

## 5. Recommended Remediation

1. In `DELETE /api/v1/tournaments/:id/participants/:teamId`:
   - After deleting the participant row, re-index all remaining participants for that tournament sequentially (`seed = 1, 2, ..., N`).
2. Alternatively (or as defense-in-depth), in `POST /api/v1/tournaments/:id/bracket/generate`:
   - Re-assign contiguous seeds `1..N` to all participants before passing them to `BracketGeneratorService`.
