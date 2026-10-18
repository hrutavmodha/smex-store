# Bug: Missing `trustProxy` in Fastify Breaks Rate Limiting and Audit Logging Behind Nginx

- **Bug ID**: 11
- **Category**: Security
- **Severity**: High
- **Target Files**:
  - `server/src/server.ts` (lines 6–10)
  - `nginx.prod.conf` (lines 20–22, 51–53)
  - `server/src/plugins/rate-limit.ts` (lines 31, 104)
- **Status**: Identified

---

## 1. Description

In `server/src/server.ts`:
```ts
export async function createServer() {
  const server = Fastify({
    logger: loggerOptions,
  });
  // ...
```
Fastify is instantiated without `trustProxy: true`.
In the production topology (`docker-compose.prod.yml` and `nginx.prod.conf`), all traffic passes through an Nginx reverse proxy that appends client IPs to the `X-Forwarded-For` and `X-Real-IP` headers.

Because `trustProxy` is `false`:
1. Fastify ignores `X-Forwarded-For` and sets `request.ip` to the IP address of the incoming TCP socket (Nginx container's internal network IP, e.g. `172.18.0.x`).
2. Global rate limiting (`rl:global:${req.ip}`) and registration rate limiting (`rl:register:${req.ip}`) pool every single user on the platform under that single internal IP. If one user triggers a rate limit, the entire platform is blocked.
3. In `SessionService.createSession`, `metadata.ipAddress` records the internal Docker IP instead of the client's actual IP address.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/cicd-hardening.md` Section 3: "Production Reverse Proxy Topology: Fastify must trust Nginx proxy headers to resolve genuine client IP addresses."
- `docs/internal/requirements.md` Section 14: "Accurate distributed rate limiting and security audit logs."

---

## 3. Reproduction Steps / Proof of Concept

1. Launch production stack via `docker compose -f docker-compose.prod.yml up`.
2. Send requests to `http://localhost/api/v1/health` and inspect logs.
3. `req.ip` is logged as `172.18.0.x` rather than the client IP `127.0.0.1`.
4. Trigger the registration rate limit (3 attempts); observe that all subsequent registration attempts from any client IP are blocked.

---

## 4. Impact

Platform-wide denial of service when rate limits trigger, and completely corrupted device/session IP audit trails.

---

## 5. Recommended Remediation

Enable `trustProxy` in `server/src/server.ts`:
```ts
export async function createServer() {
  const server = Fastify({
    logger: loggerOptions,
    trustProxy: true,
  });
  // ...
```
