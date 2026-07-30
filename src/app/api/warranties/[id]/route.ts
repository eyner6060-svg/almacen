import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logUpdate, logDelete } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Obtener garantía individual
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const warranty = await db.warranty.findUnique({
      where: { id: parseInt(id) },
      include: {
        item: {
          include: {
            warehouse: true,
          },
        },
      },
    })

    if (!warranty) {
      return NextResponse.json({ error: 'Garantía no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ warranty })
  } catch (error) {
    logger.error('Error fetching warranty:', error)
    return NextResponse.json({ error: 'Error al obtener garantía' }, { status: 500 })
  }
}

// PUT - Actualizar garantía
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      purchaseDate,
      expiryDate,
      supplierName,
      supplierContact,
      warrantyTerms,
      documentUrl,
      notes,
      status,
    } = body

    const warranty = await db.warranty.update({
      where: { id: parseInt(id) },
      data: {
        ...(purchaseDate && { purchaseDate: new Date(purchaseDate) }),
        ...(expiryDate && { expiryDate: new Date(expiryDate) }),
        ...(supplierName !== undefined && { supplierName }),
        ...(supplierContact !== undefined && { supplierContact }),
        ...(warrantyTerms !== undefined && { warrantyTerms }),
        ...(documentUrl !== undefined && { documentUrl }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: {
        item: true,
      },
    })

    logUpdate(user.id, 'PatrimonialUnit', parseInt(id), {}, { status })

    return NextResponse.json({ warranty })
  } catch (error) {
    logger.error('Error updating warranty:', error)
    return NextResponse.json({ error: 'Error al actualizar garantía' }, { status: 500 })
  }
}

// DELETE - Eliminar garantía
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    await db.warranty.delete({
      where: { id: parseInt(id) },
    })

    logDelete(user.id, 'PatrimonialUnit', parseInt(id), {}, `Garantía ID ${id} eliminada`)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting warranty:', error)
    return NextResponse.json({ error: 'Error al eliminar garantía' }, { status: 500 })
  }
}
