type CacheValue = string | number | boolean | object | null

interface CacheOptions {
  ttl?: number
  prefix?: string
}

interface CacheBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl: number): Promise<void>
  del(key: string): Promise<void>
  delPattern(pattern: string): Promise<void>
}

const DEFAULT_TTL = 300
const KEY_PREFIX = 'almacen:'

class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: string; expiresAt: number }>()

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) this.store.delete(key)
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt > Date.now()) return entry.value
    this.store.delete(key)
    return null
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async delPattern(pattern: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key)
    }
  }
}

let _backend: CacheBackend | null = null
let _redisInitAttempted = false

function getBackend(): CacheBackend {
  if (_backend) return _backend

  if (!_redisInitAttempted) {
    _redisInitAttempted = true
    const redisUrl = process.env.REDIS_URL
    if (redisUrl) {
      initRedisBackend(redisUrl)
        .then(() => {
          // El backend de Redis reemplazará a _backend en caso de éxito
        })
        .catch(() => {
          // Redis falló, usar memoria
          _backend = new MemoryBackend()
        })
    } else {
      _backend = new MemoryBackend()
    }
  }

  if (!_backend) {
    _backend = new MemoryBackend()
  }
  return _backend
}

async function initRedisBackend(redisUrl: string): Promise<void> {
  try {
    const modName = ['io', 'redis'].join('')
    const { default: Redis } = await import(modName)
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000)
    })
    client.on('error', () => { /* ignorar */ })
    client.on('connect', () => { /* ignorar */ })
    _backend = {
      async get(key: string) { try { return await client.get(key) } catch { return null } },
      async set(key: string, value: string, ttl: number) { try { await client.setex(key, ttl, value) } catch { /* ignorar */ } },
      async del(key: string) { try { await client.del(key) } catch { /* ignorar */ } },
      async delPattern(pattern: string) {
        try {
          let cursor = '0'
          do {
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `*${pattern}*`, 'COUNT', 100)
            if (keys.length > 0) await client.del(keys)
            cursor = nextCursor
          } while (cursor !== '0')
        } catch { /* ignorar */ }
      }
    }
  } catch {
    // Redis no disponible, continuar con memoria
  }
}

function buildKey(key: string, prefix?: string): string {
  return `${KEY_PREFIX}${prefix || ''}${key}`
}

export async function cacheSet(key: string, value: CacheValue, options?: CacheOptions): Promise<void> {
  const fullKey = buildKey(key, options?.prefix)
  const ttl = options?.ttl || DEFAULT_TTL
  await getBackend().set(fullKey, JSON.stringify(value), ttl)
}

export async function cacheGet<T = CacheValue>(key: string, options?: CacheOptions): Promise<T | null> {
  const fullKey = buildKey(key, options?.prefix)
  const raw = await getBackend().get(fullKey)
  if (raw === null) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export async function cacheDelete(key: string, options?: CacheOptions): Promise<void> {
  const fullKey = buildKey(key, options?.prefix)
  await getBackend().del(fullKey)
}

export async function cacheDeletePattern(pattern: string): Promise<void> {
  await getBackend().delPattern(`${KEY_PREFIX}${pattern}`)
}

export async function cacheGetOrSet<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
  const cached = await cacheGet<T>(key, options)
  if (cached !== null) return cached
  const value = await factory()
  await cacheSet(key, value as CacheValue, options)
  return value
}

export function clearExpiredCacheEntries(): void {
  const b = getBackend()
  if (b instanceof MemoryBackend) {
    b.cleanup()
  }
}

export const CacheKeys = {
  user: (id: number) => `user:${id}`,
  userList: () => 'users:list',
  userPermissions: (id: number) => `user:${id}:permissions`,
  itemList: (warehouseId?: number) => `items:list:${warehouseId || 'all'}`,
  item: (id: number) => `item:${id}`,
  itemCategories: () => 'items:categories',
  lowStockItems: () => 'items:low-stock',
  orderList: (status?: string) => `orders:list:${status || 'all'}`,
  order: (id: number) => `order:${id}`,
  pendingOrders: () => 'orders:pending',
  fuelInventory: () => 'fuel:inventory',
  fuelRequests: (status?: string) => `fuel:requests:${status || 'all'}`,
  vehicleList: () => 'vehicles:list',
  officeList: () => 'offices:list',
  office: (id: number) => `office:${id}`,
  systemConfig: () => 'system:config',
  signatureConfig: () => 'system:signatures',
  dashboardStats: () => 'dashboard:stats',
  dashboardNotifications: () => 'dashboard:notifications',
  notificationList: (userId: number) => `notifications:${userId}`,
  warehouseList: () => 'warehouses:list',
  assignedAssets: (userId?: number) => `assigned:${userId || 'all'}`,
  ingressList: () => 'ingresses:list',
  predictionResults: () => 'predictions:results'
}

export const CacheTTL = {
  VERY_SHORT: 30,
  SHORT: 60,
  MEDIUM: 300,
  LONG: 900,
  HOUR: 3600,
  DAY: 86400
}

// =====================================================
// Caché con ámbito de solicitud para evitar consultas repetidas
// dentro de una misma solicitud (ej: manejador PUT de pedido)
// =====================================================
import { AsyncLocalStorage } from 'async_hooks'

const requestCacheStorage = new AsyncLocalStorage<Map<string, unknown>>()

export function runWithRequestCache<T>(fn: () => T): T {
  return requestCacheStorage.run(new Map(), fn)
}

export function getRequestCache<T>(key: string): T | undefined {
  const store = requestCacheStorage.getStore()
  if (!store) return undefined
  return store.get(key) as T | undefined
}

export function setRequestCache<T>(key: string, value: T): void {
  const store = requestCacheStorage.getStore()
  if (!store) return
  store.set(key, value)
}

/**
 * Cache contextual que persiste durante la vida del request actual.
 * Si no hay contexto de request, delega al cache global.
 */
export async function cacheGetOrSetRequestScoped<T>(
  key: string,
  factory: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Intentar caché con ámbito de solicitud primero
  const requestCached = getRequestCache<T>(key)
  if (requestCached !== undefined) return requestCached

  // Respaldo al caché global
  const value = await cacheGetOrSet<T>(key, factory, options)

  // Guardar en caché con ámbito de solicitud
  setRequestCache(key, value)
  return value
}
