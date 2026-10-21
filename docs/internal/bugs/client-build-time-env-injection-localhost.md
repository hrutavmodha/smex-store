# Bug: Next.js Client Production Image Bakes In Development Localhost URLs

- **Bug ID**: BUG-OPS-004
- **Milestone**: Operations & Production Deployment
- **Severity**: High (P1 - Networking & Client API Ingress Failure)
- **Target Files**:
  - `docker-compose.prod.yml` (lines 77–87)
  - `client/Dockerfile` (lines 28–31)
  - `.env.example` (lines 21–22)
- **Status**: Identified

---

## 1. Description

Next.js statically inlines all `NEXT_PUBLIC_*` environment variables directly into the compiled JavaScript bundles during build time (`next build`).

In [`client/Dockerfile`](file:///home/hrutav-modha/Documents/smex-store/client/Dockerfile#L28-L31):
```dockerfile
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
```

And in [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml#L77-L87):
```yaml
  client:
    build:
      context: .
      dockerfile: client/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-}
        NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-}
    environment:
      INTERNAL_API_URL: http://server:3001
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-}
      NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-}
```

If a production server environment file (`.env`) is initialized from [`.env.example`](file:///home/hrutav-modha/Documents/smex-store/.env.example):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

During `docker compose -f docker-compose.prod.yml build client`, Docker substitutes `${NEXT_PUBLIC_API_URL}` with `http://localhost:3001`. Next.js compiles `http://localhost:3001` directly into every JavaScript component on the client.

---

## 2. Impact

- When external end-users (e.g. mobile gamers, tournament participants) load the deployed production website (`https://yourdomain.com`), client-side fetch and WebSocket calls attempt to connect to `http://localhost:3001` on the **user's own device**.
- Calls fail with `ERR_CONNECTION_REFUSED` because the user does not have a Fastify backend running on port 3001 of their phone or computer.
- Changing `NEXT_PUBLIC_API_URL` as a runtime environment variable in `docker-compose.prod.yml` has **zero effect** because Next.js reads `NEXT_PUBLIC_*` strictly at build time.

---

## 3. Reproduction Steps / Proof of Concept

1. Verify `.env.example` lines 21–22 contain:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_WS_URL=ws://localhost:3001
   ```
2. Build the client container via `docker compose -f docker-compose.prod.yml build client`.
3. Inspect the compiled static chunks in the container:
   `docker run --rm smex-store-client grep -rn "http://localhost:3001" .next/static/`
4. Observe hardcoded string references to `http://localhost:3001`.

---

## 4. Root Cause

1. Production builds behind an Nginx reverse proxy do not need an absolute API URL; they should use same-origin relative paths (`/api/...`) or the public production domain name.
2. In `docker-compose.prod.yml`, passing `${NEXT_PUBLIC_API_URL:-}` falls back to the local dev variable when `.env` is present.
3. The lack of a dedicated `.env.production.example` leads developers to use `.env.example` values during production builds.

---

## 5. Recommended Remediation

1. In [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml), explicitly default build arguments to empty strings or production domain variables:
   ```yaml
   args:
     NEXT_PUBLIC_API_URL: ${PROD_PUBLIC_API_URL:-}
     NEXT_PUBLIC_WS_URL: ${PROD_PUBLIC_WS_URL:-}
   ```
2. Rely on the client's existing [`getApiBaseUrl()`](file:///home/hrutav-modha/Documents/smex-store/client/lib/api.ts) and [`getWebSocketUrl()`](file:///home/hrutav-modha/Documents/smex-store/client/lib/api.ts) which default cleanly to same-origin paths (`/api/...`) and current window origin (`window.location.host`) when `NEXT_PUBLIC_*` are empty strings.
3. Provide a separate `.env.production.example` where `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are left blank by default.
