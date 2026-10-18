# Bug: Test Harness Relies on Dirty Pre-Existing Database Masking Missing Migrations and Cross-Test Contamination

- **Bug ID**: BUG-M8-009
- **Milestone**: Milestone 8: Real-Time Notifications and Universal Search (Test Infrastructure Debt)
- **Severity**: High / Test Integrity Flaw ("Green-Checkmark Fallacy" Root Cause)
- **Target Files**:
  - `server/test/helper.ts` (lines 17–53)
  - `server/src/plugins/db.ts` (lines 22–44)
- **Status**: Identified

---

## 1. Description

The Antigravity Global Engineering Mandate states:
> "Passing tests are a verification tool, never the product: A 100% green test suite is completely meaningless if it passes because production code was contorted, faked, bypassed, or polluted... Tests must exercise actual runtime integration."

In `server/test/helper.ts`, the test builder function `build(t)` connects directly to the developer's local, persistent PostgreSQL instance via standard Fastify plugin initialization:
```typescript
// server/test/helper.ts:17-30
async function build(
  t?: TestContext,
  configure?: (app: FastifyInstance) => Promise<void> | void
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fp(appPlugin as any, { name: 'app-test-wrapper' }), defaultOptions);
  if (configure) await configure(app);
  await app.ready();
  // ...
```

Notice what is missing:
1. **Zero Migration Verification**:
   The test runner **never** runs `drizzle-kit migrate` against a fresh ephemeral schema or container. It connects to whatever database state is already running on `localhost:5432`.
2. **Masked Migration Omissions**:
   Because the local PostgreSQL container had `pg_trgm` manually enabled or installed previously, `pnpm test` passed 100% of tests despite the fact that `CREATE EXTENSION IF NOT EXISTS pg_trgm;` was **completely missing from all migration files** in `server/src/db/migrations/`.
3. **Dirty State Cross-Contamination**:
   Tests only clean up Redis rate-limit and search keys. Residual records in PostgreSQL tables (`tournaments`, `teams`, `users`, `marketplace_listings`) persist across runs, creating non-deterministic test flakiness when test IDs collide.

---

## 2. Specification & Design Reference

- **Antigravity Engineering Mandate**: Section 1 & Section 3:
  > "Tests serve to objectively verify production reality... A test that passes only because the test runner supplies artificial props, mock flags, or synthetic conditions that the live application never wires up is an invalid test."

---

## 3. Reproduction Steps / Proof of Concept

1. Spin up a fresh PostgreSQL container on a non-standard port or fresh volume:
   ```bash
   docker run --name smex-fresh-test-db -e POSTGRES_PASSWORD=smex -e POSTGRES_DB=smex_test -p 5499:5432 -d postgres:16-alpine
   ```
2. Point `DATABASE_URL` to the fresh test database:
   ```bash
   export DATABASE_URL="postgres://postgres:smex@localhost:5499/smex_test"
   ```
3. Run `pnpm test`.
4. **Result**: The entire test suite fails immediately because the tables and extensions do not exist. The test runner has no mechanism to bootstrap or verify migrations.

---

## 4. Impact

- **False Sense of Security**: Deployments to staging and production fail on migration steps or runtime queries even when the local test suite is 100% green.
- **Hidden Schema Drift**: Schema changes made directly to local database instances pass tests even if corresponding SQL migrations were never generated or committed.

---

## 5. Recommended Remediation

1. In `server/test/helper.ts` (or via a global test setup hook):
   - Automatically execute migrations (`drizzle-kit migrate` or schema push) into an isolated test schema or test database before running tests.
   - Run tests inside isolated PostgreSQL schemas (e.g. `test_schema_${Date.now()}`) dropped on teardown.
2. Add a CI workflow step that boots a completely empty PostgreSQL service container and executes `pnpm db:migrate && pnpm test` to guarantee migration integrity.
