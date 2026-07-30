import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/cache', () => ({
  runWithRequestCache: vi.fn((fn: () => unknown) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { getCurrentUser } from '@/lib/auth'

function createMockRequest(overrides = {}): NextRequest {
  return {
    url: 'http://localhost:3000/api/test',
    method: 'GET',
    headers: new Headers(),
    ...overrides,
  } as unknown as NextRequest
}

function createMockUser(role: string = 'ADMINISTRADOR') {
  return {
    id: 1,
    fullName: 'Admin',
    email: 'admin@test.com',
    role,
    isActive: true,
    dni: '12345678',
    phone: null,
    position: 'Admin',
    isDriver: false,
    twoFactorEnabled: false,
    officeId: null,
    office: null,
    createdAt: new Date().toISOString(),
  }
}

describe('apiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna 401 si no hay autenticación', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const handler = apiHandler(async () => NextResponse.json({ ok: true }))
    const req = createMockRequest()
    const res = await handler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('retorna 403 si no tiene el rol requerido', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(createMockUser('TRABAJADOR'))
    const handler = apiHandler(
      async () => NextResponse.json({ ok: true }),
      { roles: ['ADMINISTRADOR'] }
    )
    const req = createMockRequest()
    const res = await handler(req)
    expect(res.status).toBe(403)
  })

  it('ejecuta handler si tiene el rol correcto', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(createMockUser('ADMINISTRADOR'))
    const handler = apiHandler(
      async () => NextResponse.json({ ok: true }),
      { roles: ['ADMINISTRADOR'] }
    )
    const req = createMockRequest()
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('ejecuta handler sin verificación de rol si no se especifica', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(createMockUser('TRABAJADOR'))
    const handler = apiHandler(async () => NextResponse.json({ ok: true }))
    const req = createMockRequest()
    const res = await handler(req)
    expect(res.status).toBe(200)
  })

  it('pasa el usuario al handler cuando está autenticado', async () => {
    const mockUser = createMockUser()
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    const handler = apiHandler(async (_req, user) => {
      return NextResponse.json({ userId: user.id })
    })
    const req = createMockRequest()
    const res = await handler(req)
    const body = await res.json()
    expect(body.userId).toBe(1)
  })

  it('retorna 500 para errores inesperados del handler', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(createMockUser())
    const handler = apiHandler(async () => {
      throw new Error('Error inesperado en el handler')
    })
    const req = createMockRequest()
    const res = await handler(req)
    expect(res.status).toBe(500)
  })
})
