# Bug: Client Registration Form Schema Mismatch (`inGameId` vs `username`) Blocking User Signup

- **Bug ID**: BUG-M3-002
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: Critical (User Ingress Blocker)
- **Target Files**:
  - `client/components/auth/RegisterForm.tsx` (lines 81–89)
  - `server/src/routes/auth.ts` (lines 17–21, 43–52)
- **Status**: Identified

---

## 1. Description

The frontend client registration form is completely non-functional due to a parameter naming mismatch between `RegisterForm.tsx` and the backend `POST /api/v1/auth/register` Zod validation schema.

In `client/components/auth/RegisterForm.tsx`:
```typescript
const response = await fetch('/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: email.trim(),
    password,
    inGameId: inGameId.trim(),
  }),
});
```
The form collects `email`, `password`, and `inGameId`. It sends the field `inGameId`.

In `server/src/routes/auth.ts`:
```typescript
const registerBodySchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  username: z.string().min(3).max(50),
});
```
The backend parser strictly requires `username` (`username: z.string().min(3).max(50)`). It does not declare or accept `inGameId`.

When a user attempts to sign up through the application UI:
1. `request.body` contains `{ email, password, inGameId }`.
2. `registerBodySchema.safeParse(request.body)` fails because `username` is `undefined`.
3. The server immediately aborts and returns HTTP 400 Bad Request with `{ "code": "VALIDATION_FAILED", "detail": "Required" }`.
4. No user account can ever be registered via the client registration UI.

Furthermore, `client/test/auth-ui.test.tsx` never included a test case for submitting `RegisterForm`, so this critical bug was masked.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 3.1:
  > Users and Profiles schemas define `username` (max 50, unique) and `in_game_id` (max 50, nullable).
- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 10 Table:
  > `POST /api/v1/auth/register`: "Creates account, generates profile, dispatches verification email".
- **SRS Reference**: `docs/internal/requirements.md` Section 8.1 Step 1:
  > "User fills out registration form (Email, Password, Username)."

---

## 3. Reproduction Steps / Proof of Concept

1. Launch client (`pnpm --filter @smex/client dev`) and server (`pnpm --filter @smex/server dev`).
2. Click "Sign Up" in the navigation bar to open the registration modal.
3. Fill in:
   - Email: `newplayer@smexstore.com`
   - In-Game Name (IGN): `ApexPredator`
   - Password: `Password123!`
   - Confirm Password: `Password123!`
4. Click "Create Account".
5. Observe the UI error prompt: `"Registration failed. Please try again."`.
6. Inspect the network console:
   ```http
   POST /api/v1/auth/register
   Payload: { "email": "newplayer@smexstore.com", "password": "Password123!", "inGameId": "ApexPredator" }
   Response: 400 Bad Request
   {
     "type": "https://api.smexstore.com/errors/validation-failed",
     "title": "Validation Error",
     "status": 400,
     "detail": "Required",
     "code": "VALIDATION_FAILED"
   }
   ```

---

## 4. Impact

- Complete blockage of new user registration across the platform.
- Total breakdown of end-to-end user onboarding workflows.

---

## 5. Recommended Remediation

Align `RegisterForm.tsx` and `registerBodySchema`:

1. Update `RegisterForm.tsx` to collect `username` (or send `username: inGameId.trim()`, optionally allowing both `username` and `inGameId`):
   ```typescript
   body: JSON.stringify({
     email: email.trim(),
     password,
     username: inGameId.trim(),
     inGameId: inGameId.trim(),
   }),
   ```
2. Update `registerBodySchema` in `server/src/routes/auth.ts` to optionally accept `inGameId` and map it into `profiles`:
   ```typescript
   const registerBodySchema = z.object({
     email: z.string().email(),
     password: passwordSchema,
     username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores'),
     inGameId: z.string().min(3).max(50).optional(),
   });
   ```
3. Add end-to-end form submission tests in `client/test/auth-ui.test.tsx` verifying successful registration response handling.
