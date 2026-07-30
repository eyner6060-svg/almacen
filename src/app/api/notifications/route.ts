import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      db.notification.count({
        where: { userId: currentUser.id, isRead: false }
      })
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    logger.error('Error al obtener notificaciones:', error)
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const markAll = searchParams.get('markAll')
    const id = searchParams.get('id')

    if (markAll) {
      await db.notification.updateMany({
        where: { userId: currentUser.id, isRead: false },
        data: { isRead: true }
      })
    } else if (id) {
      await db.notification.updateMany({
        where: { id: parseInt(id), userId: currentUser.id },
        data: { isRead: true }
      })
    }

    await cacheDelete(CacheKeys.notificationList(currentUser.id))

    logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'User', entityId: currentUser.id, description: id ? `Notificación ${id} marcada como leída` : 'Todas las notificaciones marcadas como leídas' })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error al actualizar notificación:', error)
    return NextResponse.json({ error: 'Error al actualizar notificación' }, { status: 500 })
  }
}
