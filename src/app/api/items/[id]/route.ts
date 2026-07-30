import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { updateItemSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logUpdate, logDelete, logAudit } from '@/lib/audit'

const invalidateItemCaches = () => Promise.all([
  cacheDelete(CacheKeys.itemList()),
  cacheDelete(CacheKeys.itemCategories()),
  cacheDelete(CacheKeys.lowStockItems()),
  cacheDelete(CacheKeys.warehouseList()),
  cacheDelete(CacheKeys.dashboardStats()),
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const item = await db.item.findUnique({
      where: { id: parseInt(id) },
      include: { 
        warehouse: { select: { id: true, name: true, location: true } },
        patrimonialUnits: { select: { id: true, patrimonialCode: true, status: true, isAvailable: true } },
        statusLogs: {
          include: { reporter: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Bien no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ item })
  } catch (error) {
    logger.error('Get item error:', error)
    return NextResponse.json({ error: 'Error al obtener bien' }, { status: 500 })
  }
}

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
    const itemId = parseInt(id)
    const body = await request.json()
    const { patrimonialCodes: newCodesRaw, patrimonialCode: patrimonialCodeRaw, warehouseId: _warehouseId, code: _code, patrimonialUnitUpdates, ...restBody } = body

    // También manejar patrimonialCode (singular) para items con cantidad=1
    let finalCodesRaw = newCodesRaw
    if (!finalCodesRaw && patrimonialCodeRaw) {
      finalCodesRaw = patrimonialCodeRaw.split('\n').map((c: string) => c.trim()).filter(Boolean)
    }

    const updateData = updateItemSchema.parse(restBody)

    const item = await db.$transaction(async (tx) => {
      // Actualizar datos del item
      const updated = await tx.item.update({
        where: { id: itemId },
        data: updateData,
        include: { warehouse: true }
      })

      // Si es un bien patrimonial y se enviaron códigos, sincronizar unidades patrimoniales
      if (updated.itemType === 'PATRIMONIAL' && finalCodesRaw) {
        const newCodes: string[] = typeof finalCodesRaw === 'string'
          ? finalCodesRaw.split('\n').map((c: string) => c.trim()).filter(Boolean)
          : finalCodesRaw

        const existingUnits = await tx.patrimonialUnit.findMany({
          where: { itemId },
          select: { id: true, patrimonialCode: true }
        })
        const existingCodes = existingUnits.map(u => u.patrimonialCode)

        // Códigos a eliminar (estaban pero ya no están en la lista)
        const codesToRemove = existingCodes.filter(c => !newCodes.includes(c))
        if (codesToRemove.length > 0) {
          const unitsToRemove = existingUnits.filter(u => codesToRemove.includes(u.patrimonialCode))
          const unitIds = unitsToRemove.map(u => u.id)

          const ordersUsing = await tx.orderItem.findFirst({ where: { patrimonialUnitId: { in: unitIds } }, select: { id: true } })
          if (ordersUsing) {
            const codes = unitsToRemove.map(u => u.patrimonialCode).join(', ')
            throw new Error(`No se pueden eliminar las unidades patrimoniales (${codes}) porque están referenciadas en órdenes de salida.`)
          }

          const assetsUsing = await tx.assignedAsset.findFirst({ where: { patrimonialUnitId: { in: unitIds } }, select: { id: true } })
          if (assetsUsing) {
            const codes = unitsToRemove.map(u => u.patrimonialCode).join(', ')
            throw new Error(`No se pueden eliminar las unidades patrimoniales (${codes}) porque están asignadas a un usuario.`)
          }

          const loansUsing = await tx.loanItem.findFirst({ where: { patrimonialUnitId: { in: unitIds } }, select: { id: true } })
          if (loansUsing) {
            const codes = unitsToRemove.map(u => u.patrimonialCode).join(', ')
            throw new Error(`No se pueden eliminar las unidades patrimoniales (${codes}) porque están referenciadas en préstamos.`)
          }

          await tx.patrimonialUnit.deleteMany({
            where: { itemId, patrimonialCode: { in: codesToRemove } }
          })
        }

        // Códigos a agregar (son nuevos)
        const codesToAdd = newCodes.filter(c => !existingCodes.includes(c))
        if (codesToAdd.length > 0) {
          // Validar que no existan en otros items
          const existingElsewhere = await tx.patrimonialUnit.findMany({
            where: { patrimonialCode: { in: codesToAdd }, itemId: { not: itemId } },
            select: { patrimonialCode: true }
          })
          if (existingElsewhere.length > 0) {
            throw new Error(`Los códigos patrimoniales ya existen en otros bienes: ${existingElsewhere.map(c => c.patrimonialCode).join(', ')}`)
          }

          await tx.patrimonialUnit.createMany({
            data: codesToAdd.map(code => ({
              itemId,
              patrimonialCode: code,
              status: 'OPERATIVO',
              isAvailable: true
            }))
          })
        }

        // Actualizar campos patrimonialCodes y patrimonialCode en el Item
        const finalCodes = existingUnits
          .filter(u => !codesToRemove.includes(u.patrimonialCode))
          .map(u => u.patrimonialCode)
          .concat(codesToAdd)

        await tx.item.update({
          where: { id: itemId },
          data: {
            patrimonialCodes: JSON.stringify(finalCodes),
            patrimonialCode: finalCodes[0] || null,
          }
        })
      }

      // Actualizar estado por lote de unidades patrimoniales
      if (patrimonialUnitUpdates && Array.isArray(patrimonialUnitUpdates) && patrimonialUnitUpdates.length > 0) {
        const statusGroups = new Map<string, number[]>()
        for (const u of patrimonialUnitUpdates) {
          const s = u.status || 'OPERATIVO'
          if (!statusGroups.has(s)) statusGroups.set(s, [])
          statusGroups.get(s)!.push(u.id)
        }
        for (const [status, ids] of statusGroups) {
          await tx.patrimonialUnit.updateMany({
            where: { id: { in: ids }, itemId },
            data: { status }
          })
        }
      }

      const patrimonialUnits = await tx.patrimonialUnit.findMany({
        where: { itemId },
        select: { id: true, patrimonialCode: true, status: true, isAvailable: true }
      })

      return { ...updated, patrimonialUnits }
    })

    await invalidateItemCaches()
    await logUpdate(currentUser.id, 'Item', itemId, {}, updateData, `Actualización de bien ${item.name}`)

    return NextResponse.json({ item })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    if (permanent) {
      const itemId = parseInt(id)
      await db.$transaction(async (tx) => {
        await tx.itemMovement.deleteMany({ where: { itemId } })
        await tx.itemStatusLog.deleteMany({ where: { itemId } })
        await tx.warranty.deleteMany({ where: { itemId } })
        await tx.demandPrediction.deleteMany({ where: { itemId } })
        await tx.qRScanLog.deleteMany({ where: { itemId } })
        await tx.assignedAsset.deleteMany({ where: { itemId } })
        await tx.orderItem.deleteMany({ where: { itemId } })
        await tx.ingress.deleteMany({ where: { itemId } })
        await tx.patrimonialUnit.deleteMany({ where: { itemId } })
        await tx.loanItem.deleteMany({ where: { itemId } })
        await tx.item.delete({ where: { id: itemId } })
      })
      await invalidateItemCaches()
      await logDelete(currentUser.id, 'Item', itemId, {}, 'Eliminación permanente de bien')
      return NextResponse.json({ success: true, message: 'Bien eliminado permanentemente' })
    } else {
      await db.item.update({
        where: { id: parseInt(id) },
        data: { isDeleted: true, deletedAt: new Date() }
      })
      await invalidateItemCaches()
      await logAudit({ userId: currentUser.id, action: 'DELETE', entityType: 'Item', entityId: parseInt(id), description: 'Bien movido a la papelera' })
      return NextResponse.json({ success: true, message: 'Bien movido a la papelera' })
    }
  } catch (error) {
    logger.error('Delete item error:', error)
    return NextResponse.json({ error: 'Error al eliminar bien' }, { status: 500 })
  }
}

// PATCH para restaurar items de la papelera
export async function PATCH(
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
    const { action } = body

    if (action === 'restore') {
      const item = await db.item.update({
        where: { id: parseInt(id) },
        data: { isDeleted: false, deletedAt: null },
        include: { warehouse: true }
      })
      await invalidateItemCaches()
      await logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'Item', entityId: parseInt(id), description: `Bien restaurado de la papelera - ${item.name}` })
      return NextResponse.json({ item, message: 'Bien restaurado correctamente' })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    logger.error('Patch item error:', error)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
