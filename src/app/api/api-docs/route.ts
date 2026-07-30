import { NextResponse } from 'next/server'

/**
 * Generador de Documentación OpenAPI 3.0
 * Genera documentación completa de la API para todos los endpoints
 */

interface OpenAPIInfo {
  title: string
  description: string
  version: string
  contact?: {
    name: string
    email: string
  }
}

interface OpenAPIServer {
  url: string
  description: string
}

interface OpenAPIPath {
  [path: string]: {
    [method: string]: {
      tags: string[]
      summary: string
      description?: string
      security?: Array<{ [name: string]: string[] }>
      parameters?: Array<{
        name: string
        in: 'path' | 'query' | 'header' | 'cookie'
        required?: boolean
        description?: string
        schema: { type: string; format?: string; enum?: string[] }
      }>
      requestBody?: {
        required: boolean
        content: {
          'application/json': {
            schema: { $ref: string } | OpenAPIProperty
          }
        }
      }
      responses: {
        [status: string]: {
          description: string
          content?: {
            'application/json': {
              schema: { $ref: string } | OpenAPIProperty
            }
          }
        }
      }
    }
  }
}

interface OpenAPIProperty {
  type?: string
  description?: string
  format?: string
  enum?: string[]
  items?: OpenAPIProperty
  properties?: Record<string, OpenAPIProperty>
  required?: string[]
  default?: string | number | boolean
  $ref?: string
}

interface OpenAPISchema {
  [name: string]: {
    type: string
    properties?: Record<string, OpenAPIProperty>
    required?: string[]
    items?: OpenAPIProperty
  }
}

