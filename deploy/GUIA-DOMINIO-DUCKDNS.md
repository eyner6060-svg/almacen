# CONFIGURACIÓN DE DOMINIO — DUCKDNS

**Sistema:** Sistema de Gestión de Almacén  
**IP Pública:** 38.252.209.72  
**IP Privada:** 192.168.11.30  
**Dominio a crear:** `dtel-almacen.duckdns.org`

---

## ÍNDICE

1. [Crear el subdominio en DuckDNS](#paso-1-crear-el-subdominio-en-duckdns)
2. [Verificar DNS en el servidor](#paso-2-verificar-dns-en-el-servidor)
3. [Obtener certificado SSL real (Let's Encrypt)](#paso-3-obtener-certificado-ssl-real-lets-encrypt)
4. [Habilitar HTTPS en nginx](#paso-4-habilitar-https-en-nginx)
5. [Actualizar APP_URL](#paso-5-actualizar-app_url)
6. [Actualización automática de IP (cron)](#paso-6-actualización-automática-de-ip-cron)
7. [Verificación final](#paso-7-verificación-final)
8. [Solución de problemas](#paso-8-solución-de-problemas)

---

## PASO 1: CREAR EL SUBDOMINIO EN DUCKDNS

Esto se hace desde un navegador web en cualquier computadora.

1. Abrir **https://www.duckdns.org**
2. Iniciar sesión con cuenta de **Google, GitHub, Twitter o Reddit** (no requiere registro nuevo)
3. En la sección **"Sub-domains"**:
   - Escribir: `dtel-almacen`
   - Hacer clic en **"add domain"**
4. En el campo **"Current IP"**:
   - Escribir: `38.252.209.72`
   - Hacer clic en **"update ip"**
5. **COPIAR EL TOKEN**:
   - Bajo el dominio aparece una clave larga (token)
   - Ejemplo de formato: `8f2a9d3e-...`
   - **Guardar este token**, se necesita en el Paso 6

**Resultado esperado:**
```
Sub-domain:  dtel-almacen.duckdns.org
Current IP:  38.252.209.72
Token:       [XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX]  ← GUARDAR ESTO
```

---

## PASO 2: VERIFICAR DNS EN EL SERVIDOR

Conectarse por SSH al servidor:

```bash
ssh root@192.168.11.30
# Contraseña: DTEL2025*
```

Verificar que el dominio resuelve al IP público:

```bash
nslookup dtel-almacen.duckdns.org
```

**Salida esperada:**
```
Name:    dtel-almacen.duckdns.org
Address: 38.252.209.72
```

> Si no muestra `38.252.209.72`, esperar 1-2 minutos (el DNS tarda en propagarse).

---

## PASO 3: OBTENER CERTIFICADO SSL REAL (LET'S ENCRYPT)

En el servidor (SSH como root):

### 3.1 Instalar certbot

```bash
dnf install -y certbot
```

### 3.2 Detener nginx temporalmente

El puerto 80 debe quedar libre para que certbot valide el dominio:

```bash
docker stop almacen-nginx
```

### 3.3 Obtener el certificado

```bash
certbot certonly --standalone -d dtel-almacen.duckdns.org \
  --non-interactive --agree-tos -m admin@tuempresa.com
```

> **Nota:** Si no quieres registrar un email real, agrega `--register-unsafely-without-email`

### 3.4 Copiar los certificados al proyecto

```bash
mkdir -p /opt/almacen/ssl
cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/fullchain.pem /opt/almacen/ssl/cert.pem
cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/privkey.pem /opt/almacen/ssl/key.pem

# Verificar permisos (nginx debe poder leerlos)
ls -la /opt/almacen/ssl/
chmod 644 /opt/almacen/ssl/cert.pem /opt/almacen/ssl/key.pem
```

**Salida esperada:**
```
-rw-r--r-- 1 root root ... cert.pem
-rw-r--r-- 1 root root ... key.pem
```

---

## PASO 4: HABILITAR HTTPS EN NGINX

El archivo `nginx.conf` del repositorio ya trae la configuración SSL lista (puerto 443).

Verificar que el `nginx.conf` actual sea la versión con SSL (no la de prueba HTTP):

```bash
cd /opt/almacen

# Ver el inicio del archivo (debe mencionar 443 ssl)
head -60 nginx.conf | grep -n "443 ssl"
# Debe mostrar algo como:  listen 443 ssl http2;

# Si NO aparece, restaurar la versión SSL desde el repo:
cp nginx.conf nginx.conf.http   # respaldo de la versión HTTP
git checkout -- nginx.conf       # trae la versión SSL del repo

# Verificar que apunte a los certificados
grep -n "ssl_certificate" nginx.conf
# Debe mostrar:
#   ssl_certificate /etc/nginx/ssl/cert.pem;
#   ssl_certificate_key /etc/nginx/ssl/key.pem;
```

> **IMPORTANTE:** La ruta `/etc/nginx/ssl/` dentro del contenedor nginx corresponde a `/opt/almacen/ssl/` en el servidor (montaje de volumen).

### 4.1 Verificar el montaje del volumen SSL

El `docker-compose.yml` debe montar la carpeta SSL al contenedor nginx:

```bash
grep -n "ssl" docker-compose.yml
```

Debe existir una línea como:
```
- ./ssl:/etc/nginx/ssl:ro
```

**Si NO existe**, agregarla al servicio nginx en `docker-compose.yml`:

```bash
nano docker-compose.yml
```

Buscar el bloque `nginx:` y agregar bajo `volumes:`:

```yaml
  nginx:
    image: nginx:alpine
    container_name: almacen-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./deploy/nginx.deploy.conf:/etc/nginx/nginx.conf:ro   # ← ver nota
      - ./ssl:/etc/nginx/ssl:ro                                # ← AGREGAR ESTA LÍNEA
```

> **NOTA:** Si el `nginx.conf` del repo (con SSL) se monta desde la raíz, usar:
> ```
> - ./nginx.conf:/etc/nginx/nginx.conf:ro
> - ./ssl:/etc/nginx/ssl:ro
> ```

Guardar con **Ctrl+O** → Enter → **Ctrl+X**

### 4.2 Reiniciar el stack de nginx

```bash
docker compose up -d --force-recreate nginx
```

---

## PASO 5: ACTUALIZAR APP_URL

El sistema debe saber cuál es su URL pública para generar enlaces correctos.

1. Abrir Portainer: **http://192.168.11.30:9000**
2. Ir a **Stacks → almacen → Editor**
3. Buscar la variable `APP_URL`
4. Cambiarla de:
   - **Antes:** `http://38.252.209.72`
   - **Ahora:** `https://dtel-almacen.duckdns.org`
5. Clic en **"Update the stack"** → confirmar redeploy

> También se puede actualizar desde el archivo `.env` del servidor:
> ```bash
> cd /opt/almacen
> nano .env
> # Cambiar: NEXT_PUBLIC_APP_URL=https://dtel-almacen.duckdns.org
> ```

---

## PASO 6: ACTUALIZACIÓN AUTOMÁTICA DE IP (CRON)

DuckDNS es un DNS dinámico: si el IP público cambia, el dominio deja de funcionar.
Para evitar esto, configurar una actualización automática cada 5 minutos.

```bash
# Abrir el crontab
crontab -e
```

Agregar esta línea (reemplazar `TU_TOKEN` por el token real del Paso 1):

```cron
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=dtel-almacen&token=TU_TOKEN&ip=" >/dev/null 2>&1
```

Guardar y salir (**Ctrl+O** → Enter → **Ctrl+X**)

**Ejemplo con token real:**
```cron
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=dtel-almacen&token=8f2a9d3e4b5c6d7e8f9a0b1c2d3e4f5&ip=" >/dev/null 2>&1
```

Verificar que el cron se guardó:

```bash
crontab -l
```

---

## PASO 7: VERIFICACIÓN FINAL

### Desde dentro de la red local

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://dtel-almacen.duckdns.org/health
# Esperado: 200
```

> Si da error de certificado, usar `-k`:
> `curl -sk -o /dev/null -w "%{http_code}\n" https://dtel-almacen.duckdns.org/health`

### Desde Internet (celular con datos 4G)

1. Desconectarse del WiFi
2. Abrir el navegador
3. Ir a **https://dtel-almacen.duckdns.org**
4. Debe aparecer el login del Sistema de Gestión de Almacén
5. Verificar el candado de seguridad (certificado válido, no advertencia)

### Verificar el certificado SSL

```bash
echo | openssl s_client -connect dtel-almacen.duckdns.org:443 2>/dev/null | grep "subject="
# Debe mostrar: subject=CN = dtel-almacen.duckdns.org
```

---

## PASO 8: SOLUCIÓN DE PROBLEMAS

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| `nslookup` no muestra el IP | DNS aún propagando | Esperar 2-5 minutos |
| `Connection refused` en :443 | nginx no iniciado | `docker start almacen-nginx` |
| Certificado no válido | certbot no se ejecutó o puerto 80 ocupado | Repetir Paso 3.2 (detener nginx primero) |
| Error `ERR_SSL_PROTOCOL_ERROR` | nginx.conf no es la versión SSL | Verificar Paso 4 |
| Error `404 Not Found` en /health | Ruta distinta | Probar `https://dtel-almacen.duckdns.org/api/system/health` |
| Advertencia "no seguro" | Certificado autofirmado aún en uso | Asegurar que cert.pem/key.pem sean de Let's Encrypt |
| El dominio apunta al router, no al sistema | Port forwarding no configurado | Abrir 80/443 → 192.168.11.30 en el router |
| Al probar desde la misma red falla | Hairpin NAT del router | Probar desde celular 4G (fuera de la red) |

---

## RESUMEN DE COMANDOS

| Acción | Comando |
|--------|---------|
| Verificar DNS | `nslookup dtel-almacen.duckdns.org` |
| Instalar certbot | `dnf install -y certbot` |
| Obtener certificado | `certbot certonly --standalone -d dtel-almacen.duckdns.org --register-unsafely-without-email` |
| Copiar certs | `cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/fullchain.pem /opt/almacen/ssl/cert.pem` |
| Reiniciar nginx | `docker compose up -d --force-recreate nginx` |
| Probar HTTPS | `curl -sk https://dtel-almacen.duckdns.org/health` |
| Renovar cert manual | `certbot renew` |
| Verificar cron | `crontab -l` |

---

## RENOVACIÓN AUTOMÁTICA DEL CERTIFICADO (RECOMENDADO)

Los certificados de Let's Encrypt duran 90 días. Para renovación automática:

```bash
# Editar crontab
crontab -e
```

Agregar:

```cron
0 3 1 * * certbot renew --quiet --deploy-hook "cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/fullchain.pem /opt/almacen/ssl/cert.pem && cp /etc/letsencrypt/live/dtel-almacen.duckdns.org/privkey.pem /opt/almacen/ssl/key.pem && docker restart almacen-nginx"
```

Esto renueva el certificado el día 1 de cada mes a las 3 AM, copia los nuevos certificados y reinicia nginx.

---

## DOMINIOS ALTERNATIVOS

Si en el futuro se quiere un dominio propio:

| Proveedor | Ejemplo | Costo |
|-----------|---------|-------|
| Google Domains | `almacen.dtel.pe` | ~$12/año |
| Namecheap | `almacen.dtel.pe` | ~$9/año |
| GoDaddy | `almacen.dtel.pe` | ~$15/año |

Para usarlo: en el panel del proveedor crear un **registro A**:
```
Nombre:  almacen
Tipo:    A
Valor:   38.252.209.72
TTL:     300
```

Luego repetir los Pasos 3-7 con el nuevo dominio.

---

*Documento generado el 31/07/2026 — Sistema de Gestión de Almacén*
