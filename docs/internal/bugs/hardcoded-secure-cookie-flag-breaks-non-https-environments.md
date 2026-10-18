# Bug: Hardcoded `secure: true` on Session Cookies Breaks Non-HTTPS and Staging Environments

- **Bug ID**: 22
- **Category**: Reliability / Auth
- **Severity**: Medium
- **Target Files**:
  - `server/src/routes/auth.ts` (lines 213–228, 312–324)
  - `server/src/config/env.ts` (lines 13–15)
- **Status**: Identified

---

## 1. Description

In `server/src/routes/auth.ts`, session cookies are set and cleared with a hardcoded `secure: true` flag:

```ts
// Login endpoint (lines 213–228)
reply.setCookie('__Host-refresh-token', session.cookieValue, {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 2592000,
});

reply.setCookie('smex_access_token', accessToken, {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 900,
});

// Logout endpoint (lines 312–324)
reply.clearCookie('__Host-refresh-token', {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
});
reply.clearCookie('smex_access_token', {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
});
```

Under RFC 6265bis, browsers strictly require a secure TLS/HTTPS connection before storing cookies flagged with `secure: true` or prefixed with `__Host-`.
While desktop Chrome provides an exception for `http://localhost`, connecting via an IP address (e.g., `http://127.0.0.1:3000`, local LAN testing `http://192.168.x.x`, or HTTP staging deployments) causes compliant browsers (Safari, Firefox, Mobile Chrome) to silently reject the `Set-Cookie` header.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/auth-and-sessions.md` Section 2: "Cookie Specification: RFC 6265bis compliant session cookies. `secure` attribute must evaluate to `true` in production environments and allow plain HTTP transport in local development/test."
- `docs/internal/requirements.md` Section 3: "Dual-token authentication and cookie handling."

---

## 3. Reproduction Steps / Proof of Concept

1. Access the application in Firefox or Safari using the IP address `http://127.0.0.1:3000` or a mobile device connected over LAN.
2. Authenticate with valid credentials via `POST /api/v1/auth/login`.
3. Inspect network response headers: `Set-Cookie: __Host-refresh-token=...; Secure; SameSite=Strict`.
4. Browser storage shows no cookies stored due to the cookie being sent over non-HTTPS transport with `Secure` / `__Host-` directives.
5. Subsequent authenticated requests return HTTP 401 `UNAUTHORIZED`.

---

## 4. Impact

Authentication fails completely across local mobile testing, non-localhost development URLs (`127.0.0.1`), and HTTP-based staging environments.

---

## 5. Recommended Remediation

Conditionally set the `secure` flag based on `NODE_ENV === 'production'` and only use the `__Host-` cookie prefix when `secure` is enabled:

```ts
const isProduction = fastify.config.NODE_ENV === 'production';
const refreshTokenName = isProduction ? '__Host-refresh-token' : 'smex_refresh_token';

reply.setCookie(refreshTokenName, session.cookieValue, {
  path: '/',
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 2592000,
});

reply.setCookie('smex_access_token', accessToken, {
  path: '/',
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 900,
});
```
