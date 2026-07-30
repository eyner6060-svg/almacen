import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logAudit, logDelete } from '@/lib/audit'

const ASSET_LOOKUP_INCLUDE = {
  item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true } },
  patrimonialUnit: true,
} as const

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, returnDocNumber, returnDocUrl, notes, returnQuantity } = body

    const existing = await db.assignedAsset.findUnique({
      where: { id: parseInt(id) },
      include: ASSET_LOOKUP_INCLUDE,
    })

    if (!existing) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    if (action === 'return') {
      if (existing.status !== 'ASIGNADO') {
        return NextResponse.json({ error: 'El bien ya fue devuelto' }, { status: 400 })
      }

      const qtyToReturn = returnQuantity ? parseInt(returnQuantity) : existing.quantity
      if (qtyToReturn <= 0 || qtyToReturn > existing.quantity) {
        return NextResponse.json({ error: `Cantidad invalida. Debe ser entre 1 y ${existing.quantity}` }, { status: 400 })
      }

      const USER_BASIC_SELECT = { id: true, fullName: true, role: true }
      const ITEM_BASIC_SELECT = { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } }

      const updated = await db.$transaction(async (tx) => {
        await tx.item.update({
          where: { id: existing.itemId },
          data: { quantity: { increment: qtyToReturn } },
        })

        if (existing.patrimonialUnitId) {
          await tx.patrimonialUnit.update({
            where: { id: existing.patrimonialUnitId },
            data: { isAvailable: true, currentHolderId: null },
          })
        }

        if (qtyToReturn < existing.quantity) {
          const remainingQty = existing.quantity - qtyToReturn

          await tx.assignedAsset.update({
            where: { id: parseInt(id) },
            data: { quantity: remainingQty },
          })

          return tx.assignedAsset.create({
            data: {
              userId: existing.userId,
              itemId: existing.itemId,
              patrimonialUnitId: existing.patrimonialUnitId,
              quantity: qtyToReturn,
              assignmentDocNumber: existing.assignmentDocNumber,
              assignmentDocUrl: existing.assignmentDocUrl,
              notes: notes || existing.notes,
              status: 'DEVUELTO',
              returnDate: new Date(),
              returnDocNumber: returnDocNumber || null,
              returnDocUrl: returnDocUrl || null,
            },
            include: {
              user: { select: USER_BASIC_SELECT },
              item: { select: ITEM_BASIC_SELECT },
              patrimonialUnit: true,
            },
          })
        }

        return tx.assignedAsset.update({
          where: { id: parseInt(id) },
          data: {
            status: 'DEVUELTO',
            returnDate: new Date(),
            returnDocNumber: returnDocNumber || null,
            returnDocUrl: returnDocUrl || null,
            notes: notes || existing.notes,
          },
          include: {
            user: { select: USER_BASIC_SELECT },
            item: { select: ITEM_BASIC_SELECT },
            patrimonialUnit: true,
          },
        })
      })

      logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'PatrimonialUnit', entityId: parseInt(id), description: `Bien devuelto - ${existing.item.name} (${qtyToReturn} unidades)` })

      await Promise.all([
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.lowStockItems()),
        cacheDelete(CacheKeys.warehouseList()),
      ])

      return NextResponse.json({ assignedAsset: updated, isPartialReturn: qtyToReturn < existing.quantity })
    }

    if (action === 'lost') {
      if (existing.status !== 'ASIGNADO') {
        return NextResponse.json({ error: 'El bien no está asignado' }, { status: 400 })
      }

      if (existing.patrimonialUnitId) {
        await db.patrimonialUnit.update({
          where: { id: existing.patrimonialUnitId },
          data: { status: 'BAJA', isAvailable: false },
        })
      }

      const updated = await db.assignedAsset.update({
        where: { id: parseInt(id) },
        data: {
          status: 'PERDIDO',
          notes: notes || existing.notes,
        },
        include: {
          user: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true, office: { select: { id: true, name: true, code: true } } } },
          item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } } },
          patrimonialUnit: true,
        },
      })

      logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'PatrimonialUnit', entityId: parseInt(id), description: `Bien marcado como perdido - ${existing.item.name}`, severity: 'WARNING' })

      await Promise.all([
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.lowStockItems()),
        cacheDelete(CacheKeys.warehouseList()),
      ])

      return NextResponse.json({ assignedAsset: updated })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    logger.error('Error updating assigned asset:', error)
    return NextResponse.json({ error: 'Error al actualizar asignación' }, { status: 500 })
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
    const existing = await db.assignedAsset.findUnique({
      where: { id: parseInt(id) },
      include: ASSET_LOOKUP_INCLUDE,
    })

      if (existing) {
        await db.item.update({
          where: { id: existing.itemId },
          data: { quantity: { increment: existing.quantity } },
        })
        if (existing.patrimonialUnitId) {
        await db.patrimonialUnit.update({
          where: { id: existing.patrimonialUnitId },
          data: { isAvailable: true, currentHolderId: null },
        })
      }
    }

    await db.assignedAsset.delete({ where: { id: parseInt(id) } })

    logDelete(currentUser.id, 'PatrimonialUnit', parseInt(id), {}, `Asignación ID ${id} eliminada`)

    await Promise.all([
      cacheDelete(CacheKeys.itemList()),
      cacheDelete(CacheKeys.lowStockItems()),
      cacheDelete(CacheKeys.warehouseList()),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting assigned asset:', error)
    return NextResponse.json({ error: 'Error al eliminar asignación' }, { status: 500 })
  }
}
