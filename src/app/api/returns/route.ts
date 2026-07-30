import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/api-handler'
import { getNextDocumentNumber } from '@/lib/document-sequence'
import { logAudit } from '@/lib/audit'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import type { AvailableUnit } from '@/types'
import { Prisma } from '@prisma/client'

export const GET = apiHandler(async () => {
  const unavailableUnits = await db.patrimonialUnit.findMany({
    where: { isAvailable: false },
    select: {
      id: true, patrimonialCode: true, status: true, itemId: true,
      item: { select: { id: true, name: true, code: true, category: true, brand: true, model: true, location: true } }
    },
    orderBy: [{ itemId: 'asc' }, { patrimonialCode: 'asc' }]
  })

  if (unavailableUnits.length === 0) {
    return NextResponse.json({ units: [], total: 0 })
  }

  const unitIds = unavailableUnits.map(u => u.id)

  const [orderItems, loanItems, assignedAssets] = await Promise.all([
    db.orderItem.findMany({
      where: { patrimonialUnitId: { in: unitIds }, actualReturnDate: null },
      select: {
        id: true, patrimonialUnitId: true, currentLocation: true, issueDate: true,
        order: {
          select: {
            id: true, orderNumber: true, issueDate: true,
            requestedBy: { select: { id: true, fullName: true, dni: true } },
            office: { select: { name: true } }
          }
        }
      },
      orderBy: { issueDate: 'desc' }
    }),
    db.loanItem.findMany({
      where: { patrimonialUnitId: { in: unitIds } },
      select: {
        id: true, patrimonialUnitId: true,
        loan: {
          select: {
            id: true, documentNumber: true, loanDate: true,
            borrowerName: true, borrowerDni: true, status: true
          }
        }
      },
      orderBy: { loan: { loanDate: 'desc' } }
    }),
    db.assignedAsset.findMany({
      where: { patrimonialUnitId: { in: unitIds }, status: 'ASIGNADO' },
      select: {
        id: true, patrimonialUnitId: true, assignmentDate: true, assignmentDocNumber: true,
        user: { select: { id: true, fullName: true, dni: true, office: { select: { name: true } } } }
      },
      orderBy: { assignmentDate: 'desc' }
    })
  ])

  const orderItemByUnit = new Map(orderItems.map(oi => [oi.patrimonialUnitId, oi]))

  const loanItemByUnit = new Map<number, typeof loanItems[0]>()
  for (const li of loanItems) {
    if (li.loan.status !== 'DEVUELTO' && !loanItemByUnit.has(li.patrimonialUnitId!)) {
      loanItemByUnit.set(li.patrimonialUnitId!, li)
    }
  }

  const assignedAssetByUnit = new Map(assignedAssets.map(aa => [aa.patrimonialUnitId, aa]))

  const available: AvailableUnit[] = []

  for (const unit of unavailableUnits) {
    const oi = orderItemByUnit.get(unit.id)
    if (oi?.order) {
      available.push({
        id: unit.id, patrimonialCode: unit.patrimonialCode, status: unit.status,
        itemId: unit.itemId, itemName: unit.item.name, itemCode: unit.item.code,
        itemCategory: unit.item.category, itemBrand: unit.item.brand, itemModel: unit.item.model,
        currentLocation: oi.currentLocation || oi.order.office?.name || null,
        currentHolder: oi.order.requestedBy?.fullName || null,
        holderDni: oi.order.requestedBy?.dni || null,
        reason: 'Pedido de salida',
        referenceType: 'ORDER', referenceId: oi.order.id,
        referenceNumber: oi.order.orderNumber,
        since: oi.issueDate?.toISOString() || oi.order.issueDate.toISOString()
      })
      continue
    }

    const li = loanItemByUnit.get(unit.id)
    if (li?.loan) {
      available.push({
        id: unit.id, patrimonialCode: unit.patrimonialCode, status: unit.status,
        itemId: unit.itemId, itemName: unit.item.name, itemCode: unit.item.code,
        itemCategory: unit.item.category, itemBrand: unit.item.brand, itemModel: unit.item.model,
        currentLocation: unit.item.location || 'Préstamo externo',
        currentHolder: li.loan.borrowerName,
        holderDni: li.loan.borrowerDni,
        reason: 'Préstamo a externo',
        referenceType: 'LOAN', referenceId: li.loan.id,
        referenceNumber: li.loan.documentNumber,
        since: li.loan.loanDate.toISOString()
      })
      continue
    }

    const aa = assignedAssetByUnit.get(unit.id)
    if (aa) {
      available.push({
        id: unit.id, patrimonialCode: unit.patrimonialCode, status: unit.status,
        itemId: unit.itemId, itemName: unit.item.name, itemCode: unit.item.code,
        itemCategory: unit.item.category, itemBrand: unit.item.brand, itemModel: unit.item.model,
        currentLocation: unit.item.location || aa.user?.office?.name || 'Asignado',
        currentHolder: aa.user?.fullName || null,
        holderDni: aa.user?.dni || null,
        reason: 'Bien asignado',
        referenceType: 'ASSIGNMENT', referenceId: aa.id,
        referenceNumber: aa.assignmentDocNumber || '',
        since: aa.assignmentDate.toISOString()
      })
      continue
    }

    available.push({
      id: unit.id, patrimonialCode: unit.patrimonialCode, status: unit.status,
      itemId: unit.itemId, itemName: unit.item.name, itemCode: unit.item.code,
      itemCategory: unit.item.category, itemBrand: unit.item.brand, itemModel: unit.item.model,
      currentLocation: unit.item.location || 'Ubicación desconocida',
      currentHolder: null, holderDni: null,
      reason: 'No disponible',
      referenceType: 'ORDER', referenceId: 0, referenceNumber: '',
      since: ''
    })
  }

  return NextResponse.json({ units: available, total: available.length })
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })

