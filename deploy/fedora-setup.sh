#!/bin/bash
# ============================================================
# Script de instalación para Fedora - Sistema de Gestión de Almacén
# ============================================================
# Uso: sudo bash fedora-setup.sh [--domain ejemplo.com] [--email admin@ejemplo.com]
#
# Requisitos:
#   - Fedora 39+ (server)
#   - Ejecutar como root o con sudo
#   - Git (para clonar el repositorio)
# ============================================================
set -euo pipefail

# Colores para output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ------------------------------------------------------------
# Parseo de argumentos
# ------------------------------------------------------------
DOMAIN=""
EMAIL=""
REPO_URL=""
APP_DIR="/opt/almacen"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)    DOMAIN="$2";    shift 2 ;;
    --email)     EMAIL="$2";     shift 2 ;;
    --repo)      REPO_URL="$2";  shift 2 ;;
    --dir)       APP_DIR="$2";   shift 2 ;;
    --help|-h)   echo "Uso: $0 [--domain DOMINIO] [--email EMAIL] [--repo URL] [--dir RUTA]"; exit 0 ;;
    *)           err "Argumento desconocido: $1. Use --help para ayuda." ;;
  esac
done

if [ "$EUID" -ne 0 ]; then err "Este script debe ejecutarse como root o con sudo."; fi

# ------------------------------------------------------------
# 1. Verificar versión de Fedora
# ------------------------------------------------------------
FEDORA_VERSION=$(rpm -E %fedora)
log "Fedora $FEDORA_VERSION detectada"

# ------------------------------------------------------------
# 2. Actualizar sistema e instalar dependencias
# ------------------------------------------------------------
log "Actualizando sistema..."
dnf upgrade -y

log "Instalando Docker, Compose V2 y herramientas..."
dnf install -y dnf-plugins-core git curl wget policycoreutils-python-utils

dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

log "Habilitando e iniciando Docker..."
systemctl enable --now docker

# ------------------------------------------------------------
# 3. Firewall - firewalld
# ------------------------------------------------------------
log "Configurando firewalld..."
systemctl enable --now firewalld

firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# ------------------------------------------------------------
# 4. SELinux - contexto para el directorio de la aplicación
# ------------------------------------------------------------
log "Configurando SELinux..."
mkdir -p "$APP_DIR"
semanage fcontext -a -t container_file_t "$APP_DIR(/.*)?"
restorecon -Rv "$APP_DIR"

# ------------------------------------------------------------
# 5. Clonar o copiar repositorio
# ------------------------------------------------------------
if [ -n "$REPO_URL" ]; then
  log "Clonando repositorio desde $REPO_URL ..."
  if [ -d "$APP_DIR/.git" ]; then
    warn "El directorio $APP_DIR ya existe. Saltando clonado."
  else
    git clone "$REPO_URL" "$APP_DIR"
  fi
else
  warn "No se especificó --repo. Copie manualmente los archivos a $APP_DIR"
  warn "Ejemplo: rsync -avz ./ $APP_DIR/"
fi

cd "$APP_DIR"

# ------------------------------------------------------------
# 6. Archivo .env
# ------------------------------------------------------------
if [ ! -f "$APP_DIR/.env" ]; then
  log "Creando .env desde .env.example..."
  cp .env.example .env
  warn "EDITE .env con sus valores reales antes de iniciar:"
  warn "  - SESSION_SECRET, ENCRYPTION_KEY (generar con openssl)"
  warn "  - POSTGRES_PASSWORD, REDIS_PASSWORD"
  warn "  - NEXT_PUBLIC_APP_URL"
else
  log ".env ya existe."
fi

# ------------------------------------------------------------
# 7. Certificados SSL (Let's Encrypt) - si se especificó dominio
# ------------------------------------------------------------
if [ -n "$DOMAIN" ] && [ -n "$EMAIL" ]; then
  log "Instalando certbot para SSL..."
  dnf install -y certbot python3-certbot-nginx

  mkdir -p "$APP_DIR/ssl"

  if [ ! -f "$APP_DIR/ssl/cert.pem" ]; then
    log "Obteniendo certificado SSL para $DOMAIN ..."
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
      cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$APP_DIR/ssl/cert.pem"
      cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem"   "$APP_DIR/ssl/key.pem"
      log "Certificados copiados a $APP_DIR/ssl/"

      # Renovación automática vía systemd
      cat > /etc/systemd/system/almacen-certbot-renew.service << 'EOF'
[Unit]
Description=Renovar certificados Let's Encrypt para Almacén

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/almacen/ssl/cert.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/almacen/ssl/key.pem && systemctl reload almacen"
EOF

      cat > /etc/systemd/system/almacen-certbot-renew.timer << 'EOF'
[Unit]
Description=Renovar certificados SSL cada mes

[Timer]
OnCalendar=monthly
Persistent=true

[Install]
WantedBy=timers.target
EOF

      systemctl daemon-reload
      systemctl enable --now almacen-certbot-renew.timer
      log "Renovación automática de SSL configurada."
    else
      warn "No se encontraron los certificados. Revise certbot."
    fi
  else
    log "Certificados SSL ya existen en $APP_DIR/ssl/"
  fi
fi

# ------------------------------------------------------------
# 8. Instalar systemd service
# ------------------------------------------------------------
log "Instalando servicio systemd..."
cp "$APP_DIR/deploy/almacen.service" /etc/systemd/system/almacen.service
systemctl daemon-reload
systemctl enable almacen.service

# ------------------------------------------------------------
# 9. Resumen final
# ------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Instalación completada exitosamente${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Directorio:       $APP_DIR"
echo "  Para iniciar:     sudo systemctl start almacen"
echo "  Para detener:     sudo systemctl stop almacen"
echo "  Para ver logs:    journalctl -u almacen -f"
echo ""
echo "  Configuración pendiente:"
echo "    1. Editar $APP_DIR/.env con valores reales"
echo "    2. Ejecutar: sudo systemctl start almacen"
echo ""

if [ -n "$DOMAIN" ]; then
  echo "  Acceder via:    https://$DOMAIN"
else
  echo "  Acceder via:    http://<IP_DEL_SERVIDOR>:3000"
fi
echo ""
