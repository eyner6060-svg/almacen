import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

// GET - Obtener movimientos recientes
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const itemId = searchParams.get('itemId')

    const where: Prisma.ItemMovementWhereInput = {}
    if (itemId) {
      where.itemId = parseInt(itemId)
    }

    const movements = await db.itemMovement.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            patrimonialCode: true,
            warehouse: {
              select: { name: true }
            },
          },
        },
        movedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ movements })
  } catch (error) {
    logger.error('Error al obtener movements:', error)
    return NextResponse.json({ movements: [], error: 'Error al obtener movimientos' }, { status: 500 })
  }
}

// POST - Crear un nuevo movimiento
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      patrimonialCode,
      itemId,
      fromLocation,
      toLocation,
      fromUserId,
      toUserId,
      reason,
      notes,
      latitude,
      longitude,
    } = body

    if (!patrimonialCode || !itemId || !toLocation) {
      return NextResponse.json({ error: 'Código patrimonial, bien y ubicación destino son requeridos' }, { status: 400 })
    }

    const movement = await db.itemMovement.create({
      data: {
        patrimonialCode,
        itemId: parseInt(itemId),
        fromLocation,
        toLocation,
        fromUserId: fromUserId ? parseInt(fromUserId) : null,
        toUserId: toUserId ? parseInt(toUserId) : null,
        movedById: user.id,
        reason,
        notes,
        latitude,
        longitude,
      },
      include: {
        item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true } },
        movedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    logCreate(user.id, 'Item', movement.id, { itemId: parseInt(itemId), fromLocation, toLocation })

    return NextResponse.json({ movement })
  } catch (error) {
    logger.error('Error al crear movement:', error)
    return NextResponse.json({ error: 'Error al registrar movimiento' }, { status: 500 })
  }
}
