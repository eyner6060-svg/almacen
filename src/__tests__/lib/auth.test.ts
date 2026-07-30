import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'

// Debe estar al nivel superior para que Vitest lo eleve — afecta todas las importaciones de @/lib/auth
vi.mock('@/lib/db', () => ({
  db: {
    securityEvent: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logLogin: vi.fn(),
  logLogout: vi.fn(),
  logAudit: vi.fn(),
  logCreate: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  generateSecureToken: vi.fn(() => 'mock-session-token'),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

import {
  isValidEmail,
  isValidDNI,
  isValidPIN,
  isStrongPassword,
  isLockedOut,
  recordFailedAttempt,
  clearFailedAttempts,
  hashPassword,
  verifyPassword,
} from '@/lib/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (await import('@/lib/db')).db as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const audit = (await import('@/lib/audit')) as any

const mockUser = {
  id: 1,
  fullName: 'Admin Test',
  dni: '12345678',
  phone: null,
  position: 'Admin',
  email: 'admin@test.com',
  password: '',
  pin: '1234',
  role: 'ADMINISTRADOR',
  isActive: true,
  isDriver: false,
  twoFactorEnabled: false,
  officeId: 1,
  office: { id: 1, name: 'Oficina Admin' },
  createdAt: new Date(),
}

beforeAll(async () => {
  const hash = await bcrypt.hash('ValidPass1!', 4)
  mockUser.password = hash
})

afterAll(() => {
  vi.restoreAllMocks()
})

describe('isValidEmail', () => {
  it('acepta emails válidos', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('admin@institucion.gob.pe')).toBe(true)
    expect(isValidEmail('a.b@c.co')).toBe(true)
  })

  it('rechaza emails inválidos', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('notanemail')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user@.com')).toBe(false)
  })

  it('rechaza emails demasiado largos', () => {
    const long = 'a'.repeat(256) + '@b.com'
    expect(isValidEmail(long)).toBe(false)
  })
})

describe('isValidDNI', () => {
  it('acepta DNI peruano de 8 dígitos', () => {
    expect(isValidDNI('12345678')).toBe(true)
    expect(isValidDNI('00000001')).toBe(true)
  })

  it('rechaza DNIs inválidos', () => {
    expect(isValidDNI('')).toBe(false)
    expect(isValidDNI('1234567')).toBe(false)
    expect(isValidDNI('123456789')).toBe(false)
    expect(isValidDNI('abcdefgh')).toBe(false)
    expect(isValidDNI('1234 678')).toBe(false)
  })
})

describe('isValidPIN', () => {
  it('acepta PIN de 4 dígitos', () => {
    expect(isValidPIN('1234')).toBe(true)
    expect(isValidPIN('0000')).toBe(true)
  })

  it('rechaza PINs inválidos', () => {
    expect(isValidPIN('')).toBe(false)
    expect(isValidPIN('123')).toBe(false)
    expect(isValidPIN('12345')).toBe(false)
    expect(isValidPIN('abcd')).toBe(false)
    expect(isValidPIN('12 4')).toBe(false)
  })
})

describe('isStrongPassword', () => {
  it('acepta contraseñas fuertes', () => {
    expect(isStrongPassword('Admin123!')).toBe(true)
    expect(isStrongPassword('Str0ng!Pass')).toBe(true)
    expect(isStrongPassword('Abcdef1$xyz')).toBe(true)
  })

  it('rechaza contraseñas sin mayúscula', () => {
    expect(isStrongPassword('admin123!')).toBe(false)
  })

  it('rechaza contraseñas sin minúscula', () => {
    expect(isStrongPassword('ADMIN123!')).toBe(false)
  })

  it('rechaza contraseñas sin número', () => {
    expect(isStrongPassword('Admin!!!!')).toBe(false)
  })

  it('rechaza contraseñas sin símbolo', () => {
    expect(isStrongPassword('Admin1234')).toBe(false)
  })

  it('rechaza contraseñas cortas (< 8)', () => {
    expect(isStrongPassword('Ab1!')).toBe(false)
  })
})

describe('hashPassword and verifyPassword', () => {
  it('hashea y verifica contraseña correcta', async () => {
    const hash = await hashPassword('Test1234!')
    expect(hash).toBeTruthy()
    expect(hash).not.toBe('Test1234!')
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true)
    const valid = await verifyPassword('Test1234!', hash)
    expect(valid).toBe(true)
  })

  it('rechaza contraseña incorrecta', async () => {
    const hash = await hashPassword('Test1234!')
    const valid = await verifyPassword('WrongPass1!', hash)
    expect(valid).toBe(false)
  })

  it('lanza error para contraseña débil', async () => {
    await expect(hashPassword('weak')).rejects.toThrow('requisitos de seguridad')
  })

  it('verifyPassword no lanza para hash inválido', async () => {
    const valid = await verifyPassword('Test1234!', 'invalid-hash')
    expect(valid).toBe(false)
  })
})

