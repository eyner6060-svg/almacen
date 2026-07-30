import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAuditLogs, exportAuditLogs, AuditAction, EntityType, AuditSeverity } from '@/lib/audit'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// GET - Obtener logs de auditoría con filtros
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo administradores pueden ver logs
    if (user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No tiene permisos para ver logs' }, { status: 403 })
    }

    // Límite de tasa de solicitudes
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`audit:${ip}`, RateLimitPresets.API)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)

    // Parsear filtros
    const filters = {
      userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined,
      action: searchParams.get('action') as AuditAction | undefined,
      entityType: searchParams.get('entityType') as EntityType | undefined,
      entityId: searchParams.get('entityId') ? parseInt(searchParams.get('entityId')!) : undefined,
      severity: searchParams.get('severity') as AuditSeverity | undefined,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    }

    // Verificar si es exportación
    const export_ = searchParams.get('export')
    if (export_ === 'json') {
      const logs = await exportAuditLogs(filters)
      return NextResponse.json(logs, {
        headers: {
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    }

    const result = await getAuditLogs(filters)

    return NextResponse.json({
      ...result,
      rateLimit: {
        remaining: rateLimit.remaining,
        reset: rateLimit.resetTime
      }
    })

  } catch (error) {
    logger.error('[AUDIT] Error al obtener logs:', error)
    return NextResponse.json(
      { error: 'Error al obtener logs de auditoría' },
      { status: 500 }
    )
  }
}
