import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { mkdirSync, writeFileSync, statSync } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
    }

    if (!file.name.endsWith('.sql')) {
      return NextResponse.json({ error: 'Solo se permiten archivos .sql' }, { status: 400 })
    }

    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede el límite de 500 MB' }, { status: 400 })
    }

    const backupsBase = path.join(/* turbopackIgnore: true */ process.cwd(), 'backups')
    mkdirSync(backupsBase, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup-upload-${timestamp}.sql`
    const filePath = path.join(backupsBase, fileName)

    const buffer = Buffer.from(await file.arrayBuffer())
    writeFileSync(filePath, buffer)

    const stats = statSync(filePath)

    const backupLog = await db.backupLog.create({
      data: {
        fileName,
        fileSize: BigInt(stats.size),
        type: 'MANUAL',
        status: 'COMPLETED',
        filePath,
        triggeredBy: currentUser.id,
        completedAt: new Date(),
      },
    })

    await logAudit({
      userId: currentUser.id,
      action: 'BACKUP_CREATE',
      entityType: 'BackupLog',
      entityId: backupLog.id,
      description: 'Respaldo cargado manualmente: ' + file.name + ' (' + (stats.size / 1024 / 1024).toFixed(2) + ' MB)',
      severity: 'INFO',
    })

    return NextResponse.json({ id: backupLog.id, fileName, status: 'COMPLETED' })
  } catch (error) {
    logger.error('Error en upload backup:', error)
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno del servidor' }, { status: 500 })
    }
    return handleApiError(error)
  }
}
