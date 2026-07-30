import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logUpdate, logDelete } from '@/lib/audit'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, location, description, managerId, isActive } = body

    const warehouse = await db.warehouse.update({
      where: { id: parseInt(id) },
      data: { 
        name, 
        location, 
        description, 
        managerId: managerId || null,
        isActive 
      },
      include: { manager: true }
    })

    logUpdate(currentUser.id, 'Warehouse', parseInt(id), {}, { name, isActive })

    await cacheDelete(CacheKeys.warehouseList())

    return NextResponse.json({ warehouse })
  } catch (error) {
    logger.error('Update warehouse error:', error)
    return NextResponse.json({ error: 'Error al actualizar almacén' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    
    // Verificar si el almacén tiene items
    const itemsCount = await db.item.count({
      where: { warehouseId: parseInt(id) }
    })

    if (itemsCount > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un almacén con bienes registrados' },
        { status: 400 }
      )
    }

    const deletedWarehouse = await db.warehouse.findUnique({ where: { id: parseInt(id) }, select: { name: true } })
    await db.warehouse.delete({
      where: { id: parseInt(id) }
    })

    logDelete(currentUser.id, 'Warehouse', parseInt(id), {}, `Almacén ${deletedWarehouse?.name || `ID ${id}`} eliminado`)

    await cacheDelete(CacheKeys.warehouseList())

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete warehouse error:', error)
    return NextResponse.json({ error: 'Error al eliminar almacén' }, { status: 500 })
  }
}
