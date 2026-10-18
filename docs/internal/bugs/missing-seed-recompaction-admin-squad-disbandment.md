# Bug: Missing Seed Re-Compaction in Admin Squad Disbandment

- **Bug ID**: 5
- **Category**: Correctness
- **Severity**: Medium
- **Target Files**:
  - `server/src/services/user-moderation.service.ts` (lines 262–268)
  - `server/src/services/tournament-participant.service.ts` (lines 202–222)
- **Status**: Identified

---

## 1. Description

When an administrator disbands a squad, `UserModerationService.disbandTeam` withdraws the squad from all upcoming tournaments:
```ts
const participants = await db
  .select({
    participantId: tournamentParticipants.id,
    tournamentId: tournamentParticipants.tournamentId,
    status: tournaments.status,
  })
  .from(tournamentParticipants)
  .innerJoin(tournaments, eq(tournamentParticipants.tournamentId, tournaments.id))
  .where(
    and(
      eq(tournamentParticipants.teamId, teamId),
      or(eq(tournaments.status, 'upcoming'), eq(tournaments.status, 'registration_open'))
    )
  );

for (const p of participants) {
  await db
    .delete(tournamentParticipants)
    .where(eq(tournamentParticipants.id, p.participantId));
}
```
However, it fails to re-compact the seeds of the remaining registered squads.
In contrast, `TournamentParticipantService.withdrawSquad` explicitly re-compacts participant seeds sequentially ($1 \dots N$):
```ts
const remaining = await tx
  .select()
  .from(tournamentParticipants)
  .where(eq(tournamentParticipants.tournamentId, tournamentId))
  .orderBy(tournamentParticipants.seed, tournamentParticipants.registeredAt);

for (let i = 0; i < remaining.length; i++) {
  const newSeed = i + 1;
  if (remaining[i].seed !== newSeed) {
    await tx.update(tournamentParticipants).set({ seed: newSeed })...;
  }
}
```

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/tournament-engine.md` Section 2: "Seeding Invariant: Registered squads in upcoming tournaments must maintain strictly contiguous seeds from 1 to N."

---

## 3. Reproduction Steps / Proof of Concept

1. Register squads A, B, and C into an open tournament (assigned seeds 1, 2, and 3).
2. As an administrator, disband squad B via `POST /api/v1/admin/teams/:id/disband`.
3. Inspect `tournament_participants` for the tournament:
   - Squad A has seed 1.
   - Squad C has seed 3.
   - Seed 2 is missing.
4. When new teams register, seeds are assigned as `currentCount + 1`, duplicating existing seeds or generating non-standard bracket matchups.

---

## 4. Impact

Non-contiguous seeds lead to skewed bracket generation, incorrect bye placements, and duplicate seed assignments.

---

## 5. Recommended Remediation

In `UserModerationService.disbandTeam`, iterate through affected tournaments and re-compact seeds after deleting participants, or call `TournamentParticipantService.withdrawSquad` directly.
