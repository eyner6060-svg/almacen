// CSRF compatible con Edge - usa Web Crypto API en lugar de crypto de Node.js

const CSRF_COOKIE_NAME = 'csrf-token'
const TOKEN_BYTES = 32

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateCsrfToken(): Promise<string> {
  const arr = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(arr)
  return arrayToHex(arr)
}

export async function setCsrfCookie(response?: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } }): Promise<string> {
  const token = await generateCsrfToken()
  const opts = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 8,
    path: '/',
  }
  if (response) {
    response.cookies.set(CSRF_COOKIE_NAME, token, opts)
  } else {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    cookieStore.set(CSRF_COOKIE_NAME, token, opts)
  }
  return token
}

const CSRF_HEADER_NAME = 'x-csrf-token'

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function validateCsrfToken(request: { cookies: { get: (name: string) => { value?: string } | undefined }, headers: { get: (name: string) => string | null } }): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (!cookieToken || !headerToken) return false
  return timingSafeEqual(cookieToken, headerToken)
}


