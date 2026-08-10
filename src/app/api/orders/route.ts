import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logCreate } from '@/lib/audit'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { createOrderSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { OrderStatus, NotifType, Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'
import { getNextDocumentNumber } from '@/lib/document-sequence'

const VALID_ORDER_STATUSES: OrderStatus[] = ['PENDIENTE', 'AUTORIZADO_JEFE', 'AUTORIZADO_ALMACENERO', 'COMPLETADO', 'RECHAZADO']

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const officeId = searchParams.get('officeId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))
    const view = searchParams.get('view') || 'list'

    const where: Prisma.OrderWhereInput = {}

    if (status && VALID_ORDER_STATUSES.includes(status as OrderStatus)) {
      where.status = status as OrderStatus
    }

    if (officeId) {
      where.officeId = parseInt(officeId)
    }

    if (currentUser.role === 'TRABAJADOR') {
      where.requestedById = currentUser.id
    } else if (currentUser.role === 'JEFE_OFICINA') {
      if (!currentUser.office?.id) {
        return NextResponse.json(
          { error: 'No tiene una oficina asignada', orders: [], pagination: { page: 1, perPage: 20, total: 0, totalPages: 0 } },
          { status: 200 }
        )
      }
      where.officeId = currentUser.office.id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderInclude: any = view === 'detail' ? {
      requestedBy: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true, office: { select: { id: true, name: true, code: true } } } },
      office: true,
      items: {
        include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, location: true, quantity: true, minStock: true } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } }
      },
      authorizations: {
        include: { user: { select: { id: true, fullName: true, role: true } } }
      },
    } : {
      requestedBy: { select: { id: true, fullName: true, position: true, dni: true, office: { select: { id: true, name: true } } } },
      office: { select: { id: true, name: true } },
      items: {
        select: {
          id: true, quantity: true, itemId: true, patrimonialCode: true, patrimonialUnitId: true,
          issueDate: true, expectedReturnDate: true, returnDate: true, actualReturnDate: true,
          currentLocation: true, isOverdue: true, notes: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          item: { select: { id: true, code: true, name: true, brand: true, model: true, itemType: true, status: true, color: true, unit: true } } as any,
          patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } }
        }
      },
      authorizations: { select: { id: true, role: true, authorizedAt: true, user: { select: { id: true, fullName: true, role: true } } } },
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.order.count({ where })
    ])

    return NextResponse.json({ 
      orders,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    })
  } catch (error) {
    logger.error('Get orders error:', error)
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`order-create:${ip}`, RateLimitPresets.CREATE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    createOrderSchema.parse(body)
    const { items, notes, officeId } = body

    // Validar que el usuario tenga una oficina asignada o se proporcione una
    let targetOfficeId: number | undefined
    if (officeId) {
      targetOfficeId = typeof officeId === 'string' ? parseInt(officeId) : officeId
    } else if (currentUser.office?.id) {
      targetOfficeId = currentUser.office.id
    }

    if (!targetOfficeId) {
      return NextResponse.json(
        { error: 'Debe tener una oficina asignada o seleccionar una oficina' },
        { status: 400 }
      )
    }

    interface OrderItemInput {
      itemId: number
      quantity: number
      patrimonialUnitId?: number | null
      patrimonialCode?: string | null
    }
    const typedItems = items as OrderItemInput[]

    const itemIds = typedItems.map(i => i.itemId)
    const puIds = typedItems.filter(i => i.patrimonialUnitId).map(i => i.patrimonialUnitId!)

    // Generar número de documento (upsert atómico, seguro fuera de transacción)
    const orderNumber = (await getNextDocumentNumber('ORDEN_SALIDA')).documentNumber

    // Transacción: re-leer stock fresco → validar → crear pedido
    // NOTA: El stock NO se descuenta aquí. Se descuenta al confirmar la entrega
    // (confirm_delivery) para evitar que los bienes queden bloqueados antes de ser entregados.
    const order = await db.$transaction(async (tx) => {
      // 1. Re-leer stock actual dentro de la transacción
      const currentItems = await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, quantity: true, name: true }
      })

      const currentPUs = puIds.length > 0
        ? await tx.patrimonialUnit.findMany({
            where: { id: { in: puIds } },
            select: { id: true, isAvailable: true }
          })
        : []

      const itemsMap = new Map(currentItems.map(i => [i.id, i]))
      const puMap = new Map(currentPUs.map(u => [u.id, u]))

      // 2. Validar stock contra valores frescos
      for (const orderItem of typedItems) {
        const item = itemsMap.get(orderItem.itemId)
        if (!item || item.quantity < orderItem.quantity) {
          throw new Error(`Stock insuficiente para ${item?.name || 'item'}`)
        }

        if (orderItem.patrimonialUnitId) {
          const pu = puMap.get(orderItem.patrimonialUnitId)
          if (!pu || !pu.isAvailable) {
            throw new Error('La unidad patrimonial no está disponible')
          }
        }
      }

      // 3. Crear pedido
      const created = await tx.order.create({
        data: {
          orderNumber,
          status: 'PENDIENTE',
          requestedById: currentUser.id,
          officeId: targetOfficeId,
          notes,
          items: {
            create: items.map((item: {
              itemId: number
              quantity: number
              patrimonialUnitId?: number | null
              patrimonialCode?: string | null
            }) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              patrimonialUnitId: item.patrimonialUnitId || null,
              patrimonialCode: item.patrimonialCode || null
            }))
          }
        },
        include: {
          requestedBy: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true } },
          office: true,
          items: { include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true } }, patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } } } }
        }
      })

      return created
    })

    // Log de auditoría
    await logCreate(
      currentUser.id,
      'Order',
      order.id,
      {
        orderNumber: order.orderNumber,
        officeId: order.officeId,
        itemCount: items.length,
        status: 'PENDIENTE'
      },
      `Pedido ${order.orderNumber} creado con ${items.length} items`
    )

    // Invalidar cachés
    await Promise.all([
      cacheDelete(CacheKeys.pendingOrders()),
      cacheDelete(CacheKeys.orderList()),
      cacheDelete(CacheKeys.officeList()),
    ])

    // Notificar a jefes de oficina, administradores y almaceneros
    const [jefes, adminsYAlmaceneros] = await Promise.all([
      db.user.findMany({
        where: { role: 'JEFE_OFICINA', officeId: order.officeId },
        select: { id: true }
      }),
      db.user.findMany({
        where: { role: { in: ['ADMINISTRADOR', 'ALMACENERO'] }, isActive: true },
        select: { id: true }
      })
    ])

    const allNotifUsers: {
      userId: number
      title: string
      message: string
      type: NotifType
      relatedId: number
    }[] = [
      ...jefes.map(u => ({ userId: u.id, title: 'Nuevo Pedido Pendiente', message: `El pedido ${order.orderNumber} requiere su autorización`, type: 'PEDIDO_PENDIENTE' as NotifType, relatedId: order.id })),
      ...adminsYAlmaceneros.map(u => ({ userId: u.id, title: 'Nuevo Pedido Creado', message: `Se ha creado el pedido ${order.orderNumber} y está pendiente de autorización`, type: 'PEDIDO_PENDIENTE' as NotifType, relatedId: order.id }))
    ]

    if (allNotifUsers.length > 0) {
      await db.notification.createMany({ data: allNotifUsers })
    }

    return NextResponse.json({ order })
  } catch (error) {
    // Errores lanzados desde la transacción por validación de stock
    if (error instanceof Error) {
      if (error.message.startsWith('Stock insuficiente') || error.message.startsWith('La unidad patrimonial')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    return handleApiError(error)
  }
}
