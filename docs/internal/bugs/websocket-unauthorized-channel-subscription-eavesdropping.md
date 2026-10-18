# Bug: Unrestricted WebSocket Channel Subscriptions Permitting Unauthorized Eavesdropping on User Private Notifications

- **Bug ID**: BUG-M8-005
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search
- **Severity**: Critical (Information Disclosure / Authorization Bypass)
- **Target Files**:
  - `server/src/plugins/websocket.ts` (lines 122–170)
- **Status**: Identified

---

## 1. Description

In Milestone 8, the WebSocket gateway (`server/src/plugins/websocket.ts`) was expanded to dispatch real-time events (`user:${userId}`) for notifications, squad join requests, and captain decisions.

When a client connects to the WebSocket endpoint `/ws`, the server allows both authenticated and unauthenticated (guest) connections. Upon receiving a frame from the client:
```typescript
// server/src/plugins/websocket.ts:139-153
socket.on('message', (raw: Buffer | string) => {
  try {
    const text = typeof raw === 'string' ? raw : raw.toString();
    const msg = JSON.parse(text);
    if (msg.action === 'subscribe' && typeof msg.channel === 'string') {
      meta.subscriptions.add(msg.channel);
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({
            event: 'subscribed',
            channel: msg.channel,
            timestamp: Date.now(),
          })
        );
      }
    }
    // ...
```

There is **zero authorization check** on `msg.channel`. 

When an event is broadcast:
```typescript
// server/src/plugins/websocket.ts:71-79
broadcastToChannel: (channel: string, message: unknown) => {
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  for (const [socket, meta] of clients.entries()) {
    const isOpen = socket.readyState === 1;
    if (meta.subscriptions.has(channel) && isOpen) {
      socket.send(payload);
    }
  }
}
```

Any unauthenticated guest or authenticated attacker can connect to `/ws` and subscribe to `user:<any-target-user-id>`. The server will add the victim's private channel to the socket's subscription set and forward all private notifications, join request details, applicant names, player roles, and system messages directly to the unauthorized client.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/notifications-search.md` Section 2.1:
  > "Private user channels (`user:${userId}`) carry confidential user-targeted notifications and team request data."
- **Security Invariant**: A WebSocket client must only be permitted to receive messages from channels they are authorized to access. Specifically, a client may only subscribe to `user:${userId}` if `meta.userId === userId`.

---

## 3. Reproduction Steps / Proof of Concept

1. Attacker opens an unauthenticated WebSocket connection to the server:
   ```javascript
   const ws = new WebSocket('ws://localhost:3001/ws');
   ws.onopen = () => {
     // Attacker subscribes to victim's private notification channel
     ws.send(JSON.stringify({
       action: 'subscribe',
       channel: 'user:c7a6e112-9876-4321-bbbb-0123456789ab'
     }));
   };
   ws.onmessage = (e) => console.log('Intercepted victim notification:', e.data);
   ```
2. The server responds with `{"event": "subscribed", "channel": "user:c7a6e112-9876-4321-bbbb-0123456789ab"}`.
3. Another player submits a squad join request to the victim captain.
4. `NotificationService.notifyCaptainJoinRequest` broadcasts the event to `user:c7a6e112-9876-4321-bbbb-0123456789ab`.
5. The attacker's WebSocket immediately receives the complete notification payload, containing player IGN, applicant user ID, team ID, and request ID.

---

## 4. Impact

- **Total Notification Privacy Breach**: Unauthorized actors can intercept private communications, join requests, captain decisions, and system alerts for any user on the platform.
- **Account Surveillance & Reconnaissance**: Attackers can monitor victim activity in real-time across the platform.

---

## 5. Recommended Remediation

1. In `server/src/plugins/websocket.ts`, restrict channel subscription by enforcing channel authorization rules:
   ```typescript
   if (msg.action === 'subscribe' && typeof msg.channel === 'string') {
     const channel = msg.channel.trim();

     // Enforce private channel authorization
     if (channel.startsWith('user:')) {
       const targetUserId = channel.slice(5);
       if (!meta.userId || meta.userId !== targetUserId) {
         socket.send(JSON.stringify({
           event: 'error',
           code: 'FORBIDDEN_CHANNEL',
           message: 'You are not authorized to subscribe to this private channel',
         }));
         return;
       }
     }

     meta.subscriptions.add(channel);
     // ...
   }
   ```
2. Reject guest subscriptions to sensitive or restricted channel patterns.
