# Bug: Redundant Duplicate SQL Count Query in resolveJoinRequest Transaction

- **Bug ID**: 19
- **Category**: Efficiency
- **Severity**: Low
- **Target Files**:
  - `server/src/services/team-join.service.ts` (lines 239–245, 275–280)
- **Status**: Identified

---

## 1. Description

In `TeamJoinService.resolveJoinRequest`, when a team captain accepts a squad join request, the method executes two consecutive, identical `COUNT(*)` database queries against `team_members` within the same transaction:

```ts
// server/src/services/team-join.service.ts (lines 238-254)
// First execution:
if (action === 'accept') {
  const [countResult] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  const activeCount = countResult?.count ?? 0;

  if (activeCount >= lockedTeam.memberCap) {
    ...
  }
}

...

// Second execution:
// Action is 'accept'
const [countResult] = await tx
  .select({ count: sql<number>`COUNT(*)::int` })
  .from(teamMembers)
  .where(eq(teamMembers.teamId, teamId));

const activeCount = countResult?.count ?? 0;
```

Because the team record is already locked via `FOR UPDATE` earlier in the transaction (line 228), no concurrent transaction can modify `team_members` for this team. Repeating the identical count query at line 275 is 100% redundant, adding an unnecessary database round-trip while holding an exclusive row-level lock on the team table.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/squad-recruitment.md` Section 4.2: "Join Request State Machine & Transaction Optimization: Transactions must be minimal in statement count and duration to maximize throughput on high-contention team locks."

---

## 3. Reproduction Steps / Proof of Concept

1. Enable PostgreSQL query logging (`SET log_statement = 'all'`).
2. Submit a join request to an open squad.
3. As the squad captain, approve the join request via `PATCH /api/v1/teams/:teamId/join-requests/:requestId` with `{ "action": "accept" }`.
4. Inspect Postgres logs during the transaction; observe two consecutive:
   `SELECT count(*)::int AS "count" FROM "team_members" WHERE "team_members"."team_id" = $1`

---

## 4. Impact

1. **Unnecessary Database Round-Trip**: Increases transaction latency by executing duplicate I/O on the primary Postgres instance.
2. **Prolonged Lock Holding**: Extends the duration that the row-level lock on the `teams` row is held, increasing contention and serialization conflicts when multiple join requests are handled simultaneously.

---

## 5. Recommended Remediation

Remove the redundant second query and retain the `activeCount` computed during the initial capacity validation:

```ts
// server/src/services/team-join.service.ts
let activeCount = 0;

if (action === 'accept') {
  const [countResult] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  activeCount = countResult?.count ?? 0;

  if (activeCount >= lockedTeam.memberCap) {
    await tx
      .update(teamJoinRequests)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(teamJoinRequests.id, requestId));

    throw createServiceError('Team roster is full', 409, 'TEAM_ROSTER_FULL');
  }
}

if (joinReq.status !== 'pending') {
  throw createServiceError(`Request has already been resolved (${joinReq.status})`, 400, 'REQUEST_ALREADY_RESOLVED');
}

if (action === 'reject') {
  ...
  return { ... };
}

// Action is 'accept' - reuse activeCount without re-querying tx
// Proceed directly to MLBB single squad check
```
