import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const available = searchParams.get('available') === 'true'

    const where: Prisma.PatrimonialUnitWhereInput = {}
    if (itemId) where.itemId = parseInt(itemId)
    if (available) where.isAvailable = true

    const patrimonialUnits = await db.patrimonialUnit.findMany({
      where,
      select: { id: true, patrimonialCode: true, status: true, isAvailable: true }
    })

    return NextResponse.json({ patrimonialUnits })
  } catch (error) {
    logger.error('Error al obtener patrimonial units:', error)
    return NextResponse.json({ error: 'Error al obtener unidades patrimoniales' }, { status: 500 })
  }
}
