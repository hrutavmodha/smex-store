# Bug: Production Docker Environment Variable Divergence and Missing `JWT_REFRESH_SECRET`

- **Bug ID**: 13
- **Category**: Security
- **Severity**: High
- **Target Files**:
  - `docker-compose.prod.yml` (lines 28–36)
  - `server/src/config/env.ts` (lines 28–53)
- **Status**: Identified

---

## 1. Description

There are two critical configuration divergences in `docker-compose.prod.yml`:

1. **S3 Environment Variable Name Mismatch**:
   `docker-compose.prod.yml` specifies:
   ```yaml
   STORAGE_ENDPOINT: http://minio:9000
   STORAGE_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
   STORAGE_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
   STORAGE_BUCKET: smex-storage
   ```
   However, `server/src/config/env.ts` and `StorageService` strictly parse:
   - `S3_ENDPOINT`
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_BUCKET`
   The S3 client inside the container fails to receive valid endpoint and credential configurations.

2. **Fatal Production Boot Crash on Missing `JWT_REFRESH_SECRET`**:
   `docker-compose.prod.yml` passes `JWT_SECRET`, but omits `JWT_REFRESH_SECRET`.
   In `server/src/config/env.ts`:
   ```ts
   JWT_REFRESH_SECRET: z.string().default('development_jwt_refresh_secret_key_needs_32_chars_min!'),
   // ...
   refine((data) => {
     if (data.NODE_ENV === 'production') {
       return !data.JWT_SECRET.includes('development') && !data.JWT_REFRESH_SECRET.includes('development');
     }
     return true;
   }, { message: 'Production deployments must supply secure, non-development JWT secrets' })
   ```
   Because `JWT_REFRESH_SECRET` is not passed in `docker-compose.prod.yml`, it falls back to the default containing `'development'`. When `NODE_ENV=production`, `loadEnv()` throws a fatal error and the process crashes on boot.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/cicd-hardening.md` Section 3: "Production Docker Compose Topology and Environment Parity."
- `docs/internal/roadmap.md` Section 10.3: "Production Containerization and Env Configuration."

---

## 3. Reproduction Steps / Proof of Concept

1. Run `docker compose -f docker-compose.prod.yml up server`.
2. Inspect server container logs:
   `Fatal configuration error: Invalid environment variables: Production deployments must supply secure, non-development JWT secrets`.
3. Container terminates with exit code 1.

---

## 4. Impact

The server container crashes immediately on launch in any production Docker Compose deployment.

---

## 5. Recommended Remediation

Update `docker-compose.prod.yml` to supply `JWT_REFRESH_SECRET` and align S3 variable names:
```yaml
environment:
  NODE_ENV: production
  PORT: 3001
  DATABASE_URL: postgres://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/smex_store
  REDIS_URL: redis://redis:6379
  JWT_SECRET: ${JWT_SECRET}
  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
  S3_ENDPOINT: http://minio:9000
  S3_ACCESS_KEY_ID: ${MINIO_ROOT_USER:-minioadmin}
  S3_SECRET_ACCESS_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
  S3_BUCKET: smex-storage
```
