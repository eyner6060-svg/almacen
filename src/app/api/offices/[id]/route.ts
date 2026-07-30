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
    const { name, code, description, isActive } = body

    const office = await db.office.update({
      where: { id: parseInt(id) },
      data: { name, code, description, isActive }
    })

    logUpdate(currentUser.id, 'Office', parseInt(id), {}, { name, code, isActive })

    await cacheDelete(CacheKeys.officeList())

    return NextResponse.json({ office })
  } catch (error) {
    logger.error('Update office error:', error)
    return NextResponse.json({ error: 'Error al actualizar oficina' }, { status: 500 })
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
    
    // Verificar si la oficina tiene usuarios
    const usersCount = await db.user.count({
      where: { officeId: parseInt(id) }
    })

    if (usersCount > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una oficina con usuarios asignados' },
        { status: 400 }
      )
    }

    const deletedOffice = await db.office.findUnique({ where: { id: parseInt(id) }, select: { name: true } })
    await db.office.delete({
      where: { id: parseInt(id) }
    })

    logDelete(currentUser.id, 'Office', parseInt(id), {}, `Oficina ${deletedOffice?.name || `ID ${id}`} eliminada`)

    await cacheDelete(CacheKeys.officeList())

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete office error:', error)
    return NextResponse.json({ error: 'Error al eliminar oficina' }, { status: 500 })
  }
}
