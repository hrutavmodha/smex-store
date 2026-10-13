# Bug: Expired Sessions Persist Indefinitely in Active Device Sessions List

- **Bug ID**: BUG-M3-006
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: Medium (Data Hygiene & Security Visibility Flaw)
- **Target Files**:
  - `server/src/services/session.service.ts` (lines 308–330)
- **Status**: Identified

---

## 1. Description

In `server/src/services/session.service.ts`, `getActiveSessions` retrieves active device sessions for a user:
```typescript
static async getActiveSessions(
  userId: string,
  currentSessionId: string,
  db: SmexDatabase
): Promise<ActiveSessionView[]> {
  const list = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.isActive, true)));
  ...
```

The SQL query only checks `is_active = true`. It does **not** check whether `sessions.expires_at > now()`.

When a 30-day session expires:
1. Redis evicts the session data and lookup keys via TTL expiration.
2. PostgreSQL does not have an automatic TTL mechanism; records in `sessions` remain with `is_active = true` and `expires_at < now()`.
3. When the user visits Settings > Device Management (`GET /api/v1/devices/sessions`), `getActiveSessions` returns all historically expired sessions where the user never explicitly clicked "Logout".

A user who has used multiple devices over months or years will accumulate dozens of stale, expired ghost sessions labeled as "Active Devices".

Furthermore, if the user clicks "Revoke" on an expired session, `SessionService.revokeSession` attempts to delete Redis keys that already expired weeks ago, but deactivates it in PostgreSQL only upon explicit revocation.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 3.2:
  > `sessions` table defines `expiresAt: timestamp('expires_at')`.
  > `index('sessions_expires_at_idx').on(t.expiresAt)`.
- **SRS Reference**: `docs/internal/requirements.md` Section 10.1:
  > View all active authenticated sessions tied to the account. Stale/expired sessions must not be displayed as active.

---

## 3. Reproduction Steps / Proof of Concept

1. Insert a session record into PostgreSQL with `expires_at = NOW() - INTERVAL '5 days'` and `is_active = true`.
2. Authenticate as the session's user and call `GET /api/v1/devices/sessions`.
3. The expired session is returned in the `sessions` array.
4. The client UI renders the card as an "Active Device".

---

## 4. Impact

- Clutter and misleading security metrics displayed to the user.
- Failure to utilize the defined index `sessions_expires_at_idx`.
- Data leaks regarding devices that have long since been disconnected.

---

## 5. Recommended Remediation

Update `SessionService.getActiveSessions` to filter by `expiresAt > now()` and lazily mark expired records as inactive:

```typescript
import { gt } from 'drizzle-orm';

static async getActiveSessions(
  userId: string,
  currentSessionId: string,
  db: SmexDatabase
): Promise<ActiveSessionView[]> {
  const now = new Date();
  const list = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.isActive, true),
        gt(sessions.expiresAt, now)
      )
    );
  ...
```
Additionally, consider a periodic cleanup job or trigger to set `is_active = false WHERE expires_at < now() AND is_active = true`.
