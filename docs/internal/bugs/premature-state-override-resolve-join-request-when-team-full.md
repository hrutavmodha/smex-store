# Bug: Premature State Override in `resolveJoinRequest` When Team is Full

- **Bug ID**: 4
- **Category**: Correctness
- **Severity**: Medium
- **Target Files**:
  - `server/src/services/team-join.service.ts` (lines 237–259)
- **Status**: Identified

---

## 1. Description

In `TeamJoinService.resolveJoinRequest`:
```ts
// If action is accept, check roster capacity first under the lock
if (action === 'accept') {
  const [countResult] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  const activeCount = countResult?.count ?? 0;

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
```
The check verifying that `joinReq.status === 'pending'` is executed **after** the roster capacity check and state update.
If a join request was already resolved (e.g. it was previously `cancelled` by the player or already `accepted`), and a caller sends `POST /api/v1/teams/:id/join-requests/:requestId` with `action: 'accept'` on a full team:
1. The service mutates the join request's status to `'rejected'`.
2. It throws HTTP 409 `TEAM_ROSTER_FULL` instead of HTTP 400 `REQUEST_ALREADY_RESOLVED`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/squad-recruitment.md` Section 3.2: "State transitions are valid only from 'pending' state. Terminal states (accepted, rejected, cancelled) are immutable."

---

## 3. Reproduction Steps / Proof of Concept

1. Create a squad with capacity 1 (filled by captain).
2. Create and then cancel a join request (status becomes `'cancelled'`).
3. Send a request to accept the cancelled join request: `PATCH /api/v1/teams/:id/join-requests/:reqId` with `{ action: 'accept' }`.
4. The service overwrites the status to `'rejected'` and returns 409 `TEAM_ROSTER_FULL` instead of returning 400 `REQUEST_ALREADY_RESOLVED`.

---

## 4. Impact

Terminal states of join requests can be overwritten, corrupting the audit trail of player applications.

---

## 5. Recommended Remediation

Move the `joinReq.status !== 'pending'` assertion to the very beginning of the transaction, immediately after loading `joinReq`:
```ts
if (!joinReq) {
  throw createServiceError('Join request not found', 404, 'REQUEST_NOT_FOUND');
}

if (joinReq.status !== 'pending') {
  throw createServiceError(`Request has already been resolved (${joinReq.status})`, 400, 'REQUEST_ALREADY_RESOLVED');
}
```
