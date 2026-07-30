import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, isStrongPassword } from '@/lib/auth'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  try {
    const { token, password, confirmPassword } = await request.json()

    if (!token || !password || !confirmPassword) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Las contraseñas no coinciden' }, { status: 400 })
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y carácter especial' }, { status: 400 })
    }

    const rateLimitResult = await checkRateLimit(`reset-pw:${token}`, RateLimitPresets.LOGIN)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.message }, { status: 429 })
    }

    const resetToken = await db.passwordResetToken.findUnique({ where: { token } })
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
    }

    const hashedPassword = await hashPassword(password)

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ])

    logAudit({ userId: resetToken.userId, action: 'PASSWORD_CHANGE', entityType: 'User', entityId: resetToken.userId, description: 'Contraseña restablecida mediante token' })

    return NextResponse.json({ message: 'Contraseña actualizada exitosamente' })
  } catch (error) {
    logger.error('[RESET-PASSWORD] Error:', error)
    return NextResponse.json({ error: 'Error al restablecer la contraseña' }, { status: 500 })
  }
}