export const POST = apiHandler(async (request: NextRequest, user) => {
  const body = await request.json()
  const { unitIds, notes, unitsStatus: unitsStatusRaw, status: fallbackStatus } = body
  const unitsStatus = unitsStatusRaw as Record<number, string> | undefined

  if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0) {
    return NextResponse.json({ error: 'Debe seleccionar al menos una unidad' }, { status: 400 })
  }

  const units = await db.patrimonialUnit.findMany({
    where: { id: { in: unitIds }, isAvailable: false },
    select: { id: true, itemId: true, patrimonialCode: true, status: true, item: { select: { id: true, name: true, code: true } } }
  })

  if (units.length === 0) {
    return NextResponse.json({ error: 'Ninguna unidad seleccionada está disponible para retorno' }, { status: 400 })
  }

  const { documentNumber, documentLabel } = await getNextDocumentNumber('ACTA_RETORNO')

  const unitIdSet = units.map(u => u.id)
  const now = new Date()

  // Pre-cargar todas las relaciones en lote antes de la transacción
  const [activeOrderItems, activeLoanItems, activeAssignedAssets] = await Promise.all([
    db.orderItem.findMany({
      where: { patrimonialUnitId: { in: unitIdSet }, actualReturnDate: null },
      select: { id: true, patrimonialUnitId: true }
    }),
    db.loanItem.findMany({
      where: { patrimonialUnitId: { in: unitIdSet } },
      select: { id: true, patrimonialUnitId: true, loanId: true, loan: { select: { status: true, actualReturnDate: true } } }
    }),
    db.assignedAsset.findMany({
      where: { patrimonialUnitId: { in: unitIdSet }, status: 'ASIGNADO' },
      select: { id: true, patrimonialUnitId: true }
    })
  ])

  // Agrupar unidades por status para batch update
  const statusGroups = new Map<string, number[]>()
  for (const unit of units) {
    const s = unitsStatus?.[unit.id] || fallbackStatus || unit.status || 'OPERATIVO'
    if (!statusGroups.has(s)) statusGroups.set(s, [])
    statusGroups.get(s)!.push(unit.id)
  }

  await db.$transaction(async (tx) => {
    // Lote: marcar todas como disponibles
    await tx.patrimonialUnit.updateMany({
      where: { id: { in: unitIdSet } },
      data: { isAvailable: true, currentHolderId: null }
    })

    // Lote por grupo de estado (evita actualización individual por unidad)
    for (const [status, ids] of statusGroups) {
      if (status === (fallbackStatus || 'OPERATIVO') && statusGroups.size === 1) continue
      await tx.patrimonialUnit.updateMany({
        where: { id: { in: ids } },
        data: { status } as Prisma.PatrimonialUnitUpdateManyMutationInput
      })
    }

    // Lote: incrementar stock por item agregando cantidades
    const itemQtys = units.reduce((acc, u) => {
      acc[u.itemId] = (acc[u.itemId] || 0) + 1; return acc
    }, {} as Record<number, number>)
    for (const [itemId, qty] of Object.entries(itemQtys)) {
      await tx.item.update({
        where: { id: Number(itemId) },
        data: { quantity: { increment: qty } }
      })
    }

    // Lote: cerrar orderItems activos
    const oiIds = activeOrderItems.map(oi => oi.id)
    if (oiIds.length > 0) {
      await tx.orderItem.updateMany({
        where: { id: { in: oiIds } },
        data: { actualReturnDate: now, isOverdue: false }
      })
    }

    // Lote: cerrar préstamos activos
    const loanIds = [...new Set(activeLoanItems.filter(li => li.loan.status !== 'DEVUELTO' && !li.loan.actualReturnDate).map(li => li.loanId))]
    if (loanIds.length > 0) {
      await tx.loan.updateMany({
        where: { id: { in: loanIds } },
        data: { actualReturnDate: now, status: 'DEVUELTO' }
      })
    }

    // Lote: cerrar activos asignados activos
    const aaIds = activeAssignedAssets.map(aa => aa.id)
    if (aaIds.length > 0) {
      await tx.assignedAsset.updateMany({
        where: { id: { in: aaIds } },
        data: { returnDate: now, status: 'DEVUELTO' }
      })
    }

    // Lote: crear todos los movimientos de una sola vez
    await tx.itemMovement.createMany({
      data: units.map(unit => ({
        patrimonialCode: unit.patrimonialCode,
        itemId: unit.itemId,
        toLocation: 'Almacén (retorno)',
        movedById: user.id,
        reason: `Retorno registrado - ${documentNumber}`,
        notes: notes || null
      }))
    })
  })

  await Promise.all([
    cacheDelete(CacheKeys.itemList()),
    cacheDelete(CacheKeys.dashboardStats()),
  ])

  logAudit({
    userId: user.id, action: 'UPDATE', entityType: 'Item',
    entityId: units[0]?.itemId,
    description: `Retorno de ${units.length} unidad(es) patrimonial(es) - Acta: ${documentNumber}`
  })

  return NextResponse.json({
    success: true,
    message: `${units.length} unidad(es) retornada(s) correctamente`,
    documentNumber,
    documentLabel,
    returnedCount: units.length,
    units: units.map(u => {
      const unitStatus = unitsStatus?.[u.id] || fallbackStatus || u.status || 'OPERATIVO'
      return { patrimonialCode: u.patrimonialCode, itemName: u.item.name, itemCode: u.item.code, status: unitStatus }
    })
  })
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })
