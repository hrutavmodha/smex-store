#!/usr/bin/env bash
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../certs" && pwd)"

mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/fullchain.pem" ] && [ -f "$CERTS_DIR/privkey.pem" ]; then
  echo "TLS certificates already exist in $CERTS_DIR."
  exit 0
fi

echo "Generating self-signed staging/dev TLS certificates for localhost & smexstore.com in $CERTS_DIR..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out "$CERTS_DIR/fullchain.pem" \
  -subj "/CN=smexstore.com/O=Smex Store/C=US" \
  -addext "subjectAltName=DNS:smexstore.com,DNS:localhost,IP:127.0.0.1"

chmod 600 "$CERTS_DIR/privkey.pem"
chmod 644 "$CERTS_DIR/fullchain.pem"

echo "Certificates successfully generated at $CERTS_DIR."
