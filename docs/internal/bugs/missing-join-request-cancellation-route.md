# Bug: Missing REST API Route for Join Request Cancellation

- **Bug ID**: BUG-M4-001
- **Milestone**: Milestone 4: Squads and Team Recruitment Engine
- **Severity**: High (API Completeness & User Deadlock)
- **Target Files**:
  - `server/src/routes/teams.ts` (lines 75–372)
  - `server/src/services/team-join.service.ts` (lines 373–415)
- **Status**: Resolved

---

## 1. Description

The squad recruitment engine supports applicant join request cancellation at the service and data layer:
- In `server/src/db/schema/teams.ts` line 46, `joinRequestStatusEnum` defines the `'cancelled'` state.
- In `server/src/services/team-join.service.ts` lines 373–415, the service method `TeamJoinService.cancelJoinRequest(teamId, requestId, callerId, db)` is fully implemented with permission checks (`callerId === request.userId`), status validation (`status === 'pending'`), and updates `status` to `'cancelled'`.
- In `docs/internal/design/lld/squad-recruitment.md` Section 2.1 & 4.1, the cancelled status is part of the core recruitment state machine.

However, in `server/src/routes/teams.ts`:
- **No HTTP route is registered** that invokes `TeamJoinService.cancelJoinRequest`.
- Neither `DELETE /api/v1/teams/:id/join-requests/:requestId` nor `PATCH /api/v1/teams/:id/join-requests/:requestId/cancel` exists in `teamsRoutes`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/squad-recruitment.md` Section 2.1 (Status Enum), Section 4.1 (State Machine), Section 6.1 (Endpoint Catalog).
- **SRS Reference**: `docs/internal/requirements.md` Section 6.3 Item 2 ("Users can submit join requests or directly join open rosters").

---

## 3. Reproduction Steps / Proof of Concept

1. User A submits a join request to Squad 1:
   ```http
   POST /api/v1/teams/team_123/join-requests
   Authorization: Bearer <user_a_token>
   { "playerIgn": "AcePlayer", "playerRole": "Assassin" }
   ```
   Status: 201 Created (Request ID: `req_abc`).
2. User A realizes they entered the wrong IGN or wishes to withdraw their application.
3. User A attempts to cancel the request:
   ```http
   DELETE /api/v1/teams/team_123/join-requests/req_abc
   Authorization: Bearer <user_a_token>
   ```
4. Server responds with `HTTP 404 Route DELETE:/api/v1/teams/team_123/join-requests/req_abc not found`.
5. Due to PostgreSQL partial unique index `team_join_requests_pending_unq` on `(team_id, user_id) WHERE status = 'pending'`, User A is permanently blocked from submitting an updated join request to this squad until the captain accepts or rejects it.

---

## 4. Impact

- **User Deadlock**: If a captain is inactive or does not review pending requests, applicants cannot withdraw pending requests and cannot submit corrected applications.
- **Dangling Code**: `TeamJoinService.cancelJoinRequest` is dead code unreachable via any HTTP interface.

---

## 5. Recommended Remediation

1. Register `DELETE /api/v1/teams/:id/join-requests/:requestId` in `server/src/routes/teams.ts`:
   ```typescript
   fastify.delete(
     '/api/v1/teams/:id/join-requests/:requestId',
     { preHandler: [fastify.authenticate] },
     async (request, reply) => {
       const { id, requestId } = request.params as { id: string; requestId: string };
       try {
         const cancelled = await TeamJoinService.cancelJoinRequest(
           id,
           requestId,
           request.user.sub,
           fastify.db
         );
         return reply.code(200).send({ joinRequest: cancelled });
       } catch (err: any) {
         return handleError(reply, err);
       }
     }
   );
   ```
2. Add a corresponding test case in `server/test/routes/teams-join.test.ts`.
