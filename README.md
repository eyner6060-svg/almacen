# Sistema de Gestión de Almacén Institucional

Sistema web completo para la gestión de almacén institucional con control de inventario, pedidos, combustible y bienes patrimoniales.

## Características Principales

### Gestión de Inventario
- Control de bienes consumibles y patrimoniales
- Alertas de stock bajo
- Códigos de barras y QR para identificación
- Historial de cambios de estado
- Trazabilidad completa de movimientos

### Gestión de Pedidos
- Flujo de autorización con PIN de 4 dígitos
- Aprobación por Jefe de Oficina y Almacenero
- Generación de PDF con logo institucional
- Control de retornos de bienes patrimoniales

### Gestión de Combustible
- Inventario de gasolina y petróleo
- Vales de combustible con numeración correlativa
- Asignación de vehículos a conductores
- Control de consumo por usuario

### Dashboard y Reportes
- Estadísticas en tiempo real
- Gráficos de consumo
- Alertas de stock bajo
- Control de bienes en préstamo
- Predicción de demanda

### Seguridad
- Autenticación con sesiones seguras
- Rate limiting en login
- Cifrado de datos sensibles (AES-256)
- Auditoría completa de operaciones
- Eventos de seguridad forense

## Tecnologías Utilizadas

| Componente | Tecnología | Versión |
|------------|------------|---------|
| Frontend | Next.js + React | 16.x |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS + shadcn/ui | 4.x |
| Base de Datos | PostgreSQL | 16.x |
| ORM | Prisma | 6.x |
| Autenticación | Sesiones con cookies httpOnly | - |
| Cache | Redis (opcional) | 7.x |
| Gráficos | Recharts | 2.x |

## Requisitos del Sistema

- Node.js 18.x o superior
- npm 9.x o superior
- PostgreSQL 14+ (o SQLite para desarrollo)
- 512MB RAM mínimo
- 1GB de espacio en disco

## Instalación Rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 3. Inicializar base de datos
npx prisma generate
npx prisma db push

# 4. (Opcional) Cargar datos de prueba
npx prisma db seed

# 5. Iniciar servidor
npm run dev
```

Acceder a `http://localhost:3000`

**Credenciales por defecto:**
- Email: `admin@institucion.gob.pe`
- Contraseña: `Admin123!`
- PIN: `1234`

## Despliegue con Docker

```bash
# Construir y ejecutar
docker-compose up -d

# Ver logs
docker-compose logs -f
```

Los servicios incluidos:
- Aplicación (puerto 3000)
- PostgreSQL (puerto 5432)
- Redis (puerto 6379)
- Nginx (puertos 80, 443)

## Estructura del Proyecto

```
sistema-almacen/
├── prisma/
│   ├── schema.prisma      # Esquema de base de datos
│   └── seed.ts            # Datos iniciales
├── public/
│   ├── uploads/           # Archivos subidos
│   └── icons/             # Iconos PWA
├── src/
│   ├── app/
│   │   ├── api/           # API Routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/        # Componentes React
│   ├── lib/               # Utilidades y configuración
│   ├── hooks/             # Custom hooks
│   └── types/             # Tipos TypeScript
├── .env.example           # Variables de entorno ejemplo
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| Administrador | Acceso total, configuración, gestión de usuarios |
| Almacenero | Gestión de inventario, pedidos, combustible |
| Jefe de Oficina | Autorización de pedidos de su oficina |
| Trabajador | Solicitar bienes, ver sus pedidos |
| Conductor | Solicitar combustible (adicional a rol base) |

## Configuración Inicial

1. **Configurar Institución**: Nombre, logo y colores
2. **Crear Oficinas**: Unidades organizativas
3. **Crear Almacenes**: Ubicaciones físicas
4. **Registrar Usuarios**: Con roles y PINs
5. **Configurar Firmas**: Para vales y salidas
6. **Registrar Vehículos**: Para control de combustible

## Mantenimiento

### Respaldos

```bash
# PostgreSQL
pg_dump -U postgres almacen_db > backup.sql

# Restaurar
psql -U postgres almacen_db < backup.sql
```

### Actualización

```bash
git pull origin main
npm install
npx prisma generate
npx prisma db push
npm run build
docker-compose restart app
```

## Solución de Problemas

### Error de Base de Datos
```bash
npx prisma generate
npx prisma db push
```

### Error de Autenticación
1. Verificar SESSION_SECRET en .env
2. Limpiar cookies del navegador
3. Verificar que el usuario esté activo

### Puerto en Uso
```bash
lsof -i :3000
kill -9 <PID>
```

## Documentación

- [`GUIA_USUARIO.md`](GUIA_USUARIO.md) - Manual de usuario completo

## Licencia

Este software fue desarrollado para uso institucional. Todos los derechos reservados.

---

**Versión**: 2.0.0  
**Última actualización**: Julio 2026
