import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { html, docNumber, assetsIds, docType = 'ENTREGA' } = body

    if (!html || !docNumber) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const sanitized = docNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    const prefix = docType === 'RETORNO' ? 'Acta_Retorno' : docType === 'PERDIDA' ? 'Declaracion_Perdida' : 'Acta_Entrega'
    const filename = `${prefix}_${sanitized}_${Date.now()}.html`
    const dirPath = join(process.cwd(), 'private', 'uploads', 'docs')
    const filePath = join(dirPath, filename)

    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, html, 'utf-8')

    const docUrl = `/api/files/docs/${filename}`

    if (docType === 'RETORNO' && assetsIds && Array.isArray(assetsIds) && assetsIds.length > 0) {
      await db.assignedAsset.updateMany({
        where: { id: { in: assetsIds.map(Number) } },
        data: { returnDocUrl: docUrl },
      })
    } else if (assetsIds && Array.isArray(assetsIds) && assetsIds.length > 0) {
      await db.assignedAsset.updateMany({
        where: { id: { in: assetsIds.map(Number) } },
        data: { assignmentDocUrl: docUrl },
      })
    } else {
      await db.assignedAsset.updateMany({
        where: { assignmentDocNumber: docNumber },
        data: { assignmentDocUrl: docUrl },
      })
    }

    logAudit({ userId: currentUser.id, action: 'CREATE', entityType: 'PatrimonialUnit', entityId: assetsIds?.[0] || 0, description: `${prefix} ${docNumber} guardada` })

    return NextResponse.json({ url: docUrl })
  } catch (error) {
    logger.error('Error al guardar document:', error)
    return NextResponse.json({ error: 'Error al guardar documento' }, { status: 500 })
  }
}
