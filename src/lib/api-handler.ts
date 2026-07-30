import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getCurrentUser } from './auth'
import { runWithRequestCache } from './cache'
import { validateCsrfToken } from './csrf'
import { logger } from './logger'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

type ApiHandler = (req: NextRequest, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<NextResponse>

type Role = 'ADMINISTRADOR' | 'ALMACENERO' | 'JEFE_OFICINA' | 'TRABAJADOR'

interface HandlerOptions {
  roles?: Role[]
  auth?: boolean
  csrf?: boolean
}

class UnauthorizedError extends Error {
  code = 'UNAUTHORIZED'
  constructor(message = 'No autorizado') { super(message); this.name = 'UnauthorizedError' }
}

class ForbiddenError extends Error {
  code = 'FORBIDDEN'
  constructor(message = 'No tiene permisos para esta acción') { super(message); this.name = 'ForbiddenError' }
}

export class ConflictError extends Error {
  code = 'CONFLICT'
  constructor(message = 'Ya existe el recurso') { super(message); this.name = 'ConflictError' }
}

type ApiHandlerWithoutAuth = (req: NextRequest) => Promise<NextResponse>

export function apiHandler(handler: ApiHandler | ApiHandlerWithoutAuth, options?: HandlerOptions) {
  const { roles, auth = true, csrf = true } = options || {}

  return async (req: NextRequest) => {
    try {
      return await runWithRequestCache(async () => {
        if (!SAFE_METHODS.has(req.method) && csrf) {
          if (!validateCsrfToken(req)) {
            return NextResponse.json(
              { error: 'CSRF token inválido', code: 'CSRF_TOKEN_INVALID' },
              { status: 403 }
            )
          }
        }

        if (auth) {
          const user = await getCurrentUser()
          if (!user) {
            return NextResponse.json({ error: 'No autorizado', code: 'UNAUTHORIZED' }, { status: 401 })
          }

          if (roles && roles.length > 0) {
            if (!roles.includes(user.role as Role)) {
              return NextResponse.json(
                { error: 'No tiene permisos para esta acción', code: 'FORBIDDEN' },
                { status: 403 }
              )
            }
          }

          return (handler as ApiHandler)(req, user)
        }

        return (handler as ApiHandlerWithoutAuth)(req)
      })
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: 'Datos inválidos',
            code: 'VALIDATION_ERROR',
            details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
          { status: 400 }
        )
      }

      if (error instanceof UnauthorizedError) {
        return NextResponse.json({ error: error.message, code: 'UNAUTHORIZED' }, { status: 401 })
      }
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ error: error.message, code: 'FORBIDDEN' }, { status: 403 })
      }
      if (error instanceof ConflictError) {
        return NextResponse.json({ error: error.message, code: 'CONFLICT' }, { status: 409 })
      }

      logger.error('API Error:', error, 'api-handler')
      return NextResponse.json(
        { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}
