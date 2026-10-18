# Bug: Production Nginx Configuration Lacks SSL/TLS Termination for Exposed Port 443

- **Bug ID**: 21
- **Category**: Security / Ops
- **Severity**: High
- **Target Files**:
  - `docker-compose.prod.yml` (lines 7–8)
  - `nginx.prod.conf` (lines 9–12)
- **Status**: Identified

---

## 1. Description

In `docker-compose.prod.yml`, the production Nginx reverse proxy binds and exposes both HTTP and HTTPS ports to the host:
```yaml
services:
  nginx:
    image: nginx:alpine
    container_name: smex-nginx-prod
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
```

However, inside `nginx.prod.conf`:
```nginx
server {
  listen 80;
  server_name localhost;

  # API and WebSocket proxy to Fastify backend
  location /api/ { ... }
  location /ws { ... }
  location /health { ... }
  location / { ... }
}
```

There is no `listen 443 ssl;` server block, no SSL/TLS certificate directives (`ssl_certificate`, `ssl_certificate_key`), and no SSL volume mount configured in Docker Compose.

---

## 2. Specification & Design Reference

- `docs/internal/design/lld/cicd-hardening.md` Section 3: "Production Docker Compose Topology and Reverse Proxy: Edge ingress via Nginx terminating SSL/TLS and proxying traffic to Next.js (port 3000) and Fastify (port 3001)."
- `docs/internal/roadmap.md` Section 10.3: "Production Containerization and Reverse Proxy Topology."

---

## 3. Reproduction Steps / Proof of Concept

1. Boot the production stack using Docker Compose:
   `docker compose -f docker-compose.prod.yml up -d nginx`
2. Attempt an HTTPS request against the edge proxy:
   `curl -vk https://localhost/health`
3. Result:
   `curl: (35) error:0A000410:SSL routines::sslv3 alert handshake failure` or connection reset, as port 443 is open at the Docker layer but Nginx has no SSL listener configured.

---

## 4. Impact

All HTTPS inbound traffic to the production cluster will fail immediately. Browsers and API clients enforcing secure transport (HSTS, TLS) will encounter connection resets or SSL handshake failures.

---

## 5. Recommended Remediation

1. Add SSL certificate volumes (or Let's Encrypt / Certbot integration) in `docker-compose.prod.yml`:
   ```yaml
   volumes:
     - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
     - ./certs:/etc/nginx/certs:ro
   ```
2. Configure a dedicated HTTPS server block in `nginx.prod.conf` with HTTP-to-HTTPS redirect:
   ```nginx
   server {
     listen 80;
     server_name _;
     return 301 https://$host$request_uri;
   }

   server {
     listen 443 ssl;
     server_name _;

     ssl_certificate /etc/nginx/certs/fullchain.pem;
     ssl_certificate_key /etc/nginx/certs/privkey.pem;
     ssl_protocols TLSv1.2 TLSv1.3;
     ssl_ciphers HIGH:!aNULL:!MD5;

     location /api/ { proxy_pass http://server_upstream; ... }
     location /ws { proxy_pass http://server_upstream; ... }
     location /health { proxy_pass http://server_upstream; ... }
     location / { proxy_pass http://client_upstream; ... }
   }
   ```
