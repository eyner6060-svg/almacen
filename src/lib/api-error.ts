import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { logger } from '@/lib/logger'

type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'CSRF_TOKEN_INVALID'

interface ApiErrorBody {
  error: string
  code: ApiErrorCode
  details?: unknown
}

function apiError(status: number, body: ApiErrorBody): NextResponse {
  return NextResponse.json(body, { status })
}

export function unauthorized(message = 'No autorizado'): NextResponse {
  return apiError(401, { error: message, code: 'UNAUTHORIZED' })
}

export function forbidden(message = 'No tiene permisos para esta acción'): NextResponse {
  return apiError(403, { error: message, code: 'FORBIDDEN' })
}

export function notFound(entity = 'Recurso'): NextResponse {
  return apiError(404, { error: `${entity} no encontrado`, code: 'NOT_FOUND' })
}

export function conflict(message: string): NextResponse {
  return apiError(409, { error: message, code: 'CONFLICT' })
}

export function rateLimited(message = 'Demasiadas solicitudes'): NextResponse {
  return apiError(429, { error: message, code: 'RATE_LIMITED' })
}

export function validationError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return apiError(400, {
      error: 'Datos inválidos',
      code: 'VALIDATION_ERROR',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }
  return apiError(400, { error: 'Datos inválidos', code: 'VALIDATION_ERROR' })
}

export function internalError(error?: unknown): NextResponse {
  if (error) logger.error('[API] Error interno:', error)
  return apiError(500, { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' })
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) return validationError(error)
  if (error instanceof Error) {
    if (error.message === 'No autorizado') return unauthorized()
    if (error.message.startsWith('No tiene permisos')) return forbidden()
    if (error.message.startsWith('Ya existe')) return conflict(error.message)
  }
  return internalError(error)
}
