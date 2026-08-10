import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'
import { logLogin, logLogout } from './audit'
import { generateSecureToken } from './encryption'
import { logger } from '@/lib/logger'

const SESSION_COOKIE_NAME = 'session_user_id'
const SESSION_TOKEN_COOKIE = 'session_token'
const SESSION_EXPIRY_HOURS = 8
const INACTIVITY_TIMEOUT_MINUTES = 30
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION_MINUTES = 3
const LOGIN_WINDOW_MS = 3 * 60 * 1000

// Validar email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 255
}

// Validar DNI (8 dígitos para Perú)
export function isValidDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni)
}

// Validar PIN (4 dígitos)
export function isValidPIN(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

// Verificar bloqueo por intentos fallidos
export async function isLockedOut(identifier: string): Promise<{ locked: boolean; remainingMinutes?: number }> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS)

  const recentAttempts = await db.securityEvent.count({
    where: {
      eventType: 'LOGIN_FAILED',
      details: { contains: identifier },
      createdAt: { gte: windowStart }
    }
  })

  if (recentAttempts >= MAX_LOGIN_ATTEMPTS) {
    const oldestInWindow = await db.securityEvent.findFirst({
      where: {
        eventType: 'LOGIN_FAILED',
        details: { contains: identifier },
        createdAt: { gte: windowStart }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (oldestInWindow) {
      const lockedUntil = new Date(oldestInWindow.createdAt.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
      const now = new Date()
      if (now < lockedUntil) {
        return { locked: true, remainingMinutes: Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000) }
      }

      // Ventana de tiempo superada, limpiar registros antiguos
      await db.securityEvent.deleteMany({
        where: {
          eventType: 'LOGIN_FAILED',
          details: { contains: identifier },
          createdAt: { lte: windowStart }
        }
      })
    }
  }

  return { locked: false }
}

// Registrar intento fallido
export async function recordFailedAttempt(identifier: string): Promise<void> {
  await db.securityEvent.create({
    data: {
      eventType: 'LOGIN_FAILED',
      details: JSON.stringify({ email: identifier }),
      severity: 'WARNING'
    }
  })
}

// Limpiar intentos después de login exitoso
export async function clearFailedAttempts(identifier: string): Promise<void> {
  await db.securityEvent.deleteMany({
    where: {
      eventType: 'LOGIN_FAILED',
      details: { contains: identifier }
    }
  })
}

// Resumen de contraseña
export async function hashPassword(password: string): Promise<string> {
  if (!isStrongPassword(password)) {
    throw new Error('La contraseña no cumple con los requisitos de seguridad')
  }
  return bcrypt.hash(password, 12)
}

// Verificar fortaleza de contraseña
export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false
  if (!/[A-Z]/.test(password)) return false
  if (!/[a-z]/.test(password)) return false
  if (!/[0-9]/.test(password)) return false
  if (!/[^A-Za-z0-9]/.test(password)) return false
  return true
}

// Verificar contraseña
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// Crear sesión con token
export async function createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = generateSecureToken(32)
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000)

  // Crear registro de sesión en base de datos
  try {
    await db.userSession.create({
      data: {
        userId,
        sessionToken,
        ipAddress,
        userAgent,
        expiresAt,
        lastActivity: new Date(),
        isActive: true
      }
    })
  } catch (error) {
    logger.error('[AUTH] Error al crear registro de sesión:', error)
  }

  // Cookies seguras
  cookieStore.set(SESSION_COOKIE_NAME, String(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * SESSION_EXPIRY_HOURS,
    path: '/',
  })

  cookieStore.set(SESSION_TOKEN_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * SESSION_EXPIRY_HOURS,
    path: '/',
  })
}

