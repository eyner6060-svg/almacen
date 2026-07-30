import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidEmail } from '@/lib/auth'
import { generateSecureToken } from '@/lib/encryption'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const rateLimitResult = await checkRateLimit(`recovery:${normalizedEmail}`, RateLimitPresets.LOGIN)
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.message }, { status: 429 })
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return NextResponse.json({ error: 'Si el email existe, recibirás instrucciones' }, { status: 200 })
    }

    const token = generateSecureToken(48)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await db.passwordResetToken.upsert({
      where: { userId: user.id },
      update: { token, expiresAt, used: false },
      create: { userId: user.id, token, expiresAt },
    })

    logger.info(`[RECOVERY] Password reset requested for user ${user.id}`)

    return NextResponse.json({
      message: 'Si el email existe, recibirás instrucciones',
    })
  } catch (error) {
    logger.error('[RECOVERY] Error:', error)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
