import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  cacheSet,
  cacheGet,
  cacheDelete,
  cacheDeletePattern,
  cacheGetOrSet,
  clearExpiredCacheEntries,
  CacheKeys,
  CacheTTL,
} from '@/lib/cache'

describe('CacheKeys', () => {
  it('genera key de usuario', () => {
    expect(CacheKeys.user(1)).toBe('user:1')
  })

  it('genera key de items', () => {
    expect(CacheKeys.itemList()).toBe('items:list:all')
    expect(CacheKeys.itemList(2)).toBe('items:list:2')
  })

  it('genera key de órdenes', () => {
    expect(CacheKeys.order(5)).toBe('order:5')
    expect(CacheKeys.pendingOrders()).toBe('orders:pending')
  })
})

describe('CacheTTL', () => {
  it('tiene valores predefinidos', () => {
    expect(CacheTTL.VERY_SHORT).toBe(30)
    expect(CacheTTL.SHORT).toBe(60)
    expect(CacheTTL.MEDIUM).toBe(300)
    expect(CacheTTL.LONG).toBe(900)
    expect(CacheTTL.DAY).toBe(86400)
  })
})

describe('Memory Cache operations', () => {
  beforeEach(async () => {
    await cacheDeletePattern('test:')
  })

  it('set y get de string', async () => {
    await cacheSet('test:str', 'hello')
    const val = await cacheGet<string>('test:str')
    expect(val).toBe('hello')
  })

  it('set y get de objeto', async () => {
    const obj = { name: 'test', count: 42 }
    await cacheSet('test:obj', obj)
    const val = await cacheGet<typeof obj>('test:obj')
    expect(val).toEqual(obj)
  })

  it('set y get de número', async () => {
    await cacheSet('test:num', 123)
    const val = await cacheGet<number>('test:num')
    expect(val).toBe(123)
  })

  it('set y get de booleano', async () => {
    await cacheSet('test:bool', true)
    const val = await cacheGet<boolean>('test:bool')
    expect(val).toBe(true)
  })

  it('retorna null para key inexistente', async () => {
    const val = await cacheGet('test:nonexistent')
    expect(val).toBeNull()
  })

  it('delete elimina key', async () => {
    await cacheSet('test:del', 'value')
    expect(await cacheGet('test:del')).toBe('value')
    await cacheDelete('test:del')
    expect(await cacheGet('test:del')).toBeNull()
  })

  it('deletePattern elimina keys por patrón', async () => {
    await cacheSet('test:pat:a', '1')
    await cacheSet('test:pat:b', '2')
    await cacheSet('other:key', '3')
    await cacheDeletePattern('test:pat:')
    expect(await cacheGet('test:pat:a')).toBeNull()
    expect(await cacheGet('test:pat:b')).toBeNull()
    expect(await cacheGet('other:key')).toBe('3')
  })

  it('cacheGetOrSet usa factory si no hay cache', async () => {
    const factory = vi.fn().mockResolvedValue('factory-result')
    const result = await cacheGetOrSet('test:factory', factory)
    expect(result).toBe('factory-result')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('cacheGetOrSet retorna cache sin llamar factory', async () => {
    await cacheSet('test:factory2', 'cached-value')
    const factory = vi.fn().mockResolvedValue('new-value')
    const result = await cacheGetOrSet('test:factory2', factory)
    expect(result).toBe('cached-value')
    expect(factory).not.toHaveBeenCalled()
  })

  it('respeta TTL', async () => {
    vi.useFakeTimers()
    await cacheSet('test:ttl', 'expires-fast', { ttl: 1 })
    expect(await cacheGet('test:ttl')).toBe('expires-fast')
    vi.advanceTimersByTime(1500)
    expect(await cacheGet('test:ttl')).toBeNull()
    vi.useRealTimers()
  })

  it('clearExpiredCacheEntries no lanza error', () => {
    expect(() => clearExpiredCacheEntries()).not.toThrow()
  })
})
