# Bug: Nginx Production Configuration Lacks MinIO Object Storage Proxy & Upload Payload Limit

- **Bug ID**: BUG-OPS-008
- **Milestone**: Operations & Reverse Proxy
- **Severity**: High (P1 - Media Access & Direct Upload Failure)
- **Target Files**:
  - `nginx.prod.conf` (lines 20–67)
  - `docker-compose.prod.yml` (lines 6–18)
- **Status**: Identified

---

## 1. Description

[`nginx.prod.conf`](file:///home/hrutav-modha/Documents/smex-store/nginx.prod.conf) defines reverse proxy rules for:
- `/api/` -> Fastify backend (`server:3001`)
- `/ws` -> Fastify WebSocket (`server:3001`)
- `/health` -> Fastify health check (`server:3001`)
- `/` -> Next.js frontend (`client:3000`)

However:
1. **Missing MinIO Proxy Location**:
   There is no `upstream minio_upstream` or `location /smex-storage/` rule defined in Nginx.
   In production Compose ([`docker-compose.prod.yml`](file:///home/hrutav-modha/Documents/smex-store/docker-compose.prod.yml)), MinIO does not bind any host ports (ports `9000` and `9001` are unmapped). Since Nginx is the sole ingress gateway listening on ports `80` and `443`, direct client-to-storage requests (such as S3 PUT presigned uploads or public downloads) have no path to reach the MinIO container.

2. **Missing `client_max_body_size`**:
   Nginx default `client_max_body_size` is **1 MB**.
   The platform allows screenshot uploads up to **5 MB** ([`MAX_FILE_SIZE = 5 * 1024 * 1024`](file:///home/hrutav-modha/Documents/smex-store/server/src/services/storage.service.ts#L43)).
   Any upload payload exceeding 1 MB routed through Nginx will be rejected by Nginx with `413 Request Entity Too Large` before reaching Fastify or MinIO.

---

## 2. Impact

- Client-side presigned image uploads to MinIO cannot be completed through Nginx.
- Uploads between 1 MB and 5 MB fail with HTTP 413.

---

## 3. Reproduction Steps / Proof of Concept

1. Inspect `nginx.prod.conf`.
2. Observe there are only upstreams for `client` and `server`.
3. Observe absence of `client_max_body_size 10M;` directive.

---

## 4. Root Cause

Nginx configuration was tailored solely for Next.js SSR and Fastify REST/WebSockets, omitting object storage routing.

---

## 5. Recommended Remediation

1. In [`nginx.prod.conf`](file:///home/hrutav-modha/Documents/smex-store/nginx.prod.conf), add:
   ```nginx
   upstream minio_upstream {
     server minio:9000;
   }

   # Inside server block:
   client_max_body_size 10M;

   location /smex-storage/ {
     proxy_pass http://minio_upstream;
     proxy_http_version 1.1;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
2. In `docker-compose.prod.yml`, ensure `nginx` depends on `minio: condition: service_healthy` if MinIO is used.
