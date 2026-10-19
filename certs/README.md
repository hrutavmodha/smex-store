# TLS Certificates for Smex Store Nginx Proxy

Nginx (`nginx.prod.conf`) expects:
- `/etc/nginx/certs/fullchain.pem`: Full certificate chain
- `/etc/nginx/certs/privkey.pem`: Private key

## Development & Staging
To generate self-signed certificates for local testing with Nginx:
```bash
./scripts/generate-certs.sh
```

## Production Provisioning
For production deployments, mount certificates provisioned by Certbot (Let's Encrypt), Cloudflare Origin CA, or AWS ACM:
1. Ensure `fullchain.pem` and `privkey.pem` are placed in this directory or mounted into `/etc/nginx/certs/` inside the container.
2. Ensure file permissions restrict access to `privkey.pem` (`chmod 600`).