// Obtener sesión
export async function getSession(): Promise<number | null> {
  const cookieStore = await cookies()
  const userId = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const sessionToken = cookieStore.get(SESSION_TOKEN_COOKIE)?.value

  if (!userId || !sessionToken) return null

  const parsedId = parseInt(userId)
  if (isNaN(parsedId) || parsedId <= 0) {
    await clearSession()
    return null
  }

  // Verificar que la sesión existe y está activa
  try {
    const session = await db.userSession.findFirst({
      where: {
        userId: parsedId,
        sessionToken,
        isActive: true,
        expiresAt: { gt: new Date() }
      }
    })

    if (!session) {
      await clearSession()
      return null
    }

    // Verificar inactividad
    const inactiveTime = Date.now() - session.lastActivity.getTime()
    if (inactiveTime > INACTIVITY_TIMEOUT_MINUTES * 60 * 1000) {
      await clearSession()
      return null
    }

    // Actualizar última actividad
    await db.userSession.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    })

    return parsedId
  } catch (error) {
    logger.error('[AUTH] Error al validar sesión:', error)
    return null
  }
}

// Obtener usuario actual
export async function getCurrentUser() {
  const userId = await getSession()
  if (!userId) return null

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        dni: true,
        phone: true,
        position: true,
        email: true,
        pin: true,
        role: true,
        isActive: true,
        isDriver: true,
        twoFactorEnabled: true,
        canAuthorizeOrders: true,
        canAuthorizeFuel: true,
        canAuthorizeAssignments: true,
        canAuthorizeLoans: true,
        officeId: true,
        office: true,
        createdAt: true
      }
    })

    if (!user || !user.isActive) return null

    return user
  } catch (error) {
    logger.error('[AUTH] Error al obtener usuario:', error)
    return null
  }
}

// Limpiar sesión
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_TOKEN_COOKIE)?.value

  // Invalidar sesión en base de datos
  if (sessionToken) {
    try {
      await db.userSession.updateMany({
        where: { sessionToken },
        data: { isActive: false }
      })
    } catch (error) {
      logger.error('[AUTH] Error al invalidar sesión:', error)
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
  cookieStore.delete(SESSION_TOKEN_COOKIE)
}

// Requerir autenticación
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('No autorizado')
  }
  return user
}

// Login con logging de auditoría
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; user?: Awaited<ReturnType<typeof getCurrentUser>>; error?: string }> {
  // Verificar bloqueo
  const { locked, remainingMinutes } = await isLockedOut(email)
  if (locked) {
    await logLogin(null, false, email)
    return {
      success: false,
      error: `Cuenta bloqueada. Intente nuevamente en ${remainingMinutes} minutos.`
    }
  }

  // Buscar usuario
  const user = await db.user.findUnique({
    where: { email },
      select: {
        id: true,
        fullName: true,
        dni: true,
        phone: true,
        position: true,
        email: true,
        password: true,
        pin: true,
        role: true,
        isActive: true,
        isDriver: true,
        twoFactorEnabled: true,
        canAuthorizeOrders: true,
        canAuthorizeFuel: true,
        canAuthorizeAssignments: true,
        canAuthorizeLoans: true,
        officeId: true,
        office: true,
        createdAt: true
      }
  })

  if (!user) {
    await recordFailedAttempt(email)
    await logLogin(null, false, email)
    return { success: false, error: 'Credenciales inválidas' }
  }

  if (!user.isActive) {
    await recordFailedAttempt(email)
    await logLogin(user.id, false, email)
    return { success: false, error: 'Credenciales inválidas' }
  }

  // Verificar contraseña
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    await recordFailedAttempt(email)
    await logLogin(user.id, false, email)
    return { success: false, error: 'Credenciales inválidas' }
  }

  // Inicio de sesión exitoso
  await clearFailedAttempts(email)
  await createSession(user.id, ipAddress, userAgent)
  await logLogin(user.id, true, email)

  // Eliminar contraseña del objeto de retorno
  const { password: _, ...userWithoutPassword } = user

  return { success: true, user: userWithoutPassword }
}

// Logout con logging de auditoría
export async function logoutUser(): Promise<void> {
  const user = await getCurrentUser()
  if (user) {
    await logLogout(user.id)
  }
  await clearSession()
}
