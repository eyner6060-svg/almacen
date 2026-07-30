import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    await db.notification.updateMany({
      where: { id: parseInt(id), userId: currentUser.id },
      data: { isRead: true }
    })

    logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'User', entityId: currentUser.id, description: `Notificación ${id} marcada como leída` })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Mark notification as read error:', error)
    return NextResponse.json({ error: 'Error al marcar notificación como leída' }, { status: 500 })
  }
}
