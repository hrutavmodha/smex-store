# Bug: Remote Session Revocation Fails to Terminate Live WebSocket Sockets

- **Bug ID**: BUG-M3-009
- **Milestone**: Milestone 3: Zero-Trust Authentication and User Profiles (also relates to Milestone 1 WebSockets)
- **Severity**: Low/Medium (Real-Time Security Enforcement Bug)
- **Target Files**:
  - `server/src/services/session.service.ts` (lines 207–215, 293–301)
  - `server/src/plugins/websocket.ts` (lines 66–77)
- **Status**: Identified

---

## 1. Description

Both the Roadmap and the Low-Level Design specify that emergency account revocation and individual remote session evictions must terminate live WebSocket connections immediately:

- **Roadmap 3.3**:
  > "Implement `POST /api/auth/revoke-all` to purge all user keys from Redis, triggering immediate WS and HTTP disconnects."
- **LLD Section 5.2 C Item 6**:
  > "Disconnects all user WebSockets."
- **LLD Section 5.2 A Item 5**:
  > "Dispatches WebSocket termination message `session:revoked` targeting `:sessionId`."

However, in `SessionService.ts`:
```typescript
if (wsGateway) {
  wsGateway.broadcastToChannel(`user:${userId}`, {
    event: 'session:revoked',
    channel: `user:${userId}`,
    timestamp: Date.now(),
    payload: { all: true },
  });
}
```

The gateway only dispatches a broadcast JSON payload (`wsGateway.broadcastToChannel`). It **never calls `socket.close()` or `socket.terminate()`**. 

Furthermore:
1. Sockets tracked in `wsGateway.clients` have a `userId` field, but no `sessionId` field is stored on `WebSocketClientMeta`.
2. Even in `revokeAllSessions`, where all connections for `userId` should be forcefully disconnected, no iterate-and-terminate logic is executed over `wsGateway.clients`.
3. If an attacker or compromised device holds an active WebSocket connection, the socket remains open and connected indefinitely despite remote session eviction.

---

## 2. Specification & Design Reference

- **Roadmap Reference**: `docs/internal/roadmap.md` Task 3.3 ("triggering immediate WS and HTTP disconnects").
- **LLD Reference**: `docs/internal/design/lld/auth-and-sessions.md` Section 5.2 C Item 6 ("Disconnects all user WebSockets").

---

## 3. Reproduction Steps / Proof of Concept

1. Connect a WebSocket client to the server associated with User A.
2. Call `POST /api/v1/auth/revoke-all` or `DELETE /api/v1/devices/sessions/:sessionId`.
3. Observe the WebSocket connection:
   - The connection remains in state `OPEN` (readyState === 1).
   - The client is not disconnected by the server.

---

## 4. Impact

- Revoked sessions retain active real-time socket connections.
- Incomplete implementation of zero-trust session termination contracts.

---

## 5. Recommended Remediation

Extend `WsGatewayDecorator` in `server/src/plugins/websocket.ts` with explicit connection termination utilities:
```typescript
terminateUserSockets: (userId: string, sessionId?: string) => void;
```
Inside `terminateUserSockets`:
```typescript
for (const [socket, meta] of clients.entries()) {
  if (meta.userId === userId && (!sessionId || meta.sessionId === sessionId)) {
    try {
      socket.close(4401, 'Session revoked');
    } catch {
      socket.terminate();
    }
    clients.delete(socket);
  }
}
```
And invoke this in `SessionService.revokeSession` and `SessionService.revokeAllSessions`.
