# Bug: TOCTOU Race Condition & Missing Transactional Row Lock in `transferCaptaincy`

- **Bug ID**: BUG-M4-006
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: High (Relational Integrity & Race Condition)
- **Target Files**:
  - `server/src/services/team.service.ts` (lines 459–530)
- **Status**: Resolved

---

## 1. Description

In `server/src/services/team.service.ts`:
```typescript
static async transferCaptaincy(
  teamId: string,
  callerId: string,
  newCaptainId: string,
  db: SmexDatabase
): Promise<{ success: boolean; newCaptainId: string }> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  ...
  // Verify new captain is an active member of this squad
  const [targetMember] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)))
    .limit(1);

  if (!targetMember) {
    const err: any = new Error('Target player must be an active member of the squad');
    err.statusCode = 400;
    err.code = 'TARGET_NOT_A_MEMBER';
    throw err;
  }

  return await db.transaction(async (tx) => {
    // 1. Update teams table captainId
    await tx
      .update(teams)
      .set({ captainId: newCaptainId, updatedAt: new Date() })
      .where(eq(teams.id, teamId));

    // 2. Demote previous captain in teamMembers
    await tx
      .update(teamMembers)
      .set({ memberRole: 'member' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)));

    // 3. Promote target member in teamMembers
    await tx
      .update(teamMembers)
      .set({ memberRole: 'captain' })
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)));

    return { success: true, newCaptainId };
  });
}
```

Notice the Time-Of-Check to Time-Of-Use (TOCTOU) vulnerability:
1. `team` and `targetMember` checks are conducted **outside the transaction without a pessimistic row lock**.
2. If `newCaptainId` is removed or voluntarily leaves the squad concurrently (between line 493 and line 506):
   - The transaction still executes:
     - `teams.captainId` is updated to `newCaptainId`.
     - Step 3 (`update(teamMembers)...where userId = newCaptainId`) matches **0 rows**.
3. As a result, `teams.captainId` references a user who is **not in `team_members`**, breaking the fundamental relational integrity requirement that a team's captain must be an active roster member with `memberRole = 'captain'`.
4. Furthermore, if the captain initiates two concurrent transfer calls, both pass the check outside the transaction.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 4.1 ("Pessimistic Row Lock (`SELECT FOR UPDATE`)") and Section 6.1 ("POST /api/v1/teams/:id/transfer-captaincy: Reassigns squad captaincy to another verified roster member").
- **LLT Reference**: `docs/internal/testing/llt/squad-recruitment.md` Section 2.5 Test 18.

---

## 3. Reproduction Steps / Proof of Concept

1. Captain transfers captaincy to Member X.
2. Concurrently, Member X sends `DELETE /api/v1/teams/:id/members/member_x` to leave the squad.
3. Member X's leave transaction completes first, deleting their row from `team_members`.
4. The transfer transaction proceeds:
   - `teams.captainId` is updated to `member_x`.
   - `team_members.userId = member_x` has no row, so no row is updated to `memberRole: 'captain'`.
   - The old captain is demoted to `'member'`.
5. Database state:
   - `teams.captainId` is `member_x`.
   - `team_members` contains only the old captain (now `'member'`).
   - The squad has NO captain in `team_members` and is rendered completely captain-less and unmanageable.

---

## 4. Impact

- Catastrophic roster corruption: squads can be rendered captain-less or have an external non-member as captain.
- Any subsequent captain-restricted actions (disbanding, resolving join requests, kicking members) fail because the user in `teams.captainId` is not in the squad.

---

## 5. Recommended Remediation

Move the validation checks inside the transaction and acquire a pessimistic lock (`FOR UPDATE`) on the target team:
```typescript
return await db.transaction(async (tx) => {
  const [lockedTeam] = await tx
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .for('update');

  if (!lockedTeam) {
    const err: any = new Error('Team not found');
    err.statusCode = 404;
    err.code = 'TEAM_NOT_FOUND';
    throw err;
  }

  if (lockedTeam.captainId !== callerId) {
    const err: any = new Error('Only the current captain can transfer captaincy');
    err.statusCode = 403;
    err.code = 'CAPTAIN_PERMISSION_REQUIRED';
    throw err;
  }

  const [targetMember] = await tx
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)))
    .for('update');

  if (!targetMember) {
    const err: any = new Error('Target player must be an active member of the squad');
    err.statusCode = 400;
    err.code = 'TARGET_NOT_A_MEMBER';
    throw err;
  }

  // Update captaincy atomically
  await tx
    .update(teams)
    .set({ captainId: newCaptainId, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  await tx
    .update(teamMembers)
    .set({ memberRole: 'member' })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)));

  await tx
    .update(teamMembers)
    .set({ memberRole: 'captain' })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)));

  return { success: true, newCaptainId };
});
```
