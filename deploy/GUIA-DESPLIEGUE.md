# GUÍA DE DESPLIEGUE — Sistema de Gestión de Almacén

> **Plataforma:** Fedora + Docker + Portainer  
> **Aplicación:** Next.js (Sistema de Gestión de Almacén)  
> **Red:** 192.168.11.0/24 — IP Pública: 38.252.209.72  
> **Idioma:** Español (Perú)  
> **Versión del documento:** 1.0

---

## Índice

1. [Arquitectura del Sistema](#1-arquitectura-del-sistema)
2. [Requisitos Previos](#2-requisitos-previos)
3. [Preparación del Servidor](#3-preparación-del-servidor)
4. [Despliegue en Portainer](#4-despliegue-en-portainer)
5. [Configuración del Router (Port Forwarding)](#5-configuración-del-router-port-forwarding)
6. [Verificación](#6-verificación)
7. [Configuración de Dominio (Posterior)](#7-configuración-de-dominio-posterior)
8. [Solución de Problemas](#8-solución-de-problemas)
9. [Mantenimiento](#9-mantenimiento)

---

## 1. ARQUITECTURA DEL SISTEMA

### 1.1 Diagrama de Arquitectura

```
                         INTERNET
                            |
                     (Puertos 80, 443)
                            |
                     [ROUTER / FIREWALL]
                     (Port Forwarding)
                            |
                     ~~~~~~~~~~~~~~~~~~~
                     |   RED LOCAL      |
                     | 192.168.11.0/24  |
                     ~~~~~~~~~~~~~~~~~~~
                            |
                     ~~~~~~~~~~~~~~~~~~~
                     |  FEDORA SERVER   |
                     | 192.168.11.30    |
                     ~~~~~~~~~~~~~~~~~~~
                            |
                    [Portainer:9000]
                    [Cockpit:9090]
                            |
                     ~~~~~~~~~~~~~~~~~~~
                     |  DOCKER STACK    |
                     |   "almacen"      |
                     ~~~~~~~~~~~~~~~~~~~
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
  +-------------+   +-------------+   +---------------------+
  | postgres:16 |   |   redis:7   |   |   almacen-app      |
  | (db)        |   | (cache)     |   |   (Next.js :3000)  |
  | :5432       |   | :6379       |   |   privado           |
  +-------------+   +-------------+   +----------+----------+
        |                   |                      |
        +-------------------+----------------------+
                            |
                     +------+------+
                     |   nginx     |
                     | (reverso)   |
                     | :80 / :443  |
                     +-------------+
                            |
                     (HTTP/HTTPS público)
```

### 1.2 Descripción de Contenedores

| Contenedor       | Imagen              | Puerto Interno | Puerto Expuesto | Propósito                                       |
|------------------|---------------------|----------------|-----------------|-------------------------------------------------|
| `postgres`       | postgres:16-alpine  | 5432           | 127.0.0.1:5432  | Base de datos relacional (PostgreSQL)           |
| `redis`          | redis:7-alpine      | 6379           | 127.0.0.1:6379  | Caché, sesiones, rate-limiting                  |
| `almacen-app`    | (build local)       | 3000           | 127.0.0.1:3000  | Aplicación Next.js + API REST                   |
| `nginx`          | nginx:alpine        | 80 / 443       | 0.0.0.0:80/443  | Proxy inverso, SSL, rate-limiting, caché        |

Los puertos de `postgres`, `redis` y `almacen-app` están vinculados solo a `127.0.0.1` por seguridad — solo nginx (que corre en el mismo stack) puede alcanzarlos. Nginx sí expone los puertos 80 y 443 a toda la red (y por extensión a Internet vía port forwarding).

---

## 2. REQUISITOS PREVIOS

Antes de iniciar, asegúrese de contar con lo siguiente:

- **Portainer funcionando** en `http://192.168.11.30:9000`
  - Credenciales: `dtel` / (contraseña configurada durante instalación de Portainer)
- **Acceso SSH root** al servidor Fedora (IP privada: `192.168.11.30`)
- **Git instalado** en el servidor (si no, se instalará en el paso 3)
- **Puertos 80 y 443 disponibles** en el servidor (sin conflictos con otros servicios)
- **Acceso al router** para configurar port forwarding (usualmente en `http://192.168.11.1`)
- **Cliente SSH** (PuTTY en Windows, terminal en Linux/macOS)

---

## 3. PREPARACIÓN DEL SERVIDOR

> Todos los comandos de esta sección se ejecutan **vía SSH** como root.

### 3.1 Acceder al Servidor por SSH

```bash
ssh root@192.168.11.30
```

Si es la primera vez que se conecta, acepte la huella del servidor cuando se le solicite.

### 3.2 Instalar Git (si no está instalado)

```bash
dnf install -y git
```

Verifique la instalación:

```bash
git --version
```

### 3.3 Clonar el Proyecto

```bash
# Crear directorio de aplicaciones
mkdir -p /opt/almacen

# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO> /opt/almacen

# Alternativa: si tiene los archivos localmente, use scp o rsync
# rsync -avz ./ /opt/almacen/
```

### 3.4 Abrir Puertos en el Firewall (firewalld)

```bash
# Verificar estado de firewalld
systemctl status firewalld

# Si no está activo, iniciarlo:
systemctl enable --now firewalld

# Abrir puertos HTTP y HTTPS
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh

# Recargar configuración
firewall-cmd --reload

# Verificar reglas activas
firewall-cmd --list-all
```

> **⚠️ Advertencia:** Abrir puertos expone el servidor a Internet. Asegúrese de tener contraseñas seguras y mantener el sistema actualizado.

### 3.5 Configurar SELinux (si aplica)

```bash
# Aplicar contexto de contenedor al directorio de la app
semanage fcontext -a -t container_file_t "/opt/almacen(/.*)?"
restorecon -Rv /opt/almacen
```

> Si el comando `semanage` no está disponible, instale `policycoreutils-python-utils`:
> ```bash
> dnf install -y policycoreutils-python-utils
> ```

### 3.6 Generar Certificados SSL Autofirmados (para pruebas)

```bash
cd /opt/almacen

# Ejecutar el script generador
bash deploy/gen-ssl-certs.sh
```

Esto generará los archivos `ssl/cert.pem` y `ssl/key.pem`. Por defecto usa `dtel-almacen.local` como dominio.

> **Nota:** Los certificados autofirmados servirán para probar HTTPS localmente. Más adelante (sección 7) se explica cómo obtener certificados reales con Let's Encrypt.

### 3.7 Preparar nginx.conf

Para la primera prueba usaremos la configuración **solo HTTP**:

```bash
cd /opt/almacen

# Respaldar nginx.conf original (con SSL)
cp nginx.conf nginx.conf.bak

# Copiar la versión HTTP
cp deploy/nginx.deploy.conf nginx.conf
```

> Más adelante, cuando tenga certificados reales, restaurará el `nginx.conf.bak` o copiará la versión con SSL.

### 3.8 Crear y Configurar Archivo .env

```bash
cd /opt/almacen

# Copiar desde ejemplo si no existe
cp .env.example .env

# Editar con los valores de producción
nano .env
```

Configure las siguientes variables (use valores seguros, **no** los del ejemplo):

```bash
# ===========================================
# VALORES DE PRODUCCIÓN - COMPLETAR
# ===========================================

# BASE DE DATOS
POSTGRES_USER=dtel
POSTGRES_PASSWORD=[GENERAR_CONTRASEÑA_SEGURA_30+_CARACTERES]

# REDIS
REDIS_PASSWORD=[GENERAR_CONTRASEÑA_SEGURA_30+_CARACTERES]

# SEGURIDAD - Usar openssl para generar
SESSION_SECRET=[EJECUTAR: openssl rand -base64 32]
ENCRYPTION_KEY=[EJECUTAR: openssl rand -hex 32]

# ENTORNO
NODE_ENV=production
ALLOW_DEV_ENCRYPTION=false

# APLICACIÓN
NEXT_PUBLIC_APP_URL=http://38.252.209.72
```

Comandos para generar las claves:

```bash
# Generar SESSION_SECRET (ejecutar en SSH)
openssl rand -base64 32

# Generar ENCRYPTION_KEY (ejecutar en SSH)
openssl rand -hex 32
```

Copie los resultados y péguelos en el archivo `.env`.

**DATABASE_URL** se construye automáticamente en el stack de Portainer (no necesita editarla en `.env` si usa Portainer, pero para referencia el formato es):

```
DATABASE_URL=postgresql://dtel:[TU_CONTRASEÑA]@postgres:5432/almacen_db?schema=public
```

> **⚠️ ADVERTENCIA CRÍTICA:**  
> - `SESSION_SECRET` y `ENCRYPTION_KEY` deben ser únicas y secretas.  
> - `ENCRYPTION_KEY` debe tener exactamente 64 caracteres hex.  
> - No use `ALLOW_DEV_ENCRYPTION=true` en producción.  
> - Guarde una copia de seguridad de estas claves en un gestor de contraseñas.

---

## 4. DESPLIEGUE EN PORTAINER

> Toda esta sección se realiza desde un navegador web apuntando a **http://192.168.11.30:9000**.

### 4.1 Ingresar a Portainer

1. Abra su navegador y vaya a `http://192.168.11.30:9000`
2. Ingrese las credenciales:
   - **Usuario:** `dtel`
   - **Contraseña:** (la que configuró al instalar Portainer)
3. Seleccione el **entorno local** (generalmente aparece como "Primary" o "local")

![Portainer Login](https://docs.portainer.io/images/login.png)
*(Imagen referencial — la pantalla real puede variar ligeramente)*

### 4.2 Crear un Nuevo Stack

1. En el menú izquierdo, haga clic en **Stacks**
2. Haga clic en el botón azul **"+ Add stack"**
3. Complete los campos:
   - **Name:** `almacen`
   - **Build method:** seleccione **"Web editor"**

### 4.3 Copiar el Stack YML

En el editor web, **copie y pegue** el siguiente contenido:

```yaml
# ============================================================
# Portainer Stack - Sistema de Gestión de Almacén
# ============================================================
services:
  postgres:
    image: postgres:16-alpine
    container_name: almacen-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: almacen_db
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d almacen_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks:
      - almacen-network

  redis:
    image: redis:7-alpine
    container_name: almacen-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - almacen-network

  almacen-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sistema-almacen
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/almacen_db?schema=public
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      NEXT_PUBLIC_APP_URL: ${APP_URL}
      NEXT_TELEMETRY_DISABLED: 1
    volumes:
      - almacen-uploads:/app/public/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/config"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - almacen-network

  nginx:
    image: nginx:alpine
    container_name: almacen-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ssl-certs:/etc/nginx/ssl:ro
    depends_on:
      - almacen-app
    networks:
      - almacen-network

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  almacen-uploads:
    driver: local
  ssl-certs:
    driver: local

networks:
  almacen-network:
    driver: bridge
```

### 4.4 Configurar Variables de Entorno

En la sección **"Environment variables"** (debajo del editor), agregue las siguientes variables **una por una** haciendo clic en **"Add environment variable"**:

| Variable            | Valor                                                         | ¿Cómo generarlo?                          |
|---------------------|---------------------------------------------------------------|-------------------------------------------|
| `POSTGRES_USER`     | `dtel`                                                        | Fijo                                      |
| `POSTGRES_PASSWORD` | `[TU_CONTRASEÑA_SEGURA]`                                      | Genere una contraseña de >30 caracteres   |
| `REDIS_PASSWORD`    | `[TU_CONTRASEÑA_SEGURA]`                                      | Genere una contraseña de >30 caracteres   |
| `SESSION_SECRET`    | `[RESULTADO_DE_openssl_rand_base64_32]`                       | `openssl rand -base64 32`                 |
| `ENCRYPTION_KEY`    | `[RESULTADO_DE_openssl_rand_hex_32]`                          | `openssl rand -hex 32`                    |
| `APP_URL`           | `http://38.252.209.72`                                        | URL pública del sistema                   |

> **IMPORTANTE:**  
> - `SESSION_SECRET` debe tener **44 caracteres** (base64).  
> - `ENCRYPTION_KEY` debe tener **64 caracteres** (hexadecimal, 32 bytes).  
> - `POSTGRES_PASSWORD` y `REDIS_PASSWORD` no deben contener caracteres que requieran URL-encoding (evite `@`, `:`, `%`, `#`, etc.). Use solo letras, números y guiones.

### 4.5 Desplegar el Stack

1. Revise que todas las variables estén correctamente llenadas
2. Haga clic en el botón azul **"Deploy the stack"** en la parte inferior

![Deploy stack](https://docs.portainer.io/images/deploy_stack.png)
*(Imagen referencial)*

### 4.6 Progreso del Despliegue

El despliegue tomará aproximadamente **3 a 5 minutos** la primera vez, porque Portainer construirá la imagen Docker de la aplicación (multi-stage build).

**¿Qué sucede durante este tiempo?**

1. **Portainer construye la imagen** de `almacen-app` usando el `Dockerfile` del proyecto
   - Etapa 1: Instala dependencias (pnpm install)
   - Etapa 2: Compila la aplicación (pnpm run build)
   - Etapa 3: Crea la imagen final (solo lo necesario)
2. **Descarga las imágenes base:** `postgres:16-alpine`, `redis:7-alpine`, `nginx:alpine`
3. **Inicia los contenedores** en orden (postgres → redis → app → nginx)
4. **Ejecuta healthchecks** para verificar que todo funcione

> **Consejo:** Si el despliegue falla, vaya a **Containers** → seleccione `sistema-almacen` → haga clic en **Logs** para ver el error exacto.

### 4.7 Verificar Logs en Portainer

Para monitorear los logs en tiempo real desde Portainer:

1. **Menú izquierdo** → **Containers**
2. Haga clic en el nombre del contenedor (ej. `sistema-almacen`)
3. Vaya a la pestaña **"Logs"**
4 Seleccione "Fetch" o "Auto refresh"

También puede ver logs vía SSH:

```bash
# Logs de todos los contenedores del stack
docker logs sistema-almacen -f
docker logs almacen-nginx
docker logs almacen-postgres
docker logs almacen-redis
```

---

## 5. CONFIGURACIÓN DEL ROUTER (PORT FORWARDING)

Para que el sistema sea accesible desde Internet (IP pública `38.252.209.72`), debe configurar **port forwarding** en el router.

### 5.1 Acceder al Router

1. Abra un navegador y vaya a `http://192.168.11.1` (la puerta de enlace predeterminada)
2. Ingrese las credenciales del router (usuario y contraseña del administrador de red)

### 5.2 Encontrar la Configuración de Port Forwarding

Busque una sección con alguno de estos nombres:
- **Port Forwarding**
- **Virtual Server**
- **NAT / Port Forwarding**
- **Advanced → NAT → Port Forwarding**

### 5.3 Agregar las Reglas

Agregue **dos reglas**:

| # | nombre/servicio  | Puerto Externo | IP Interna      | Puerto Interno | Protocolo |
|---|------------------|----------------|-----------------|----------------|-----------|
| 1 | `HTTP-Almacen`   | 80             | 192.168.11.30   | 80             | TCP       |
| 2 | `HTTPS-Almacen`  | 443            | 192.168.11.30   | 443            | TCP       |

### 5.4 Guardar y Aplicar

1. Guarde los cambios
2. Reinicie el router si es necesario (algunos modelos requieren reinicio)
3. Verifique que las reglas estén activas

### 5.5 Nota sobre Hairpin NAT

> **Hairpin NAT (o NAT loopback):** Desde dispositivos dentro de la misma red local (192.168.11.x), no podrá acceder al sistema usando la IP pública `38.252.209.72`. Esto es normal. Para probar desde la misma red, use la IP privada `http://192.168.11.30`. Para probar el acceso desde Internet, desconéctese del WiFi y use datos móviles (4G).

---

## 6. VERIFICACIÓN

### 6.1 Probar desde Fuera de la Red (4G/celular)

Desconéctese del WiFi y active los datos móviles:

```bash
# Desde el navegador del celular:
http://38.252.209.72
```

> Debería ver la página de login del Sistema de Gestión de Almacén.

### 6.2 Probar desde Dentro de la Red

```bash
# Desde cualquier PC en la red local:
http://192.168.11.30
```

### 6.3 Verificar Contenedores vía SSH

```bash
# Listar contenedores del stack
docker ps | grep almacen

# Ejemplo de salida esperada (4 contenedores RUNNING):
# CONTAINER ID   IMAGE                   STATUS         PORTS                    NAMES
# abc123...      nginx:alpine            Up 2 minutes   0.0.0.0:80->80/tcp,...   almacen-nginx
# def456...      almacen_app:latest      Up 3 minutes   127.0.0.1:3000->3000...  sistema-almacen
# ghi789...      redis:7-alpine          Up 3 minutes   127.0.0.1:6379->6379...  almacen-redis
# jkl012...      postgres:16-alpine      Up 4 minutes   127.0.0.1:5432->5432...  almacen-postgres
```

### 6.4 Verificar Puertos Abiertos

```bash
ss -tlnp | grep -E ':80|:443'

# Debería mostrar:
# LISTEN 0      128     0.0.0.0:80    0.0.0.0:*    users:(("docker-proxy",...))
# LISTEN 0      128     0.0.0.0:443   0.0.0.0:*    users:(("docker-proxy",...))
```

### 6.5 Verificar Logs de la Aplicación

```bash
docker logs sistema-almacen -f
```

Presione `Ctrl+C` para salir del modo follow.

---

## 7. CONFIGURACIÓN DE DOMINIO (POSTERIOR)

### 7.1 Opciones de Dominio Gratuito

Recomendaciones de servicios DNS dinámicos gratuitos:

| Servicio      | URL                                    | Ejemplo                     |
|---------------|----------------------------------------|-----------------------------|
| DuckDNS       | https://www.duckdns.org                | `dtel-almacen.duckdns.org`  |
| No-IP         | https://www.noip.com                   | `dtel-almacen.ddns.net`     |
| FreeDNS       | https://freedns.afraid.org             | (varios dominios)           |

### 7.2 Configurar DuckDNS (Recomendado)

1. Vaya a https://www.duckdns.org
2. Inicie sesión con su cuenta de Google, GitHub, Twitter o Reddit
3. Cree un nuevo subdominio: `dtel-almacen.duckdns.org`
4. Asigne la IP: `38.252.209.72`
5. DuckDNS le proporcionará un **token**. Guárdelo.
6. Opcional: configure un cronjob en el servidor para actualizar la IP automáticamente:

```bash
# Agregar al crontab (ejecutar cada 5 minutos)
echo "*/5 * * * * curl -s 'https://www.duckdns.org/update?domains=dtel-almacen&token=TU_TOKEN&ip='" | crontab -
```

### 7.3 Obtener Certificado SSL Real (Let's Encrypt)

Una vez que tenga el dominio configurado y apuntando a `38.252.209.72`:

```bash
# Instalar certbot
dnf install -y certbot python3-certbot-nginx

# Detener nginx temporalmente (certbot necesita puerto 80)
docker stop almacen-nginx

# Obtener certificado real
certbot certonly --standalone -d dtel-almacen.duckdns.org --non-interactive --agree-tos -m tu-email@ejemplo.com

# Copiar certificados al directorio del proyecto
cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/fullchain.pem /opt/almacen/ssl/cert.pem
cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/privkey.pem /opt/almacen/ssl/key.pem

# Reiniciar nginx
docker start almacen-nginx
```

### 7.4 Reemplazar nginx.conf con SSL

```bash
cd /opt/almacen

# Restaurar la versión con SSL
cp nginx.conf.bak nginx.conf
```

### 7.5 Actualizar APP_URL y Redeploy

1. Vaya a Portainer → **Stacks** → `almacen` → **"Editor"**
2. Cambie la variable `APP_URL`:
   - De: `http://38.252.209.72`
   - A: `https://dtel-almacen.duckdns.org`
3. Haga clic en **"Update the stack"** o **"Deploy"**
4. Confirme el redeploy

### 7.6 Configurar Renovación Automática de SSL

```bash
# Probar renovación
certbot renew --dry-run

# certbot agrega automáticamente un timer systemd
# Verifique con:
systemctl list-timers | grep certbot
```

---

## 8. SOLUCIÓN DE PROBLEMAS

### 8.1 "No se puede acceder al puerto 80/443"

Posibles causas y soluciones:

| Causa                     | Solución                                                                  |
|---------------------------|---------------------------------------------------------------------------|
| Firewall cerrado          | `firewall-cmd --permanent --add-service=http --add-service=https; firewall-cmd --reload` |
| Nginx no iniciado         | `docker ps | grep nginx` — si no aparece, revise logs: `docker logs almacen-nginx` |
| Port Forwarding incorrecto | Revise las reglas en el router (sección 5)                               |
| Puerto ocupado            | `ss -tlnp | grep -E ':80|:443'` para ver qué proceso lo ocupa            |
| Docker no iniciado        | `systemctl status docker; systemctl enable --now docker`                  |

### 8.2 "Error 502 Bad Gateway"

El navegador muestra "502 Bad Gateway" o "502 Bad Gateway nginx".

**Causa:** Nginx está funcionando pero no puede comunicarse con la aplicación (`sistema-almacen`).

**Solución:**

```bash
# 1. Verificar que la app esté corriendo
docker ps | grep sistema-almacen

# 2. Revisar logs de la app
docker logs sistema-almacen

# 3. La app puede estar todavía iniciando (esperar 30s más)
# 4. Forzar reinicio de la app
docker restart sistema-almacen
```

### 8.3 "Error de conexión a Base de Datos"

**Causa:** Variables de entorno incorrectas o postgres no saludable.

**Solución:**

```bash
# 1. Verificar que postgres esté funcionando
docker ps | grep almacen-postgres

# 2. Revisar logs de postgres
docker logs almacen-postgres

# 3. Verificar DATABASE_URL en Portainer (debe coincidir con POSTGRES_USER/PASSWORD)
#    Formato correcto:
#    postgresql://[USER]:[PASS]@postgres:5432/almacen_db?schema=public

# 4. Forzar reinicio
docker restart almacen-postgres
docker restart sistema-almacen
```

### 8.4 "SSL certificate error"

**Causa:** Certificados no generados o no montados correctamente.

**Solución:**

```bash
# 1. Verificar que existan los certificados
ls -la /opt/almacen/ssl/

# 2. Si no existen, generarlos
bash /opt/almacen/deploy/gen-ssl-certs.sh

# Si persiste, use solo HTTP:
cp /opt/almacen/deploy/nginx.deploy.conf /opt/almacen/nginx.conf
docker restart almacen-nginx
```

### 8.5 "Container always restarting"

**Causa:** El contenedor inicia y se detiene cíclicamente.

**Solución:**

```bash
# Ver el error exacto
docker logs <nombre_del_contenedor>

# Causas comunes:
# - postgres: permisos del volumen, puerto ocupado
# - redis: contraseña inválida
# - almacen-app: error de compilación, migración fallida
# - nginx: nginx.conf con errores sintácticos

# Verificar sintaxis de nginx
docker exec almacen-nginx nginx -t
```

### 8.6 "Build failed" en Portainer

**Causa:** Error durante la construcción de la imagen Docker.

**Solución:**

```bash
# 1. Ir a Portainer → Images → ver si hay build logs
# 2. O construir manualmente para ver el error exacto
cd /opt/almacen
docker build -t almacen-app:test -f Dockerfile .
```

Errores comunes:
- `pnpm-lock.yaml` desactualizado → ejecutar `pnpm install` localmente y commit
- Falta de memoria RAM durante el build → verificar con `free -h`
- `permission denied` en scripts → `chmod +x docker-entrypoint.sh`

---

## 9. MANTENIMIENTO

### 9.1 Actualizar el Sistema a Nueva Versión

```bash
# 1. SSH al servidor
ssh root@192.168.11.30

# 2. Ir al directorio del proyecto
cd /opt/almacen

# 3. Obtener los últimos cambios
git pull origin main

# 4. Ir a Portainer → Stacks → almacen → "Editor"
# 5. Haga clic en "Deploy" (sin modificar nada, redeploya con los nuevos archivos)
```

> Portainer reconstruirá la imagen automáticamente y reiniciará los contenedores.

### 9.2 Ver Logs

**Desde Portainer (recomendado):**
1. Contenedores → `sistema-almacen` → Logs
2. Use "Auto refresh" para ver en tiempo real

**Desde SSH:**

```bash
# Todos los logs
docker logs sistema-almacen -f

# Últimas 50 líneas
docker logs --tail 50 sistema-almacen

# Filtrar por palabra clave
docker logs sistema-almacen 2>&1 | grep -i error

# Logs de nginx
docker logs almacen-nginx -f
```

### 9.3 Backup de Base de Datos

```bash
# Backup completo (ejecutar vía SSH)
docker exec almacen-postgres pg_dump -U dtel almacen_db > /opt/almacen/backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
cat backup.sql | docker exec -i almacen-postgres psql -U dtel almacen_db

# Backup automático (cron diario)
echo "0 3 * * * root docker exec almacen-postgres pg_dump -U dtel almacen_db > /opt/almacen/backups/backup_$(date +\%Y\%m\%d).sql" > /etc/cron.d/almacen-backup
```

### 9.4 Ver Espacio en Disco

```bash
# Espacio usado por Docker
docker system df

# Espacio de volúmenes individuales
docker system df -v

# Espacio total del servidor
df -h

# Limpiar imágenes no usadas (cuidado: también limpia cachés)
docker system prune -af
```

### 9.5 Reiniciar el Stack Completo

Desde Portainer:
1. Stacks → `almacen` → **"Stop"**
2. Stacks → `almacen` → **"Start"**

O desde SSH:

```bash
# Detener todos los contenedores
docker stop almacen-nginx sistema-almacen almacen-redis almacen-postgres

# Iniciar de nuevo
docker start almacen-postgres almacen-redis sistema-almacen almacen-nginx

# Verificar estado
docker ps | grep almacen
```

---

## APÉNDICE A: Comandos Rápidos

| Acción                                 | Comando                                                        |
|----------------------------------------|----------------------------------------------------------------|
| Ver contenedores activos               | `docker ps \| grep almacen`                                      |
| Ver logs de la app                     | `docker logs sistema-almacen -f`                               |
| Ver logs de nginx                      | `docker logs almacen-nginx -f`                                 |
| Ver logs de postgres                   | `docker logs almacen-postgres`                                 |
| Ver logs de redis                      | `docker logs almacen-redis`                                    |
| Reiniciar contenedor                   | `docker restart sistema-almacen`                               |
| Ingresar al contenedor (bash)          | `docker exec -it sistema-almacen sh`                           |
| Backup de BD                           | `docker exec almacen-postgres pg_dump -U dtel almacen_db > backup.sql` |
| Ver puertos abiertos                   | `ss -tlnp \| grep -E ':80\|:443'`                               |
| Generar SESSION_SECRET                 | `openssl rand -base64 32`                                      |
| Generar ENCRYPTION_KEY                 | `openssl rand -hex 32`                                         |
| Abrir puerto en firewall               | `firewall-cmd --permanent --add-service=http; firewall-cmd --reload` |

---

## APÉNDICE B: Puertos y Servicios

| Puerto | Servicio   | ¿Externo? | Descripción                            |
|--------|------------|-----------|----------------------------------------|
| 22     | SSH        | No*       | Acceso remoto seguro al servidor       |
| 80     | HTTP       | Sí        | Tráfico web (redirecciona a HTTPS)     |
| 443    | HTTPS      | Sí        | Tráfico web seguro                     |
| 9000   | Portainer  | No        | Administración de contenedores Docker  |
| 9090   | Cockpit    | No        | Administración del servidor Fedora     |

* *Se recomienda NO exponer SSH a Internet. Use VPN o acceso desde la red local.*

---

## APÉNDICE C: Topología de Red

```
+------------------+          +------------------+          +------------------+
|   INTERNET       |          |   RED LOCAL       |          |   DOCKER         |
|   38.252.209.72  |          |   192.168.11.0/24 |          |   172.x.x.x      |
+--------+---------+          +--------+---------+          +--------+---------+
         |                             |                             |
         |   (80, 443)                 |                             |
         +---------> [ROUTER] -------->+-----> [FEDORA] ----> [PORTAINER STACK]
                                             192.168.11.30
```

---

## APÉNDICE D: Referencias

- **Portainer Docs:** https://docs.portainer.io
- **Docker Docs:** https://docs.docker.com
- **Next.js Deployment:** https://nextjs.org/docs/pages/building-your-application/deploying
- **Let's Encrypt:** https://letsencrypt.org
- **DuckDNS:** https://www.duckdns.org
- **Fedora Firewall:** https://docs.fedoraproject.org/en-US/quick-docs/firewalld

---

*Documento generado para el despliegue del Sistema de Gestión de Almacén — © DTEL*
