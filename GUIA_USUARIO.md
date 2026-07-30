# Guía de Usuario - Sistema de Gestión de Almacén Institucional

## Índice

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Dashboard](#3-dashboard)
4. [Inventario](#4-inventario)
5. [Pedidos](#5-pedidos)
6. [Combustible](#6-combustible)
7. [Préstamos](#7-préstamos)
8. [Bienes Asignados](#8-bienes-asignados)
9. [Retorno de Bienes](#9-retorno-de-bienes)
10. [Reportes](#10-reportes)
11. [Configuración](#11-configuración)
12. [Perfil de Usuario](#12-perfil-de-usuario)
13. [Solución de Problemas](#13-solución-de-problemas)

---

## 1. Introducción

El Sistema de Gestión de Almacén Institucional es una plataforma web diseñada para administrar:

- Inventario de bienes consumibles y patrimoniales
- Pedidos y autorizaciones con flujo de aprobación
- Control de combustible y vehículos
- Préstamos de bienes a externos
- Asignación de bienes a trabajadores
- Trazabilidad completa de movimientos
- Reportes y estadísticas

### Roles y permisos

| Rol | Descripción |
|-----|-------------|
| Administrador | Acceso total al sistema, configuración, gestión de usuarios |
| Almacenero | Gestión de inventario, pedidos, combustible, retornos |
| Jefe de Oficina | Autorización de pedidos de su oficina |
| Trabajador | Solicitar bienes y ver sus pedidos |
| Conductor | Solicitar combustible (permiso adicional) |

---

## 2. Acceso al Sistema

### Inicio de sesión

1. Abra el navegador y acceda a la URL del sistema
2. Ingrese su **correo electrónico** y **contraseña**
3. Si tiene 2FA habilitado, ingrese el código de verificación
4. Para operaciones que requieran autorización, use su **PIN de 4 dígitos**

### Recuperación de contraseña

1. En la pantalla de login, haga clic en "¿Olvidó su contraseña?"
2. Ingrese su correo electrónico registrado
3. Siga las instrucciones enviadas a su correo

### Cierre de sesión

Haga clic en su avatar (esquina superior derecha) → "Cerrar sesión"

---

## 3. Dashboard

El dashboard muestra un resumen ejecutivo del estado del almacén.

### Widgets disponibles

- **Bienes en stock**: Total de items en inventario
- **Stock bajo**: Items con cantidad por debajo del mínimo
- **Pedidos pendientes**: Solicitudes pendientes de autorización
- **Préstamos activos**: Bienes actualmente en préstamo
- **Combustible**: Niveles actuales de gasolina y petróleo
- **Actividad reciente**: Últimos movimientos registrados
- **Alertas**: Notificaciones importantes

### Personalización

- Arrastre y suelte los widgets para reorganizarlos
- Use el botón "Personalizar" para mostrar/ocultar widgets
- Los widgets se guardan automáticamente por usuario

---

## 4. Inventario

### Visualización

- **Vista de cuadrícula**: Tarjetas con información resumida
- **Vista de lista**: Tabla con todos los campos
- **Filtros**: Búsqueda por nombre/código, categoría, estado, tipo
- **Paginación**: 20 items por página

### Registrar un bien

1. Haga clic en "Nuevo Bien"
2. Complete los campos obligatorios:
   - **Nombre**: Descripción del bien
   - **Tipo**: Consumible o Patrimonial
   - **Categoría**: Clasificación del bien
   - **Cantidad**: Stock inicial (mínimo 1)
   - **Stock mínimo**: Alerta de reposición
   - **Almacén**: Ubicación física
3. Para bienes **patrimoniales**: Ingrese los códigos patrimoniales
4. Opcional: adjunte documento de sustento, especificaciones técnicas
5. Haga clic en "Guardar"

### Editar un bien

1. Haga clic en el bien deseado
2. Modifique los campos necesarios
3. Para bienes patrimoniales: puede editar el estado de **cada unidad** individualmente o en grupo
4. Haga clic en "Guardar cambios"

### Estados disponibles

Los estados se gestionan desde Configuración → Estados. Ejemplos:
- **OPERATIVO**: Bien en condiciones normales de uso
- **MANTENIMIENTO**: En reparación
- **BAJA**: Dado de baja
- **NUEVO**: Recién adquirido
- **USADO**: En uso regular

### Códigos QR

- Cada bien patrimonial tiene un código QR único
- Use el lector QR (módulo Escáner) para consultar rápidamente
- Puede descargar e imprimir códigos QR desde la vista de detalle

---

## 5. Pedidos

### Realizar un pedido

1. Vaya al módulo Pedidos
2. Haga clic en "Nuevo Pedido"
3. Seleccione los bienes del catálogo
4. Especifique cantidades
5. Si el bien es patrimonial, seleccione unidades específicas
6. Envíe el pedido

### Flujo de autorización

1. **Creado**: El pedido está pendiente
2. **Autorizado por Jefe**: El jefe de oficina aprueba con su PIN
3. **Autorizado por Almacenero**: El almacenero autoriza la salida
4. **Rechazado**: Cualquier autorizador puede rechazar
5. **Completado**: Bienes entregados

### Seguimiento

- Use la vista Kanban para ver el estado de cada pedido
- Filtre por estado, oficina, fechas
- Vea el detalle completo con documentos generados

---

## 6. Combustible

### Solicitar combustible

1. Vaya al módulo Combustible
2. Haga clic en "Nueva Solicitud"
3. Seleccione el vehículo
4. Especifique tipo (Gasolina/Petróleo) y cantidad
5. Adjunte el kilometraje actual
6. Envíe la solicitud

### Autorización

1. El Almacenero revisa la disponibilidad
2. Autoriza o rechaza usando su PIN
3. El vale de combustible se genera automáticamente

### Control de inventario

- El módulo Combustible muestra los niveles actuales
- Las entradas se registran con documento de sustento
- Alertas automáticas cuando el stock es bajo

---

## 7. Préstamos

### Registrar un préstamo

1. Vaya al módulo Préstamos
2. Haga clic en "Nuevo Préstamo"
3. Ingrese datos del solicitante externo
4. Seleccione los bienes a prestar
5. Para bienes patrimoniales, seleccione unidades específicas
6. Establezca fecha estimada de retorno
7. Guarde el préstamo

### Retorno de préstamo

1. Busque el préstamo activo
2. Haga clic en "Registrar Retorno"
3. Confirme la devolución de los bienes
4. El sistema actualiza automáticamente la disponibilidad

---

## 8. Bienes Asignados

### Asignar un bien

1. Vaya al módulo Bienes Asignados
2. Seleccione el trabajador destino
3. Elija los bienes a asignar (deben ser patrimoniales)
4. Genere el acta de entrega
5. Confirme la asignación

### Devolución de bien asignado

1. Busque la asignación activa
2. Haga clic en "Devolver"
3. Registre la fecha y estado de devolución
4. El bien vuelve a estar disponible

---

## 9. Retorno de Bienes

1. Vaya al módulo Retorno
2. Seleccione las unidades patrimoniales a retornar
3. Para cada unidad, puede asignar un estado individual
4. Agregue notas si es necesario
5. Confirme el retorno
6. El sistema genera automáticamente un acta de retorno

---

## 10. Reportes

### Reportes disponibles

- **Inventario**: Listado completo de bienes con filtros
- **Movimientos**: Trazabilidad de entradas y salidas
- **Pedidos**: Historial de solicitudes
- **Préstamos**: Bienes prestados a externos
- **Combustible**: Consumo por vehículo/usuario
- **Stock bajo**: Bienes por debajo del mínimo

### Exportación

- Todos los reportes se pueden exportar a Excel
- Use los filtros de fecha para acotar resultados
- Los reportes incluyen datos actualizados al momento de la consulta

---

## 11. Configuración

### Módulo de Configuración

Accesible solo para Administradores:

- **Institución**: Nombre, logo, colores, favicon
- **Almacenes**: Crear y gestionar ubicaciones
- **Oficinas**: Unidades organizativas
- **Categorías**: Clasificación de bienes
- **Estados**: Gestionar estados personalizados de bienes
- **Respaldos**: Crear y restaurar copias de seguridad
- **Firma digital**: Configurar método de autorización
- **Workflows**: Reglas de autorización automática

### Gestión de usuarios

- Crear, editar y desactivar usuarios
- Asignar roles y permisos
- Configurar PIN de autorización
- Asignar oficina y vehículo (para conductores)

---

## 12. Perfil de Usuario

- Cambiar contraseña
- Configurar 2FA (doble factor)
- Ver información personal
- Cerrar sesión en todos los dispositivos

### Notificaciones

- Las notificaciones aparecen en el icono de campana
- Configure sus preferencias en el panel de notificaciones
- Tipos de notificación: pedidos, autorizaciones, alertas de stock

---

## 13. Solución de Problemas

### No puedo iniciar sesión

1. Verifique que su correo esté escrito correctamente
2. Use la opción "¿Olvidó su contraseña?"
3. Contacte al administrador si el problema persiste

### El sistema está lento

- Cierre otras pestañas del navegador
- Verifique su conexión a internet
- Los reportes con muchos datos pueden tomar algunos segundos

### Error al guardar un bien

- Verifique que todos los campos obligatorios estén completos
- Los códigos patrimoniales deben ser únicos
- El tamaño máximo de archivo es 10 MB

### No encuentro un bien

- Use la barra de búsqueda (Ctrl+K)
- Verifique los filtros de categoría y estado
- Revise la papelera (bienes eliminados)

---

**Versión**: 2.0.0  
**Última actualización**: Julio 2026  
**Soporte técnico**: Contacte al administrador del sistema
