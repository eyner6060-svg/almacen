import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const signatureId = parseInt(id)

    const signature = await db.digitalSignature.findUnique({
      where: { id: signatureId }
    })

    if (!signature) {
      return NextResponse.json({ error: 'Firma no encontrada' }, { status: 404 })
    }

    if (currentUser.role !== 'ADMINISTRADOR' && signature.userId !== currentUser.id) {
      return NextResponse.json({ error: 'No tiene permisos para eliminar esta firma' }, { status: 403 })
    }

    await db.digitalSignature.delete({
      where: { id: signatureId }
    })

    logAudit({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'DigitalSignature',
      entityId: signatureId,
      description: `Firma digital eliminada para ${signature.documentType} #${signature.documentId}`
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete signature error:', error)
    return NextResponse.json({ error: 'Error al eliminar firma' }, { status: 500 })
  }
}
