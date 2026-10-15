# Bug: Unrestricted Bracket Regeneration Allowed on Ongoing & Completed Tournaments

- **Bug ID**: BUG-M5-006
- **Milestone**: Milestone 5: Tournament Engine and Live Lobbies
- **Severity**: High (Data Loss & Lifecycle Integrity Violation)
- **Target Files**:
  - `server/src/routes/tournaments.ts` (lines 481–555)
  - `server/src/services/bracket-generator.service.ts` (line 33)
- **Status**: Identified

---

## 1. Description

The bracket generation endpoint `POST /api/v1/tournaments/:id/bracket/generate` does not check the current lifecycle status of the tournament before resetting and regenerating matches.

In `server/src/routes/tournaments.ts` lines 491–525:
```typescript
const [tourney] = await fastify.db
  .select()
  .from(tournaments)
  .where(eq(tournaments.id, id))
  .limit(1);

if (!tourney) {
  return reply.code(404).send(...);
}

// Check participants
if (participants.length < 2) {
  return reply.code(422).send(...);
}

// Generate bracket matches
const matches = await BracketGeneratorService.generateBracket(
  id,
  tourney.format,
  validParticipants,
  fastify.db
);
```

And in `BracketGeneratorService.generateBracket` (`server/src/services/bracket-generator.service.ts` line 33):
```typescript
// Wipe existing matches for this tournament to ensure fresh generation
await db.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));
```

### Flaw
There is no guard ensuring that `tourney.status` is either `'upcoming'` or `'registration_open'`.
1. **Ongoing Tournaments**: If called on an `'ongoing'` tournament (accidentally or maliciously), the endpoint wipes all completed match records, live scores, and participant advancements, resetting the tournament to round 1 with blank scores while leaving tournament status as `ongoing`.
2. **Completed Tournaments**: If called on a `'completed'` tournament, all historical match records, final scores, and brackets are deleted from the database forever. The tournament status remains `'completed'`, but contains newly generated, unplayed match records with no scores and no champion link.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/tournament-engine.md` Section 2.1 & 2.2:
  > Bracket generation is an administrative operation permitted strictly during pre-tournament setup (`registration_open`). Once a tournament is `ongoing` or `completed`, the match tree is locked and immutable.

---

## 3. Reproduction Steps / Proof of Concept

1. Create a tournament, register squads, generate bracket, and progress several matches to `'completed'`.
2. As an administrator, send `POST /api/v1/tournaments/:id/bracket/generate` to the ongoing tournament.
3. The server responds with `200 OK`.
4. Check `tournament_matches`:
   - All previously completed matches and scores are erased.
   - Newly generated initial matches replace them.

---

## 4. Impact

- Catastrophic data loss: match records and historical scores of live or completed tournaments can be wiped out with a single request.
- Violation of the tournament lifecycle state machine.

---

## 5. Recommended Remediation

In `server/src/routes/tournaments.ts`, add a status guard before generating brackets:
```typescript
if (tourney.status !== 'registration_open' && tourney.status !== 'upcoming') {
  return reply.code(400).send(
    formatRfc7807(
      400,
      'INVALID_TOURNAMENT_STATE',
      'Bad Request',
      `Cannot generate brackets for tournament in '${tourney.status}' state`
    )
  );
}
```
