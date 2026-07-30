import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Simular todas las dependencias de la ruta de pedidos
vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  RateLimitPresets: { CREATE: { windowMs: 60000, maxRequests: 20 } },
}))

vi.mock('@/lib/cache', () => ({
  cacheDelete: vi.fn(),
  CacheKeys: { pendingOrders: vi.fn(() => 'orders:pending'), orderList: vi.fn(() => 'orders:list'), officeList: vi.fn(() => 'offices:list') },
}))

vi.mock('@/lib/document-sequence', () => ({
  getNextDocumentNumber: vi.fn(() => ({ documentNumber: 'ORDEN_SALIDA-001' })),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

import { GET, POST } from '@/app/api/orders/route'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (await import('@/lib/db')).db as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const auth = (await import('@/lib/auth')) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rateLimit = (await import('@/lib/rate-limit')) as any

const mockUser = {
  id: 1,
  fullName: 'Admin Test',
  dni: '12345678',
  phone: null,
  position: 'Admin',
  email: 'admin@test.com',
  password: 'hashed',
  pin: '1234',
  role: 'ADMINISTRADOR' as const,
  isActive: true,
  isDriver: false,
  twoFactorEnabled: false,
  officeId: 1,
  office: { id: 1, name: 'Oficina Admin' },
  createdAt: new Date(),
}

function createNextRequest(overrides: {
  url?: string
  method?: string
  body?: unknown
  headers?: Record<string, string>
} = {}) {
  const url = overrides.url || 'http://localhost:3000/api/orders'
  const body = overrides.body !== undefined ? JSON.stringify(overrides.body) : undefined
  return new NextRequest(url, {
    method: overrides.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...overrides.headers },
    body,
  })
}

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.getCurrentUser.mockResolvedValue(mockUser)
  })

  it('retorna 401 si no está autenticado', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    const req = createNextRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it('retorna lista paginada de órdenes', async () => {
    const mockOrders = [
      { id: 1, status: 'PENDIENTE', requestedBy: { id: 1, fullName: 'Admin' }, items: [] },
      { id: 2, status: 'COMPLETADO', requestedBy: { id: 1, fullName: 'Admin' }, items: [] },
    ]
    db.order.findMany.mockResolvedValue(mockOrders)
    db.order.count.mockResolvedValue(2)

    const req = createNextRequest({ url: 'http://localhost:3000/api/orders?page=1&perPage=20' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.orders).toHaveLength(2)
    expect(body.pagination).toBeDefined()
    expect(body.pagination.total).toBe(2)
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.perPage).toBe(20)
  })

  it('aplica filtro por status', async () => {
    db.order.findMany.mockResolvedValue([])
    db.order.count.mockResolvedValue(0)

    await GET(createNextRequest({ url: 'http://localhost:3000/api/orders?status=PENDIENTE' }))
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDIENTE' }),
      })
    )
  })

  it('filtra por oficina cuando el usuario es JEFE_OFICINA', async () => {
    const jefeUser = { ...mockUser, role: 'JEFE_OFICINA', office: { id: 2, name: 'Oficina 2' } }
    auth.getCurrentUser.mockResolvedValue(jefeUser)
    db.order.findMany.mockResolvedValue([])
    db.order.count.mockResolvedValue(0)

    await GET(createNextRequest())
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ officeId: 2 }),
      })
    )
  })

  it('restringe a órdenes propias cuando el usuario es TRABAJADOR', async () => {
    const workerUser = { ...mockUser, role: 'TRABAJADOR' }
    auth.getCurrentUser.mockResolvedValue(workerUser)
    db.order.findMany.mockResolvedValue([])
    db.order.count.mockResolvedValue(0)

    await GET(createNextRequest())
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requestedById: 1 }),
      })
    )
  })

  it('respeta límites de paginación', async () => {
    db.order.findMany.mockResolvedValue([])
    db.order.count.mockResolvedValue(0)

    await GET(createNextRequest({ url: 'http://localhost:3000/api/orders?page=2&perPage=10' }))
    expect(db.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    )
  })

  it('retorna error 500 si la consulta falla', async () => {
    db.order.findMany.mockRejectedValue(new Error('DB error'))
    const req = createNextRequest()
    const res = await GET(req)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/orders', () => {
  const validOrderPayload = {
    items: [{ itemId: 1, quantity: 5 }],
    officeId: 1,
    notes: 'Entrega urgente',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    auth.getCurrentUser.mockResolvedValue(mockUser)
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetTime: Date.now() + 60000 })
  })

  it('retorna 401 si no está autenticado', async () => {
    auth.getCurrentUser.mockResolvedValue(null)
    const req = createNextRequest({ method: 'POST', body: validOrderPayload })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('retorna 429 si se excede el rate limit', async () => {
    rateLimit.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60000, message: 'Demasiadas solicitudes' })
    const req = createNextRequest({ method: 'POST', body: validOrderPayload })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })

  it('retorna 400 si faltan campos requeridos', async () => {
    const req = createNextRequest({ method: 'POST', body: {} })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 si no hay oficina asignada', async () => {
    const userWithoutOffice = { ...mockUser, office: null, officeId: null }
    auth.getCurrentUser.mockResolvedValue(userWithoutOffice)
    const req = createNextRequest({ method: 'POST', body: { items: [{ itemId: 1, quantity: 5 }] } })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('oficina')
  })

  it('retorna 400 cuando el stock es insuficiente', async () => {
    db.$transaction.mockRejectedValue(new Error('Stock insuficiente para Laptop'))
    const req = createNextRequest({ method: 'POST', body: validOrderPayload })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Stock insuficiente')
  })

  it('retorna 400 cuando la unidad patrimonial no está disponible', async () => {
    db.$transaction.mockRejectedValue(new Error('La unidad patrimonial no está disponible'))
    const req = createNextRequest({ method: 'POST', body: validOrderPayload })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('crea pedido exitosamente', async () => {
    const createdOrder = {
      id: 1,
      orderNumber: 'ORDEN_SALIDA-001',
      status: 'PENDIENTE',
      requestedById: 1,
      officeId: 1,
      notes: 'Entrega urgente',
      items: [{ id: 1, itemId: 1, quantity: 5 }],
      requestedBy: { id: 1, fullName: 'Admin' },
      office: { id: 1, name: 'Oficina Admin' },
    }
    db.$transaction.mockResolvedValue(createdOrder)
    db.user.findMany
      .mockResolvedValueOnce([{ id: 2 }]) // jefes
      .mockResolvedValueOnce([{ id: 3 }, { id: 4 }]) // admins y almaceneros
    db.notification.createMany.mockResolvedValue({ count: 3 })

    const req = createNextRequest({ method: 'POST', body: validOrderPayload })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.order).toBeDefined()
    expect(body.order.orderNumber).toBe('ORDEN_SALIDA-001')
    expect(body.order.status).toBe('PENDIENTE')
  })

  it('notifica a jefes y administradores al crear pedido', async () => {
    const createdOrder = {
      id: 1,
      orderNumber: 'ORDEN_SALIDA-001',
      status: 'PENDIENTE',
      requestedById: 1,
      officeId: 1,
      notes: '',
      items: [],
      requestedBy: { id: 1, fullName: 'Admin' },
      office: { id: 1, name: 'Oficina Admin' },
    }
    db.$transaction.mockResolvedValue(createdOrder)
    db.user.findMany
      .mockResolvedValueOnce([{ id: 2 }, { id: 5 }])
      .mockResolvedValueOnce([{ id: 3 }])
    db.notification.createMany.mockResolvedValue({ count: 3 })

    await POST(createNextRequest({ method: 'POST', body: validOrderPayload }))
    expect(db.notification.createMany).toHaveBeenCalled()
  })
})
