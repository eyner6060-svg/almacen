import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { logLogin } from '@/lib/audit'
import { setCsrfCookie } from '@/lib/csrf'
import { apiHandler } from '@/lib/api-handler'

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown'
}

function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown'
}

// GET: Inicializar CSRF token para el formulario de login
export const GET = apiHandler(async () => {
  const response = NextResponse.json({ ok: true })
  await setCsrfCookie(response)
  return response
}, { auth: false, csrf: false })

export const POST = apiHandler(async (request: NextRequest) => {
  const ip = getClientIP(request)
  const userAgent = getUserAgent(request)

  const rateLimitResult = await checkRateLimit(`login:${ip}`, RateLimitPresets.LOGIN)
  if (!rateLimitResult.allowed) {
    await logLogin(null, false, `rate-limited-ip:${ip}`)
    return NextResponse.json(
      { error: rateLimitResult.message },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(RateLimitPresets.LOGIN.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000))
        }
      }
    )
  }

  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email y contraseña son requeridos' },
      { status: 400 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()
  const result = await loginUser(normalizedEmail, password, ip, userAgent)

  if (!result.success) {
    const currentRateLimit = await checkRateLimit(`login:${ip}`, RateLimitPresets.LOGIN)
    return NextResponse.json(
      { error: result.error },
      {
        status: 401,
        headers: {
          'X-RateLimit-Limit': String(RateLimitPresets.LOGIN.maxRequests),
          'X-RateLimit-Remaining': String(currentRateLimit.remaining),
          'X-RateLimit-Reset': String(Math.ceil(currentRateLimit.resetTime / 1000))
        }
      }
    )
  }

  const response = NextResponse.json({
    user: result.user,
    message: 'Inicio de sesión exitoso'
  }, {
    headers: {
      'X-RateLimit-Limit': String(RateLimitPresets.LOGIN.maxRequests),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000))
    }
  })

  await setCsrfCookie(response)
  return response
}, { auth: false, csrf: false })
