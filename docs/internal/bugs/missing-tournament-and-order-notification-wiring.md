# Bug: Missing Notification Dispatchers for Tournament Schedule Alerts and Order Status Updates

- **Bug ID**: BUG-M8-004
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search (Roadmap Scope Omission)
- **Severity**: Medium (Roadmap Scope Incompleteness)
- **Target Files**:
  - `server/src/services/notification.service.ts`
  - `server/src/routes/tournaments.ts`
  - `server/src/routes/boosting.ts`
- **Status**: Identified

---

## 1. Description

The Milestone 8 roadmap specification in `docs/internal/roadmap.md` Section 8.1 clearly states:
> "* [X] **8.1 Notification Dispatcher**:
>   * In-memory WebSocket pub/sub and database persistence for unread notification center.
>   * Notification types: Squad join requests, tournament schedule alerts, order status updates."

However, in the implementation:
1. `NotificationService` only defines dispatch helper methods for squad join requests:
   - `notifyCaptainJoinRequest`
   - `notifyApplicantStatus`
2. No helper methods or handlers were built for:
   - Tournament schedule alerts (e.g. match starting soon, round advancement notification to participants).
   - Order status updates (e.g. boosting order assigned, in progress, completed).
3. Neither `server/src/routes/tournaments.ts` nor `server/src/routes/boosting.ts` invoke `NotificationService` anywhere in their codebases.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 8 Section 8.1:
  > Explicitly mandates notification types for "Squad join requests, tournament schedule alerts, order status updates."

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `server/src/services/notification.service.ts`:
   - Search for `tournament` or `order`: 0 helper methods or event types exist.
2. Advance a tournament round or match status in `server/src/routes/tournaments.ts`.
3. Check the database `notifications` table or WebSocket stream for tournament participants:
   - Zero notifications are dispatched.
4. Place or advance a boosting order.
5. Check notifications for the customer:
   - Zero notifications are dispatched.

---

## 4. Impact

- **Roadmap Scope Non-Compliance**: While the core infrastructure (generic `dispatchNotification`, schemas, WebSocket channel broadcasting, and Notification Center UI) was built, the actual integration for tournament alerts and order status updates was left unwired and unimplemented.

---

## 5. Recommended Remediation

1. In `server/src/services/notification.service.ts`, add dedicated dispatch helpers:
   - `notifyTournamentScheduleAlert(participantIds: string[], tournamentId: string, alertMessage: string, db: SmexDatabase, ...)`
   - `notifyOrderStatusUpdate(customerId: string, orderId: string, status: string, db: SmexDatabase, ...)`
2. Wire these helpers into the tournament advancement lifecycle in `server/src/routes/tournaments.ts` and order status transition handlers in `server/src/routes/boosting.ts`.
