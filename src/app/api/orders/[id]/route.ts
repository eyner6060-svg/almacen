import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { OrderStatus, Role, Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { cacheDelete, cacheGetOrSet, cacheDeletePattern, CacheKeys, CacheTTL } from '@/lib/cache'
import { checkPinAttempt, recordFailedPinAttempt, resetPinAttempts } from '@/lib/pin-attempts'
import { logAuthorization, logRejection, logAudit } from '@/lib/audit'

const PIN_LOCKOUT_MINUTES = 3


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const order = await db.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        requestedBy: { select: { id: true, fullName: true, dni: true, email: true, phone: true, position: true, role: true, office: { select: { id: true, name: true, code: true } } } },
        office: { select: { id: true, name: true, code: true } },
        items: {
          include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, color: true, category: true, unit: true, itemType: true, status: true, location: true, warehouse: { select: { id: true, name: true } } } } }
        },
        authorizations: {
          include: { user: { select: { id: true, fullName: true, role: true } } },
          orderBy: { authorizedAt: 'asc' }
        },
        documents: {
          include: { uploader: { select: { id: true, fullName: true } } }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ order })
  } catch (error) {
    logger.error('Get order error:', error)
    return NextResponse.json({ error: 'Error al obtener pedido' }, { status: 500 })
  }
}

export const USER_BASIC_SELECT = {
  id: true, fullName: true, email: true, role: true, position: true, isActive: true, officeId: true,
  isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true,
  office: { select: { id: true, name: true, code: true } }
} as const

const ORDER_DETAIL_INCLUDE = {
  requestedBy: { select: { id: true, fullName: true, dni: true, email: true, phone: true, position: true, role: true, office: { select: { id: true, name: true, code: true } } } },
  office: { select: { id: true, name: true, code: true } },
  items: {
    include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, color: true, category: true, unit: true, itemType: true, status: true, location: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } }
  },
  authorizations: {
    include: { user: { select: { id: true, fullName: true, role: true } } },
    orderBy: { authorizedAt: 'asc' as const }
  }
} as const


