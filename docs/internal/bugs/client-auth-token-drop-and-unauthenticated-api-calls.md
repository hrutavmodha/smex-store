# Bug: Client Discards Access Token Leading to 100% Unauthenticated Protected Requests

- **Bug ID**: BUG-M3-003
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: High (Client Architecture & State Synchronization Flaw)
- **Target Files**:
  - `client/components/auth/LoginForm.tsx` (lines 52–67)
  - `client/components/shell/AppShell.tsx` (lines 13–46)
  - `client/app/settings/devices/page.tsx` (lines 40–117)
  - `client/components/shell/Navbar.tsx` (lines 115–125)
- **Status**: Identified

---

## 1. Description

The frontend client does not manage or persist the short-lived Access Token JWT returned upon login, nor does it pass the `Authorization` header to protected API endpoints.

Specific failures across the components:

1. **`LoginForm.tsx` discards the authentication payload**:
   ```typescript
   const response = await fetch('/api/v1/auth/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: email.trim(), password }),
   });

   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     throw new Error(errorData.detail || errorData.message || 'Invalid email or password');
   }

   if (onSuccess) {
     onSuccess();
   }
   ```
   `response.json()` contains `{ accessToken, user }`. `LoginForm` never reads `response.json()` upon success and never passes the token or user object to `onSuccess` or storage.

2. **`AppShell.tsx` never updates authenticated user state**:
   ```typescript
   <AuthModal
     key={`${isAuthModalOpen}-${authView}`}
     isOpen={isAuthModalOpen}
     onClose={() => setIsAuthModalOpen(false)}
     initialView={authView}
   />
   ```
   `AppShell` initializes `const [user, setUser] = useState<UserProfile | null>(null);`. However, it does not pass an `onSuccess` callback to `AuthModal`. Thus, when a user successfully signs in, `AppShell`'s `user` state remains `null`. The Navbar continues displaying "Sign In" and "Sign Up" buttons. Furthermore, `AppShell` has no session bootstrap logic (e.g. calling `GET /api/v1/auth/me`) on mount.

3. **`DeviceManagementDashboard` calls protected APIs without credentials or headers**:
   In `client/app/settings/devices/page.tsx`:
   - `fetch('/api/v1/devices/sessions')` (line 42)
   - `fetch('/api/v1/devices/sessions/' + sessionId, { method: 'DELETE' })` (line 83)
   - `fetch('/api/v1/devices/sessions/others', { method: 'DELETE' })` (line 103)
   All three requests omit the `Authorization: Bearer <token>` header and omit `credentials: 'include'`. Because Fastify's `authenticate` preHandler requires `request.jwtVerify()`, the server returns HTTP 401 Unauthorized for every request made by the page.

4. **`Navbar.tsx` logout calls protected endpoint without headers**:
   In `Navbar.tsx`:
   `await fetch('/api/v1/auth/logout', { method: 'POST' });`
   The logout endpoint is protected by `fastify.authenticate`. Without an `Authorization` header, the request is rejected with HTTP 401.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 4.1 A:
  > **Access Token (Short-Lived JWT)**
  > - Lifetime: 900 seconds (15 minutes).
  > - Transport: `Authorization: Bearer <token>` HTTP header.
- **SRS Reference**: `docs/internal/requirements.md` Section 10 & 12 (API endpoints protected with JWT session validation).

---

## 3. Reproduction Steps / Proof of Concept

1. Authenticate via `/api/v1/auth/login`.
2. Inspect browser storage / memory: no JWT is stored.
3. Navigate to `/settings/devices`.
4. Observe the console error: `GET /api/v1/devices/sessions 401 (Unauthorized)`.
5. Device sessions fail to load, showing error `"Failed to load active device sessions"`.

---

## 4. Impact

- The client application cannot interact with any protected server route.
- The Device Management settings view is completely inoperative in live environments.
- The UI navigation bar cannot maintain or display user profile state.

---

## 5. Recommended Remediation

1. Implement an authentication context/provider or React Query hook managing token lifecycle and active user profile.
2. Store the access token in memory (with automatic refresh via `/api/v1/auth/refresh` on 401 or timer) or encrypted storage.
3. Create an API client utility (e.g., `apiClient.fetch`) that automatically attaches `Authorization: Bearer ${token}` and `credentials: 'include'` on all outgoing API calls.
4. Update `AppShell.tsx` to mount an initial session verification query calling `GET /api/v1/auth/me`.
