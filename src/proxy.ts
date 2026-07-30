import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateCsrfToken } from '@/lib/csrf'

const SESSION_COOKIE_NAME = 'session_user_id'
const SESSION_TOKEN_COOKIE = 'session_token'

const PUBLIC_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/recovery',
  '/api/auth/reset-password',
  '/api/system/health',
])

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const normalizedPath = pathname.replace(/\/\.\.(\/|$)/g, '/').replace(/\/\//g, '/')

  if (
    !normalizedPath.startsWith('/api/') ||
    normalizedPath.startsWith('/_next/') ||
    normalizedPath === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  if (PUBLIC_ROUTES.has(normalizedPath)) {
    return NextResponse.next()
  }

  if (normalizedPath === '/api/system/health') {
    return NextResponse.next()
  }

  if (!SAFE_METHODS.has(request.method)) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'CSRF token inválido', code: 'CSRF_TOKEN_INVALID' },
        { status: 403 }
      )
    }
  }

  const userId = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const sessionToken = request.cookies.get(SESSION_TOKEN_COOKIE)?.value

  if (!userId || !sessionToken) {
    if (request.method === 'GET' && normalizedPath === '/api/auth/me') {
      return NextResponse.next()
    }
    return NextResponse.json(
      { error: 'No autorizado', code: 'UNAUTHORIZED' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|uploads/|sw.js|manifest.json|offline.html|logo.svg|robots.txt).*)',
  ],
}
