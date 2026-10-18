# Bug: Blocking Redis KEYS Command in Session Revocation Halts Redis Event Loop

- **Bug ID**: 17
- **Category**: Efficiency
- **Severity**: Medium
- **Target Files**:
  - `server/src/services/session.service.ts` (lines 295–299)
- **Status**: Identified

---

## 1. Description

In `SessionService.revokeAllSessions`, when a user requests "revoke all sessions" or an administrator terminates all sessions for an account, the service attempts to purge any orphaned session keys in Redis:

```ts
// server/src/services/session.service.ts
// Also scan and purge any orphaned session keys in Redis
const keys = await redis.keys(`session:${userId}:*`);
if (keys.length > 0) {
  await redis.del(...keys);
}
```

The Redis `KEYS` command operates in $O(N)$ time, where $N$ is the total count of keys in the Redis database. Redis is fundamentally single-threaded; executing `KEYS` across millions of session, cache, and rate-limiting keys blocks the Redis event loop synchronously. During this time, every other Redis operation across the entire platform (including authentication checks, rate-limit verifications, and WebSocket pub/sub message processing) is completely blocked and queued.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/auth-session.md` Section 4.3: "Redis Session Storage: Keyspace commands must not block the single-threaded Redis event loop; cursor-based iteration (`SCAN`) or dedicated index sets must be used for bulk invalidation."
- Redis Official Production Best Practices: *"Warning: consider `KEYS` as a command that should only be used in production environments with extreme care. It may ruin performance when it is executed against large databases. Use `SCAN` instead."*

---

## 3. Reproduction Steps / Proof of Concept

1. Populate a Redis instance with 2,000,000 mock keys (typical for high-concurrency production setups with tokens, caches, and rate-limit counters).
2. Trigger `POST /api/v1/auth/sessions/revoke-all` for any user.
3. Observe Redis metrics:
   - Command latency for concurrent operations spikes to hundreds of milliseconds or seconds while `KEYS session:<userId>:*` scans the entire keyspace.
   - Fastify request timeouts or connection pool exhaustion occur for concurrent requests awaiting session token validation.

---

## 4. Impact

1. **System-Wide Latency Spikes**: Any call to `revokeAllSessions` halts the central Redis instance, causing artificial latency spikes across all API endpoints relying on Redis (rate limiting, session verification, WebSocket dispatch).
2. **Denial of Service Vector**: An attacker with multiple accounts or compromised sessions can trigger concurrent `revoke-all` requests, deliberately degrading backend responsiveness for all platform users.

---

## 5. Recommended Remediation

Replace the synchronous `redis.keys()` call with non-blocking cursor iteration via `redis.scanStream` or maintain a secondary Redis set index (`user_sessions:${userId}`) tracking active session IDs for that specific user:

### Solution A: Non-blocking `scanStream`
```ts
const stream = redis.scanStream({
  match: `session:${userId}:*`,
  count: 100,
});

const keysToDelete: string[] = [];
for await (const chunk of stream) {
  keysToDelete.push(...chunk);
}

if (keysToDelete.length > 0) {
  await redis.del(...keysToDelete);
}
```

### Solution B: User Session Set Index (Recommended)
Track active session IDs in a Redis set `user_sessions:${userId}` upon session creation (`SADD user_sessions:${userId} ${sessionId}`). During `revokeAllSessions`, query the set with `SMEMBERS user_sessions:${userId}` ($O(M)$ where $M$ is only that user's session count, usually < 10), delete each session key, and then delete the set.
