import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { FuelType, FuelRequestStatus, Prisma } from '@prisma/client'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createFuelRequestSchema, updateFuelRequestSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { ConflictError } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { checkPinAttempt, recordFailedPinAttempt, resetPinAttempts } from '@/lib/pin-attempts'
import { logCreate, logAudit, logRejection, logDelete } from '@/lib/audit'
import { getNextDocumentNumber } from '@/lib/document-sequence'
import { cacheGetOrSet, CacheKeys, CacheTTL } from '@/lib/cache'

const FUEL_REQUEST_USER_SELECT = {
  id: true, fullName: true, email: true, role: true, dni: true, phone: true,
  position: true, isActive: true, officeId: true, isDriver: true,
  canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true,
  createdAt: true,
  office: { select: { id: true, name: true, code: true } },
} as const

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const where: Prisma.FuelRequestWhereInput = {}

    if (status && status !== 'all') {
      where.status = status as FuelRequestStatus
    }

    if (currentUser.isDriver && currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO') {
      where.requestedById = currentUser.id
    }

    const [fuelRequests, total] = await Promise.all([
      db.fuelRequest.findMany({
        where,
        include: {
          requestedBy: {
            select: { id: true, fullName: true, email: true, role: true, position: true, office: { select: { id: true, name: true } } }
          },
          vehicle: { select: { id: true, name: true, plate: true } },
          signatures: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.fuelRequest.count({ where })
    ])

    return NextResponse.json({ 
      fuelRequests,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    })
  } catch (error) {
    logger.error('Get fuel requests error:', error)
    return NextResponse.json({ error: 'Error al obtener solicitudes de combustible' }, { status: 500 })
  }
}

// POST: Crear solicitud de combustible
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo conductores, almacenero, jefe de oficina o admin pueden crear solicitudes
    const isAdminOrStaff = currentUser.role === 'ADMINISTRADOR' || currentUser.role === 'ALMACENERO' || currentUser.role === 'JEFE_OFICINA'
    const canRequestFuel = currentUser.isDriver === true || isAdminOrStaff
    
    if (!canRequestFuel) {
      logger.info(`[FUEL] User ${currentUser.id} (role: ${currentUser.role}, isDriver: ${currentUser.isDriver}) not authorized to request fuel`)
      return NextResponse.json({ error: 'No autorizado para solicitar combustible. Debe ser conductor o tener un rol autorizado.' }, { status: 403 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`fuel-request-create:${ip}`, RateLimitPresets.CREATE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    logger.debug('[FUEL] Request body:', { fuelType: body.fuelType, quantity: body.quantity })
    const parsedBody = createFuelRequestSchema.safeParse(body)
    if (!parsedBody.success) {
      logger.error('[FUEL] Validation errors:', parsedBody.error.issues)
      return NextResponse.json({
        error: 'Datos inválidos',
        code: 'VALIDATION_ERROR',
        details: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
      }, { status: 400 })
    }
    const validated = parsedBody.data
    const { fuelType, quantity, reason, destinations, vehicleId } = validated

    // Conductores solo pueden solicitar para su vehículo asignado
    if (currentUser.isDriver === true && !isAdminOrStaff) {
      const assignedVehicle = await db.vehicle.findFirst({
        where: { driverId: currentUser.id, isActive: true },
        select: { id: true }
      })
      if (!assignedVehicle) {
        return NextResponse.json(
          { error: 'No tiene un vehículo asignado para solicitar combustible' },
          { status: 400 }
        )
      }
      if (vehicleId !== assignedVehicle.id) {
        return NextResponse.json(
          { error: 'Solo puede solicitar combustible para su vehículo asignado' },
          { status: 403 }
        )
      }
    }

    const requestDate = new Date()

    // Consultas independientes en paralelo
    const [{ inventory }, { documentNumber: requestNumber }, signatureConfigs] = await Promise.all([
      db.fuelInventory.findUnique({
        where: { fuelType: fuelType as FuelType },
        select: { quantity: true }
      }).then(r => ({ inventory: r })),
      getNextDocumentNumber('VALE_COMBUSTIBLE'),
      db.signatureConfig.findMany({
        where: { type: 'FUEL_VOUCHER', isActive: true },
        orderBy: { position: 'asc' }
      })
    ])

    if (!inventory || inventory.quantity < quantity) {
      return NextResponse.json(
        { error: `No hay suficiente ${fuelType === 'GASOLINA' ? 'gasolina' : 'petróleo'} en el inventario` },
        { status: 400 }
      )
    }

    // Crear solicitud con placeholders de firma
    const fuelRequest = await db.fuelRequest.create({
      data: {
        requestNumber,
        fuelType: fuelType as FuelType,
        quantity,
        reason,
        destinations,
        requestDate,
        requestedById: currentUser.id,
        vehicleId,
        signatures: signatureConfigs.length > 0 ? {
          create: signatureConfigs.map((config, index) => ({
            order: index + 1,
            position: config.title
          }))
        } : undefined
      },
      include: {
  requestedBy: { select: FUEL_REQUEST_USER_SELECT },
        vehicle: true,
        signatures: true
      }
    })

    logCreate(currentUser.id, 'FuelRequest', fuelRequest.id, { fuelType, quantity, vehicleId })

    const notifUsers = await db.user.findMany({
      where: {
        OR: [
          { role: 'ADMINISTRADOR' },
          { role: 'ALMACENERO' },
          { role: 'JEFE_OFICINA' },
        ],
        isActive: true,
        id: { not: currentUser.id }
      },
      select: { id: true }
    })

    if (notifUsers.length > 0) {
      await db.notification.createMany({
        data: notifUsers.map(u => ({
          userId: u.id,
          title: 'Nueva Solicitud de Combustible',
          message: `El vale N° ${fuelRequest.requestNumber} de ${fuelType} por ${quantity} galones requiere atención`,
          type: 'SOLICITUD_COMBUSTIBLE',
          relatedId: fuelRequest.id
        }))
      })
    }

    return NextResponse.json({ fuelRequest })
  } catch (error) {
    logger.error('Create fuel request error:', error)
    return handleApiError(error)
  }
}

// Actualizar solicitud de combustible (autorizar, rechazar, completar)
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`fuel-request-update:${ip}`, RateLimitPresets.AUTHORIZE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    const validated = updateFuelRequestSchema.parse(body)
    const { id, action, pin } = validated

    const fuelRequest = await db.fuelRequest.findUnique({
      where: { id },
      include: { 
        requestedBy: { select: { id: true, fullName: true, email: true, role: true, office: { select: { id: true, name: true } } } },
        vehicle: { select: { id: true, name: true, plate: true } },
        signatures: { orderBy: { order: 'asc' } }
      }
    })

    if (!fuelRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (action === 'authorize') {
      // Verificar PIN para almacenero o jefe de oficina
      if (currentUser.role === 'ALMACENERO' || currentUser.role === 'JEFE_OFICINA') {
        const config = await cacheGetOrSet(CacheKeys.systemConfig(), () => db.systemConfig.findFirst({ where: { id: 1 } }), { ttl: CacheTTL.LONG })
        const maxAttempts = config?.maxPinAttempts ?? 5
        const lockoutMinutes = config?.pinLockoutMinutes ?? 3
        if (!pin || pin.length !== 4) {
          return NextResponse.json({ error: 'Debe ingresar su PIN de 4 dígitos.' }, { status: 400 })
        }

        const attempt = await checkPinAttempt(currentUser.id, maxAttempts, lockoutMinutes)
        if (attempt.locked) {
          return NextResponse.json({
            error: `Demasiados intentos fallidos. Intente en ${lockoutMinutes} minutos.`,
            remainingAttempts: 0,
            locked: true,
          }, { status: 403 })
        }

        if (!currentUser.pin || !(await bcrypt.compare(pin, currentUser.pin))) {
          const result = await recordFailedPinAttempt(currentUser.id, maxAttempts, lockoutMinutes)
          return NextResponse.json({
            error: 'PIN incorrecto',
            remainingAttempts: result.remaining,
            locked: result.locked,
          }, { status: 400 })
        }

        await resetPinAttempts(currentUser.id)
      }
      
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'JEFE_OFICINA' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado para autorizar solicitudes de combustible' }, { status: 403 })
      }

      if (!currentUser.canAuthorizeFuel && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No tiene permisos de autorización de combustible' }, { status: 403 })
      }

      if (fuelRequest.status !== 'PENDIENTE') {
        return NextResponse.json({ error: 'La solicitud no está pendiente' }, { status: 400 })
      }

      // Transacción atómica: verificar inventario, descontar y autorizar
      const updatedRequest = await db.$transaction(async (tx) => {
        const result = await tx.fuelInventory.updateMany({
          where: {
            fuelType: fuelRequest.fuelType,
            quantity: { gte: fuelRequest.quantity }
          },
          data: { quantity: { decrement: fuelRequest.quantity } }
        })

        if (result.count === 0) {
          throw new ConflictError('No hay suficiente combustible en el inventario')
        }

        return tx.fuelRequest.update({
          where: { id },
          data: { status: 'AUTORIZADO' },
          include: {
      requestedBy: { select: FUEL_REQUEST_USER_SELECT },
            vehicle: true,
            signatures: true
          }
        })
      })

      logAudit({ userId: currentUser.id, action: 'AUTHORIZE', entityType: 'FuelRequest', entityId: id, description: `Solicitud de combustible ${fuelRequest.requestNumber} autorizada por ${currentUser.fullName}` })

      return NextResponse.json({ fuelRequest: updatedRequest })
    }

    if (action === 'reject') {
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'JEFE_OFICINA') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      if (!currentUser.canAuthorizeFuel && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No tiene permisos de autorización de combustible' }, { status: 403 })
      }

      if (fuelRequest.status !== 'PENDIENTE') {
        return NextResponse.json({ error: 'La solicitud no está pendiente' }, { status: 400 })
      }

      const updatedRequest = await db.fuelRequest.update({
        where: { id },
        data: { status: 'RECHAZADO' },
        include: {
    requestedBy: { select: FUEL_REQUEST_USER_SELECT },
          vehicle: true,
          signatures: true
        }
      })

      logRejection(currentUser.id, 'FuelRequest', id, `Solicitud de combustible ${fuelRequest.requestNumber} rechazada`)

      return NextResponse.json({ fuelRequest: updatedRequest })
    }

    if (action === 'complete') {
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      if (!currentUser.canAuthorizeFuel && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No tiene permisos de autorización de combustible' }, { status: 403 })
      }

      if (fuelRequest.status !== 'AUTORIZADO') {
        return NextResponse.json({ error: 'La solicitud no está autorizada' }, { status: 400 })
      }

      const updatedRequest = await db.fuelRequest.update({
        where: { id },
        data: { status: 'COMPLETADO' },
        include: {
    requestedBy: { select: FUEL_REQUEST_USER_SELECT },
          vehicle: true,
          signatures: true
        }
      })

      logAudit({ userId: currentUser.id, action: 'STATUS_CHANGE', entityType: 'FuelRequest', entityId: id, description: `Solicitud de combustible ${fuelRequest.requestNumber} completada por ${currentUser.fullName}` })

      return NextResponse.json({ fuelRequest: updatedRequest })
    }

    if (action === 'upload_signed_pdf') {
      const { signedPdfUrl } = body

      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'JEFE_OFICINA' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado para subir documentos firmados' }, { status: 403 })
      }

      if (!currentUser.canAuthorizeFuel && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No tiene permisos de autorización de combustible' }, { status: 403 })
      }

      const updatedRequest = await db.fuelRequest.update({
        where: { id },
        data: { signedPdfUrl },
        include: {
    requestedBy: { select: FUEL_REQUEST_USER_SELECT },
          vehicle: true,
          signatures: true
        }
      })

      return NextResponse.json({ fuelRequest: updatedRequest })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    logger.error('Update fuel request error:', error)
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return handleApiError(error)
  }
}

// DELETE: Eliminar solicitud de combustible (solo PENDIENTE)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const fuelRequest = await db.fuelRequest.findUnique({
      where: { id }
    })

    if (!fuelRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    // Solo permitir eliminación si está PENDIENTE y es el solicitante o admin
    if (fuelRequest.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Solo se pueden eliminar solicitudes pendientes' }, { status: 400 })
    }

    if (fuelRequest.requestedById !== currentUser.id && currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    await db.fuelRequest.delete({ where: { id } })

    logDelete(currentUser.id, 'FuelRequest', id, {}, `Solicitud de combustible ${fuelRequest.requestNumber} eliminada`)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete fuel request error:', error)
    return NextResponse.json({ error: 'Error al eliminar solicitud' }, { status: 500 })
  }
}
