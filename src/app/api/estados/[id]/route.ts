import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, label, color, isActive } = body

    const existing = await db.itemStatusEnum.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    }

    if (name !== undefined) {
      const nameKey = name.trim().toUpperCase().replace(/\s+/g, '_')
      const duplicate = await db.itemStatusEnum.findUnique({ where: { name: nameKey } })
      if (duplicate && duplicate.id !== parseInt(id)) {
        return NextResponse.json({ error: 'Ya existe un estado con ese nombre' }, { status: 409 })
      }
    }

    const data: Prisma.ItemStatusEnumUpdateInput = {}
    if (name !== undefined) data.name = name.trim().toUpperCase().replace(/\s+/g, '_')
    if (label !== undefined) data.label = label.trim()
    if (color !== undefined) data.color = color
    if (isActive !== undefined) data.isActive = isActive

    const estado = await db.itemStatusEnum.update({
      where: { id: parseInt(id) },
      data
    })

    return NextResponse.json({ estado })
  } catch (error) {
    logger.error('Update estado error:', error)
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const estado = await db.itemStatusEnum.findUnique({ where: { id: parseInt(id) } })

    if (!estado) {
      return NextResponse.json({ error: 'Estado no encontrado' }, { status: 404 })
    }

    // Verificar si hay bienes usando este estado
    const itemsCount = await db.item.count({ where: { status: estado.name } })
    if (itemsCount > 0) {
      return NextResponse.json({
        error: `No se puede eliminar el estado "${estado.label}" porque hay ${itemsCount} bien(es) que lo usan. Cambie el estado de esos bienes primero.`
      }, { status: 409 })
    }

    // Eliminar el estado
    await db.itemStatusEnum.delete({ where: { id: parseInt(id) } })

    return NextResponse.json({ success: true, message: 'Estado eliminado correctamente' })
  } catch (error) {
    logger.error('Delete estado error:', error)
    return NextResponse.json({ error: 'Error al eliminar estado' }, { status: 500 })
  }
}
