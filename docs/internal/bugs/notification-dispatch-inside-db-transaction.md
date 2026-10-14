# Bug: Side-Effect Notification Dispatch Executed Inside Open Database Transactions

- **Bug ID**: BUG-M4-010
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: Medium (Transaction Isolation & Distributed Side-Effects)
- **Target Files**:
  - `server/src/services/team-join.service.ts` (lines 291–296, 359–364)
- **Status**: Identified

---

## 1. Description

In `server/src/services/team-join.service.ts`, `resolveJoinRequest` runs a database transaction using `db.transaction(...)`:
```typescript
return await db.transaction(async (tx) => {
  ...
  if (action === 'reject') {
    await tx.update(teamJoinRequests)...;

    await NotificationService.notifyApplicantStatus(
      joinReq.userId,
      { teamId, teamName: lockedTeam.name, status: 'rejected' },
      redis,
      wsGateway
    );

    return { success: true, status: 'rejected' };
  }

  ... // action === 'accept'
  await tx.insert(teamMembers)...;
  await tx.update(teamJoinRequests)...;

  // 9. Dispatch real-time WebSocket / Redis notification to applicant
  await NotificationService.notifyApplicantStatus(
    joinReq.userId,
    { teamId, teamName: lockedTeam.name, status: 'accepted' },
    redis,
    wsGateway
  );

  return { success: true, status: 'accepted' };
});
```

Notice:
1. `NotificationService.notifyApplicantStatus` publishes to Redis and calls `wsGateway.broadcastToChannel` **before the database transaction commits**.
2. If Redis encounters a transient connection error or `redis.publish` throws an unhandled rejection, Fastify aborts the callback and PostgreSQL rolls back the transaction. The database mutation is cancelled solely due to an ephemeral notification transport failure.
3. Conversely, if the notification publishes successfully, but the database transaction subsequently fails to commit (e.g. serialization failure or socket drop), the applicant receives a real-time event stating they were accepted into the squad, while the database records that they were never added.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 4 Sequence Diagram (Note step 13: `COMMIT TRANSACTION` occurs before step 14: `PUBLISH notification`).
- **HLD Reference**: `docs/internal/design/hld.md` Section 6.3.

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect the Sequence Diagram in `docs/internal/design/lld/squad-recruitment.md`:
   - Step 11: `API -> DB: COMMIT TRANSACTION`
   - Step 12: `API -> Redis: PUBLISH notification:user:{applicantId}`
2. Inspect the code in `server/src/services/team-join.service.ts` lines 359–364:
   - `NotificationService.notifyApplicantStatus` is executed inside the `db.transaction` callback prior to commit.
3. If Redis publish throws, the ACID transaction rolls back and 500 is returned.

---

## 4. Impact

- Violation of transactional boundary design: external non-transactional side-effects (Pub/Sub) run inside the ACID lock gate.
- Risk of false notifications sent to applicants if commit fails, or transactional rollbacks triggered by external network transport errors.

---

## 5. Recommended Remediation

Move notification dispatch outside of `db.transaction(...)`, executing it only after the transaction has successfully committed, and wrap it in a `try/catch` to log errors without failing the already-committed mutation:
```typescript
const result = await db.transaction(async (tx) => {
  ...
  return { success: true, status: action, applicantId: joinReq.userId, teamName: lockedTeam.name };
});

try {
  await NotificationService.notifyApplicantStatus(
    result.applicantId,
    { teamId, teamName: result.teamName, status: result.status },
    redis,
    wsGateway
  );
} catch (err) {
  // Log error without failing HTTP response
}

return { success: result.success, status: result.status };
```
