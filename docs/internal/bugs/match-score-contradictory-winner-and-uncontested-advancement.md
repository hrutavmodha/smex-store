# Bug: Match Score Logic Permits Contradictory Winners & Scoring Uncontested Matches

- **Bug ID**: BUG-M5-007
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Medium (Data Integrity & Match Engine Invariant Failure)
- **Target Files**:
  - `server/src/services/match.service.ts` (lines 65–85)
  - `server/src/routes/tournaments.ts` (lines 560–600)
- **Status**: Identified

---

## 1. Description

The match scoring service `MatchService.updateMatchScore` fails to enforce domain invariants regarding match scores and winners:

### A. Contradictory Winner Validation Omission
In `MatchService.updateMatchScore`:
```typescript
if (input.winnerId !== lockedMatch.teamAId && input.winnerId !== lockedMatch.teamBId) {
  throw new MatchServiceError(
    'INVALID_WINNER',
    400,
    'Winner ID must match one of the participating teams'
  );
}
```
The service verifies that `winnerId` belongs to either `teamAId` or `teamBId`, but **never compares the scores against the declared winner**.
An administrator or caller can submit:
```json
{
  "teamAScore": 0,
  "teamBScore": 2,
  "winnerId": "<teamAId>"
}
```
The system accepts this without error, permanently marking Team A as the match winner and advancing them to the next round despite losing the match 0–2.

### B. Uncontested Matches Can Be Concluded Prematurely
In upper rounds of elimination brackets, matches are scheduled with placeholder slots (`teamBId: null`) waiting for previous round winners to emerge.
If an admin invokes score reporting on a match where `teamBId` is `null` with `winnerId = teamAId`, the match is marked as `completed` with status `'completed'`.
This allows advancing a team without ever playing their opponent from the lower feeder match. Furthermore, when the lower feeder match later completes, its advancement logic attempts to write into an already-completed match node.

### C. No Protection Against Re-Scoring Already Completed Matches
If a match is already marked `'completed'`, calling score update allows overwriting its score and changing the winner without rolling back downstream bracket advancements.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 4.1:
  > Match score submissions must validate score consistency against `winner_id` ($S_{\text{winner}} > S_{\text{loser}}$) and ensure both competitors are populated before concluding a contested match node.

---

## 3. Reproduction Steps / Proof of Concept

1. Start an ongoing tournament.
2. For Round 1 Match 1 (Team A vs Team B):
   - Submit `PATCH /api/v1/tournaments/:id/matches/:matchId` with payload:
     `{ "teamAScore": 1, "teamBScore": 3, "winnerId": "<teamAId>" }`.
3. Notice HTTP 200 OK response:
   - Team A is declared winner and advanced to Round 2, despite scoring fewer points.
4. For Round 2 Match 1 (where Team B has not yet arrived, `teamBId: null`):
   - Submit score with `winnerId = <teamAId>`.
   - The match completes uncontested.

---

## 4. Impact

- Corrupted tournament results and invalid match histories.
- Desynchronization of the bracket progression tree if an uncontested or already-completed match is modified.

---

## 5. Recommended Remediation

In `server/src/services/match.service.ts`:
1. Guard against scoring matches where either `teamAId` or `teamBId` is `null` (unless it's an automated bye node).
2. Validate score parity:
   ```typescript
   if (input.winnerId === lockedMatch.teamAId && input.teamAScore <= input.teamBScore) {
     throw new MatchServiceError('INVALID_SCORE', 400, 'Winner score must be greater than loser score');
   }
   if (input.winnerId === lockedMatch.teamBId && input.teamBScore <= input.teamAScore) {
     throw new MatchServiceError('INVALID_SCORE', 400, 'Winner score must be greater than loser score');
   }
   ```
3. Guard against mutating matches that are already in `'completed'` state unless an explicit rollback workflow is invoked.
