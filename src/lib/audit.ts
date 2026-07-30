/**
 * Sistema de Auditoría para registro de operaciones sensibles
 * Registra todas las acciones críticas del sistema con detalles completos
 */

import { db } from './db'
import { headers } from 'next/headers'
import { encrypt, decrypt } from './encryption'
import { logger } from '@/lib/logger'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'AUTHORIZE'
  | 'REJECT'
  | 'STATUS_CHANGE'
  | 'ROLE_CHANGE'
  | 'PASSWORD_CHANGE'
  | 'PIN_CHANGE'
  | 'EXPORT'
  | 'IMPORT'
  | 'BACKUP'
  | 'BACKUP_CREATE'
  | 'BACKUP_DELETE'
  | 'BACKUP_AUTO'
  | 'BACKUP_RESTORE'
  | 'BACKUP_CONFIG_UPDATE'

export type EntityType =
  | 'User'
  | 'Order'
  | 'Item'
  | 'Vehicle'
  | 'FuelRequest'
  | 'FuelEntry'
  | 'Ingress'
  | 'Office'
  | 'Warehouse'
  | 'SystemConfig'
  | 'PatrimonialUnit'
  | 'BackupLog'
  | 'DigitalSignature'
  | 'Loan'
  | 'TDR'
  | 'Warranty'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

interface AuditLogData {
  userId?: number
  action: AuditAction
  entityType: EntityType
  entityId?: number
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  description: string
  severity?: AuditSeverity
}

/**
 * Obtiene la dirección IP del cliente desde los headers
 */
async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers()
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Obtiene el User-Agent del cliente
 */
async function getUserAgent(): Promise<string | null> {
  try {
    const headersList = await headers()
    return headersList.get('user-agent') || null
  } catch {
    return null
  }
}

/**
 * Determina la severidad basada en la acción
 */
function determineSeverity(action: AuditAction): AuditSeverity {
  const criticalActions: AuditAction[] = ['DELETE', 'ROLE_CHANGE', 'PASSWORD_CHANGE']
  const warningActions: AuditAction[] = ['AUTHORIZE', 'REJECT', 'STATUS_CHANGE', 'PIN_CHANGE', 'LOGIN_FAILED']

  if (criticalActions.includes(action)) return 'CRITICAL'
  if (warningActions.includes(action)) return 'WARNING'
  return 'INFO'
}

/**
 * Registra una entrada en el log de auditoría
 */
export async function logAudit(data: AuditLogData): Promise<void> {
  try {
    const [ipAddress, userAgent] = await Promise.all([
      getClientIP(),
      getUserAgent()
    ])

    await db.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        ipAddress,
        userAgent,
        oldValue: data.oldValue ? encrypt(JSON.stringify(data.oldValue)) : null,
        newValue: data.newValue ? encrypt(JSON.stringify(data.newValue)) : null,
        description: data.description,
        severity: data.severity || determineSeverity(data.action)
      }
    })
  } catch (error) {
    // No lanzar error para no interrumpir operaciones
    logger.error('[AUDIT] Error al registrar entrada de auditoría:', error)
  }
}

/**
 * Registra un intento de login
 */
export async function logLogin(userId: number | null, success: boolean, email: string): Promise<void> {
  await logAudit({
    userId: userId ?? undefined,
    action: success ? 'LOGIN' : 'LOGIN_FAILED',
    entityType: 'User',
    description: success
      ? `Inicio de sesión exitoso`
      : `Intento de inicio de sesión fallido para ${email}`,
    severity: success ? 'INFO' : 'WARNING'
  })
}

/**
 * Registra un cierre de sesión
 */
export async function logLogout(userId: number): Promise<void> {
  await logAudit({
    userId,
    action: 'LOGOUT',
    entityType: 'User',
    description: 'Cierre de sesión'
  })
}

/**
 * Registra la creación de una entidad
 */
export async function logCreate(
  userId: number,
  entityType: EntityType,
  entityId: number,
  newData: Record<string, unknown>,
  description?: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'CREATE',
    entityType,
    entityId,
    newValue: newData,
    description: description || `Creación de ${entityType} (ID: ${entityId})`
  })
}

/**
 * Registra la actualización de una entidad
 */
export async function logUpdate(
  userId: number,
  entityType: EntityType,
  entityId: number,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  description?: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'UPDATE',
    entityType,
    entityId,
    oldValue: oldData,
    newValue: newData,
    description: description || `Actualización de ${entityType} (ID: ${entityId})`
  })
}

/**
 * Registra la eliminación de una entidad
 */
export async function logDelete(
  userId: number,
  entityType: EntityType,
  entityId: number,
  oldData: Record<string, unknown>,
  description?: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'DELETE',
    entityType,
    entityId,
    oldValue: oldData,
    description: description || `Eliminación de ${entityType} (ID: ${entityId})`,
    severity: 'CRITICAL'
  })
}

/**
 * Registra una autorización
 */
export async function logAuthorization(
  userId: number,
  entityType: EntityType,
  entityId: number,
  description: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'AUTHORIZE',
    entityType,
    entityId,
    description,
    severity: 'WARNING'
  })
}

/**
 * Registra un rechazo
 */
export async function logRejection(
  userId: number,
  entityType: EntityType,
  entityId: number,
  reason: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'REJECT',
    entityType,
    entityId,
    description: `Rechazo: ${reason}`,
    severity: 'WARNING'
  })
}

/**
 * Registra cambio de rol
 */
export async function logRoleChange(
  userId: number,
  targetUserId: number,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logAudit({
    userId,
    action: 'ROLE_CHANGE',
    entityType: 'User',
    entityId: targetUserId,
    oldValue: { role: oldRole },
    newValue: { role: newRole },
    description: `Cambio de rol de ${oldRole} a ${newRole}`,
    severity: 'CRITICAL'
  })
}

/**
 * Obtiene los logs de auditoría con filtros
 */
export async function getAuditLogs(filters: {
  userId?: number
  action?: AuditAction
  entityType?: EntityType
  entityId?: number
  severity?: AuditSeverity
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}) {
  const { page = 1, limit = 50 } = filters
  const skip = (page - 1) * limit

  const where = {
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.action && { action: filters.action }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.entityId && { entityId: filters.entityId }),
    ...(filters.severity && { severity: filters.severity }),
    ...(filters.startDate && { createdAt: { gte: filters.startDate } }),
    ...(filters.endDate && { createdAt: { lte: filters.endDate } })
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    db.auditLog.count({ where })
  ])

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

/**
 * Exporta logs de auditoría a JSON
 */
export async function exportAuditLogs(filters: {
  startDate?: Date
  endDate?: Date
  userId?: number
}) {
  const logs = await db.auditLog.findMany({
    where: {
      ...(filters.startDate && { createdAt: { gte: filters.startDate } }),
      ...(filters.endDate && { createdAt: { lte: filters.endDate } }),
      ...(filters.userId && { userId: filters.userId })
    },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return logs.map(log => ({
    id: log.id,
    fecha: log.createdAt.toISOString(),
    usuario: log.user?.fullName || 'Sistema',
    email: log.user?.email || '-',
    rol: log.user?.role || '-',
    accion: log.action,
    entidad: log.entityType,
    entidadId: log.entityId,
    ip: log.ipAddress || '-',
    descripcion: log.description,
    severidad: log.severity,
    datosAnteriores: log.oldValue ? JSON.parse(decrypt(log.oldValue)) : null,
    datosNuevos: log.newValue ? JSON.parse(decrypt(log.newValue)) : null
  }))
}
