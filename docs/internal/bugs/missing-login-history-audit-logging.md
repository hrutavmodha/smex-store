# Bug: Complete Omission of Security Login History Audit Logging

- **Bug ID**: BUG-M3-008
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles (also relates to Milestone 2 Schemas)
- **Severity**: Medium (Compliance & Security Audit Trail Omission)
- **Target Files**:
  - `server/src/routes/auth.ts` (lines 133–222)
  - `server/src/db/schema/` (no `login_history` schema table defined)
- **Status**: Identified

---

## 1. Description

The platform requirements explicitly mandate an immutable audit trail for account logins, distinct from user browsing activity:

- `docs/internal/requirements.md` Section 8.2 Step 4:
  > "An immutable timestamped event is recorded in the Login History log."
- `docs/internal/requirements.md` Section 10.2:
  > "**Login History**: Audit log tracking historical login events, timestamps, and authentication statuses."
- `docs/internal/requirements.md` Section 11 Item 3:
  > "**Decoupled Architecture**: Architectural separation between Activity History (user browsing behavior) and Login History (security audit log)."
- `docs/internal/requirements.md` Section 12 Item 2:
  > Endpoint specification includes `GET /api/devices/history`.
- `docs/internal/requirements.md` Section 14 Item 5:
  > "**Immutable audit logging for account authentication events.**"

However:
1. No `login_history` table was defined in `server/src/db/schema/` during Milestone 2 or 3.
2. In `server/src/routes/auth.ts`, the `POST /api/v1/auth/login` handler creates the session in `sessions` and Redis, but logs **zero** entries to any audit ledger or history table.
3. No `GET /api/v1/devices/history` endpoint exists to allow users or admins to review login history.

---

## 2. Specification & Design Reference

- **SRS Reference**: `docs/internal/requirements.md` Section 8.2 Item 4, Section 10.2, Section 11 Item 3, Section 12 Item 2, Section 14 Item 5.

---

## 3. Reproduction Steps / Proof of Concept

1. Authenticate via `POST /api/v1/auth/login`.
2. Inspect the database:
   - Only `sessions` and `users` records exist.
   - `activity_logs` has no entry.
   - No table exists tracking historical login events (successful/failed), client IPs, or device metadata.
3. Call `GET /api/v1/devices/history`:
   - Returns 404 Route not found.

---

## 4. Impact

- Lack of security visibility: if an account is compromised, the user cannot inspect historical login IP addresses, timestamps, or device histories.
- Direct non-compliance with the Software Requirements Specification (SRS).

---

## 5. Recommended Remediation

1. Define a `login_history` schema in `server/src/db/schema/login-history.ts`:
   - `id`: UUID PK
   - `userId`: UUID FK to `users.id`
   - `ipAddress`: varchar(45)
   - `userAgent`: text
   - `deviceName`: varchar(150)
   - `status`: enum('success', 'failed')
   - `createdAt`: timestamp
2. In `POST /api/v1/auth/login`, record an entry in `login_history` on both successful and failed attempts.
3. Expose `GET /api/v1/devices/history` to provide historical login audit data to Settings.
