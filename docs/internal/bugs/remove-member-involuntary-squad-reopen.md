# Bug: `removeMember` Unconditionally Reopens Squads Intentionally Closed by Captain

- **Bug ID**: BUG-M4-005
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (Business Logic & Privacy Defect)
- **Target Files**:
  - `server/src/services/team.service.ts` (lines 435–448)
- **Status**: Identified

---

## 1. Description

In `server/src/services/team.service.ts` line 435:
```typescript
static async removeMember(
  teamId: string,
  targetUserId: string,
  callerId: string,
  db: SmexDatabase
): Promise<{ success: boolean; message: string }> {
  ...
  return await db.transaction(async (tx) => {
    await tx
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, targetUserId)));

    // Auto-reopen check: If team was closed and remaining members < memberCap, transition status to 'open'
    const [countResult] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    const remainingCount = countResult?.count ?? 0;
    if (team.status === 'closed' && remainingCount < team.memberCap) {
      await tx
        .update(teams)
        .set({ status: 'open', updatedAt: new Date() })
        .where(eq(teams.id, teamId));
    }
```

A captain has full authority to intentionally close a squad roster at any time (e.g., during a tournament lock, practice freeze, or private recruitment) by clicking "Close Roster" or updating `{ status: 'closed' }` via `PATCH /api/v1/teams/:id`.

However, if an active member leaves the squad or the captain kicks an inactive member:
- `removeMember` checks `team.status === 'closed' && remainingCount < team.memberCap`.
- Because `remainingCount < team.memberCap` is true, **the squad is automatically mutated to `status: 'open'`**, completely overriding the captain's explicit decision to keep the roster closed.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 3.2 ("Dynamic Availability Badges: Full / Closed: Computed when `teams.status === 'closed'` OR $\text{Open Slots} === 0$").
- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 6.1 ("PATCH /api/v1/teams/:id: Updates squad metadata (`name`, `tag`, `description`, `member_cap`, `status`)").
- **LLT Reference**: `docs/internal/testing/llt/squad-recruitment.md` Section 2.1 Test 4 ("Captain updates squad metadata and status").

---

## 3. Reproduction Steps / Proof of Concept

1. Captain creates a squad with `memberCap = 5`.
2. Squad has 3 active members (openSlots = 2).
3. Captain toggles the roster to "Closed" (`PATCH /api/v1/teams/:id` with `{ status: 'closed' }`).
4. Squad status in DB is `'closed'`.
5. One of the regular members voluntarily leaves (`DELETE /api/v1/teams/:id/members/:userId`).
6. Query squad in DB: `teams.status` has been automatically modified back to `'open'`.
7. The squad is now unexpectedly open to public join requests against the captain's instructions.

---

## 4. Impact

- Breach of captain administrative control: a squad intentionally closed for private training or competitive roster locks gets automatically published to public recruitment without warning.

---

## 5. Recommended Remediation

Per the LLD Section 3.1 & 3.2 contract:
- Team status (`teams.status`) represents the captain's recruitment preference (`'open'` or `'closed'`).
- Dynamic availability already determines whether a squad can be joined:
  - `open`: `teams.status === 'open' && openSlots > 0`
  - `full`: `openSlots === 0`
  - `closed`: `teams.status === 'closed'`
- Therefore, `teams.status` should NOT be blindly overwritten to `'open'` on member removal. If auto-closure upon full capacity is retained, either:
  1. Only reopen if the closure was automatic due to capacity (e.g. tracking an `autoClosed` flag), OR
  2. Rely purely on dynamic vacancy math `availability === 'full'` without mutating `teams.status`.
