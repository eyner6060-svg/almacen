import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { checkPinAttempt, recordFailedPinAttempt, resetPinAttempts } from '@/lib/pin-attempts'

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCKOUT_MINUTES = 3

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitResult = await checkRateLimit(`verify-pin:${currentUser.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 10,
      message: 'Demasiados intentos. Espere un minuto.'
    })
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.message }, { status: 429 })
    }

    const body = await request.json()
    const { pin } = body

    if (!pin || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: 'El PIN debe tener 4 dígitos numéricos' }, { status: 400 })
    }

    const attempt = await checkPinAttempt(currentUser.id, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MINUTES)
    if (attempt.locked) {
      return NextResponse.json({
        error: `Demasiados intentos fallidos. Espere ${PIN_LOCKOUT_MINUTES} minutos.`
      }, { status: 429 })
    }

    if (!currentUser.pin) {
      return NextResponse.json({ error: 'No tiene un PIN configurado' }, { status: 400 })
    }

    const isValid = await bcrypt.compare(pin, currentUser.pin)
    if (!isValid) {
      await recordFailedPinAttempt(currentUser.id, MAX_PIN_ATTEMPTS, PIN_LOCKOUT_MINUTES)
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    await resetPinAttempts(currentUser.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Verify PIN error:', error)
    return NextResponse.json({ error: 'Error al verificar PIN' }, { status: 500 })
  }
}
