import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET - Obtener movimientos por código patrimonial
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const { code: rawCode } = await params
    const code = decodeURIComponent(rawCode)

    // Buscar por código patrimonial o código de bien
    const movements = await db.itemMovement.findMany({
      where: {
        OR: [
          { patrimonialCode: code },
          { item: { code: code } },
        ],
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            model: true,
            brand: true,
            category: true,
            unit: true,
            itemType: true,
            status: true,
            location: true,
            quantity: true,
            minStock: true,
            warehouse: {
              select: { id: true, name: true },
            },
          },
        },
        movedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      take: Math.min(100, parseInt(searchParams.get('limit') || '50')),
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ movements })
  } catch (error) {
    logger.error('Error fetching traceability:', error)
    return NextResponse.json({ error: 'Error al obtener trazabilidad' }, { status: 500 })
  }
}
