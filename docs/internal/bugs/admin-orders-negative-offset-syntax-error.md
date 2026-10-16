# Bug: Admin Orders Query Accepts Negative Page/Limit Triggering SQL Syntax Exceptions

- **Bug ID**: BUG-M6-008
- **Milestone**: Milestone 6: MLBB Dual-Mode Boosting Engine
- **Severity**: Low to Medium (Query Sanitization Defect & Unhandled 500)
- **Target Files**:
  - `server/src/routes/admin/boosting.ts` (lines 66–89)
  - `server/src/services/boosting-rate.service.ts` (lines 108–120)
- **Status**: Identified

---

## 1. Description

In `server/src/routes/admin/boosting.ts` lines 66–89:
```typescript
fastify.get('/api/v1/admin/boosting/orders', async (request, reply) => {
  const query = request.query as {
    status?: string;
    channel?: string;
    page?: string;
    limit?: string;
  };

  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const page = query.page ? parseInt(query.page, 10) : 1;
  const offset = (page - 1) * limit;

  const orders = await BoostingRateService.getOrders(
    {
      status: query.status,
      channel: query.channel,
      limit,
      offset,
    },
    fastify.db
  );

  return reply.code(200).send({ orders, page, limit });
});
```

### Flaw
There is no lower-bound validation on `query.page` or `query.limit`:
1. If a client supplies `?page=0` or `?page=-1`:
   `offset = (0 - 1) * 20 = -20`.
2. Drizzle executes:
   ```sql
   SELECT ... FROM "boosting_orders" ... LIMIT 20 OFFSET -20;
   ```
3. PostgreSQL immediately rejects negative offsets with:
   `error: OFFSET must not be negative (code: 2201X)`.
4. The request crashes with an unhandled HTTP 500 error instead of a validated 400 response.
5. Similarly, `limit <= 0` generates an unhandled PostgreSQL error: `LIMIT must not be negative`.

---

## 2. Specification & Design Reference

- **LLD Reference**: `docs/internal/design/lld/mlbb-boosting.md` Section 5.2 Item 3.

---

## 3. Reproduction Steps / Proof of Concept

1. Authenticate with an admin bearer token.
2. Send `GET /api/v1/admin/boosting/orders?page=0`.
3. The server crashes with HTTP 500: `OFFSET must not be negative`.

---

## 4. Impact

- DoS vector on admin pagination endpoint through unhandled database exceptions.

---

## 5. Recommended Remediation

In `server/src/routes/admin/boosting.ts`, validate query parameters via a Zod schema or sanitize:
```typescript
const page = Math.max(1, query.page ? parseInt(query.page, 10) || 1 : 1);
const limit = Math.max(1, Math.min(100, query.limit ? parseInt(query.limit, 10) || 20 : 20));
const offset = (page - 1) * limit;
```
