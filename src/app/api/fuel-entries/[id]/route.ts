import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logUpdate, logAudit } from '@/lib/audit'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { supplier, documentNumber, notes, quantity, fuelType } = body

    const existing = await db.fuelEntry.findUnique({ where: { id: parseInt(id) } })
    if (!existing) {
      return NextResponse.json({ error: 'Ingreso no encontrado' }, { status: 404 })
    }

    const data: Prisma.FuelEntryUpdateInput = {}
    let inventoryAdjustment = 0

    if (supplier !== undefined) data.supplier = supplier
    if (documentNumber !== undefined) data.documentNumber = documentNumber
    if (notes !== undefined) data.notes = notes

    if (quantity !== undefined) {
      const quantityNum = parseFloat(String(quantity))
      if (isNaN(quantityNum) || quantityNum < 0) {
        return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
      }
      data.quantity = quantityNum
      inventoryAdjustment = quantityNum - existing.quantity
      data.newStock = existing.newStock + inventoryAdjustment
      data.previousStock = existing.previousStock

      if (fuelType !== undefined && fuelType !== existing.fuelType) {
        const fuelTypeMatch = fuelType === 'GASOLINA' || fuelType === 'PETROLEO' ? fuelType : null
        if (!fuelTypeMatch) {
          return NextResponse.json({ error: 'Tipo de combustible inválido' }, { status: 400 })
        }

        const oldInventory = await db.fuelInventory.findUnique({ where: { fuelType: existing.fuelType } })
        if (oldInventory) {
          await db.fuelInventory.update({
            where: { fuelType: existing.fuelType },
            data: { quantity: { decrement: existing.quantity } }
          })
        }

        const newInventory = await db.fuelInventory.findUnique({ where: { fuelType: fuelTypeMatch } })
        if (newInventory) {
          await db.fuelInventory.update({
            where: { fuelType: fuelTypeMatch },
            data: { quantity: { increment: quantityNum } }
          })
        } else {
          await db.fuelInventory.create({
            data: { fuelType: fuelTypeMatch, quantity: quantityNum, minStock: 10 }
          })
        }

        data.fuelType = fuelTypeMatch
      } else if (inventoryAdjustment !== 0) {
        await db.fuelInventory.update({
          where: { fuelType: existing.fuelType },
          data: { quantity: { increment: inventoryAdjustment } }
        })
      }
    } else if (fuelType !== undefined && fuelType !== existing.fuelType) {
      const fuelTypeMatch = fuelType === 'GASOLINA' || fuelType === 'PETROLEO' ? fuelType : null
      if (!fuelTypeMatch) {
        return NextResponse.json({ error: 'Tipo de combustible inválido' }, { status: 400 })
      }
      data.fuelType = fuelTypeMatch
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 })
    }

    const entry = await db.fuelEntry.update({
      where: { id: parseInt(id) },
      data,
      include: {
        receivedBy: {
          select: { id: true, fullName: true, email: true }
        }
      }
    })

    logUpdate(currentUser.id, 'FuelEntry', entry.id, {
      fuelType: existing.fuelType,
      quantity: existing.quantity,
      supplier: existing.supplier,
      documentNumber: existing.documentNumber,
      notes: existing.notes
    }, {
      fuelType: entry.fuelType,
      quantity: entry.quantity,
      supplier: entry.supplier,
      documentNumber: entry.documentNumber,
      notes: entry.notes
    }, `Ingreso de combustible ${entry.entryNumber} actualizado`)

    return NextResponse.json({ entry })
  } catch (error) {
    logger.error('Error al actualizar ingreso de combustible:', error)
    return NextResponse.json({ error: 'Error al actualizar ingreso de combustible' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const entry = await db.fuelEntry.findUnique({ where: { id: parseInt(id) } })
    if (!entry) {
      return NextResponse.json({ error: 'Ingreso no encontrado' }, { status: 404 })
    }

    await db.fuelInventory.update({
      where: { fuelType: entry.fuelType },
      data: { quantity: { decrement: entry.quantity } }
    })

    await db.fuelEntry.delete({ where: { id: parseInt(id) } })

    logAudit({
      userId: currentUser.id,
      action: 'DELETE',
      entityType: 'FuelEntry',
      entityId: entry.id,
      description: `Ingreso de combustible ${entry.entryNumber} eliminado`,
      severity: 'WARNING'
    })

    return NextResponse.json({ success: true, message: 'Ingreso eliminado correctamente' })
  } catch (error) {
    logger.error('Error al eliminar ingreso de combustible:', error)
    return NextResponse.json({ error: 'Error al eliminar ingreso de combustible' }, { status: 500 })
  }
}
