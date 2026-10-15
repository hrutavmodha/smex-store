# Bug: Round-Robin Schedule Destruction & Arbitrary Winner Crowning

- **Bug ID**: BUG-M5-002
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Critical (Tournament Schedule Corruption & Arbitrary Winner Declaration)
- **Target Files**:
  - `server/src/services/match.service.ts` (lines 95–136, 137–157)
- **Status**: Identified

---

## 1. Description

The match reporting service (`server/src/services/match.service.ts`) treats all competitive tournament formats as single-elimination ladders when advancing match winners and crowning champions. This severely corrupts Round Robin tournaments in two ways:

### A. Overwriting Round-Robin Match Pairings
In `generateRoundRobin` (`server/src/services/bracket-generator.service.ts`), a complete round-by-round tournament schedule is pre-calculated using the Berger rotation polygon algorithm, pre-assigning `teamAId` and `teamBId` for every match in every round.

However, in `MatchService.updateMatchScore` lines 95–124:
```typescript
const nextRound = lockedMatch.roundNumber + 1;
const nextMatchOrder = Math.ceil(lockedMatch.matchOrder / 2);
const isTeamASlot = lockedMatch.matchOrder % 2 === 1;

const [nextMatch] = await tx
  .select()
  .from(tournamentMatches)
  .where(
    and(
      eq(tournamentMatches.tournamentId, tournamentId),
      eq(tournamentMatches.roundNumber, nextRound),
      eq(tournamentMatches.matchOrder, nextMatchOrder),
      eq(tournamentMatches.bracketType, lockedMatch.bracketType)
    )
  )
  .for('update')
  .limit(1);

if (nextMatch) {
  const updatePayload = isTeamASlot
    ? { teamAId: input.winnerId, updatedAt: new Date() }
    : { teamBId: input.winnerId, updatedAt: new Date() };

  await tx.update(tournamentMatches).set(updatePayload).where(eq(tournamentMatches.id, nextMatch.id));
}
```
Because all round-robin matches share `bracketType = 'round_robin'`, whenever a Round 1 match finishes, this query locates a match in Round 2 and **overwrites its pre-scheduled `teamAId` or `teamBId`** with the winner of Round 1. This completely obliterates the Berger schedule.

### B. Arbitrary Winner Crowning
When the final match of the last round completes, lines 137–157 check:
```typescript
if (!higherRoundMatch) {
  isChampionshipMatch = true;
  await TournamentLifecycleService.transitionStatus(
    tournamentId,
    'completed',
    db,
    redis,
    { winnerTeamId: input.winnerId }
  );
}
```
In Round Robin tournaments, there is no single elimination "championship final match". Tournaments are decided by total standings (match wins, points: 3 for win, 1 for draw, 0 for loss, score differential).
Currently, the system crowns **whoever happened to win the last match played on the schedule** as the champion of the entire tournament, ignoring points, match records, and standings.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 3.3:
  > Round Robin pairings are pre-computed for all rounds and must remain static. Standings and rankings are accumulated from all completed match scores to crown the tournament winner based on points and tie-breakers.

---

## 3. Reproduction Steps / Proof of Concept

1. Create a 4-team tournament with `format = 'round_robin'`.
2. Generate bracket (`POST /api/v1/tournaments/:id/bracket/generate`). Notice 3 rounds of 2 matches each, all with pre-populated `teamAId` and `teamBId`.
3. Submit score for Round 1, Match 1: `winnerId = Team 1`.
4. Inspect Round 2, Match 1:
   - Notice its pre-scheduled team has been replaced/overwritten by Team 1.
5. Complete all matches.
6. Observe `tournaments.winnerTeamId`:
   - It is set to the winner of the last match in Round 3, regardless of overall win-loss record or point totals.

---

## 4. Impact

- Corrupted match schedules in Round Robin tournaments.
- Illegitimate tournament champions crowned in live production.

---

## 5. Recommended Remediation

1. In `server/src/services/match.service.ts`:
   - Only execute `findNextMatch` bracket advancement if `lockedMatch.bracketType !== 'round_robin'`.
   - In `checkAndCompleteTournament`, if the tournament format is `'round_robin'`, verify that all matches across all rounds are completed. If completed, compute cumulative standings (points, wins, goal differential) across all tournament matches to determine the legitimate tournament champion.
