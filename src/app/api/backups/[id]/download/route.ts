import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
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

    if (backup.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'La copia de seguridad no está completa' }, { status: 400 })
    }

    if (!existsSync(backup.filePath)) {
      return NextResponse.json({ error: 'Archivo de copia no encontrado en el servidor' }, { status: 404 })
    }

    const content = readFileSync(backup.filePath, 'utf8')
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${backup.fileName}"`,
        'Content-Length': String(Buffer.byteLength(content, 'utf8')),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
