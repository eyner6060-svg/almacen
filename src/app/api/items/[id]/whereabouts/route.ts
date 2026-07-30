import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { WhereaboutsUnit } from '@/types'

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
    const itemId = parseInt(id)

    const item = await db.item.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, code: true, itemType: true, location: true }
    })

    if (!item) {
      return NextResponse.json({ error: 'Bien no encontrado' }, { status: 404 })
    }

    if (item.itemType !== 'PATRIMONIAL') {
      return NextResponse.json({ error: 'El bien no es patrimonial' }, { status: 400 })
    }

    const allUnits = await db.patrimonialUnit.findMany({
      where: { itemId },
      select: { id: true, patrimonialCode: true, status: true, isAvailable: true }
    })

    const totalUnits = allUnits.length
    const availableUnits = allUnits.filter(u => u.isAvailable).length
    const unavailableUnits = allUnits.filter(u => !u.isAvailable)
    const unitIds = unavailableUnits.map(u => u.id)

    if (unitIds.length === 0) {
      return NextResponse.json({ totalUnits, availableUnits, unavailableUnits: [] as WhereaboutsUnit[] })
    }

    const [orderItems, loanItems, assignedAssets, latestMovements] = await Promise.all([
      db.orderItem.findMany({
        where: { patrimonialUnitId: { in: unitIds }, actualReturnDate: null },
        select: {
          id: true, patrimonialUnitId: true, currentLocation: true, issueDate: true,
          order: {
            select: {
              id: true, orderNumber: true, issueDate: true,
              requestedBy: { select: { id: true, fullName: true, dni: true } },
              office: { select: { id: true, name: true } }
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
              borrowerName: true, borrowerDni: true, status: true,
              expectedReturnDate: true
            }
          }
        },
        orderBy: { loan: { loanDate: 'desc' } }
      }),
      db.assignedAsset.findMany({
        where: { patrimonialUnitId: { in: unitIds }, status: 'ASIGNADO' },
        select: {
          id: true, patrimonialUnitId: true, assignmentDate: true,
          user: { select: { id: true, fullName: true, dni: true, office: { select: { name: true } } } }
        },
        orderBy: { assignmentDate: 'desc' }
      }),
      db.itemMovement.findMany({
        where: { patrimonialCode: { in: unavailableUnits.map(u => u.patrimonialCode) } },
        select: {
          id: true, patrimonialCode: true, toLocation: true, toUserId: true,
          reason: true, createdAt: true, movedBy: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
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

    const movementByCode = new Map<string, typeof latestMovements[0]>()
    for (const m of latestMovements) {
      if (!movementByCode.has(m.patrimonialCode)) {
        movementByCode.set(m.patrimonialCode, m)
      }
    }

    const toUserIds = [...new Set(latestMovements.filter(m => m.toUserId).map(m => m.toUserId!))]
    const users = toUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: toUserIds } },
          select: { id: true, fullName: true, dni: true }
        })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))

    const whereabouts: WhereaboutsUnit[] = []

    for (const unit of unavailableUnits) {
      const oi = orderItemByUnit.get(unit.id)
      if (oi?.order) {
        whereabouts.push({
          patrimonialCode: unit.patrimonialCode,
          status: unit.status,
          currentLocation: oi.currentLocation || oi.order.office?.name || null,
          currentHolder: oi.order.requestedBy?.fullName || null,
          holderDni: oi.order.requestedBy?.dni || null,
          reason: 'Pedido de salida',
          referenceType: 'ORDER',
          referenceId: oi.order.id,
          referenceNumber: oi.order.orderNumber,
          since: oi.issueDate?.toISOString() || oi.order.issueDate.toISOString()
        })
        continue
      }

      const li = loanItemByUnit.get(unit.id)
      if (li?.loan) {
        whereabouts.push({
          patrimonialCode: unit.patrimonialCode,
          status: unit.status,
          currentLocation: item.location || 'Préstamo externo',
          currentHolder: li.loan.borrowerName,
          holderDni: li.loan.borrowerDni,
          reason: 'Préstamo a externo',
          referenceType: 'LOAN',
          referenceId: li.loan.id,
          referenceNumber: li.loan.documentNumber,
          since: li.loan.loanDate.toISOString()
        })
        continue
      }

      const aa = assignedAssetByUnit.get(unit.id)
      if (aa) {
        whereabouts.push({
          patrimonialCode: unit.patrimonialCode,
          status: unit.status,
          currentLocation: item.location || aa.user?.office?.name || 'Asignado',
          currentHolder: aa.user?.fullName || null,
          holderDni: aa.user?.dni || null,
          reason: 'Bien asignado',
          referenceType: 'ASSIGNMENT',
          referenceId: aa.id,
          referenceNumber: '',
          since: aa.assignmentDate.toISOString()
        })
        continue
      }

      const mv = movementByCode.get(unit.patrimonialCode)
      if (mv) {
        const movedToUser = mv.toUserId ? userMap.get(mv.toUserId) : null
        whereabouts.push({
          patrimonialCode: unit.patrimonialCode,
          status: unit.status,
          currentLocation: item.location || mv.toLocation,
          currentHolder: movedToUser?.fullName || null,
          holderDni: movedToUser?.dni || null,
          reason: mv.reason || 'Movimiento registrado',
          referenceType: 'ORDER',
          referenceId: mv.id,
          referenceNumber: '',
          since: mv.createdAt.toISOString()
        })
        continue
      }

      whereabouts.push({
        patrimonialCode: unit.patrimonialCode,
        status: unit.status,
        currentLocation: item.location || 'Ubicación desconocida',
        currentHolder: null,
        holderDni: null,
        reason: 'No disponible',
        referenceType: 'ORDER',
        referenceId: 0,
        referenceNumber: '',
        since: ''
      })
    }

    return NextResponse.json({ totalUnits, availableUnits, unavailableUnits: whereabouts })
  } catch (error) {
    logger.error('Error al obtener ubicación de bienes:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
