import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { headers } from 'next/headers'
import { syncConfigSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { dispatch } from '@/lib/jobs'

/**
 * Servicio de Sincronización SIGA
 * 
 * Proporciona capacidades de sincronización con sistemas externos como SIGA.
 * En producción se conectaría a endpoints reales de la API de SIGA.
 * Por ahora proporciona datos simulados y la infraestructura para integración real.
 */

async function getClientIP(): Promise<string | null> {
  try {
    const headersList = await headers()
    return (
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      null
    )
  } catch {
    return null
  }
}

// Datos simulados de SIGA para demostración
function getMockSIGAData(entityType: string) {
  switch (entityType) {
    case 'items':
      return [
        { codigo: 'SIGA-001', nombre: 'Computadora Desktop', categoria: 'EQUIPOS', tipo: 'PATRIMONIAL' },
        { codigo: 'SIGA-002', nombre: 'Impresora Multifuncional', categoria: 'EQUIPOS', tipo: 'PATRIMONIAL' },
        { codigo: 'SIGA-003', nombre: 'Papel Bond A4', categoria: 'PAPELERIA', tipo: 'CONSUMIBLE' },
        { codigo: 'SIGA-004', nombre: 'Toner HP 88A', categoria: 'INSUMOS', tipo: 'CONSUMIBLE' },
      ]
    case 'offices':
      return [
        { codigo: 'OF-001', nombre: 'Oficina de Planificación', descripcion: 'Área de planificación estratégica' },
        { codigo: 'OF-002', nombre: 'Oficina de Administración', descripcion: 'Área administrativa' },
        { codigo: 'OF-003', nombre: 'Oficina de Tesorería', descripcion: 'Área de tesorería' },
      ]
    case 'patrimonial_codes':
      return [
        { codigoPatrimonial: 'PAT-2024-00001', codigoSIGA: 'SIGA-001', estado: 'OPERATIVO' },
        { codigoPatrimonial: 'PAT-2024-00002', codigoSIGA: 'SIGA-001', estado: 'OPERATIVO' },
        { codigoPatrimonial: 'PAT-2024-00003', codigoSIGA: 'SIGA-002', estado: 'OPERATIVO' },
      ]
    case 'catalog':
      return [
        { codigoCatalogo: 'CAT-001', nombre: 'Laptop HP ProBook', marca: 'HP', modelo: 'ProBook 450' },
        { codigoCatalogo: 'CAT-002', nombre: 'Monitor LED 24"', marca: 'LG', modelo: '24MK430H' },
      ]
    default:
      return []
  }
}

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Obtener historial de sincronización
    const history = await db.syncLog.findMany({
      where: { system: 'SIGA' },
      orderBy: { startedAt: 'desc' },
      take: 20
    })

    const lastSync = history[0] || null

    return NextResponse.json({
      lastSync: lastSync ? {
        id: lastSync.id,
        system: lastSync.system,
        operation: lastSync.operation,
        entityType: lastSync.entityType,
        recordsTotal: lastSync.recordsTotal,
        recordsSuccess: lastSync.recordsSuccess,
        recordsFailed: lastSync.recordsFailed,
        status: lastSync.status,
        startedAt: lastSync.startedAt,
        completedAt: lastSync.completedAt
      } : null,
      history: history.map(log => ({
        id: log.id,
        system: log.system,
        operation: log.operation,
        entityType: log.entityType,
        recordsTotal: log.recordsTotal,
        recordsSuccess: log.recordsSuccess,
        recordsFailed: log.recordsFailed,
        status: log.status,
        startedAt: log.startedAt,
        completedAt: log.completedAt
      })),
      availableEntityTypes: [
        { value: 'items', label: 'Bienes', description: 'Sincronizar bienes del inventario' },
        { value: 'offices', label: 'Oficinas', description: 'Sincronizar oficinas/áreas' },
        { value: 'patrimonial_codes', label: 'Códigos Patrimoniales', description: 'Sincronizar códigos patrimoniales' },
        { value: 'catalog', label: 'Catálogo', description: 'Sincronizar catálogo de bienes' }
      ]
    })
  } catch (error) {
    logger.error('Sync status error:', error)
    return NextResponse.json({ error: 'Error al obtener estado de sincronización' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado. Se requiere rol ADMINISTRADOR' }, { status: 403 })
    }

    const body = await request.json()
    const config = syncConfigSchema.parse(body)
    const { entityType } = config

    const ipAddress = await getClientIP()
    const startTime = new Date()

    // Crear registro de sincronización
    const syncLog = await db.syncLog.create({
      data: {
        system: 'SIGA',
        operation: 'IMPORT',
        entityType,
        recordsTotal: 0,
        recordsSuccess: 0,
        recordsFailed: 0,
        status: 'FAILED',
        startedAt: startTime
      }
    })

    const mockData = getMockSIGAData(entityType)

    // Disparar job asíncrono de sincronización
    const jobId = dispatch('sync:process', {
      entityType,
      records: mockData,
      syncLogId: syncLog.id,
      userId: currentUser.id,
      ipAddress
    })

    // Actualizar registro de sincronización (iniciado)
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        recordsTotal: mockData.length,
        status: 'RUNNING'
      }
    })

    // Registrar auditoría
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: 'IMPORT',
        entityType: 'SyncLog',
        entityId: syncLog.id,
        ipAddress,
        description: `Sincronización SIGA iniciada: ${entityType} - ${mockData.length} registros`,
        severity: 'INFO'
      }
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: `Sincronización de ${entityType} iniciada en segundo plano (${mockData.length} registros)`,
      syncLogId: syncLog.id
    })
  } catch (error) {
    return handleApiError(error)
  }
}
