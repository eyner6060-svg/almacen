import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const allItems = await db.item.findMany({
      where: {
        isDeleted: false,
        itemType: 'CONSUMIBLE',
      },
      select: {
        id: true,
        name: true,
        code: true,
        quantity: true,
        minStock: true,
        unit: true,
        category: true,
        technicalSpecs: true,
      },
      orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
    })
    const lowStockItems = allItems.filter(i => i.quantity <= i.minStock)

    const zeroStockItems = lowStockItems.filter(i => i.quantity === 0)
    const lowStock = lowStockItems.filter(i => i.quantity > 0 && i.quantity <= i.minStock)

    return NextResponse.json({
      zeroStock: zeroStockItems,
      lowStock,
      total: lowStockItems.length,
    })
  } catch (error) {
    logger.error('Error al verificar stock bajo:', error)
    return NextResponse.json({ error: 'Error al verificar stock' }, { status: 500 })
  }
}
