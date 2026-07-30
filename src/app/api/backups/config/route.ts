import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { cacheGetOrSet, cacheDelete, CacheTTL } from '@/lib/cache'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const config = await cacheGetOrSet(
      'backup:config',
      async () => {
        const c = await db.systemConfig.findFirst({
          select: {
            backupEnabled: true,
            backupSchedule: true,
            backupRetentionDays: true,
            backupPath: true,
          },
        })
        return c ?? {
          backupEnabled: false,
          backupSchedule: null,
          backupRetentionDays: 30,
          backupPath: './backups',
        }
      },
      { ttl: CacheTTL.MEDIUM }
    )

    return NextResponse.json(config)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { backupEnabled, backupSchedule, backupRetentionDays, backupPath } = body

    const config = await db.systemConfig.findFirst({ where: { id: 1 } })
    if (!config) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 })
    }

    const updated = await db.systemConfig.update({
      where: { id: config.id },
      data: {
        ...(backupEnabled !== undefined && { backupEnabled }),
        ...(backupSchedule !== undefined && { backupSchedule }),
        ...(backupRetentionDays !== undefined && { backupRetentionDays }),
        ...(backupPath !== undefined && { backupPath }),
      },
      select: {
        backupEnabled: true,
        backupSchedule: true,
        backupRetentionDays: true,
        backupPath: true,
      },
    })

    await cacheDelete('backup:config')

    await logAudit({
      userId: currentUser.id,
      action: 'BACKUP_CONFIG_UPDATE',
      entityType: 'SystemConfig',
      entityId: config.id,
      description: 'Configuración de copias de seguridad actualizada',
      severity: 'INFO',
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
