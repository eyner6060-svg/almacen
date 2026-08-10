import { db } from './db'

async function getRecentFailures(userId: number, lockoutMinutes: number): Promise<number> {
  const lockoutPeriod = new Date(Date.now() - lockoutMinutes * 60 * 1000)
  return db.securityEvent.count({
    where: {
      userId,
      eventType: 'PIN_FAILED',
      createdAt: { gte: lockoutPeriod }
    }
  })
}

export async function checkPinAttempt(userId: number, maxAttempts: number, lockoutMinutes = 3): Promise<{
  allowed: boolean
  remaining: number
  locked: boolean
  lockedUntil: number | null
}> {
  const recentFailures = await getRecentFailures(userId, lockoutMinutes)
  const locked = recentFailures >= maxAttempts
  const lockedUntil = locked ? Date.now() + lockoutMinutes * 60 * 1000 : null

  return {
    allowed: !locked,
    remaining: Math.max(0, maxAttempts - recentFailures),
    locked,
    lockedUntil,
  }
}

export async function recordFailedPinAttempt(userId: number, maxAttempts: number, lockoutMinutes: number): Promise<{
  remaining: number
  locked: boolean
  lockedUntil: number | null
}> {
  await db.securityEvent.create({
    data: {
      userId,
      eventType: 'PIN_FAILED',
      severity: 'WARNING',
    }
  })

  const recentFailures = await getRecentFailures(userId, lockoutMinutes)
  const locked = recentFailures >= maxAttempts
  const lockedUntil = locked ? Date.now() + lockoutMinutes * 60 * 1000 : null

  return {
    remaining: Math.max(0, maxAttempts - recentFailures),
    locked,
    lockedUntil,
  }
}

export async function resetPinAttempts(userId: number): Promise<void> {
  await db.securityEvent.deleteMany({
    where: { userId, eventType: 'PIN_FAILED' }
  })
}