export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const user = currentUser

    const { id } = await params
    const body = await request.json()
    const { action, notes, items } = body

    const order = await cacheGetOrSet(`order:detail:${id}`, () => db.order.findUnique({ where: { id: parseInt(id) }, include: ORDER_DETAIL_INCLUDE }), { ttl: CacheTTL.VERY_SHORT })

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    async function validatePin(pin: string | undefined): Promise<{ valid: boolean; remaining: number; locked: boolean; lockedUntil: number | null }> {
      if (!pin || pin.length !== 4) {
        return { valid: false, remaining: 0, locked: false, lockedUntil: null }
      }

      const config = await cacheGetOrSet(CacheKeys.systemConfig(), () => db.systemConfig.findFirst(), { ttl: CacheTTL.LONG })
      const maxAttempts = config?.maxPinAttempts ?? 5
      const lockoutMinutes = config?.pinLockoutMinutes ?? 3

      const attempt = await checkPinAttempt(user.id, maxAttempts)
      if (attempt.locked) {
        return { valid: false, remaining: 0, locked: true, lockedUntil: attempt.lockedUntil }
      }

      if (!user.pin || !(await bcrypt.compare(pin, user.pin))) {
        const result = await recordFailedPinAttempt(user.id, maxAttempts, lockoutMinutes)
        if (result.locked) {
          return { valid: false, remaining: 0, locked: true, lockedUntil: result.lockedUntil }
        }
        return { valid: false, remaining: result.remaining, locked: false, lockedUntil: null }
      }

      await resetPinAttempts(user.id)
      return { valid: true, remaining: maxAttempts, locked: false, lockedUntil: null }
    }

    // ============ PASO 1: JEFE DE OFICINA AUTORIZA ============
    if (action === 'authorize_jefe') {
      // El Jefe de Oficina o el Administrador pueden autorizar
      if (currentUser.role !== 'JEFE_OFICINA' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado. Solo el Jefe de Oficina o el Administrador pueden realizar esta acción.' }, { status: 403 })
      }

      // Verificar PIN de 4 dígitos con control de intentos
      const { pin } = body
      const pinResult = await validatePin(pin)
      if (!pinResult.valid) {
        if (pinResult.locked) {
          const minsLeft = pinResult.lockedUntil ? Math.ceil((pinResult.lockedUntil - Date.now()) / 60000) : PIN_LOCKOUT_MINUTES
          return NextResponse.json({
            error: `Demasiados intentos fallidos. Su cuenta ha sido bloqueada por ${minsLeft} minutos.`,
            remainingAttempts: 0,
            locked: true,
            lockedUntil: pinResult.lockedUntil,
          }, { status: 403 })
        }
        if (!pin || pin.length !== 4) {
          return NextResponse.json({ error: 'Debe ingresar su PIN de 4 dígitos para autorizar.' }, { status: 400 })
        }
        return NextResponse.json({
          error: 'PIN incorrecto. Verifique su PIN de autorización.',
          remainingAttempts: pinResult.remaining,
        }, { status: 403 })
      }

      // Verificar que el pedido esté pendiente
      if (order.status !== 'PENDIENTE') {
        return NextResponse.json({ error: 'El pedido no está en estado pendiente.' }, { status: 400 })
      }

      // Verificar que sea de la misma oficina (excepto administradores)
      if (currentUser.role !== 'ADMINISTRADOR' && currentUser.officeId !== order.officeId) {
        return NextResponse.json({ error: 'Solo puede autorizar pedidos de su oficina.' }, { status: 403 })
      }

      // Actualizar estado
      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: { status: 'AUTORIZADO_JEFE' as OrderStatus },
        include: ORDER_DETAIL_INCLUDE
      })

      // Registrar autorización
      await db.orderAuthorization.create({
        data: {
          orderId: parseInt(id),
          userId: currentUser.id,
          role: currentUser.role as Role,
          method: 'PIN'
        }
      })

      await logAuthorization(currentUser.id, 'Order', parseInt(id), `Autorización Jefe de Oficina por ${currentUser.fullName}`)

      // Notificar a todos los almaceneros en una sola operación
      const almaceneros = await db.user.findMany({
        where: { role: 'ALMACENERO', isActive: true },
        select: { id: true }
      })

      if (almaceneros.length > 0) {
        await db.notification.createMany({
          data: almaceneros.map(a => ({
            userId: a.id,
            title: 'Pedido Pendiente de Preparación',
            message: `El pedido ${order.orderNumber} de ${updatedOrder.office?.name || 'Oficina'} ha sido autorizado por el Jefe y está listo para preparación.`,
            type: 'PEDIDO_PENDIENTE',
            relatedId: order.id
          }))
        })
      }

      // Notificar al solicitante
      await db.notification.create({
        data: {
          userId: order.requestedById,
          title: 'Pedido Autorizado por Jefe',
          message: `Su pedido ${order.orderNumber} ha sido autorizado por el Jefe de Oficina y está siendo procesado.`,
          type: 'PEDIDO_AUTORIZADO',
          relatedId: order.id
        }
      })

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'Pedido autorizado correctamente. Se ha notificado al almacén para la preparación.'
      })
    }

    // ============ PASO 2: ALMACENERO PREPARA EL PEDIDO ============
    if (action === 'authorize_almacenero') {
      // El Almacenero o el Administrador pueden preparar
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado. Solo el Almacenero o el Administrador pueden realizar esta acción.' }, { status: 403 })
      }

      // Verificar PIN de 4 dígitos con control de intentos
      const { pin } = body
      const pinResult = await validatePin(pin)
      if (!pinResult.valid) {
        if (pinResult.locked) {
          const minsLeft = pinResult.lockedUntil ? Math.ceil((pinResult.lockedUntil - Date.now()) / 60000) : PIN_LOCKOUT_MINUTES
          return NextResponse.json({
            error: `Demasiados intentos fallidos. Su cuenta ha sido bloqueada por ${minsLeft} minutos.`,
            remainingAttempts: 0,
            locked: true,
            lockedUntil: pinResult.lockedUntil,
          }, { status: 403 })
        }
        if (!pin || pin.length !== 4) {
          return NextResponse.json({ error: 'Debe ingresar su PIN de 4 dígitos para autorizar.' }, { status: 400 })
        }
        return NextResponse.json({
          error: 'PIN incorrecto. Verifique su PIN de autorización.',
          remainingAttempts: pinResult.remaining,
        }, { status: 403 })
      }

      // Verificar que el pedido esté autorizado por el jefe
      if (order.status !== 'AUTORIZADO_JEFE') {
        if (currentUser.role === 'ADMINISTRADOR' && order.status === 'PENDIENTE') {
          await db.order.update({
            where: { id: parseInt(id) },
            data: { status: 'AUTORIZADO_JEFE' as OrderStatus },
          })
          await db.orderAuthorization.create({
            data: {
              orderId: parseInt(id),
              userId: currentUser.id,
              role: 'ADMINISTRADOR',
              method: 'PIN',
            }
          })
          await logAuthorization(currentUser.id, 'Order', parseInt(id), `Autorización Jefe de Oficina por ${currentUser.fullName} (Administrador actuó en representación)`)
        } else {
          return NextResponse.json({ error: 'El pedido debe estar autorizado por el Jefe de Oficina primero.' }, { status: 400 })
        }
      }

      // Verificar stock disponible
      for (const orderItem of order.items) {
        if (orderItem.item.quantity < orderItem.quantity) {
          return NextResponse.json({ 
            error: `Stock insuficiente para "${orderItem.item.name}". Disponible: ${orderItem.item.quantity}, Solicitado: ${orderItem.quantity}` 
          }, { status: 400 })
        }
      }

      // Actualizar estado a "listo para entrega"
      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: { status: 'AUTORIZADO_ALMACENERO' as OrderStatus },
        include: ORDER_DETAIL_INCLUDE
      })

      // Registrar autorización del almacenero (o administrador)
      await db.orderAuthorization.create({
        data: {
          orderId: parseInt(id),
          userId: currentUser.id,
          role: currentUser.role as Role,
          method: 'PIN'
        }
      })

      await logAuthorization(currentUser.id, 'Order', parseInt(id), `Autorización Almacenero por ${currentUser.fullName}`)

      // Notificar al solicitante
      await db.notification.create({
        data: {
          userId: order.requestedById,
          title: 'Pedido Listo para Entrega',
          message: `Su pedido ${order.orderNumber} ha sido preparado y está listo para ser recogido en almacén.`,
          type: 'PEDIDO_AUTORIZADO',
          relatedId: order.id
        }
      })

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'Pedido preparado correctamente. Los bienes están listos para ser entregados.'
      })
    }

    // ============ PASO 3: ALMACENERO CONFIRMA ENTREGA Y DESCUENTA STOCK ============
    if (action === 'confirm_delivery') {
      // El Almacenero o el Administrador pueden confirmar entrega
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado. Solo el Almacenero o el Administrador pueden confirmar la entrega.' }, { status: 403 })
      }

      // Verificar PIN de 4 dígitos con control de intentos
      const { pin, expectedReturnDate } = body
      const pinResult = await validatePin(pin)
      if (!pinResult.valid) {
        if (pinResult.locked) {
          const minsLeft = pinResult.lockedUntil ? Math.ceil((pinResult.lockedUntil - Date.now()) / 60000) : PIN_LOCKOUT_MINUTES
          return NextResponse.json({
            error: `Demasiados intentos fallidos. Su cuenta ha sido bloqueada por ${minsLeft} minutos.`,
            remainingAttempts: 0,
            locked: true,
            lockedUntil: pinResult.lockedUntil,
          }, { status: 403 })
        }
        if (!pin || pin.length !== 4) {
          return NextResponse.json({ error: 'Debe ingresar su PIN de 4 dígitos para confirmar la entrega.' }, { status: 400 })
        }
        return NextResponse.json({
          error: 'PIN incorrecto. Verifique su PIN de autorización.',
          remainingAttempts: pinResult.remaining,
        }, { status: 403 })
      }

      // Verificar que el pedido esté listo para entrega
      if (order.status !== 'AUTORIZADO_ALMACENERO') {
        if (currentUser.role === 'ADMINISTRADOR' && (order.status === 'PENDIENTE' || order.status === 'AUTORIZADO_JEFE')) {
          if (order.status === 'PENDIENTE') {
            await db.order.update({
              where: { id: parseInt(id) },
              data: { status: 'AUTORIZADO_JEFE' as OrderStatus },
            })
            await db.orderAuthorization.create({
              data: {
                orderId: parseInt(id),
                userId: currentUser.id,
                role: 'ADMINISTRADOR',
                method: 'PIN',
              }
            })
            await logAuthorization(currentUser.id, 'Order', parseInt(id), `Autorización Jefe de Oficina por ${currentUser.fullName} (Administrador actuó en representación)`)
          }
          await db.order.update({
            where: { id: parseInt(id) },
            data: { status: 'AUTORIZADO_ALMACENERO' as OrderStatus },
          })
          await db.orderAuthorization.create({
            data: {
              orderId: parseInt(id),
              userId: currentUser.id,
              role: 'ADMINISTRADOR',
              method: 'PIN',
            }
          })
          await logAuthorization(currentUser.id, 'Order', parseInt(id), `Autorización Almacenero por ${currentUser.fullName} (Administrador actuó en representación)`)
        } else {
          return NextResponse.json({ error: 'El pedido debe estar preparado por el almacén primero.' }, { status: 400 })
        }
      }

      // Verificar stock de todos los items antes de descontar
      for (const orderItem of order.items) {
        if (orderItem.item.quantity < orderItem.quantity) {
          return NextResponse.json({ 
            error: `Error de stock: No hay suficiente cantidad de "${orderItem.item.name}".` 
          }, { status: 400 })
        }

        // Para bienes patrimoniales, verificar que la unidad aún esté disponible
        if (orderItem.patrimonialUnitId && (!orderItem.patrimonialUnit || !orderItem.patrimonialUnit.isAvailable)) {
          return NextResponse.json({ 
            error: `La unidad patrimonial "${orderItem.patrimonialUnit?.patrimonialCode || ''}" ya no está disponible para entrega.` 
          }, { status: 400 })
        }
      }

      // Descontar stock y actualizar estado (transaccional)
      const updatedOrder = await db.$transaction(async (tx) => {
        const defaultReturnDate = (() => {
          const date = new Date()
          date.setDate(date.getDate() + 15)
          return date
        })()

        // Re-leer stock fresco dentro de la transacción para evitar descuentos
        // basados en datos en caché o pedidos concurrentes
        const freshItems = await tx.item.findMany({
          where: { id: { in: order.items.map(oi => oi.itemId) } },
          select: { id: true, quantity: true, name: true }
        })
        const freshItemsMap = new Map(freshItems.map(i => [i.id, i]))

        const puIds = order.items
          .filter(oi => oi.patrimonialUnitId)
          .map(oi => oi.patrimonialUnitId!)
        const freshPUs = puIds.length > 0
          ? await tx.patrimonialUnit.findMany({
              where: { id: { in: puIds } },
              select: { id: true, isAvailable: true, patrimonialCode: true }
            })
          : []
        const freshPUsMap = new Map(freshPUs.map(u => [u.id, u]))

        for (const orderItem of order.items) {
          const item = freshItemsMap.get(orderItem.itemId)
          if (!item || item.quantity < orderItem.quantity) {
            throw new Error(`Stock insuficiente para "${orderItem.item.name}" al momento de la entrega`)
          }
          if (orderItem.patrimonialUnitId) {
            const pu = freshPUsMap.get(orderItem.patrimonialUnitId)
            if (!pu || !pu.isAvailable) {
              throw new Error(`La unidad patrimonial "${pu?.patrimonialCode || ''}" ya no está disponible`)
            }
          }
        }

        await Promise.all(order.items.map(orderItem => {
          const updates: Promise<unknown>[] = [
            tx.item.update({
              where: { id: orderItem.itemId },
              data: { quantity: { decrement: orderItem.quantity } }
            })
          ]

          if (orderItem.item.itemType === 'PATRIMONIAL') {
            const returnDate = expectedReturnDate 
              ? new Date(expectedReturnDate)
              : defaultReturnDate

            updates.push(
              tx.orderItem.update({
                where: { id: orderItem.id },
                data: { 
                  issueDate: new Date(),
                  expectedReturnDate: returnDate,
                  returnDate: returnDate
                }
              })
            )

            if (orderItem.patrimonialUnitId) {
              updates.push(
                tx.patrimonialUnit.update({
                  where: { id: orderItem.patrimonialUnitId },
                  data: { 
                    isAvailable: false,
                    currentHolderId: order.requestedById
                  }
                })
              )
            }
          }

          return Promise.all(updates)
        }))

        return tx.order.update({
          where: { id: parseInt(id) },
          data: { 
            status: 'COMPLETADO' as OrderStatus,
            issueDate: new Date()
          },
          include: ORDER_DETAIL_INCLUDE
        })
      })

      // Verificar si algún item quedó con stock bajo
      const lowStockAlerts = order.items
        .filter(oi => oi.item.quantity - oi.quantity <= oi.item.minStock)
        .map(oi => ({
          id: oi.item.id,
          name: oi.item.name,
          newQuantity: oi.item.quantity - oi.quantity,
          minStock: oi.item.minStock
        }))

      if (lowStockAlerts.length > 0) {
        const notifUsers = await db.user.findMany({
          where: { 
            OR: [
              { role: 'ADMINISTRADOR' },
              { role: 'ALMACENERO' }
            ],
            isActive: true
          },
          select: { id: true }
        })

        if (notifUsers.length > 0) {
          await db.notification.createMany({
            data: notifUsers.flatMap(u =>
              lowStockAlerts.map(item => ({
                userId: u.id,
                title: 'Alerta de Stock Bajo',
                message: `El bien "${item.name}" tiene stock bajo (${item.newQuantity} unidades). Stock mínimo: ${item.minStock}`,
                type: 'STOCK_BAJO',
                relatedId: item.id
              }))
            )
          })
        }
      }

      // Notificar al solicitante
      await db.notification.create({
        data: {
          userId: order.requestedById,
          title: 'Pedido Entregado',
          message: `Su pedido ${order.orderNumber} ha sido entregado exitosamente.`,
          type: 'PEDIDO_AUTORIZADO',
          relatedId: order.id
        }
      })

      await logAudit({ userId: currentUser.id, action: 'STATUS_CHANGE', entityType: 'Order', entityId: parseInt(id), description: `Entrega confirmada - Pedido ${order.orderNumber}` })

      // Invalidar cachés para reflejar el nuevo stock y estado
      await Promise.all([
        cacheDelete(`order:detail:${id}`),
        cacheDelete(CacheKeys.order(parseInt(id))),
        cacheDeletePattern('items:list:'),
      ])

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'Entrega confirmada. El stock ha sido actualizado y se ha generado el comprobante de salida.'
      })
    }

    // ============ ACCIÓN: Completar (mantener compatibilidad) ============
    if (action === 'complete') {
      // Redirigir a confirm_delivery
      return NextResponse.json({ 
        error: 'Use "confirm_delivery" para confirmar la entrega de bienes.' 
      }, { status: 400 })
    }

    // ============ ACCIÓN: Rechazar pedido ============
    if (action === 'reject') {
      if (!notes || notes.trim() === '') {
        return NextResponse.json({ error: 'Debe proporcionar el motivo del rechazo.' }, { status: 400 })
      }

      // Verificar permisos para rechazar
      const canRejectAsJefe = currentUser.role === 'JEFE_OFICINA' && order.status === 'PENDIENTE' && order.officeId === currentUser.officeId
      const canRejectAsAlmacenero = currentUser.role === 'ALMACENERO' && order.status === 'AUTORIZADO_JEFE'
      const canRejectAsAdmin = currentUser.role === 'ADMINISTRADOR'
      
      if (!canRejectAsJefe && !canRejectAsAlmacenero && !canRejectAsAdmin) {
        return NextResponse.json({ error: 'No autorizado para rechazar este pedido.' }, { status: 403 })
      }

      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: { 
          status: 'RECHAZADO' as OrderStatus,
          notes: `${order.notes || ''}\n[MOTIVO DE RECHAZO]: ${notes}`.trim()
        },
        include: { 
          requestedBy: { select: USER_BASIC_SELECT }, 
          office: true, 
          items: { include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, location: true, quantity: true, minStock: true } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } } },
          authorizations: { include: { user: { select: USER_BASIC_SELECT } } }
        }
      })

      // Notificar al solicitante
      await db.notification.create({
        data: {
          userId: order.requestedById,
          title: 'Pedido Rechazado',
          message: `Su pedido ${order.orderNumber} ha sido rechazado. Motivo: ${notes}`,
          type: 'PEDIDO_RECHAZADO',
          relatedId: order.id
        }
      })

      await logRejection(currentUser.id, 'Order', parseInt(id), notes)

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'Pedido rechazado exitosamente.'
      })
    }

    // ============ ACCIÓN: Subir PDF firmado ============
    if (action === 'upload_signed_pdf') {
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado. Solo el Almacenero o Administrador pueden subir el PDF firmado.' }, { status: 403 })
      }

      const { signedPdfUrl } = body
      
      if (!signedPdfUrl) {
        return NextResponse.json({ error: 'URL del PDF es requerida.' }, { status: 400 })
      }

      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: { signedPdfUrl },
        include: ORDER_DETAIL_INCLUDE
      })

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'PDF firmado registrado correctamente.'
      })
    }

    // ============ ACCIÓN: Registrar retorno/ubicación de bien patrimonial ============
    if (action === 'register_return') {
      if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'No autorizado. Solo el Almacenero o Administrador pueden registrar esta información.' }, { status: 403 })
      }

      const { orderItemId, currentLocation, actualReturnDate, status } = body
      
      if (!orderItemId) {
        return NextResponse.json({ error: 'ID del item es requerido.' }, { status: 400 })
      }

      const updateData: Prisma.OrderItemUpdateInput = {}
      if (currentLocation) updateData.currentLocation = currentLocation
      if (actualReturnDate) updateData.actualReturnDate = new Date(actualReturnDate)

      const orderItem = await db.orderItem.findUnique({
        where: { id: orderItemId },
        select: { patrimonialUnitId: true }
      })

      if (orderItem?.patrimonialUnitId) {
        const puUpdate: Prisma.PatrimonialUnitUpdateInput = {
          isAvailable: true,
          currentHolderId: null,
        }
        if (status) puUpdate.status = status
        await db.patrimonialUnit.update({
          where: { id: orderItem.patrimonialUnitId },
          data: puUpdate
        })
      }

      await db.orderItem.update({
        where: { id: orderItemId },
        data: updateData
      })

      await Promise.all([
        cacheDelete(CacheKeys.warehouseList()),
        cacheDelete(CacheKeys.dashboardStats()),
        cacheDelete(CacheKeys.itemList()),
      ])

      const updatedOrder = await db.order.findUnique({
        where: { id: parseInt(id) },
        include: ORDER_DETAIL_INCLUDE
      })

      return NextResponse.json({ 
        order: updatedOrder,
        message: 'Información registrada correctamente.'
      })
    }

    // Actualizar items del pedido
    if (items) {
      await db.orderItem.deleteMany({
        where: { orderId: parseInt(id) }
      })

      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: {
          items: {
            create: items.map((item: { itemId: number; quantity: number }) => ({
              itemId: item.itemId,
              quantity: item.quantity
            }))
          }
        },
        include: { requestedBy: { select: USER_BASIC_SELECT }, office: true, items: { include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, location: true, quantity: true, minStock: true } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } } } }
      })

      return NextResponse.json({ order: updatedOrder })
    }

    // Actualizar notas
    if (notes !== undefined) {
      const updatedOrder = await db.order.update({
        where: { id: parseInt(id) },
        data: { notes },
        include: { requestedBy: { select: USER_BASIC_SELECT }, office: true, items: { include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, location: true, quantity: true, minStock: true } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } } } }
      })

      await Promise.all([
        cacheDelete(CacheKeys.officeList()),
        cacheDelete(CacheKeys.pendingOrders()),
        cacheDelete(CacheKeys.orderList()),
      ])
      return NextResponse.json({ order: updatedOrder })
    }

    await Promise.all([
      cacheDelete(CacheKeys.officeList()),
      cacheDelete(CacheKeys.pendingOrders()),
      cacheDelete(CacheKeys.orderList()),
    ])
    return NextResponse.json({ order })
  } catch (error) {
    // Errores de validación de stock lanzados dentro de la transacción de entrega
    if (error instanceof Error && (
      error.message.startsWith('Stock insuficiente') ||
      error.message.startsWith('La unidad patrimonial')
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    logger.error('Update order error:', error)
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const order = await db.order.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, requestedById: true, status: true, orderNumber: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    // Solo el creador o admin pueden eliminar
    if (order.requestedById !== currentUser.id && currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado para eliminar este pedido.' }, { status: 403 })
    }

    // Solo permitir eliminación si está pendiente
    if (order.status !== 'PENDIENTE') {
      return NextResponse.json({ error: 'Solo se pueden eliminar pedidos en estado pendiente.' }, { status: 400 })
    }

    await db.$transaction([
      db.orderItem.deleteMany({
        where: { orderId: parseInt(id) }
      }),
      db.order.delete({
        where: { id: parseInt(id) }
      })
    ])

    await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'Order', entityId: parseInt(id), description: `Pedido ${order.orderNumber} eliminado por ${currentUser.fullName}` })

    await Promise.all([
      cacheDelete(CacheKeys.officeList()),
      cacheDelete(CacheKeys.pendingOrders()),
      cacheDelete(CacheKeys.orderList()),
    ])

    return NextResponse.json({ success: true, message: 'Pedido eliminado correctamente.' })
  } catch (error) {
    logger.error('Delete order error:', error)
    return NextResponse.json({ error: 'Error al eliminar pedido' }, { status: 500 })
  }
}
