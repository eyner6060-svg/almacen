import { describe, it, expect, vi } from 'vitest'
import { setCsrfCookie } from '@/lib/csrf'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}))

describe('setCsrfCookie', () => {
  it('genera un token sin response object', async () => {
    const token = await setCsrfCookie()
    expect(token).toBeTruthy()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('genera token de 64 caracteres hex (32 bytes)', async () => {
    const token = await setCsrfCookie()
    expect(token.length).toBe(64)
  })

  it('genera tokens únicos', async () => {
    const t1 = await setCsrfCookie()
    const t2 = await setCsrfCookie()
    expect(t1).not.toBe(t2)
  })

  it('establece cookie en response object', async () => {
    const cookies = { set: vi.fn() }
    const response = { cookies }
    const token = await setCsrfCookie(response)
    expect(token).toBeTruthy()
    expect(cookies.set).toHaveBeenCalledWith(
      'csrf-token',
      token,
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'strict',
        path: '/',
      })
    )
  })
})
