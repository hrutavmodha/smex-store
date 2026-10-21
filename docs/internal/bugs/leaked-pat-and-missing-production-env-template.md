# Bug: Hardcoded GitHub PAT in `.env` and Missing Production Environment Template

- **Bug ID**: BUG-OPS-005
- **Milestone**: Operations & Security
- **Severity**: Medium (P2 - Security Risk & Configuration Usability)
- **Target Files**:
  - `.env` (line 26)
  - `.env.example`
  - `docker-compose.prod.yml` (line 49)
- **Status**: Identified

---

## 1. Description

1. **Hardcoded GitHub Personal Access Token**:
   Line 26 of [`.env`](file:///home/hrutav-modha/Documents/smex-store/.env#L26) contains a real, unmasked GitHub PAT:
   ```env
   GH_PAT=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
   ```
   While `.env` is listed in `.gitignore`, leaving credentials in working files creates an accidental exposure risk during server provisioning, rsync/scp transfers, or manual staging.

2. **Phantom Environment Variable in Production Compose**:
   Line 49 of [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml#L49) references `SESSION_COOKIE_SECRET: ${SESSION_COOKIE_SECRET}`. This environment variable is not defined anywhere in Zod schemas ([`server/src/config/env.ts`](file:///home/hrutav-modha/Documents/smex-store/server/src/config/env.ts)) or `.env.example`, generating noisy warning messages on every `docker compose` execution:
   ```
   WARN[0000] The "SESSION_COOKIE_SECRET" variable is not set. Defaulting to a blank string.
   ```

3. **Missing Production Template**:
   The repository contains only `.env.example` for local development. There is no `.env.production.example` documenting critical production invariants:
   - Requiring 32+ character non-default JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`).
   - Defining `POSTGRES_PASSWORD` for PostgreSQL security.
   - Setting `CORS_ORIGIN` and `CLIENT_URL` to the production domain.
   - Clarifying that `NEXT_PUBLIC_API_URL` should be omitted or set to the production reverse proxy.

---

## 2. Impact

- Security risk of credential leakage if the working `.env` is bundled or transferred during server setup.
- Unnecessary friction and deployment failure for system administrators trying to guess production variables without a validated template.

---

## 3. Recommended Remediation

1. Delete `GH_PAT` from `.env` and rotate/revoke the token on GitHub.
2. Remove `SESSION_COOKIE_SECRET` from [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml).
3. Create a clean `.env.production.example` template with production defaults and comments explaining all required variables.
