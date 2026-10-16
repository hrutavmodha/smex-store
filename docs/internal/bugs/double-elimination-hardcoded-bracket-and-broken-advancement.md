# Bug: Double-Elimination Bracket Hardcoded to 4 Teams & Broken Progression Logic

- **Bug ID**: BUG-M5-001
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: Critical (AI Fluff / Fake Implementation & Functional Breakdown)
- **Target Files**:
  - `server/src/services/bracket-generator.service.ts` (lines 170–268)
  - `server/src/services/match.service.ts` (lines 95–136)
- **Status**: Resolved (Dynamic N-participant bracket generation implemented, loser drop-down routing active, verified by Test 12b and Test 19)

---

## 1. Description

The double-elimination tournament implementation contains a hardcoded fake algorithm designed solely to satisfy a 4-team test case, coupled with broken match advancement logic that prevents upper bracket losers and lower bracket winners from progressing.

### A. Hardcoded 4-Team Bracket Generation (AI Fluff)
In `BracketGeneratorService.generateDoubleElimination` (`server/src/services/bracket-generator.service.ts`, lines 179–268), the bracket generation logic does not calculate rounds or matches based on participant count. Instead, it literally comments `// For 4 teams:` and hardcodes exactly 6 match records for seeds 1, 2, 3, and 4:
- Upper Round 1: Match 1 (Seed 1 vs 4), Match 2 (Seed 2 vs 3)
- Upper Round 2: Upper Final
- Lower Round 1: Lower Semis
- Lower Round 2: Lower Final
- Round 3: Grand Final

If 8, 16, or 32 squads register for a double-elimination tournament, teams 5 through 32 are completely omitted from the matches.

### B. Broken Progression & Deadlocked Grand Final
In `MatchService.updateMatchScore` (`server/src/services/match.service.ts`, lines 95–124):
1. **Losers Never Drop to Lower Bracket**: When an Upper Bracket match completes, the service advances the winner to the next round if found, but contains zero logic to route the loser to the Lower Bracket. The lower bracket matches permanently stay with `teamAId: null` and `teamBId: null`.
2. **Winners Filtered Out by Bracket Type**: Advancement queries:
   ```typescript
   and(
     eq(tournamentMatches.tournamentId, tournamentId),
     eq(tournamentMatches.roundNumber, nextRound),
     eq(tournamentMatches.matchOrder, nextMatchOrder),
     eq(tournamentMatches.bracketType, lockedMatch.bracketType)
   )
   ```
   - When Upper Final (`bracketType = 'upper'`) finishes, the next round (Round 3) has `bracketType = 'grand_final'`. Because `bracketType` is strictly matched against `'upper'`, no match is found.
   - When Lower Final (`bracketType = 'lower'`) finishes, its next round match has `bracketType = 'grand_final'`. Again, no match is found.
   - Consequently, neither finalist ever advances to the Grand Final. The Grand Final match sits permanently with `teamAId: null, teamBId: null`, and the tournament can never be completed.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 3.2:
  > Double-elimination brackets must dynamically allocate Upper and Lower brackets for any power-of-two team count, seamlessly routing upper bracket losers into corresponding lower bracket drop rounds, and advancing Upper and Lower winners to the Grand Final.

---

## 3. Reproduction Steps / Proof of Concept

1. Register 8 teams in a tournament configured with `format = 'double_elimination'`.
2. Trigger `POST /api/v1/tournaments/:id/bracket/generate`.
3. Inspect generated matches in `tournament_matches`:
   - Only 6 matches are generated instead of the required 14 matches for an 8-team double elimination.
   - Teams 5, 6, 7, and 8 have no scheduled matches.
4. For a 4-team tournament, record a score completing Upper Round 1 Match 1:
   - The losing team is never placed into Lower Round 1 Match 1.
5. Record scores completing Upper Final and Lower Final:
   - Neither winner advances to the Grand Final (`teamAId` and `teamBId` remain `null`).

---

## 4. Impact

- Complete failure of double-elimination tournaments in production.
- Any tournament with more than 4 teams drops participants.
- All double-elimination tournaments deadlock before the Grand Final.

---

## 5. Recommended Remediation

1. Implement dynamic double-elimination bracket generation in `server/src/services/bracket-generator.service.ts` supporting $N \in [2, 128]$ participants with standard upper/lower bracket sizing, drop-down rounds, and seeding.
2. In `server/src/services/match.service.ts`, implement routing logic:
   - Upper bracket losers route to designated lower bracket match nodes (`isLoserSlot`).
   - Upper Final winner and Lower Final winner route to `bracketType = 'grand_final'`.
