# Bug: Banned and Revoked Users Can Establish WebSocket Connections and Eavesdrop

- **Bug ID**: 10
- **Category**: Security
- **Severity**: High
- **Target Files**:
  - `server/src/plugins/websocket.ts` (lines 145–160)
  - `server/src/plugins/auth.ts` (lines 64–104)
- **Status**: Identified

---

## 1. Description

In `server/src/plugins/auth.ts`, HTTP authentication verifies the JWT, checks Redis for `banned_user:${sub}`, and checks `revoked_token:${sessionId}` to deny banned users or revoked sessions.

However, in `server/src/plugins/websocket.ts` (`GET /ws`):
```ts
fastify.get('/ws', { websocket: true }, (socket, req) => {
  const query = (req.query || {}) as { token?: string };
  let userId: string | null = null;
  let sessionId: string | null = null;

  if (query.token && fastify.jwt) {
    try {
      const decoded = fastify.jwt.verify<AccessTokenPayload>(query.token);
      userId = decoded.sub;
      sessionId = decoded.sessionId;
    } catch {
      // Unauthenticated or expired token: allow guest or restricted connection
    }
  }

  const meta = registerSocket(socket, clients, fastify.log, userId, sessionId, req.id);
  // ...
```
The gateway checks only the cryptographic signature of `query.token`.
It does **not** check Redis for `banned_user:${userId}` or `revoked_token:${sessionId}`.
When a user is banned by an administrator (`POST /api/v1/admin/users/:id/ban`), the server revokes existing sockets and sets `banned_user:${id}`. However, if the banned user opens a new WebSocket connection with their existing JWT, the connection is accepted and automatically subscribed to `user:${userId}` until the 15-minute JWT expires.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/auth-and-sessions.md` Section 3: "Immediate revocation across HTTP and WebSockets upon session revocation or account ban."
- `docs/internal/requirements.md` Section 14: "Session kill-switch guarantees immediate denial of access across all channels."

---

## 3. Reproduction Steps / Proof of Concept

1. User logs in and acquires an access JWT.
2. Administrator bans the user via `POST /api/v1/admin/users/:id/ban`.
3. The user opens a WebSocket connection: `ws://localhost:3001/ws?token=<ACCESS_JWT>`.
4. The server accepts the connection and auto-subscribes the socket to `user:<userId>`.
5. The banned user continues to receive real-time events.

---

## 4. Impact

Banned users and revoked sessions can bypass access revocation by establishing WebSocket sessions to monitor private channels.

---

## 5. Recommended Remediation

In `server/src/plugins/websocket.ts`, perform asynchronous checks against Redis before registering the socket:
```ts
if (sessionId) {
  const isRevoked = await fastify.redis.exists(`revoked_token:${sessionId}`);
  if (isRevoked) {
    socket.close(4401, 'Session revoked');
    return;
  }
}
if (userId) {
  const isBanned = await fastify.redis.get(`banned_user:${userId}`);
  if (isBanned === '1') {
    socket.close(4403, 'Account banned');
    return;
  }
}
```
