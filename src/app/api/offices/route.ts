import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheGetOrSet, cacheDelete, CacheKeys, CacheTTL } from '@/lib/cache'
import { createOfficeSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const offices = await cacheGetOrSet(
      CacheKeys.officeList(),
      () => db.office.findMany({
        include: { _count: { select: { users: true, orders: true } } },
        orderBy: { name: 'asc' }
      }),
      { ttl: CacheTTL.LONG }
    )

    return NextResponse.json({ offices })
  } catch (error) {
    logger.error('Get offices error:', error)
    return NextResponse.json({ error: 'Error al obtener oficinas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, code, description } = createOfficeSchema.parse(body)

    const existingOffice = await db.office.findUnique({
      where: { code }
    })

    if (existingOffice) {
      return NextResponse.json(
        { error: 'Ya existe una oficina con ese código' },
        { status: 400 }
      )
    }

    const office = await db.office.create({
      data: { name, code, description }
    })

    await cacheDelete(CacheKeys.officeList())

    logCreate(currentUser.id, 'Office', office.id, { name, code })

    return NextResponse.json({ office })
  } catch (error) {
    return handleApiError(error)
  }
}
