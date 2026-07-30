# GUÍA DE DESPLIEGUE — Sistema de Gestión de Almacén

> **Plataforma:** Fedora + Docker + Portainer  
> **Aplicación:** Next.js (Sistema de Gestión de Almacén)  
> **Red:** 192.168.11.0/24 — IP Pública: 38.252.209.72  
> **Idioma:** Español (Perú)  
> **Versión del documento:** 2.0  
> **Repositorio:** https://github.com/eyner6060-svg/almacen

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

### 3.3 Clonar el Proyecto desde GitHub

```bash
# Crear directorio de aplicaciones
mkdir -p /opt/almacen

# Clonar el repositorio
git clone https://github.com/eyner6060-svg/almacen /opt/almacen

# Ingresar al directorio
cd /opt/almacen
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

# Crear directorio para certificados
mkdir -p ssl

# Generar certificado autofirmado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=PE/ST=Lima/L=Lima/O=DTEL/CN=dtel-almacen.local" \
  -addext "subjectAltName=DNS:dtel-almacen.local,DNS:localhost,IP:38.252.209.72,IP:192.168.11.30"
```

Esto generará los archivos `ssl/cert.pem` y `ssl/key.pem`.

> **Nota:** Usamos HTTPS solo para la configuración inicial por simplicidad. Más adelante (sección 7) se explica cómo obtener certificados reales con Let's Encrypt.

### 3.7 Preparar nginx.conf (solo HTTP para empezar)

El repositorio trae dos configuraciones de nginx:
- `nginx.conf` — versión con SSL (requiere certificados)
- `deploy/nginx.deploy.conf` — versión solo HTTP (para probar sin SSL)

Para la primera prueba usaremos **solo HTTP**:

```bash
cd /opt/almacen

# Respaldar la versión con SSL
cp nginx.conf nginx.conf.ssl

# Copiar la versión HTTP como nginx.conf activo
cp deploy/nginx.deploy.conf nginx.conf
```

> Cuando tenga certificados reales, restaurará la versión SSL con:
> `cp nginx.conf.ssl nginx.conf`

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
   - **Contraseña:** `DTEL2025*DOCKER`
3. Seleccione el **entorno local** ("Primary" o "local")

### 4.2 Crear un Nuevo Stack (método Git)

> ⚠️ **Importante:** Use **Git** como método de build, no Web editor. Esto permite que Portainer clone el repositorio y use los archivos locales (`nginx.conf`, `Dockerfile`, etc.).

1. En el menú izquierdo, haga clic en **Stacks**
2. Haga clic en el botón azul **"+ Add stack"**
3. Complete los campos:

| Campo              | Valor                                              |
|--------------------|----------------------------------------------------|
| **Name**           | `almacen`                                          |
| **Build method**   | `Git`                                              |
| **Repository URL** | `https://github.com/eyner6060-svg/almacen`        |
| **Reference**      | `master`                                           |
| **Compose path**   | `docker-compose.yml` (o `deploy/portainer-stack.yml`) |

Deje **Authentication** desmarcado (el repositorio es público).

### 4.3 Elegir el archivo Compose

Tiene dos opciones:

| Archivo | Cuándo usarlo |
|---------|--------------|
| `docker-compose.yml` | Usa el `build` para construir la imagen desde el Dockerfile. Requiere que los archivos `nginx.conf` y `ssl/` estén en `/opt/almacen` del servidor. |
| `deploy/portainer-stack.yml` | Similar al anterior pero optimizado para Portainer (variables separadas explícitamente). |

Para empezar, use **`deploy/portainer-stack.yml`**.

### 4.4 Configurar Variables de Entorno

En la sección **"Environment variables"** (debajo del editor), agregue las siguientes variables **una por una**:

> 💡 Consejo: genere las claves desde SSH antes de llenar Portainer:
> ```bash
> ssh root@192.168.11.30
> # (contraseña)
> openssl rand -base64 32   # para SESSION_SECRET
> openssl rand -hex 32      # para ENCRYPTION_KEY
> ```

| Variable | Valor | ¿Cómo generarlo? |
|----------|-------|------------------|
| `POSTGRES_USER` | `dtel` | Fijo |
| `POSTGRES_PASSWORD` | `[TU_CONTRASEÑA_SEGURA]` | Use una contraseña fuerte (>20 caracteres) |
| `REDIS_PASSWORD` | `[TU_CONTRASEÑA_SEGURA]` | Use una contraseña fuerte (>20 caracteres) |
| `SESSION_SECRET` | `[RESULTADO_DE_openssl_rand_base64_32]` | `openssl rand -base64 32` (44 caracteres) |
| `ENCRYPTION_KEY` | `[RESULTADO_DE_openssl_rand_hex_32]` | `openssl rand -hex 32` (64 caracteres) |
| `APP_URL` | `http://38.252.209.72` | URL pública del sistema |

> ⚠️ **REGLA DE ORO:**  
> - `SESSION_SECRET` = 44 caracteres (base64)  
> - `ENCRYPTION_KEY` = 64 caracteres (hexadecimal)  
> - `POSTGRES_PASSWORD` y `REDIS_PASSWORD`: solo letras, números y guiones. **Evite** `@`, `:`, `%`, `#`, `&` porque rompen la URL de conexión.

### 4.5 Desplegar el Stack

1. Revise que las 6 variables estén correctamente llenadas
2. Haga clic en el botón azul **"Deploy the stack"**

El despliegue tomará **3 a 5 minutos** la primera vez:

1. **Portainer clona el repositorio** de GitHub
2. **Build de `almacen-app`** (multi-stage: instala dependencias, compila Next.js, crea imagen final)
3. **Descarga imágenes base:** `postgres:16-alpine`, `redis:7-alpine`, `nginx:alpine`
4. **Inicia contenedores** en orden: postgres → redis → app → nginx
5. **Healthchecks** verifican que todo funcione

### 4.6 Verificar Logs en Portainer

1. **Containers** → seleccione `sistema-almacen`
2. Pestaña **"Logs"** → "Auto refresh"

O desde SSH:

```bash
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
# CONTAINER ID   IMAGE                   STATUS         PORTS                          NAMES
# abc123...      nginx:alpine            Up 2 minutes   0.0.0.0:80->80/tcp, 443->443  almacen-nginx
# def456...      almacen-app:latest      Up 3 minutes   127.0.0.1:3000->3000/tcp       sistema-almacen
# ghi789...      redis:7-alpine          Up 3 minutes   127.0.0.1:6379->6379/tcp       almacen-redis
# jkl012...      postgres:16-alpine      Up 4 minutes   127.0.0.1:5432->5432/tcp       almacen-postgres
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
mkdir -p /opt/almacen/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /opt/almacen/ssl/key.pem \
  -out /opt/almacen/ssl/cert.pem \
  -subj "/C=PE/ST=Lima/L=Lima/O=DTEL/CN=dtel-almacen.local"

# 3. Si persiste, use solo HTTP:
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
git pull origin master

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
# Crear directorio de backups
mkdir -p /opt/almacen/backups

# Backup completo
docker exec almacen-postgres pg_dump -U ${POSTGRES_USER:-dtel} almacen_db > /opt/almacen/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
cat /opt/almacen/backups/backup.sql | docker exec -i almacen-postgres psql -U ${POSTGRES_USER:-dtel} almacen_db

# Backup automático diario (3:00 AM)
echo "0 3 * * * root docker exec almacen-postgres pg_dump -U dtel almacen_db > /opt/almacen/backups/backup_\$(date +\%Y\%m\%d).sql" > /etc/cron.d/almacen-backup
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
