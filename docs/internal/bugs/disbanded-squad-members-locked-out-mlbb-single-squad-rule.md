# Bug: Disbanded Squad Members Permanently Locked Out by MLBB Single Squad Rule

- **Bug ID**: 1
- **Category**: Correctness
- **Severity**: High
- **Target Files**:
  - `server/src/services/team.service.ts` (lines 87–97)
  - `server/src/services/team-join.service.ts` (lines 71–82, 282–297)
  - `server/src/services/user-moderation.service.ts` (lines 236–243)
- **Status**: Identified

---

## 1. Description

When an administrator disbands a squad in `UserModerationService.disbandTeam`, the team's status is updated to `'disbanded'`:
```ts
await db
  .update(teams)
  .set({
    status: 'disbanded',
    updatedAt: new Date(),
  })
  .where(eq(teams.id, teamId));
```
However, the members belonging to that squad are **not** removed from the `team_members` table.

When any former member of that disbanded squad later attempts to create a new squad (`TeamService.createTeam`) or submit a join request to another squad (`TeamJoinService.submitJoinRequest`), the system executes the "MLBB Single Squad Rule" check:
```ts
const [existingMembership] = await db
  .select({ teamId: teamMembers.teamId })
  .from(teamMembers)
  .innerJoin(teams, eq(teamMembers.teamId, teams.id))
  .where(and(eq(teamMembers.userId, userId), eq(teams.gameSlug, gameSlug)))
  .limit(1);

if (existingMembership) {
  throw createServiceError('You are already an active member of a squad in this game', 400, 'ALREADY_IN_SQUAD');
}
```
This query joins `teams` without verifying `ne(teams.status, 'disbanded')` (or `teams.status IN ('open', 'closed')`). Because the player's row in `team_members` for the disbanded squad still exists, the query always returns an existing membership, throwing `ALREADY_IN_SQUAD`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/squad-recruitment.md` Section 3: "MLBB Single Squad Invariant: A player may only belong to one active squad per game title simultaneously."
- `docs/internal/requirements.md` Section 9: "Single active squad membership per game title."

---

## 3. Reproduction Steps / Proof of Concept

1. Create a squad for game `'mlbb'` with User A as captain and User B as member.
2. As an administrator, call `POST /api/v1/admin/teams/:id/disband` to disband the squad.
3. User B calls `POST /api/v1/teams` to create their own squad, or calls `POST /api/v1/teams/:otherTeamId/join-requests`.
4. The request fails with HTTP 400 `ALREADY_IN_SQUAD` ("Player is already a member of an active squad in this game").

---

## 4. Impact

All players who were members of an admin-disbanded squad are permanently locked out from joining or creating any squad for that game across the platform.

---

## 5. Recommended Remediation

1. In `UserModerationService.disbandTeam`, delete the roster records from `team_members` upon disbandment:
   ```ts
   await db.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
   ```
2. In `TeamService.createTeam` and `TeamJoinService.submitJoinRequest` / `resolveJoinRequest`, ensure the single squad check filters out disbanded squads:
   ```ts
   and(
     eq(teamMembers.userId, userId),
     eq(teams.gameSlug, gameSlug),
     ne(teams.status, 'disbanded')
   )
   ```
