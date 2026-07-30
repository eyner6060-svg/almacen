import { describe, it, expect } from 'vitest'
import { unauthorized, forbidden, notFound, conflict, rateLimited, validationError, internalError, handleApiError } from '@/lib/api-error'
import { ZodError } from 'zod'

describe('unauthorized', () => {
  it('retorna 401 con mensaje por defecto', async () => {
    const res = unauthorized()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({ error: 'No autorizado', code: 'UNAUTHORIZED' })
  })

  it('retorna 401 con mensaje personalizado', async () => {
    const res = unauthorized('Token expirado')
    const body = await res.json()
    expect(body.error).toBe('Token expirado')
  })
})

describe('forbidden', () => {
  it('retorna 403', async () => {
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FORBIDDEN')
  })
})

describe('notFound', () => {
  it('retorna 404 con nombre de entidad', async () => {
    const res = notFound('Usuario')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Usuario no encontrado')
  })
})

describe('conflict', () => {
  it('retorna 409 con mensaje', async () => {
    const res = conflict('Ya existe un usuario con ese email')
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Ya existe un usuario con ese email')
  })
})

describe('rateLimited', () => {
  it('retorna 429', async () => {
    const res = rateLimited()
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('RATE_LIMITED')
  })
})

describe('validationError', () => {
  it('retorna 400 con detalles de ZodError', async () => {
    const zodError = new ZodError([
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['email'], message: 'Expected string, received number' },
    ] as any)
    const res = validationError(zodError)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.details).toHaveLength(1)
    expect(body.details[0]).toEqual({ path: 'email', message: 'Expected string, received number' })
  })

  it('retorna 400 sin detalles para error no Zod', async () => {
    const res = validationError(new Error('generic'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details).toBeUndefined()
  })
})

describe('internalError', () => {
  it('retorna 500', async () => {
    const res = internalError()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})

describe('handleApiError', () => {
  it('maneja ZodError', async () => {
    const zodError = new ZodError([])
    const res = await handleApiError(zodError)
    expect(res.status).toBe(400)
  })

  it('maneja Error de no autorizado', async () => {
    const res = await handleApiError(new Error('No autorizado'))
    expect(res.status).toBe(401)
  })

  it('maneja Error de permisos', async () => {
    const res = await handleApiError(new Error('No tiene permisos para esta acción'))
    expect(res.status).toBe(403)
  })

  it('maneja Error de conflicto', async () => {
    const res = await handleApiError(new Error('Ya existe un registro'))
    expect(res.status).toBe(409)
  })

  it('maneja errores genéricos como 500', async () => {
    const res = await handleApiError(new Error('Error inesperado'))
    expect(res.status).toBe(500)
  })
})