describe('isLockedOut, recordFailedAttempt, clearFailedAttempts', () => {
  const testIdentifier = 'lockout-test@user.com'
  const now = new Date()

  beforeEach(() => {
    vi.clearAllMocks()
    // Valor predeterminado: sin intentos fallidos
    db.securityEvent.count.mockResolvedValue(0)
    db.securityEvent.findFirst.mockResolvedValue(null)
    db.securityEvent.create.mockResolvedValue({ id: 1 })
    db.securityEvent.deleteMany.mockResolvedValue({ count: 0 })
  })

  it('no está bloqueado inicialmente', async () => {
    const result = await isLockedOut(testIdentifier)
    expect(result.locked).toBe(false)
  })

  it('bloquea después de 5 intentos fallidos', async () => {
    db.securityEvent.count.mockResolvedValue(5)
    db.securityEvent.findFirst.mockResolvedValue({
      createdAt: new Date(now.getTime() - 1000), // 1 segundo atras
    })

    const result = await isLockedOut(testIdentifier)
    expect(result.locked).toBe(true)
    expect(result.remainingMinutes).toBeGreaterThan(0)
    expect(result.remainingMinutes).toBeLessThanOrEqual(15)
  })

  it('permite hasta 4 intentos sin bloquear', async () => {
    db.securityEvent.count.mockResolvedValue(4)
    const result = await isLockedOut(testIdentifier)
    expect(result.locked).toBe(false)
  })

  it('clearFailedAttempts elimina los intentos', async () => {
    db.securityEvent.count.mockResolvedValue(5)
    db.securityEvent.findFirst.mockResolvedValue({
      createdAt: new Date(now.getTime() - 1000),
    })
    expect((await isLockedOut(testIdentifier)).locked).toBe(true)

    await clearFailedAttempts(testIdentifier)
    expect(db.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        eventType: 'LOGIN_FAILED',
        details: { contains: testIdentifier },
      },
    })

    db.securityEvent.count.mockResolvedValue(0)
    expect((await isLockedOut(testIdentifier)).locked).toBe(false)
  })

  it('maneja identificadores diferentes de forma independiente', async () => {
    db.securityEvent.count.mockImplementation(
      (args: { where: { details: { contains: string } } }) => {
        if (args.where.details.contains === 'user1@test.com') return Promise.resolve(5)
        return Promise.resolve(0)
      }
    )
    db.securityEvent.findFirst.mockResolvedValue({
      createdAt: new Date(now.getTime() - 1000),
    })

    expect((await isLockedOut('user1@test.com')).locked).toBe(true)
    expect((await isLockedOut('user2@test.com')).locked).toBe(false)
  })

  it('registra intento fallido en base de datos', async () => {
    await recordFailedAttempt(testIdentifier)
    expect(db.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'LOGIN_FAILED',
        severity: 'WARNING',
      }),
    })
  })

  it('limpia intentos fallidos', async () => {
    await clearFailedAttempts(testIdentifier)
    expect(db.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        eventType: 'LOGIN_FAILED',
        details: { contains: testIdentifier },
      },
    })
  })
})

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.securityEvent.count.mockResolvedValue(0)
    db.securityEvent.findFirst.mockResolvedValue(null)
    db.securityEvent.create.mockResolvedValue({ id: 1 })
    db.securityEvent.deleteMany.mockResolvedValue({ count: 0 })
    db.user.findUnique.mockResolvedValue(null)
    db.userSession.create.mockResolvedValue({ id: 1 })
    db.auditLog.create.mockResolvedValue({ id: 1 })
  })

  it('loguea exitosamente con credenciales válidas', async () => {
    db.user.findUnique.mockResolvedValue(mockUser)
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('admin@test.com', 'ValidPass1!')
    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user!.email).toBe('admin@test.com')
    expect('password' in result.user!).toBe(false)
    expect(audit.logLogin).toHaveBeenCalledWith(1, true, 'admin@test.com')
  })

  it('falla con email inexistente', async () => {
    db.user.findUnique.mockResolvedValue(null)
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('noexiste@test.com', 'ValidPass1!')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales inválidas')
    expect(db.securityEvent.create).toHaveBeenCalled()
  })

  it('falla con contraseña incorrecta', async () => {
    db.user.findUnique.mockResolvedValue(mockUser)
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('admin@test.com', 'WrongPass1!')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales inválidas')
    expect(db.securityEvent.create).toHaveBeenCalled()
  })

  it('bloquea cuenta cuando hay demasiados intentos fallidos', async () => {
    db.securityEvent.count.mockResolvedValue(5)
    db.securityEvent.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 1000),
    })
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('admin@test.com', 'ValidPass1!')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Cuenta bloqueada')
  })

  it('falla para usuario inactivo', async () => {
    db.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false })
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('admin@test.com', 'ValidPass1!')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Credenciales inválidas')
  })

  it('retorna usuario sin contraseña en login exitoso', async () => {
    db.user.findUnique.mockResolvedValue(mockUser)
    const { loginUser } = await import('@/lib/auth')

    const result = await loginUser('admin@test.com', 'ValidPass1!')
    expect(result.success).toBe(true)
    expect(result.user).not.toHaveProperty('password')
    expect(result.user).toHaveProperty('id')
    expect(result.user).toHaveProperty('role')
  })
})
