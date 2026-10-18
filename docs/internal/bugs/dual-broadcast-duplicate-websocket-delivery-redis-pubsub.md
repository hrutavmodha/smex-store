# Bug: Dual-Broadcast Duplicate WebSocket Delivery via Redis Pub/Sub Echo

- **Bug ID**: 18
- **Category**: Efficiency
- **Severity**: Medium
- **Target Files**:
  - `server/src/services/notification.service.ts` (lines 111–117, 315–321)
  - `server/src/plugins/websocket.ts` (lines 111–137)
- **Status**: Identified

---

## 1. Description

In `NotificationService.dispatchNotification` and `NotificationService.dispatchJoinRequestNotification`, WebSocket messages are sent to users using both Redis Pub/Sub and direct local gateway broadcasting:

```ts
// server/src/services/notification.service.ts (lines 111-117)
if (redis) {
  await redis.publish(channel, JSON.stringify(wsFrame));
}

if (wsGateway) {
  wsGateway.broadcastToChannel(channel, wsFrame);
}
```

Simultaneously, `server/src/plugins/websocket.ts` registers a Redis pattern subscriber listening on `user:*`:
```ts
// server/src/plugins/websocket.ts (lines 113-137)
const redisSubscriber = fastify.redis.duplicate();
redisSubscriber.psubscribe('tournament:*', 'user:*', 'system:*', ...);

redisSubscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
  let parsed: unknown = message;
  try {
    parsed = JSON.parse(message);
  } catch {
    // Keep string format
  }
  if (channel.startsWith('system:')) {
    wsGateway.broadcastAll({ ... });
  } else {
    wsGateway.broadcastToChannel(channel, parsed);
  }
});
```

Because Redis publishes to all subscribers including the node that originated the publish, the local node receives its own Redis message in `pmessage` and immediately executes `wsGateway.broadcastToChannel(channel, parsed)`.

Consequently, any WebSocket client connected to the node that initiated the notification receives **two identical WebSocket frames** in rapid succession:
1. Frame 1 from direct `wsGateway.broadcastToChannel()`
2. Frame 2 from `redisSubscriber.on('pmessage')`

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/realtime-gateway.md` Section 3.2: "Multi-Instance Redis Pub/Sub Architecture: Either Redis Pub/Sub is the sole dispatcher to connected client sockets across all nodes, or origin node IDs must be attached to skip re-broadcasting on the origin node."
- `docs/internal/architecture-overview.md` Section 6: "Real-Time WebSocket Invariants: Client sockets must receive exactly-once delivery of notifications and event envelopes."

---

## 3. Reproduction Steps / Proof of Concept

1. Connect a WebSocket client to `ws://localhost:3001/ws?token=<valid_token>` and subscribe to `user:<userId>`.
2. Trigger an action that dispatches a notification to `<userId>` (e.g. submitting a squad join request or calling `NotificationService.dispatchNotification`).
3. Monitor incoming frames on the WebSocket connection.
4. Observe that two identical `notification:new` or `team:join_request` frames arrive within milliseconds of each other.

---

## 4. Impact

1. **Client-Side State Glitches & Double Invocations**: Frontend notification listeners and toast triggers fire twice for every incoming event, causing double sound effects, duplicated toast alerts, and redundant React state re-renders.
2. **Redundant Network & CPU Utilization**: Double serialization and double socket transmissions waste network bandwidth and server CPU cycles, especially under high notification volumes.

---

## 5. Recommended Remediation

Adopt a clean single-path broadcast architecture. When Redis is enabled for multi-instance scaling, all broadcasts should route exclusively through Redis Pub/Sub, allowing each node's Redis subscriber to deliver the frame to its local sockets without an additional local broadcast:

```ts
// server/src/services/notification.service.ts
if (redis) {
  // Sole dispatch path when Redis is configured: pub/sub handles local + remote instances
  await redis.publish(channel, JSON.stringify(wsFrame));
} else if (wsGateway) {
  // Fallback for local single-instance development when Redis is disabled
  wsGateway.broadcastToChannel(channel, wsFrame);
}
```

Alternatively, if direct local dispatch is preferred for zero-latency local delivery, attach an instance UUID (`originNodeId`) to the Redis envelope and have `redisSubscriber.on('pmessage')` ignore messages where `originNodeId === currentInstanceId`.
