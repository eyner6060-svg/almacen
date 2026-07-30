import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }))

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: mockCreate,
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace('encrypted:', '')),
}))

describe('logAudit', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('registra entrada de auditoría correctamente', async () => {
    await logAudit({
      action: 'CREATE',
      entityType: 'Item',
      entityId: 1,
      description: 'Creación de ítem',
    })
    expect(mockCreate).toHaveBeenCalledTimes(1)
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('CREATE')
    expect(call.data.entityType).toBe('Item')
    expect(call.data.severity).toBe('INFO')
  })

  it('asigna severidad CRITICAL para DELETE', async () => {
    await logDelete(1, 'Item', 1, {})
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.severity).toBe('CRITICAL')
  })

  it('asigna severidad WARNING para AUTHORIZE', async () => {
    await logAudit({
      action: 'AUTHORIZE',
      entityType: 'Order',
      entityId: 1,
      description: 'Autorización',
    })
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.severity).toBe('WARNING')
  })

  it('registra LOGIN_FAILED con severidad WARNING', async () => {
    await logLogin(null, false, 'test@test.com')
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('LOGIN_FAILED')
    expect(call.data.severity).toBe('WARNING')
  })

  it('registra LOGIN exitoso con severidad INFO', async () => {
    await logLogin(1, true, 'test@test.com')
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('LOGIN')
    expect(call.data.severity).toBe('INFO')
  })

  it('no lanza error si falla la base de datos', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB error'))
    await expect(logAudit({
      action: 'CREATE',
      entityType: 'Item',
      description: 'Test',
    })).resolves.not.toThrow()
  })
})

describe('log functions', () => {
  beforeEach(() => {
    mockCreate.mockClear()
  })

  it('logLogout registra cierre de sesión', async () => {
    const { logLogout } = await import('@/lib/audit')
    await logLogout(1)
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('LOGOUT')
    expect(call.data.description).toBe('Cierre de sesión')
  })

  it('logCreate guarda newValue', async () => {
    const { logCreate } = await import('@/lib/audit')
    await logCreate(1, 'Item', 1, { name: 'Test Item' })
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('CREATE')
    expect(call.data.newValue).toBeTruthy()
  })

  it('logUpdate guarda oldValue y newValue', async () => {
    const { logUpdate } = await import('@/lib/audit')
    await logUpdate(1, 'Item', 1, { name: 'Old' }, { name: 'New' })
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('UPDATE')
    expect(call.data.oldValue).toBeTruthy()
    expect(call.data.newValue).toBeTruthy()
  })

  it('logRejection guarda razón', async () => {
    const { logRejection } = await import('@/lib/audit')
    await logRejection(1, 'Order', 1, 'Documentación incompleta')
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.description).toContain('Documentación incompleta')
    expect(call.data.severity).toBe('WARNING')
  })

  it('logRoleChange guarda cambio de rol', async () => {
    const { logRoleChange } = await import('@/lib/audit')
    await logRoleChange(1, 2, 'TRABAJADOR', 'ALMACENERO')
    const call = mockCreate.mock.calls[0]![0]
    expect(call.data.action).toBe('ROLE_CHANGE')
    expect(call.data.severity).toBe('CRITICAL')
    expect(call.data.description).toContain('TRABAJADOR a ALMACENERO')
  })
})

import { logAudit, logLogin, logDelete } from '@/lib/audit'
