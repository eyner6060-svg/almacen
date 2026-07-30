import { describe, it, expect, vi } from 'vitest'
import { setCsrfCookie, validateCsrfToken } from '@/lib/csrf'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}))

describe('validateCsrfToken', () => {
  it('retorna true cuando cookie y header coinciden', () => {
    const request = {
      cookies: { get: () => ({ value: 'abc123' }) },
      headers: { get: () => 'abc123' },
    }
    expect(validateCsrfToken(request)).toBe(true)
  })

  it('retorna false cuando cookie no existe', () => {
    const request = {
      cookies: { get: () => undefined },
      headers: { get: () => 'abc123' },
    }
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('retorna false cuando header no existe', () => {
    const request = {
      cookies: { get: () => ({ value: 'abc123' }) },
      headers: { get: () => null },
    }
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('retorna false cuando cookie y header no coinciden', () => {
    const request = {
      cookies: { get: () => ({ value: 'abc123' }) },
      headers: { get: () => 'different' },
    }
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('usa comparacion timing-safe', () => {
    const request = {
      cookies: { get: () => ({ value: 'abc' }) },
      headers: { get: () => 'abcd' },
    }
    expect(validateCsrfToken(request)).toBe(false)
  })

  it('genera y valida token correctamente', async () => {
    const cookies = { set: vi.fn() }
    const response = { cookies }
    const token = await setCsrfCookie(response)

    const request = {
      cookies: { get: () => ({ value: token }) },
      headers: { get: () => token },
    }
    expect(validateCsrfToken(request)).toBe(true)
  })
})
