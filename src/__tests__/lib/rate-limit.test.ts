import { describe, it, expect, vi } from 'vitest'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'

let counter = 0
function uniqueId(): string {
  return `test-user-${++counter}-${Date.now()}`
}

describe('RateLimitPresets', () => {
  it('LOGIN permite 5 intentos en 15 min', () => {
    expect(RateLimitPresets.LOGIN.maxRequests).toBe(5)
    expect(RateLimitPresets.LOGIN.windowMs).toBe(15 * 60 * 1000)
  })

  it('API permite 100 requests por minuto', () => {
    expect(RateLimitPresets.API.maxRequests).toBe(100)
    expect(RateLimitPresets.API.windowMs).toBe(60 * 1000)
  })
})

describe('checkRateLimit', () => {
  const config = { windowMs: 1000, maxRequests: 3 }

  it('permite request dentro del límite', async () => {
    const result = await checkRateLimit(uniqueId(), config)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThanOrEqual(0)
    expect(result.resetTime).toBeGreaterThan(Date.now())
  })

  it('bloquea después de exceder el límite', async () => {
    const id = uniqueId()
    for (let i = 0; i < 3; i++) {
      const res = await checkRateLimit(id, config)
      expect(res.allowed).toBe(true)
    }
    const blocked = await checkRateLimit(id, config)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
  })

  it('retorna mensaje de error cuando está bloqueado', async () => {
    const id = uniqueId()
    const configWithMsg = { ...config, message: 'Demasiadas solicitudes.' }
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(id, configWithMsg)
    }
    const result = await checkRateLimit(id, configWithMsg)
    expect(result.message).toBe('Demasiadas solicitudes.')
  })

  it('identificadores diferentes tienen contadores independientes', async () => {
    const id1 = uniqueId()
    const id2 = uniqueId()
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(id1, config)
    }
    const user1 = await checkRateLimit(id1, config)
    expect(user1.allowed).toBe(false)

    const user2 = await checkRateLimit(id2, config)
    expect(user2.allowed).toBe(true)
  })

  it('permite request después de que la ventana expira', async () => {
    vi.useFakeTimers()
    const id = uniqueId()
    const shortConfig = { windowMs: 100, maxRequests: 1 }
    await checkRateLimit(id, shortConfig)
    const blocked = await checkRateLimit(id, shortConfig)
    expect(blocked.allowed).toBe(false)

    vi.advanceTimersByTime(200)
    const allowed = await checkRateLimit(id, shortConfig)
    expect(allowed.allowed).toBe(true)
    vi.useRealTimers()
  })
})
