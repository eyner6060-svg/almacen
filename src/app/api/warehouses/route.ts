import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { createWarehouseSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const [warehouses, total] = await Promise.all([
      db.warehouse.findMany({
        include: { manager: { select: { id: true, fullName: true, email: true, role: true } }, _count: { select: { items: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.warehouse.count()
    ])

    return NextResponse.json({
      warehouses,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    })
  } catch (error) {
    logger.error('Get warehouses error:', error)
    return NextResponse.json({ error: 'Error al obtener almacenes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, location, description, managerId } = createWarehouseSchema.parse(body)

    const warehouse = await db.warehouse.create({
      data: {
        name,
        location,
        description,
        managerId: managerId ?? null
      },
      include: { manager: true }
    })

    await cacheDelete(CacheKeys.warehouseList())

    logCreate(currentUser.id, 'Warehouse', warehouse.id, { name, location })

    return NextResponse.json({ warehouse })
  } catch (error) {
    return handleApiError(error)
  }
}
