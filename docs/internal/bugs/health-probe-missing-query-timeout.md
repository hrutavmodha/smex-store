# Bug: Data Layer Health Probe Hangs Indefinitely Under Database Connection Saturation

- **Bug ID**: BUG-M2-005
- **Milestone**: Milestone 2: Data Layer and Client UI Shell
- **Severity**: Low/Medium (Observability & Reliability Bug)
- **Target Files**:
  - `server/src/routes/health.ts` (lines 38–52)
- **Status**: Identified

---

## 1. Description

The extended database health probe `GET /health` tests PostgreSQL connection pool health:
```typescript
if (pool) {
  try {
    const start = performance.now();
    await pool.query('SELECT 1');
    const elapsed = performance.now() - start;

    if (elapsed <= 1000) {
      dbStatus = 'connected';
      latencyMs = Math.round(elapsed * 100) / 100;
    }
  } catch {
    dbStatus = 'disconnected';
    latencyMs = -1;
  }
}
```

Two distinct defects exist in this logic:

1. **Unbounded Query Execution**:
   `pool.query('SELECT 1')` is executed without a statement timeout, query timeout, or cancellation signal. If the PostgreSQL pool is exhausted and `connectionTimeoutMillis` has not triggered, or if a backend database deadlock occurs, `await pool.query('SELECT 1')` hangs indefinitely. This blocks health checking agents (e.g. Docker, Kubernetes, AWS ALB probes) until their connection timeout threshold, potentially causing cascading container restarts.
   
2. **Loss of Latency Telemetry on Saturated Responses**:
   The specification states that queries taking longer than 1,000ms should be reported as degraded. However, when `elapsed > 1000`:
   `dbStatus` remains `'disconnected'`, and `latencyMs` remains `-1`. The actual measured query latency (e.g., `1250ms`) is discarded rather than reported in the response body.

3. **Missing RFC 7807 Error Envelope on HTTP 503**:
   `docs/internal/design/lld/data-layer.md` Section 6.2 states:
   > "Degraded / Outage (HTTP 503): Database query throws connection error or times out. `status: 'degraded'`, `database.status: 'disconnected'`. RFC 7807 problem details returned without leaking raw DB connection strings."
   The implementation simply sets `reply.status(503)` and returns the standard `DataLayerHealthResponse` JSON shape rather than an RFC 7807 Problem Details object.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/data-layer.md` Section 6.1 & 6.2 (Health Status Decision Logic & Response Schema).
- **Roadmap Reference**: `docs/internal/roadmap.md` Task 2.5 & Task 10.6 (RFC 7807 compliance).

---

## 3. Reproduction Steps / Proof of Concept

1. Saturate the PostgreSQL connection pool or introduce artificial network delay of 1,200ms on database queries.
2. Call `GET /health`.
3. Response:
   ```json
   {
     "status": "degraded",
     "database": {
       "status": "disconnected",
       "latencyMs": -1,
       "pool": { "totalCount": 5, "idleCount": 0, "waitingCount": 1 }
     }
   }
   ```
   Notice `latencyMs` is `-1`, completely hiding the actual 1,200ms response time from observability monitoring systems.

---

## 4. Impact

- Monitoring tools and site reliability dashboards cannot measure degraded database latency spikes.
- Risk of hanging health probes locking ingress gateway connections during database saturation.

---

## 5. Recommended Remediation

Use `Promise.race` with an explicit 1,000ms timeout or Postgres statement timeout, record measured latency regardless of threshold, and mark status as `degraded`:
```typescript
const start = performance.now();
const queryPromise = pool.query('SELECT 1');
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('HEALTH_TIMEOUT')), 1000)
);

try {
  await Promise.race([queryPromise, timeoutPromise]);
  const elapsed = performance.now() - start;
  dbStatus = 'connected';
  latencyMs = Math.round(elapsed * 100) / 100;
} catch (err: any) {
  const elapsed = performance.now() - start;
  latencyMs = Math.round(elapsed * 100) / 100;
  dbStatus = 'disconnected';
}
```
