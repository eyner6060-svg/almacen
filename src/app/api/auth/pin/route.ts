import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { logAudit } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitResult = await checkRateLimit(`pin:${currentUser.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 3,
      message: 'Demasiados intentos de cambio de PIN. Espere un minuto.'
    })
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.message }, { status: 429 })
    }

    const body = await request.json()
    const { currentPin, newPin } = body

    if (!newPin || !/^\d{4}$/.test(newPin)) {
      return NextResponse.json({ error: 'El PIN debe tener 4 dígitos numéricos' }, { status: 400 })
    }

    if (currentUser.pin) {
      if (!currentPin || !(await bcrypt.compare(currentPin, currentUser.pin))) {
        return NextResponse.json({ error: 'El PIN actual no es correcto' }, { status: 400 })
      }
    }

    const hashedPin = await bcrypt.hash(newPin, 10)

    await db.user.update({
      where: { id: currentUser.id },
      data: { pin: hashedPin },
    })

    logAudit({ userId: currentUser.id, action: 'PIN_CHANGE', entityType: 'User', entityId: currentUser.id, description: `PIN actualizado por ${currentUser.fullName}` })

    return NextResponse.json({ success: true, message: 'PIN actualizado correctamente' })
  } catch (error) {
    logger.error('Change PIN error:', error)
    return NextResponse.json({ error: 'Error al cambiar el PIN' }, { status: 500 })
  }
}
