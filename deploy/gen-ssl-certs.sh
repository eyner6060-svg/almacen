#!/bin/bash
set -euo pipefail

DOMAIN="${1:-dtel-almacen.local}"
SSL_DIR="$(dirname "$0")/../ssl"
mkdir -p "$SSL_DIR"

echo "Generando certificado SSL autofirmado para: $DOMAIN"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=PE/ST=Lima/L=Lima/O=DTEL/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:38.252.209.72,IP:192.168.11.30"

echo ""
echo "Certificados generados en:"
echo "  $SSL_DIR/cert.pem"
echo "  $SSL_DIR/key.pem"
echo ""
echo "Luego reemplace nginx.conf por el que incluye SSL"
echo "  cp deploy/nginx.deploy.conf nginx.conf  (solo HTTP, para probar)"
echo "  cp nginx.conf.bak nginx.conf            (con SSL, requiere certs)"
