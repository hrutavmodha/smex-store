# Bug: Squad Capacity Reduction Allowed Below Active Member Count

- **Bug ID**: BUG-M4-004
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (Domain Invariant & Vacancy Calculation Defect)
- **Target Files**:
  - `server/src/services/team.service.ts` (lines 321–326)
  - `server/src/routes/teams.ts` (lines 189–198)
- **Status**: Identified

---

## 1. Description

In `server/src/services/team.service.ts`:
```typescript
static async updateTeam(
  teamId: string,
  callerId: string,
  input: UpdateTeamInput,
  db: SmexDatabase
): Promise<Team> {
  ...
  if (input.memberCap !== undefined && (input.memberCap < 1 || input.memberCap > 10)) {
    const err: any = new Error('Member capacity must be between 1 and 10');
    err.statusCode = 422;
    err.code = 'INVALID_MEMBER_CAP';
    throw err;
  }

  const [updated] = await db
    .update(teams)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId))
    .returning();
```

When a captain updates a squad's `memberCap` via `PATCH /api/v1/teams/:id`, the service only validates that `1 <= memberCap <= 10`. It **does not check the current number of active members** in `team_members`.

If a squad currently has 5 active members (captain + 4 players), the captain can issue `PATCH /api/v1/teams/:id` with `{ memberCap: 2 }`. The database successfully updates `teams.member_cap` to `2`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 3.1 ("Vacancy Calculation Contract: $\text{Open Slots} = \max(0, \text{teams.member\_cap} - \text{Active Members})$").
- **SRS Reference**: `docs/internal/requirements.md` Section 6.3 Item 3 ("Display current member count and maximum capacity on every team card").

---

## 3. Reproduction Steps / Proof of Concept

1. Captain creates a squad with `memberCap: 5`.
2. Captain adds 4 members to the squad (total 5 active members).
3. Captain sends:
   ```http
   PATCH /api/v1/teams/:id
   Authorization: Bearer <captain_token>
   { "memberCap": 2 }
   ```
4. Server returns `HTTP 200 OK` with `team.memberCap = 2`.
5. Call `GET /api/v1/teams/:id`:
   - `team.memberCap` is `2`.
   - `members.length` is `5`.
   - `activeMembersCount` is `5`.
   - The UI displays `5 / 2 Members`!

---

## 4. Impact

- **Invariant Violation**: Violates the business invariant that team capacity cannot be lower than the active roster count without first removing/kicking excess members.
- **Corrupted Vacancy Calculations**: Creates nonsensical states (`5 / 2 Members`), confusing both members and public viewers.

---

## 5. Recommended Remediation

In `server/src/services/team.service.ts` `updateTeam`:
```typescript
if (input.memberCap !== undefined) {
  if (input.memberCap < 1 || input.memberCap > 10) {
    const err: any = new Error('Member capacity must be between 1 and 10');
    err.statusCode = 422;
    err.code = 'INVALID_MEMBER_CAP';
    throw err;
  }

  const [activeCountResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  const currentMembers = activeCountResult?.count ?? 0;
  if (input.memberCap < currentMembers) {
    const err: any = new Error(
      `Cannot set member capacity to ${input.memberCap} because the team currently has ${currentMembers} active members`
    );
    err.statusCode = 400;
    err.code = 'CAPACITY_BELOW_MEMBER_COUNT';
    throw err;
  }
}
```
