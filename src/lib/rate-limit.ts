interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
  keyGenerator?: (identifier: string) => string
}

interface RateLimitBackend {
  check(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }>
  cleanup?(): void
}

const KEY_PREFIX = 'almacen:ratelimit:'

class MemoryRateLimitBackend implements RateLimitBackend {
  private store = new Map<string, { count: number; resetTime: number }>()
  private locks = new Set<string>()

  async check(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()

    // Bloqueo para evitar condición de carrera
    while (this.locks.has(key)) {
      await new Promise(r => setTimeout(r, 5))
    }
    this.locks.add(key)

    try {
      let entry = this.store.get(key)

      if (!entry || now > entry.resetTime) {
        entry = { count: 1, resetTime: now + windowMs }
        this.store.set(key, entry)
        return { allowed: true, remaining: maxRequests - 1, resetTime: entry.resetTime }
      }

      if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime }
      }

      entry.count++
      return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime }
    } finally {
      this.locks.delete(key)
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) this.store.delete(key)
    }
  }
}

let backend: RateLimitBackend = new MemoryRateLimitBackend()

const CLEANUP_INTERVAL = 5 * 60 * 1000
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (backend instanceof MemoryRateLimitBackend) {
      backend.cleanup()
    }
  }, CLEANUP_INTERVAL)
}

async function initRedisBackend(): Promise<void> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return

  try {
    const modName = ['i', 'o', 'r', 'e', 'd', 'i', 's'].join('')
    const { default: Redis } = await import(modName)
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000)
    })
    client.on('error', () => { /* ignorar */ })

    backend = {
      async check(key: string, windowMs: number, maxRequests: number) {
        try {
          const fullKey = KEY_PREFIX + key
          const multi = client.multi()
          multi.incr(fullKey)
          multi.pttl(fullKey)
          const results = await multi.exec() as [[Error | null, number], [Error | null, number]]
          const count = results[0][1]
          let ttl = results[1][1]
          if (ttl < 0) {
            await client.pexpire(fullKey, windowMs)
            ttl = windowMs
          }
          const resetTime = Date.now() + ttl
          return {
            allowed: count <= maxRequests,
            remaining: Math.max(0, maxRequests - count),
            resetTime
          }
        } catch {
          return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowMs }
        }
      }
    }
  } catch {
    // Redis no disponible, continuar con memoria
  }
}

initRedisBackend()

export { backend as rateLimitBackend }

export const RateLimitPresets = {
  LOGIN: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.'
  },
  API: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Demasiadas solicitudes. Intente nuevamente en un minuto.'
  },
  CREATE: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: 'Demasiadas operaciones de creación. Espere un momento.'
  },
  AUTHORIZE: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: 'Demasiadas autorizaciones. Espere un momento.'
  },
  EXPORT: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Demasiadas exportaciones. Espere un momento.'
  },
  SEARCH: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: 'Demasiadas búsquedas. Espere un momento.'
  },
  UPLOAD: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: 'Demasiadas subidas de archivos. Espere un momento.'
  }
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number; message?: string }> {
  const key = config.keyGenerator ? config.keyGenerator(identifier) : identifier
  const result = await backend.check(key, config.windowMs, config.maxRequests)
  if (!result.allowed) {
    return { ...result, message: config.message || 'Demasiadas solicitudes.' }
  }
  return result
}