function generateOpenAPISpec(): object {
  const info: OpenAPIInfo = {
    title: 'Sistema de Gestión de Almacén API',
    description: `
## Descripción
API REST completa para el Sistema de Gestión de Almacén Institucional.

## Autenticación
La mayoría de los endpoints requieren autenticación mediante cookie de sesión.
Los endpoints administrativos requieren roles específicos.

## Roles del Sistema
- **ADMINISTRADOR**: Acceso completo al sistema
- **ALMACENERO**: Gestión de inventario y pedidos
- **JEFE_OFICINA**: Autorización de pedidos de su oficina
- **TRABAJADOR**: Creación de pedidos y consulta

## Códigos de Estado
- 200: Operación exitosa
- 201: Recurso creado
- 400: Error de validación
- 401: No autenticado
- 403: No autorizado
- 404: Recurso no encontrado
- 500: Error del servidor
    `,
    version: '1.0.0',
    contact: {
      name: 'Soporte Técnico',
      email: 'soporte@almacen.gob.pe'
    }
  }

  const servers: OpenAPIServer[] = [
    {
      url: '/api',
      description: 'Servidor actual'
    }
  ]

  const paths: OpenAPIPath = {
    // Autenticación
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión',
        description: 'Autentica un usuario y crea una sesión',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Inicio de sesión exitoso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' }
              }
            }
          },
          '401': {
            description: 'Credenciales inválidas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }
    },
    '/auth/logout': {
      post: {
        tags: ['Autenticación'],
        summary: 'Cerrar sesión',
        description: 'Termina la sesión actual del usuario',
        responses: {
          '200': {
            description: 'Sesión cerrada exitosamente'
          }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Autenticación'],
        summary: 'Obtener usuario actual',
        description: 'Retorna la información del usuario autenticado',
        responses: {
          '200': {
            description: 'Usuario autenticado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserResponse' }
              }
            }
          },
          '401': {
            description: 'No autenticado'
          }
        }
      }
    },

    // Bienes
    '/items': {
      get: {
        tags: ['Inventario'],
        summary: 'Listar bienes',
        description: 'Obtiene la lista de bienes con filtros opcionales',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por nombre, código o marca' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filtrar por categoría' },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filtrar por estado' },
          { name: 'itemType', in: 'query', schema: { type: 'string', enum: ['CONSUMIBLE', 'PATRIMONIAL'] }, description: 'Filtrar por tipo' },
          { name: 'warehouseId', in: 'query', schema: { type: 'integer' }, description: 'Filtrar por almacén' }
        ],
        responses: {
          '200': {
            description: 'Lista de bienes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ItemsListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Inventario'],
        summary: 'Crear bien',
        description: 'Registra un nuevo bien en el inventario. Requiere rol ADMINISTRADOR o ALMACENERO',
        security: [{ cookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateItemRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Bien creado exitosamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ItemResponse' }
              }
            }
          },
          '400': {
            description: 'Error de validación'
          },
          '403': {
            description: 'No autorizado'
          }
        }
      }
    },
    '/items/{id}': {
      get: {
        tags: ['Inventario'],
        summary: 'Obtener bien por ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID del bien' }
        ],
        responses: {
          '200': {
            description: 'Bien encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ItemResponse' }
              }
            }
          },
          '404': {
            description: 'Bien no encontrado'
          }
        }
      },
      put: {
        tags: ['Inventario'],
        summary: 'Actualizar bien',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID del bien' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateItemRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Bien actualizado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ItemResponse' }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Inventario'],
        summary: 'Eliminar bien',
        description: 'Mueve el bien a la papelera (eliminación lógica)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'ID del bien' }
        ],
        responses: {
          '200': {
            description: 'Bien eliminado'
          }
        }
      }
    },

    // Pedidos
    '/orders': {
      get: {
        tags: ['Pedidos'],
        summary: 'Listar pedidos',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO', 'RECHAZADO'] } },
          { name: 'officeId', in: 'query', schema: { type: 'integer' } },
          { name: 'requestedById', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Lista de pedidos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrdersListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Pedidos'],
        summary: 'Crear pedido',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOrderRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Pedido creado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderResponse' }
              }
            }
          }
        }
      }
    },
    '/orders/{id}': {
      get: {
        tags: ['Pedidos'],
        summary: 'Obtener pedido por ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Pedido encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OrderResponse' }
              }
            }
          }
        }
      },
      put: {
        tags: ['Pedidos'],
        summary: 'Actualizar pedido',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateOrderRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Pedido actualizado'
          }
        }
      }
    },

    // Usuarios
    '/users': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar usuarios',
        description: 'Requiere rol ADMINISTRADOR',
        security: [{ cookie: [] }],
        parameters: [
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] } },
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } }
        ],
        responses: {
          '200': {
            description: 'Lista de usuarios',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UsersListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear usuario',
        description: 'Requiere rol ADMINISTRADOR',
        security: [{ cookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUserRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Usuario creado'
          }
        }
      }
    },
    '/users/{id}': {
      get: {
        tags: ['Usuarios'],
        summary: 'Obtener usuario por ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Usuario encontrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserResponse' }
              }
            }
          }
        }
      },
      put: {
        tags: ['Usuarios'],
        summary: 'Actualizar usuario',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateUserRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Usuario actualizado'
          }
        }
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Desactivar usuario',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Usuario desactivado'
          }
        }
      }
    },

    // Oficinas
    '/offices': {
      get: {
        tags: ['Oficinas'],
        summary: 'Listar oficinas',
        responses: {
          '200': {
            description: 'Lista de oficinas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OfficesListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Oficinas'],
        summary: 'Crear oficina',
        description: 'Requiere rol ADMINISTRADOR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateOfficeRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Oficina creada'
          }
        }
      }
    },

    // Almacenes
    '/warehouses': {
      get: {
        tags: ['Almacenes'],
        summary: 'Listar almacenes',
        responses: {
          '200': {
            description: 'Lista de almacenes',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WarehousesListResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Almacenes'],
        summary: 'Crear almacén',
        description: 'Requiere rol ADMINISTRADOR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWarehouseRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Almacén creado'
          }
        }
      }
    },

    // Vehículos
    '/vehicles': {
      get: {
        tags: ['Vehículos'],
        summary: 'Listar vehículos',
        responses: {
          '200': {
            description: 'Lista de vehículos'
          }
        }
      },
      post: {
        tags: ['Vehículos'],
        summary: 'Crear vehículo',
        description: 'Requiere rol ADMINISTRADOR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateVehicleRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Vehículo creado'
          }
        }
      }
    },

    // Solicitudes de Combustible
    '/fuel-requests': {
      get: {
        tags: ['Combustible'],
        summary: 'Listar solicitudes de combustible',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDIENTE', 'AUTORIZADO', 'COMPLETADO', 'RECHAZADO'] } }
        ],
        responses: {
          '200': {
            description: 'Lista de solicitudes'
          }
        }
      },
      post: {
        tags: ['Combustible'],
        summary: 'Crear solicitud de combustible',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateFuelRequestRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Solicitud creada'
          }
        }
      }
    },

    // Inventario de Combustible
    '/fuel-inventory': {
      get: {
        tags: ['Combustible'],
        summary: 'Obtener inventario de combustible',
        responses: {
          '200': {
            description: 'Inventario actual'
          }
        }
      }
    },

    // Ingresos
    '/ingresses': {
      get: {
        tags: ['Ingresos'],
        summary: 'Listar ingresos de inventario',
        responses: {
          '200': {
            description: 'Lista de ingresos'
          }
        }
      },
      post: {
        tags: ['Ingresos'],
        summary: 'Registrar ingreso',
        description: 'Registra un ingreso de bienes al inventario',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateIngressRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Ingreso registrado'
          }
        }
      }
    },

    // Reportes
    '/reports': {
      get: {
        tags: ['Reportes'],
        summary: 'Generar reporte',
        parameters: [
          { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['inventory', 'movements', 'consumption', 'audit'] } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'excel', 'pdf'] } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'Reporte generado'
          }
        }
      }
    },

    // Tablero
    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Obtener estadísticas del dashboard',
        responses: {
          '200': {
            description: 'Estadísticas del sistema',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardStats' }
              }
            }
          }
        }
      }
    },

    // Logs de Auditoría
    '/audit-logs': {
      get: {
        tags: ['Auditoría'],
        summary: 'Listar logs de auditoría',
        description: 'Requiere rol ADMINISTRADOR',
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'integer' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'Lista de logs de auditoría'
          }
        }
      }
    },

    // Predicciones
    '/predictions': {
      get: {
        tags: ['Predicciones'],
        summary: 'Obtener predicciones de demanda',
        description: 'Genera predicciones de demanda basadas en datos históricos',
        parameters: [
          { name: 'itemId', in: 'query', schema: { type: 'integer' }, description: 'ID del bien específico' },
          { name: 'months', in: 'query', schema: { type: 'integer' }, description: 'Meses de historial a considerar' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filtrar por categoría' }
        ],
        responses: {
          '200': {
            description: 'Predicciones de demanda',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PredictionsResponse' }
              }
            }
          }
        }
      }
    },

    // Sincronización
    '/sync': {
      get: {
        tags: ['Sincronización'],
        summary: 'Obtener estado de sincronización',
        description: 'Obtiene el historial y estado actual de sincronización con SIGA',
        responses: {
          '200': {
            description: 'Estado de sincronización',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncStatusResponse' }
              }
            }
          }
        }
      },
      post: {
        tags: ['Sincronización'],
        summary: 'Ejecutar sincronización',
        description: 'Ejecuta una sincronización manual con SIGA. Requiere rol ADMINISTRADOR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Sincronización iniciada'
          }
        }
      }
    },

    // Eventos de Seguridad
    '/security-events': {
      get: {
        tags: ['Seguridad'],
        summary: 'Listar eventos de seguridad',
        description: 'Requiere rol ADMINISTRADOR',
        parameters: [
          { name: 'eventType', in: 'query', schema: { type: 'string', enum: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'SUSPICIOUS_ACCESS', 'PERMISSION_DENIED'] } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] } },
          { name: 'userId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } }
        ],
        responses: {
          '200': {
            description: 'Lista de eventos de seguridad'
          }
        }
      },
      post: {
        tags: ['Seguridad'],
        summary: 'Registrar evento de seguridad',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSecurityEventRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Evento registrado'
          }
        }
      }
    },

    // Notificaciones
    '/notifications': {
      get: {
        tags: ['Notificaciones'],
        summary: 'Listar notificaciones del usuario',
        responses: {
          '200': {
            description: 'Lista de notificaciones'
          }
        }
      }
    },

    // Flujos de Trabajo
    '/workflows': {
      get: {
        tags: ['Flujos de Trabajo'],
        summary: 'Listar reglas de flujo de trabajo',
        responses: {
          '200': {
            description: 'Lista de reglas'
          }
        }
      },
      post: {
        tags: ['Flujos de Trabajo'],
        summary: 'Crear regla de flujo de trabajo',
        description: 'Requiere rol ADMINISTRADOR',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWorkflowRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Regla creada'
          }
        }
      }
    },

    // Garantías
    '/warranties': {
      get: {
        tags: ['Garantías'],
        summary: 'Listar garantías',
        responses: {
          '200': {
            description: 'Lista de garantías'
          }
        }
      },
      post: {
        tags: ['Garantías'],
        summary: 'Registrar garantía',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWarrantyRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Garantía registrada'
          }
        }
      }
    },

    // Trazabilidad
    '/traceability/{code}': {
      get: {
        tags: ['Trazabilidad'],
        summary: 'Rastrear bien por código',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string' }, description: 'Código QR o patrimonial' }
        ],
        responses: {
          '200': {
            description: 'Información de trazabilidad'
          },
          '404': {
            description: 'Bien no encontrado'
          }
        }
      }
    }
  }

  const schemas: OpenAPISchema = {
    // Esquemas de Autenticación
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email', description: 'Email del usuario' },
        password: { type: 'string', format: 'password', description: 'Contraseña' }
      }
    },
    LoginResponse: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' },
        message: { type: 'string' }
      }
    },

    // Esquemas de Usuario
    User: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        fullName: { type: 'string' },
        dni: { type: 'string' },
        email: { type: 'string', format: 'email' },
        role: { type: 'string', enum: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
        position: { type: 'string' },
        phone: { type: 'string' },
        officeId: { type: 'integer' },
        isActive: { type: 'boolean' },
        isDriver: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    UserResponse: {
      type: 'object',
      properties: {
        user: { $ref: '#/components/schemas/User' }
      }
    },
    UsersListResponse: {
      type: 'object',
      properties: {
        users: {
          type: 'array',
          items: { $ref: '#/components/schemas/User' }
        }
      }
    },
    CreateUserRequest: {
      type: 'object',
      required: ['fullName', 'dni', 'email', 'password', 'role', 'position'],
      properties: {
        fullName: { type: 'string' },
        dni: { type: 'string', description: 'DNI de 8 dígitos' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', description: 'Mínimo 8 caracteres, mayúscula, minúscula y número' },
        role: { type: 'string', enum: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'] },
        position: { type: 'string' },
        phone: { type: 'string' },
        officeId: { type: 'integer' },
        isDriver: { type: 'boolean' }
      }
    },
    UpdateUserRequest: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        phone: { type: 'string' },
        position: { type: 'string' },
        officeId: { type: 'integer' },
        isDriver: { type: 'boolean' },
        isActive: { type: 'boolean' }
      }
    },

    // Esquemas de Bien
    Item: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        code: { type: 'string', description: 'Código único del bien' },
        brand: { type: 'string' },
        model: { type: 'string' },
        category: { type: 'string' },
        itemType: { type: 'string', enum: ['CONSUMIBLE', 'PATRIMONIAL'] },
        unit: { type: 'string', description: 'Unidad de medida' },
        quantity: { type: 'integer' },
        minStock: { type: 'integer' },
        status: { type: 'string', description: 'Estado del bien (ej: OPERATIVO, AVERIADO, BAJA)' },
        warehouseId: { type: 'integer' },
        patrimonialCode: { type: 'string' },
        qrCode: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    },
    ItemResponse: {
      type: 'object',
      properties: {
        item: { $ref: '#/components/schemas/Item' }
      }
    },
    ItemsListResponse: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/Item' }
        },
        categories: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    CreateItemRequest: {
      type: 'object',
      required: ['name', 'code', 'itemType', 'category', 'warehouseId'],
      properties: {
        name: { type: 'string' },
        code: { type: 'string', description: 'Código único' },
        brand: { type: 'string' },
        model: { type: 'string' },
        color: { type: 'string' },
        series: { type: 'string' },
        itemType: { type: 'string', enum: ['CONSUMIBLE', 'PATRIMONIAL'] },
        category: { type: 'string' },
        unit: { type: 'string' },
        quantity: { type: 'integer', default: 0 },
        minStock: { type: 'integer', default: 5 },
        status: { type: 'string', description: 'Estado del bien (ej: OPERATIVO)' },
        warehouseId: { type: 'integer' },
        patrimonialCode: { type: 'string' },
        patrimonialCodes: { type: 'string', description: 'JSON array de códigos patrimoniales' },
        location: { type: 'string' },
        technicalSpecs: { type: 'string' }
      }
    },
    UpdateItemRequest: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        brand: { type: 'string' },
        model: { type: 'string' },
        quantity: { type: 'integer' },
        minStock: { type: 'integer' },
        status: { type: 'string', description: 'Estado del bien (ej: OPERATIVO)' },
        location: { type: 'string' }
      }
    },

    // Esquemas de Pedido
    Order: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        orderNumber: { type: 'string' },
        status: { type: 'string', enum: ['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO', 'RECHAZADO'] },
        requestedById: { type: 'integer' },
        officeId: { type: 'integer' },
        notes: { type: 'string' },
        issueDate: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/OrderItem' }
        }
      }
    },
    OrderItem: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        itemId: { type: 'integer' },
        quantity: { type: 'integer' },
        patrimonialCode: { type: 'string' },
        issueDate: { type: 'string', format: 'date-time' },
        expectedReturnDate: { type: 'string', format: 'date-time' }
      }
    },
    OrderResponse: {
      type: 'object',
      properties: {
        order: { $ref: '#/components/schemas/Order' }
      }
    },
    OrdersListResponse: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: { $ref: '#/components/schemas/Order' }
        }
      }
    },
    CreateOrderRequest: {
      type: 'object',
      required: ['officeId', 'items'],
      properties: {
        officeId: { type: 'integer' },
        notes: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['itemId', 'quantity'],
            properties: {
              itemId: { type: 'integer' },
              quantity: { type: 'integer' },
              patrimonialUnitId: { type: 'integer' }
            }
          }
        }
      }
    },
    UpdateOrderRequest: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO', 'RECHAZADO'] },
        notes: { type: 'string' }
      }
    },

    // Esquemas de Oficina
    Office: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        code: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' }
      }
    },
    OfficesListResponse: {
      type: 'object',
      properties: {
        offices: {
          type: 'array',
          items: { $ref: '#/components/schemas/Office' }
        }
      }
    },
    CreateOfficeRequest: {
      type: 'object',
      required: ['name', 'code'],
      properties: {
        name: { type: 'string' },
        code: { type: 'string', description: 'Código único de la oficina' },
        description: { type: 'string' }
      }
    },

    // Esquemas de Almacén
    Warehouse: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        managerId: { type: 'integer' }
      }
    },
    WarehousesListResponse: {
      type: 'object',
      properties: {
        warehouses: {
          type: 'array',
          items: { $ref: '#/components/schemas/Warehouse' }
        }
      }
    },
    CreateWarehouseRequest: {
      type: 'object',
      required: ['name', 'location'],
      properties: {
        name: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        managerId: { type: 'integer' }
      }
    },

    // Esquemas de Vehículo
    CreateVehicleRequest: {
      type: 'object',
      required: ['name', 'plate'],
      properties: {
        name: { type: 'string' },
        plate: { type: 'string', description: 'Placa única del vehículo' },
        description: { type: 'string' },
        driverId: { type: 'integer' }
      }
    },

    // Esquemas de Combustible
    CreateFuelRequestRequest: {
      type: 'object',
      required: ['fuelType', 'quantity', 'reason', 'destinations', 'vehicleId'],
      properties: {
        fuelType: { type: 'string', enum: ['GASOLINA', 'PETROLEO'] },
        quantity: { type: 'number', description: 'Cantidad en galones' },
        reason: { type: 'string' },
        destinations: { type: 'string' },
        vehicleId: { type: 'integer' },
        requestDate: { type: 'string', format: 'date-time' }
      }
    },

    // Esquemas de Ingreso
    CreateIngressRequest: {
      type: 'object',
      required: ['itemId', 'quantity', 'warehouseId'],
      properties: {
        itemId: { type: 'integer' },
        quantity: { type: 'integer' },
        warehouseId: { type: 'integer' },
        supplier: { type: 'string' },
        documentNumber: { type: 'string' },
        notes: { type: 'string' }
      }
    },

    // Esquemas de Flujo de Trabajo
    CreateWorkflowRequest: {
      type: 'object',
      required: ['name', 'triggerType', 'conditions', 'actions'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        triggerType: { type: 'string', enum: ['ORDER_CREATED', 'STOCK_LOW', 'ITEM_STATUS_CHANGED'] },
        conditions: { type: 'string', description: 'JSON de condiciones' },
        actions: { type: 'string', description: 'JSON de acciones' },
        priority: { type: 'integer', default: 0 }
      }
    },

    // Esquemas de Garantía
    CreateWarrantyRequest: {
      type: 'object',
      required: ['itemId', 'purchaseDate', 'expiryDate'],
      properties: {
        itemId: { type: 'integer' },
        purchaseDate: { type: 'string', format: 'date' },
        expiryDate: { type: 'string', format: 'date' },
        documentUrl: { type: 'string' },
        supplierName: { type: 'string' },
        supplierContact: { type: 'string' },
        warrantyTerms: { type: 'string' }
      }
    },

    // Esquemas de Predicción
    PredictionsResponse: {
      type: 'object',
      properties: {
        predictions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'integer' },
              itemName: { type: 'string' },
              predictedDemand: { type: 'number' },
              confidence: { type: 'number', description: '0-1' },
              recommendedStock: { type: 'integer' },
              currentStock: { type: 'integer' },
              needsReorder: { type: 'boolean' },
              historicalData: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    month: { type: 'string' },
                    demand: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        generatedAt: { type: 'string', format: 'date-time' }
      }
    },

    // Esquemas de Sincronización
    SyncStatusResponse: {
      type: 'object',
      properties: {
        lastSync: { $ref: '#/components/schemas/SyncLog' },
        history: {
          type: 'array',
          items: { $ref: '#/components/schemas/SyncLog' }
        }
      }
    },
    SyncLog: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        system: { type: 'string' },
        operation: { type: 'string' },
        entityType: { type: 'string' },
        recordsTotal: { type: 'integer' },
        recordsSuccess: { type: 'integer' },
        recordsFailed: { type: 'integer' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time' }
      }
    },
    SyncRequest: {
      type: 'object',
      required: ['entityType'],
      properties: {
        entityType: { type: 'string', enum: ['items', 'offices', 'patrimonial_codes', 'catalog'] },
        forceFull: { type: 'boolean', description: 'Forzar sincronización completa' }
      }
    },

    // Esquemas de Evento de Seguridad
    CreateSecurityEventRequest: {
      type: 'object',
      required: ['eventType', 'severity'],
      properties: {
        userId: { type: 'integer' },
        eventType: { type: 'string', enum: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'SUSPICIOUS_ACCESS', 'PERMISSION_DENIED'] },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' },
        deviceFingerprint: { type: 'string' },
        details: { type: 'string', description: 'JSON con detalles adicionales' },
        severity: { type: 'string', enum: ['INFO', 'WARNING', 'CRITICAL'] }
      }
    },

    // Esquema del Dashboard
    DashboardStats: {
      type: 'object',
      properties: {
        totalItems: { type: 'integer' },
        lowStockItems: {
          type: 'array',
          items: { $ref: '#/components/schemas/Item' }
        },
        monthlyOrders: { type: 'integer' },
        pendingOrders: { type: 'integer' },
        patrimonialItemsOnLoan: { type: 'array' },
        usersWithMostOrders: { type: 'array' },
        mostRequestedItems: { type: 'array' },
        itemsByCategory: { type: 'array' }
      }
    },

    // Respuesta de Error
    ErrorResponse: {
      type: 'object',
      properties: {
        error: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }

  return {
    openapi: '3.0.0',
    info,
    servers,
    paths,
    components: {
      schemas,
      securitySchemes: {
        cookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session_token'
        }
      }
    },
    tags: [
      { name: 'Autenticación', description: 'Operaciones de autenticación y sesión' },
      { name: 'Inventario', description: 'Gestión de bienes y activos' },
      { name: 'Pedidos', description: 'Gestión de pedidos y salidas' },
      { name: 'Usuarios', description: 'Gestión de usuarios' },
      { name: 'Oficinas', description: 'Gestión de oficinas' },
      { name: 'Almacenes', description: 'Gestión de almacenes' },
      { name: 'Vehículos', description: 'Gestión de vehículos' },
      { name: 'Combustible', description: 'Gestión de combustible' },
      { name: 'Ingresos', description: 'Registro de ingresos al inventario' },
      { name: 'Reportes', description: 'Generación de reportes' },
      { name: 'Dashboard', description: 'Estadísticas y métricas' },
      { name: 'Auditoría', description: 'Logs de auditoría' },
      { name: 'Predicciones', description: 'Predicciones de demanda' },
      { name: 'Sincronización', description: 'Sincronización con sistemas externos' },
      { name: 'Seguridad', description: 'Eventos de seguridad' },
      { name: 'Notificaciones', description: 'Sistema de notificaciones' },
      { name: 'Flujos de Trabajo', description: 'Automatizaciones' },
      { name: 'Garantías', description: 'Gestión de garantías' },
      { name: 'Trazabilidad', description: 'Rastreo de bienes' }
    ]
  }
}

export async function GET() {
  const spec = generateOpenAPISpec()
  return NextResponse.json(spec)
}
