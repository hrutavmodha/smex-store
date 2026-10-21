# Bug: Migration Runner Fails Due to Server Environment Validation in Production

- **Bug ID**: BUG-OPS-001
- **Milestone**: Operations & Production Deployment
- **Severity**: Critical (P0 - Deployment Blocker)
- **Target Files**:
  - `docker-compose.prod.yml` (lines 20–34)
  - `server/src/db/migrate.ts` (lines 10–23)
  - `server/src/config/env.ts` (lines 40–54)
- **Status**: Identified

---

## 1. Description

In [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml), a dedicated `migration` container is defined to run database schema migrations before the Fastify server starts:

```yaml
  migration:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: smex-migration-prod
    restart: "no"
    command: ["node", "dist/migrate.mjs"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/smex_store
```

When `docker compose -f docker-compose.prod.yml up` runs, the container executes `node dist/migrate.mjs`.

In [`server/src/db/migrate.ts`](file:///home/hrutav-modha/Documents/smex-store/server/src/db/migrate.ts):
```typescript
export async function runMigrations() {
  const env = loadEnv();
  const pool = createDbPool(undefined, env);
  const db = createDbClient(pool);
  ...
```

`runMigrations()` invokes `loadEnv()` from [`server/src/config/env.ts`](file:///home/hrutav-modha/Documents/smex-store/server/src/config/env.ts), which runs full Zod validation against `envSchema`.

In `envSchema`:
```typescript
.refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      return (
        !data.JWT_SECRET.includes('development') &&
        !data.JWT_REFRESH_SECRET.includes('development')
      );
    }
    return true;
  },
  {
    message: 'Production deployments must supply secure, non-development JWT secrets',
    path: ['JWT_SECRET'],
  }
);
```

Because the `migration` service in `docker-compose.prod.yml` only receives `NODE_ENV: production` and `DATABASE_URL`, `JWT_SECRET` defaults to `'development_jwt_secret_key_needs_to_be_32_chars_minimum!'`.

The Zod refine rule immediately fails with:
```
Fatal configuration error: Invalid environment variables:
┌─────────┬──────────────┬──────────────────────────────────────────────────────────────────────────┐
│ (index) │ field        │ issue                                                                    │
├─────────┼──────────────┼──────────────────────────────────────────────────────────────────────────┤
│ 0       │ 'JWT_SECRET' │ 'Production deployments must supply secure, non-development JWT secrets' │
└─────────┴──────────────┴──────────────────────────────────────────────────────────────────────────┘
[Migrations] Migration failed: Error: Environment validation failed: [{"field":"JWT_SECRET","issue":"Production deployments must supply secure, non-development JWT secrets"}]
```

The container exits with error code `1`.

---

## 2. Impact

- The `server` service in [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml#L63-L64) has a strict dependency on `migration`:
  ```yaml
  depends_on:
    migration:
      condition: service_completed_successfully
  ```
- Because `migration` exits with non-zero exit code 1, Docker Compose aborts starting the `server` container.
- The entire production deployment fails to boot.

---

## 3. Reproduction Steps / Proof of Concept

1. From the repository root, execute the migration runner under production conditions with only the database URL:
   ```bash
   NODE_ENV=production DATABASE_URL=postgres://postgres:postgres@localhost:5432/smex_store node server/dist/migrate.mjs
   ```
2. Observe fatal console output:
   ```
   Fatal configuration error: Invalid environment variables:
   [{ field: 'JWT_SECRET', issue: 'Production deployments must supply secure, non-development JWT secrets' }]
   ```
3. Process exits with code `1`.

---

## 4. Root Cause

1. Database schema migrations only require a PostgreSQL connection (`DATABASE_URL`). They have zero runtime dependency on JWT secrets, Redis, or S3 object storage.
2. Tying `migrate.ts` to the entire server configuration schema (`loadEnv()`) violates separation of concerns and creates an artificial dependency on unused application secrets.
3. Simultaneously, [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml) does not pass `JWT_SECRET` or `JWT_REFRESH_SECRET` to the `migration` container.

---

## 5. Recommended Remediation

1. Decouple `migrate.ts` from full server `loadEnv()`:
   In [`server/src/db/migrate.ts`](file:///home/hrutav-modha/Documents/smex-store/server/src/db/migrate.ts), parse only the necessary database configuration (`DATABASE_URL`), or pass a scoped environment object to `createDbPool()`.
2. As defense-in-depth, update `docker-compose.prod.yml` to supply `JWT_SECRET: ${JWT_SECRET}` and `JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}` to all containers.
