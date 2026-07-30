import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

// GET - Obtener preferencias de notificación
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const preferences = await db.notificationPreference.findMany({
      where: {
        userId: user.id,
      },
    })

    // Si no existen preferencias, crear las predeterminadas
    if (preferences.length === 0) {
      const defaultTypes = [
        'STOCK_BAJO',
        'PEDIDO_PENDIENTE',
        'PEDIDO_AUTORIZADO',
        'PEDIDO_RECHAZADO',
        'BIEN_VENCIDO',
        'GARANTIA_PROXIMA_VENCER',
        'ITEM_MOVIMIENTO',
        'WORKFLOW_EJECUTADO',
        'REPORTE_MENSUAL',
      ]

      await db.notificationPreference.createMany({
        data: defaultTypes.map((type) => ({
          userId: user.id,
          notifType: type,
          emailEnabled: true,
          pushEnabled: true,
          smsEnabled: false,
        })),
      })

      const createdPreferences = await db.notificationPreference.findMany({
        where: { userId: user.id },
      })

      return NextResponse.json({ preferences: createdPreferences })
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    logger.error('Error al obtener notification preferences:', { error })
    return NextResponse.json({ error: 'Error al obtener preferencias' }, { status: 500 })
  }
}

// PUT - Actualizar preferencia de notificación
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { notifType, emailEnabled, pushEnabled, smsEnabled } = body

    if (!notifType) {
      return NextResponse.json({ error: 'Tipo de notificación requerido' }, { status: 400 })
    }

    // Crear o actualizar la preferencia
    const preference = await db.notificationPreference.upsert({
      where: {
        userId_notifType: {
          userId: user.id,
          notifType,
        },
      },
      update: {
        emailEnabled: emailEnabled ?? true,
        pushEnabled: pushEnabled ?? true,
        smsEnabled: smsEnabled ?? false,
      },
      create: {
        userId: user.id,
        notifType,
        emailEnabled: emailEnabled ?? true,
        pushEnabled: pushEnabled ?? true,
        smsEnabled: smsEnabled ?? false,
      },
    })

    logAudit({ userId: user.id, action: 'UPDATE', entityType: 'User', entityId: user.id, description: `Preferencia de notificación actualizada: ${notifType}` })

    return NextResponse.json({ preference })
  } catch (error) {
    logger.error('Error updating notification preference:', { error })
    return NextResponse.json({ error: 'Error al actualizar preferencia' }, { status: 500 })
  }
}
