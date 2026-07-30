import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { TOTP, generateSecret, generateURI } from 'otplib'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const totp = new TOTP()

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { action } = await request.json()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

    // Rate limiting para acciones de 2FA
    const rateLimitKey = `2fa:${action}:${user.id}:${ip}`
    const rateLimitResult = await checkRateLimit(rateLimitKey, {
      windowMs: 60 * 1000,
      maxRequests: 5,
      message: 'Demasiados intentos. Espere un minuto.'
    })
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: rateLimitResult.message }, { status: 429 })
    }

    // Configuración: generar secreto y devolver datos QR SIN habilitar aún
    if (action === 'setup') {
      const secret = generateSecret()
      const otpauth = generateURI({ strategy: 'totp', label: user.email, issuer: 'AlmacenInstitucional', secret })

      return NextResponse.json({
        secret,
        otpauth,
        qrCodeUrl: otpauth,
      })
    }

    // Verificar código y habilitar 2FA
    if (action === 'enable') {
      const { code, secret } = await request.json()
      if (!code || !secret) {
        return NextResponse.json({ error: 'Código y secreto requeridos' }, { status: 400 })
      }

      const isValid = totp.verify(code, { secret })
      if (!isValid) {
        return NextResponse.json({ error: 'Código inválido. Verifique e intente nuevamente.' }, { status: 400 })
      }

      await db.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: secret, twoFactorEnabled: true },
      })

      await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        description: '2FA habilitado',
        newValue: { twoFactorEnabled: true },
      })

      return NextResponse.json({ message: '2FA activado exitosamente' })
    }

    // Deshabilitar 2FA
    if (action === 'disable') {
      const userWithSecret = await db.user.findUnique({
        where: { id: user.id },
        select: { twoFactorSecret: true },
      })
      if (!userWithSecret?.twoFactorSecret) {
        return NextResponse.json({ error: '2FA no está configurado' }, { status: 400 })
      }

      await db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      })

      await logAudit({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        description: '2FA deshabilitado',
        newValue: { twoFactorEnabled: false },
      })

      return NextResponse.json({ message: '2FA deshabilitado exitosamente' })
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  } catch (error) {
    logger.error('[2FA] Error:', error)
    return NextResponse.json({ error: 'Error al procesar 2FA' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    return NextResponse.json({
      twoFactorEnabled: user.twoFactorEnabled || false,
    })
  } catch (error) {
    logger.error('[2FA] Error:', error)
    return NextResponse.json({ error: 'Error al obtener estado 2FA' }, { status: 500 })
  }
}
