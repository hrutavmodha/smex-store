# Bug: Missing `image` Directives in Production Compose Prevents CD Image Pulls

- **Bug ID**: BUG-OPS-006
- **Milestone**: Operations & Continuous Deployment
- **Severity**: High (P1 - CD Pipeline Deployment Failure)
- **Target Files**:
  - `docker-compose.prod.yml` (lines 20–85)
  - `.github/workflows/deploy.yml` (lines 87–94)
- **Status**: Identified

---

## 1. Description

The GitHub Actions CD pipeline ([`.github/workflows/deploy.yml`](file:///home/hrutav-modha/Documents/smex-store/.github/workflows/deploy.yml)) builds and publishes versioned Docker images to GitHub Container Registry (GHCR):
- Server: `ghcr.io/${{ github.repository }}/server:${{ github.sha }}`
- Client: `ghcr.io/${{ github.repository }}/client:${{ github.sha }}`

In line 91, the deployment step triggers the remote runner to pull the updated images and restart:
```bash
cd ${{ secrets.SSH_DEPLOY_DIR:-/opt/smex-store }} && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

However, in [`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml), the `server`, `client`, and `migration` services **do not define an `image` directive**:

```yaml
  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: smex-server-prod
    ...
```

---

## 2. Impact

1. When `docker compose -f docker-compose.prod.yml pull` executes on the production host, Docker Compose attempts to pull services that have an `image:` tag. Because `server`, `client`, and `migration` only specify `build:`, Docker skips them or warns:
   ```
   WARNING: Some service image(s) must be built from source by running: docker compose build server client
   ```
2. The remote deployment never pulls the newly published GHCR images from the CI pipeline.
3. The server continues running old code or attempts an expensive on-server rebuild (`docker compose build`), which exhausts CPU/RAM on small VPS instances like Hetzner CX22 (resulting in out-of-memory container crashes).

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `docker-compose.prod.yml` lines 20–95.
2. Note that `postgres`, `redis`, and `nginx` specify `image:`, but `server`, `client`, and `migration` omit `image:`.
3. Run `docker compose -f docker-compose.prod.yml pull server`.
4. Observe that compose reports nothing to pull.

---

## 4. Root Cause

The production compose file was drafted for local building rather than consumption of registry-published images from GHCR.

---

## 5. Recommended Remediation

Add parameterized `image:` directives to `docker-compose.prod.yml` that support both remote registry pulling and local fallback:

```yaml
  server:
    image: ${SERVER_IMAGE:-ghcr.io/your-org/server:latest}
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: smex-server-prod

  client:
    image: ${CLIENT_IMAGE:-ghcr.io/your-org/client:latest}
    build:
      context: .
      dockerfile: client/Dockerfile
    container_name: smex-client-prod

  migration:
    image: ${SERVER_IMAGE:-ghcr.io/your-org/server:latest}
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: smex-migration-prod
```
