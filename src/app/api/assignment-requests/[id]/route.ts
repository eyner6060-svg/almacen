import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { getRequestById, updateRequest } from '@/lib/assignment-requests'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

type AssignedAssetResult = Prisma.AssignedAssetGetPayload<{
  include: {
    user: { select: { id: true; fullName: true; email: true; role: true; dni: true; phone: true; position: true; isActive: true; officeId: true; isDriver: true; canAuthorizeOrders: true; canAuthorizeFuel: true; canAuthorizeAssignments: true; createdAt: true; office: { select: { id: true; name: true; code: true } } } }
    item: { select: { id: true; name: true; code: true; model: true; brand: true; category: true; unit: true; itemType: true; status: true; quantity: true; minStock: true; warehouse: { select: { id: true; name: true } } } }
    patrimonialUnit: true
  }
}>

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const reqId = parseInt(id)
    const existing = await getRequestById(reqId)
    if (!existing) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 })
    }

    const body = await request.json()
    const { action, rejectionReason, assignmentDocNumber } = body

    if (action === 'REJECTED') {
      const updated = await updateRequest(reqId, {
        status: 'REJECTED',
        processedAt: new Date().toISOString(),
        processedBy: currentUser.fullName,
        rejectionReason: rejectionReason || '',
      })
      return NextResponse.json({ request: updated })
    }

    if (action !== 'APPROVED') {
      return NextResponse.json({ error: 'Acción inválida. Use APPROVED o REJECTED' }, { status: 400 })
    }

    const docNumber = assignmentDocNumber || `ASIG-${Date.now()}`
    const assignedAssets: AssignedAssetResult[] = []

    const itemIds = existing.items.map(i => i.itemId)
    const [dbItems, availableUnits] = await Promise.all([
      db.item.findMany({ where: { id: { in: itemIds } } }).then(items => new Map(items.map(i => [i.id, i]))),
      db.patrimonialUnit.findMany({
        where: { itemId: { in: itemIds }, isAvailable: true },
        orderBy: { patrimonialCode: 'asc' },
      }).then(units => {
        const map = new Map<number, typeof units[0]>()
        for (const u of units) {
          if (!map.has(u.itemId)) map.set(u.itemId, u)
        }
        return map
      }),
    ])

    await db.$transaction(async (tx) => {
      for (const item of existing.items) {
        const dbItem = dbItems.get(item.itemId)
        if (!dbItem) continue

        if (dbItem.itemType === 'PATRIMONIAL') {
          const availableUnit = availableUnits.get(item.itemId)
          if (!availableUnit) continue

          await tx.patrimonialUnit.update({
            where: { id: availableUnit.id },
            data: { isAvailable: false, currentHolderId: existing.userId },
          })

          const created = await tx.assignedAsset.create({
            data: {
              userId: existing.userId,
              itemId: item.itemId,
              patrimonialUnitId: availableUnit.id,
              quantity: 1,
              assignmentDocNumber: docNumber,
              notes: `Solicitud #${reqId}: ${existing.notes}`,
            },
            include: {
              user: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true, office: { select: { id: true, name: true, code: true } } } },
              item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } } },
              patrimonialUnit: true,
            },
          })
          assignedAssets.push(created)
        } else {
          const qty = item.quantity || 1
          if (dbItem.quantity < qty) continue

          await tx.item.update({
            where: { id: item.itemId },
            data: { quantity: { decrement: qty } },
          })

          const created = await tx.assignedAsset.create({
            data: {
              userId: existing.userId,
              itemId: item.itemId,
              quantity: qty,
              assignmentDocNumber: docNumber,
              notes: `Solicitud #${reqId}: ${existing.notes}`,
            },
            include: {
              user: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true, office: { select: { id: true, name: true, code: true } } } },
              item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } } },
              patrimonialUnit: true,
            },
          })
          assignedAssets.push(created)
        }
      }
    })

    if (assignedAssets.length === 0) {
      return NextResponse.json({ error: 'No se pudo asignar ningún bien (stock insuficiente o sin unidades disponibles)' }, { status: 400 })
    }

    await updateRequest(reqId, {
      status: 'APPROVED',
      processedAt: new Date().toISOString(),
      processedBy: currentUser.fullName,
    })

    const updated = await getRequestById(reqId)

    return NextResponse.json({
      request: updated,
      assignedAssets,
      message: `${assignedAssets.length} bien(es) asignado(s) correctamente`,
    })
  } catch (error) {
    logger.error('Error processing assignment request:', error)
    return NextResponse.json({ error: 'Error al procesar solicitud' }, { status: 500 })
  }
}
