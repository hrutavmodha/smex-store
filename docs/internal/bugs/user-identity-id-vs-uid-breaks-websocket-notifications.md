# Bug: User Identity Mismatch (id vs uid) Breaks Real-Time WebSocket Notifications

- **Bug ID**: 2
- **Category**: Correctness
- **Severity**: High
- **Target Files**:
  - `client/components/notifications/NotificationCenter.tsx` (lines 26, 66, 85)
  - `server/src/routes/auth.ts` (lines 425–433)
  - `server/src/plugins/websocket.ts` (lines 170–184)
- **Status**: Identified

---

## 1. Description

The backend endpoint `GET /api/v1/auth/me` returns the following payload:
```ts
return reply.code(200).send({
  id: userRecord.id,
  uid: profileRecord?.inGameId || null,
  email: userRecord.email,
  role: userRecord.role,
  emailVerified: userRecord.emailVerified,
  sessionId: request.user.sessionId,
  profile: profileRecord,
});
```
Here, `id` is the user's primary key UUID, and `uid` is their optional Mobile Legends in-game ID.

In `NotificationCenter.tsx`:
```tsx
if (!user?.uid) return;
// ...
socket.send(JSON.stringify({
  action: 'subscribe',
  channel: `user:${user.uid}`,
}));
```
1. If a user registers without entering an in-game ID, `user.uid` is `null`. The hook returns early and never loads notifications or establishes a WebSocket connection.
2. If a user has an in-game ID (e.g. `"12345"`), the client attempts to subscribe to `user:12345`. However, backend notifications are broadcast to `user:<user-uuid>` (the primary key UUID). Furthermore, the WebSocket authorization guard in `websocket.ts` verifies:
```ts
if (channel.startsWith('user:')) {
  const targetUserId = channel.slice(5);
  if (!meta.userId || meta.userId !== targetUserId) {
    socket.send(JSON.stringify({ event: 'error', code: 'FORBIDDEN_CHANNEL' }));
    return;
  }
}
```
`meta.userId` is the JWT `sub` (a UUID). Because `meta.userId !== "12345"`, the gateway rejects the subscription with `FORBIDDEN_CHANNEL`.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/notifications-search.md` Section 3: "Private User Channel: user:<USER_UUID>. Clients must subscribe using their authenticated account UUID."
- `docs/internal/requirements.md` Section 13: "Real-time WebSocket event dispatch for notification center."

---

## 3. Reproduction Steps / Proof of Concept

1. Register or log in with an account that has an in-game ID set to `"778899"`.
2. Open the browser console and observe the WebSocket subscription frame sent by `NotificationCenter`:
   `{"action":"subscribe","channel":"user:778899"}`.
3. Server returns:
   `{"event":"error","code":"FORBIDDEN_CHANNEL","message":"You are not authorized to subscribe to this private channel"}`.
4. If the account has no inGameId set, no WebSocket connection is established at all.

---

## 4. Impact

Real-time notifications are completely non-functional for all users in the frontend client.

---

## 5. Recommended Remediation

Standardize the primary account identity as `id` (or `uid = user.id`) on client and server:
1. In `NotificationCenter.tsx`, subscribe using the primary user ID:
   ```tsx
   const accountId = (user as any).id || user?.uid;
   if (!accountId) return;
   socket.send(JSON.stringify({ action: 'subscribe', channel: `user:${accountId}` }));
   ```
2. In `server/src/routes/auth.ts`, ensure `uid` reflects the primary user ID `userRecord.id`, mapping the game ID to `ign` or `inGameId`.
