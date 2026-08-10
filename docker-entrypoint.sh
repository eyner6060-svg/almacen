#!/bin/sh
set -e

echo "Iniciando Sistema de Gestión de Almacen..."

# Crear directorios necesarios si no existen
mkdir -p /app/public/uploads
mkdir -p /app/private/uploads

# Ejecutar migraciones de Prisma si DATABASE_URL esta definida
if [ -n "$DATABASE_URL" ]; then
  echo "Ejecutando migraciones de base de datos..."
  if ! npx prisma migrate deploy 2>/dev/null; then
    if [ "$NODE_ENV" = "development" ]; then
      echo "Desarrollo: ejecutando db push (puede perder datos)"
      npx prisma db push --accept-data-loss --skip-generate
    else
      echo "Migraciones pendientes - aplicando esquema sin riesgo de datos"
      npx prisma db push --skip-generate
    fi
  fi
  echo "Base de datos actualizada"
else
  echo "DATABASE_URL no definida. Saltando migraciones."
fi

# Generar cliente Prisma solo si no existe (ya se genero en build)
if [ ! -d "/app/node_modules/.prisma" ] || [ ! -d "/app/node_modules/@prisma" ]; then
  echo "Generando cliente Prisma..."
  npx prisma generate
fi

echo "Iniciando servidor..."
exec "$@"
