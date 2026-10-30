#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "   Smex Store Production Deployment     "
echo "========================================="

# 1. Resolve Project Root Directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 2. Host IP or Domain (configurable via HOST_IP env var, defaults to 45.195.129.92)
TARGET_HOST="${HOST_IP:-45.195.129.92}"

# 3. Setup .env file if it does not exist
if [ ! -f .env ]; then
  echo "[-] .env not found. Generating production .env for host: ${TARGET_HOST}..."
  
  PG_PASS=$(openssl rand -hex 16)
  JWT_S=$(openssl rand -hex 32)
  JWT_RS=$(openssl rand -hex 32)
  MINIO_PASS=$(openssl rand -hex 16)

  cat << EOF > .env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Server Host / IP Configuration (Change this if IP or domain changes in future)
HOST_IP=${TARGET_HOST}

POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgres://postgres:${PG_PASS}@postgres:5432/smex_store

REDIS_URL=redis://redis:6379

JWT_SECRET=${JWT_S}
JWT_REFRESH_SECRET=${JWT_RS}

CORS_ORIGIN=https://${TARGET_HOST},http://${TARGET_HOST}
CLIENT_URL=https://${TARGET_HOST}
COOKIE_SECURE=false

MINIO_ROOT_USER=smexadmin
MINIO_ROOT_PASSWORD=${MINIO_PASS}
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_ENDPOINT=https://${TARGET_HOST}
S3_REGION=auto
S3_BUCKET=smex-storage
S3_ACCESS_KEY_ID=smexadmin
S3_SECRET_ACCESS_KEY=${MINIO_PASS}

PROD_PUBLIC_API_URL=
PROD_PUBLIC_WS_URL=

SERVER_IMAGE=smex-server:local
CLIENT_IMAGE=smex-client:local
EOF
  echo "[+] .env generated successfully with HOST_IP=${TARGET_HOST}."
else
  echo "[*] Existing .env file found. Preserving current secrets and configuration."
fi

# 4. Ensure certificates exist
if [ ! -f certs/fullchain.pem ] || [ ! -f certs/privkey.pem ]; then
  echo "[!] SSL certificates missing in certs/. Generating self-signed certificates for ${TARGET_HOST}..."
  mkdir -p certs
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout certs/privkey.pem \
    -out certs/fullchain.pem \
    -subj "/CN=${TARGET_HOST}"
fi

# 5. Build containers sequentially to prevent 1GB RAM OOM thrashing
echo "[-] Building server container..."
docker compose -f docker-compose.prod.yml build server

echo "[-] Building client container..."
docker compose -f docker-compose.prod.yml build client

# 6. Launch all production services
echo "[-] Launching production containers..."
docker compose -f docker-compose.prod.yml up -d

# 7. Display container status
echo ""
echo "========================================="
echo "   Deployment Completed! Status:         "
echo "========================================="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "App is live at: https://${TARGET_HOST}"
echo "(If using self-signed SSL, accept the browser warning to proceed)"
