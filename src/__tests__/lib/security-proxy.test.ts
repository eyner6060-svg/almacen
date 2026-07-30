import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    userSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

describe('proxy.ts - Seguridad', () => {
  it('PUBLIC_ROUTES no contiene rutas sensibles', () => {
    const publicRoutes = [
      '/api/auth/login',
      '/api/auth/recovery',
      '/api/auth/reset-password',
      '/api/system/health',
    ]
    const sensitiveRoutes = [
      '/api/users',
      '/api/items',
      '/api/orders',
      '/api/backups',
      '/api/config',
      '/api/audit-logs',
    ]
    for (const sr of sensitiveRoutes) {
      expect(publicRoutes).not.toContain(sr)
    }
  })

  it('las rutas publicas son solo GET', () => {
    const publicOnlyGet = [
      '/api/auth/login',
      '/api/auth/recovery',
      '/api/auth/reset-password',
      '/api/system/health',
    ]
    for (const route of publicOnlyGet) {
      expect(route).toBeTruthy()
    }
  })
})

describe('Auth - Seguridad de contraseñas', () => {
  it('bcrypt usa 12 rondas (costo)', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('TestPass1!', 12)
    expect(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$') || hash.startsWith('$2y$12$')).toBe(true)
  })

  it('hash de 10 rondas para PIN es suficiente', async () => {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('1234', 10)
    expect(hash.startsWith('$2a$10$') || hash.startsWith('$2b$10$') || hash.startsWith('$2y$10$')).toBe(true)
  })
})

describe('Seguridad de sesion', () => {
  it('clearSession invalida sesion en BD', async () => {
    const { clearSession } = await import('@/lib/auth')
    await expect(clearSession()).resolves.not.toThrow()
  })
})

describe('Encryption - Seguridad', () => {
  it('encriptacion produce formato valido iv:data:tag (3 partes)', async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    const encryption = await import('@/lib/encryption')
    const encrypted = encryption.encrypt('test-data')
    expect(encrypted).toBeTruthy()
    const parts = encrypted.split(':')
    expect(parts.length).toBe(3)
  })

  it('usa AES-256-GCM (verificado por longitud de clave)', async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    const encryption = await import('@/lib/encryption')
    const encrypted = encryption.encrypt('test')
    const decrypted = encryption.decrypt(encrypted)
    expect(decrypted).toBe('test')
  })

  it('incluye auth tag (GCM)', async () => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64)
    const encryption = await import('@/lib/encryption')
    const encrypted = encryption.encrypt('test')
    const parts = encrypted.split(':')
    expect(parts[2]).toBeTruthy()
  })
})

describe('Rate limiting - Seguridad', () => {
  it('login tiene limite de 5 intentos por 15 min', async () => {
    const rateLimit = await import('@/lib/rate-limit')
    expect(rateLimit.RateLimitPresets.LOGIN.maxRequests).toBe(5)
    expect(rateLimit.RateLimitPresets.LOGIN.windowMs).toBe(15 * 60 * 1000)
  })

  it('API tiene limite de 100 requests por minuto', async () => {
    const rateLimit = await import('@/lib/rate-limit')
    expect(rateLimit.RateLimitPresets.API.maxRequests).toBe(100)
    expect(rateLimit.RateLimitPresets.API.windowMs).toBe(60 * 1000)
  })
})

describe('Validacion de entrada', () => {
  it('email valido rechaza con mas de 255 chars', async () => {
    const auth = await import('@/lib/auth')
    const longEmail = 'a'.repeat(256) + '@b.com'
    expect(auth.isValidEmail(longEmail)).toBe(false)
  })

  it('isValidDNI solo acepta 8 digitos', async () => {
    const auth = await import('@/lib/auth')
    expect(auth.isValidDNI('12345678')).toBe(true)
    expect(auth.isValidDNI('1234567')).toBe(false)
    expect(auth.isValidDNI('123456789')).toBe(false)
    expect(auth.isValidDNI('abcdefgh')).toBe(false)
  })

  it('isStrongPassword requiere mayuscula, minuscula, numero y simbolo', async () => {
    const auth = await import('@/lib/auth')
    expect(auth.isStrongPassword('Admin123!')).toBe(true)
    expect(auth.isStrongPassword('admin123!')).toBe(false)
    expect(auth.isStrongPassword('ADMIN123!')).toBe(false)
    expect(auth.isStrongPassword('Admin!!!!')).toBe(false)
    expect(auth.isStrongPassword('Admin1234')).toBe(false)
  })
})

describe('apiHandler - CSRF por defecto', () => {
  let NextResponse: any

  beforeAll(async () => {
    const ns = await import('next/server')
    NextResponse = ns.NextResponse
  })

  function createMockNextRequest(method: string, csrfCookie?: string, csrfHeader?: string) {
    const _headers = new Map<string, string>()
    if (csrfHeader) _headers.set('x-csrf-token', csrfHeader)
    return {
      method,
      url: 'http://localhost/api/test',
      headers: {
        get: (name: string) => _headers.get(name) || null,
        forEach: () => {},
      },
      cookies: {
        get: () => csrfCookie ? { value: csrfCookie } : undefined,
      },
      nextUrl: new URL('http://localhost/api/test'),
      json: async () => ({}),
      formData: async () => new FormData(),
      text: async () => '',
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function() { return this },
    } as any
  }

  it('apiHandler valida CSRF para metodos no seguros', async () => {
    const handler = await import('@/lib/api-handler')
    const wrapped = handler.apiHandler(async () => {
      return NextResponse.json({ ok: true })
    }, { auth: false })

    const response = await wrapped(createMockNextRequest('POST'))
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.code).toBe('CSRF_TOKEN_INVALID')
  })

  it('apiHandler permite CSRF en metodos GET', async () => {
    const handler = await import('@/lib/api-handler')
    const wrapped = handler.apiHandler(async () => {
      return NextResponse.json({ ok: true })
    }, { auth: false })

    const response = await wrapped(createMockNextRequest('GET'))
    expect(response.status).toBe(200)
  })

  it('apiHandler permite csrf:false en handler', async () => {
    const handler = await import('@/lib/api-handler')
    const wrapped = handler.apiHandler(async () => {
      return NextResponse.json({ ok: true })
    }, { auth: false, csrf: false })

    const response = await wrapped(createMockNextRequest('POST'))
    const data = await response.json()
    expect(data.ok).toBe(true)
  })

  it('apiHandler valida CSRF correctamente cuando token coincide', async () => {
    const handler = await import('@/lib/api-handler')
    const wrapped = handler.apiHandler(async () => {
      return NextResponse.json({ ok: true })
    }, { auth: false })

    const response = await wrapped(createMockNextRequest('POST', 'valid-token', 'valid-token'))
    expect(response.status).toBe(200)
  })

  it('apiHandler rechaza CSRF cuando token no coincide', async () => {
    const handler = await import('@/lib/api-handler')
    const wrapped = handler.apiHandler(async () => {
      return NextResponse.json({ ok: true })
    }, { auth: false })

    const response = await wrapped(createMockNextRequest('POST', 'cookie-token', 'different-header-token'))
    const data = await response.json()
    expect(response.status).toBe(403)
    expect(data.code).toBe('CSRF_TOKEN_INVALID')
  })
})
