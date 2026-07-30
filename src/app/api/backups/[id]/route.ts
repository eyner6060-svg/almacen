import { NextRequest, NextResponse } from 'next/server'
import { unlinkSync } from 'fs'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const backup = await db.backupLog.findUnique({ where: { id: parseInt(id) } })
    if (!backup) {
      return NextResponse.json({ error: 'Copia de seguridad no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ backup: { ...backup, fileSize: Number(backup.fileSize) } })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const backup = await db.backupLog.findUnique({ where: { id: parseInt(id) } })
    if (!backup) {
      return NextResponse.json({ error: 'Copia de seguridad no encontrada' }, { status: 404 })
    }

    try {
      unlinkSync(backup.filePath)
    } catch { /* ignorar */ }

    await db.backupLog.delete({ where: { id: parseInt(id) } })

    await logAudit({
      userId: currentUser.id,
      action: 'BACKUP_DELETE',
      entityType: 'BackupLog',
      entityId: parseInt(id),
      description: 'Copia de seguridad eliminada: ' + backup.fileName,
      severity: 'INFO',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
