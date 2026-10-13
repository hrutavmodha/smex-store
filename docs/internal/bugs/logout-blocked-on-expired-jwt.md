# Bug: User Logout Blocked When Short-Lived Access Token (JWT) Expires

- **Bug ID**: BUG-M3-007
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles
- **Severity**: Medium (Authentication & Session Invalidation Bug)
- **Target Files**:
  - `server/src/routes/auth.ts` (lines 224–251)
  - `server/src/plugins/auth.ts` (lines 42–78)
- **Status**: Identified

---

## 1. Description

The caller logout endpoint `POST /api/v1/auth/logout` is guarded by the strict `fastify.authenticate` pre-handler hook:
```typescript
fastify.post(
  '/api/v1/auth/logout',
  {
    preHandler: [fastify.authenticate],
  },
  async (request, reply) => {
    await SessionService.revokeSession(
      request.user.sub,
      request.user.sessionId,
      fastify.db,
      fastify.redis,
      fastify.wsGateway
    );

    reply.clearCookie('__Host-refresh-token', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    });

    return reply.code(200).send({
      success: true,
      message: 'Logged out successfully',
    });
  }
);
```

The Access Token has a lifetime of only 15 minutes (`900` seconds).

If a user leaves the application idle for longer than 15 minutes, or returns to a stale browser tab, their Access Token expires. If the user then clicks "Sign Out" or "Logout":
1. The request reaches `POST /api/v1/auth/logout`.
2. `fastify.authenticate` executes `request.jwtVerify()`.
3. `@fastify/jwt` rejects the expired token with HTTP 401 Unauthorized (`jwt expired`).
4. The route handler never executes.
5. The session is **not** revoked in Redis or PostgreSQL.
6. The `__Host-refresh-token` cookie is **not** cleared from the client browser.
7. The user is trapped in an authenticated state with a 30-day refresh token that they cannot log out of through the logout button without first initiating a token refresh.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 5.2 D:
  > **Standard Caller Logout: `POST /api/v1/auth/logout`**
  > - Caller Context: User clicks Logout in Navbar menu.
  > - Execution Flow: Revokes caller's `sessionId` via tombstone and Redis key deletion; clears `__Host-refresh-token` cookie (`Max-Age=0; Path=/`).
- **SRS Reference**: `docs/internal/requirements.md` Section 14 Item 4 (granular session management allowing instant termination of stale tokens).

---

## 3. Reproduction Steps / Proof of Concept

1. User logs in.
2. Fast-forward time past 15 minutes or craft an expired JWT for the active session.
3. Call `POST /api/v1/auth/logout` with `Authorization: Bearer <expired_token>`:
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/logout \
     -H "Authorization: Bearer <expired_token>" \
     -H "Cookie: __Host-refresh-token=sessionId.secretToken"
   ```
4. Output: HTTP 401 Unauthorized:
   ```json
   {
     "type": "https://api.smexstore.com/errors/unauthorized",
     "title": "Unauthorized",
     "status": 401,
     "detail": "jwt expired",
     "code": "UNAUTHORIZED"
   }
   ```
5. Inspect the response headers: `Set-Cookie` clearing `__Host-refresh-token` is **missing**. The session remains active in Redis.

---

## 4. Impact

- Users cannot sign out after an inactivity timeout.
- Shared/public devices retain the active 30-day refresh cookie, creating a session hijacking risk.

---

## 5. Recommended Remediation

Allow `POST /api/v1/auth/logout` to extract the session from either:
1. The Access Token (even if expired, decode claims without verifying expiry solely for logout), OR
2. The `__Host-refresh-token` cookie directly via `session_lookup:${sessionId}`.
3. Ensure `reply.clearCookie('__Host-refresh-token', ...)` is always executed on logout regardless of whether the access token has expired.
