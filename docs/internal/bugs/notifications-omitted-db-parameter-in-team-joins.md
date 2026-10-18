# Bug: `db` Parameter Omitted in `TeamJoinService` Preventing Notification Persistence

- **Bug ID**: BUG-M8-002
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search (relates to Milestone 4 Squad Joins)
- **Severity**: High (Broken Offline Delivery & Missing In-App Notification History)
- **Target Files**:
  - `server/src/services/team-join.service.ts` (lines 127–139, 337–342)
  - `server/src/services/notification.service.ts` (lines 289–340, 345–395)
- **Status**: Identified

---

## 1. Description

The core requirement of Milestone 8 is durable database persistence and WebSocket real-time delivery of notifications (`notifications` table + WebSocket push).

In `NotificationService`, the methods `notifyCaptainJoinRequest` and `notifyApplicantStatus` support database persistence if `db: SmexDatabase` is supplied:
```typescript
// server/src/services/notification.service.ts:289-314
static async notifyCaptainJoinRequest(
  captainId: string,
  data: JoinRequestNotificationData,
  redis?: Redis,
  wsGateway?: WsGatewayDecorator,
  db?: SmexDatabase
): Promise<BaseNotificationEnvelope<JoinRequestNotificationData>> {
  // ...
  if (db) {
    try {
      await this.dispatchNotification(captainId, 'request', 'New Squad Join Request', ...);
    } catch { ... }
  }
}
```

However, in `TeamJoinService`:
1. **Join Request Submission** (`submitJoinRequest`, lines 127–139):
   ```typescript
   await NotificationService.notifyCaptainJoinRequest(
     team.captainId,
     {
       teamId,
       teamName: team.name,
       requestId: createdRequest.id,
       applicantId,
       playerIgn: input.playerIgn,
       playerRole: input.playerRole,
     },
     redis,
     wsGateway
     // db is completely omitted!
   );
   ```
2. **Review Join Request** (`reviewJoinRequest`, lines 337–342):
   ```typescript
   await NotificationService.notifyApplicantStatus(
     txResult.applicantId,
     { teamId, teamName: txResult.teamName, status: txResult.status },
     redis,
     wsGateway
     // db is completely omitted!
   );
   ```

Because `db` is omitted in both invocations, `if (db)` is evaluated as falsy. Neither event is ever written to the `notifications` PostgreSQL table!

---

## 2. Specification & Design Reference

- **Roadmap Reference**: Milestone 8 Section 8.1:
  > "**Notification Dispatcher**: In-memory WebSocket pub/sub and database persistence for unread notification center. Notification types: Squad join requests..."
- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 2.1:
  > "Every notification event is committed to PostgreSQL `notifications` table to guarantee durable delivery for offline clients."

---

## 3. Reproduction Steps / Proof of Concept

1. User B submits a squad join request to join Team Alpha (owned by Captain User A).
2. Captain User A is currently offline (no active WebSocket connection).
3. Query the database table:
   ```sql
   SELECT * FROM notifications WHERE recipient_id = '<captain-user-a-id>';
   ```
   **Result**: 0 rows returned.
4. User A logs in later and clicks the Notification Bell icon (`GET /api/v1/notifications`).
5. **Result**: Empty notification list (`{ notifications: [], unreadCount: 0 }`). The captain has no indication that an applicant requested to join.
6. The same issue occurs when the captain accepts/rejects a request: the applicant receives no persistent notification.

---

## 4. Impact

- **Silent Notification Drop for Offline Users**: Any user not actively connected to the WebSocket gateway at the exact millisecond an event occurs loses the notification permanently.
- **In-App Notification Center Inutility**: The Notification Center remains perpetually empty for squad actions, defeating the purpose of Milestone 8's persistent notification center.

---

## 5. Recommended Remediation

1. In `server/src/services/team-join.service.ts`:
   - Pass `db` as the 5th parameter in `submitJoinRequest`:
     ```typescript
     await NotificationService.notifyCaptainJoinRequest(
       team.captainId,
       { ... },
       redis,
       wsGateway,
       db
     );
     ```
   - Pass `db` as the 5th parameter in `reviewJoinRequest`:
     ```typescript
     await NotificationService.notifyApplicantStatus(
       txResult.applicantId,
       { ... },
       redis,
       wsGateway,
       db
     );
     ```
2. Update unit and integration tests to verify database records are created in `notifications` when team join operations execute.
