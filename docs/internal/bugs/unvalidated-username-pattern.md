# Bug: Missing Alphanumeric & Underscore Pattern Validation for Usernames

- **Bug ID**: BUG-M2-002
- **Milestone**: Milestone 2: Data Layer and Client UI Shell (relates to Milestone 3 Auth Registration)
- **Severity**: High (Data Integrity & Input Sanitization Vulnerability)
- **Target Files**:
  - `server/src/routes/auth.ts` (lines 17–21)
  - `server/src/db/schema/users.ts` (lines 18–31)
- **Status**: Identified

---

## 1. Description

In `server/src/routes/auth.ts`, the registration validation schema declares:
```typescript
const registerBodySchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  username: z.string().min(3).max(50),
});
```

The schema lacks any character format restrictions or regex validation. 

Furthermore, `server/src/db/schema/users.ts` enforces length and uniqueness on the `profiles` table:
```typescript
username: varchar('username', { length: 50 }).notNull().unique('profiles_username_unique_idx'),
```
Neither the application layer nor the database schema includes a check constraint or regex validation to restrict valid usernames.

As a result, users can register usernames containing:
- Leading, trailing, or internal whitespace (e.g., `"   "`, `"hello world"`).
- URL-sensitive characters (e.g., `"user/admin"`, `"user?id=1"`, `"user#name"`), which will break future profile route lookups (`/profile/:username`).
- HTML / script injection sequences (e.g., `"<script>alert(1)</script>"`, `"<img src=x onerror=alert(1)>"`), creating Stored XSS vectors in community and tournament leaderboards if rendered unescaped.
- Control characters and zero-width spaces.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 3.1:
  > **Invariants & Constraints**:
  > - `profiles.username` enforces alphanumeric + underscore pattern via application-layer validation and database unique index `profiles_username_unique_idx`.
- **SRS Reference**: `docs/internal/requirements.md` Section 20 Item 10:
  > "Strict input validation and sanitization enforced on both client and server boundaries to prevent Cross-Site Scripting (XSS), SQL injection, and payload manipulation."

---

## 3. Reproduction Steps / Proof of Concept

1. Send a registration request with malicious or malformed characters:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "xss_tester@smexstore.com",
       "password": "ValidPassword123",
       "username": "<script>alert(1)</script>"
     }'
   ```
2. The server accepts the payload with HTTP 201 Created.
3. The username `"<script>alert(1)</script>"` is stored in PostgreSQL `profiles.username`.

---

## 4. Impact

- Injection of malicious scripts and HTML tags into the user profile table, posing Stored XSS risks when user profiles and tournament rosters are displayed.
- Failure of routing for user profile URLs (e.g., `/profile/<script>...` or slashes in username).
- Direct violation of the Low-Level Design specification.

---

## 5. Recommended Remediation

Update `registerBodySchema` in `server/src/routes/auth.ts`:
```typescript
username: z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username must only contain alphanumeric characters and underscores')
  .trim(),
```
Optionally, add a database check constraint to `profiles` in `server/src/db/schema/users.ts`:
```typescript
check('profiles_username_format_chk', sql`${profiles.username} ~ '^[a-zA-Z0-9_]+$'`)
```
