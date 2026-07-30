import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))

    const [entries, total] = await Promise.all([
      db.fuelEntry.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          receivedBy: {
            select: { id: true, fullName: true }
          }
        }
      }),
      db.fuelEntry.count(),
    ])

    return NextResponse.json({
      entries,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    logger.error('Error al obtener ingresos de combustible:', error)
    return NextResponse.json({ error: 'Error al obtener ingresos de combustible' }, { status: 500 })
  }
}
