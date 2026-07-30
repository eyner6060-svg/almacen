import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createAssignedAssetSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logCreate } from '@/lib/audit'
import type { AssignmentStatus } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const where: Prisma.AssignedAssetWhereInput = {}
    if (status) where.status = status as AssignmentStatus
    if (userId) where.userId = parseInt(userId)

    const [assignedAssets, total] = await Promise.all([
      db.assignedAsset.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, dni: true, position: true, office: { select: { id: true, name: true } } } },
          item: { select: { id: true, name: true, code: true, itemType: true, status: true, warehouse: { select: { name: true } } } },
          patrimonialUnit: { select: { id: true, patrimonialCode: true, status: true } },
        },
        orderBy: { assignmentDate: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.assignedAsset.count({ where }),
    ])

    return NextResponse.json({ assignedAssets, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } })
  } catch (error) {
    logger.error('Error al obtener assigned assets:', error)
    return NextResponse.json({ assignedAssets: [], error: 'Error al obtener bienes asignados' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`assigned-asset-create:${ip}`, RateLimitPresets.CREATE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    const validated = createAssignedAssetSchema.parse(body)
    const { userId, itemId, patrimonialUnitId, quantity, assignmentDocNumber, assignmentDocUrl, notes, items } = validated

    // Soporte para asignación en bloque (items array) y formato legacy (single item)
    const assignmentItems = items || (itemId ? [{ itemId: String(itemId), patrimonialUnitId: patrimonialUnitId ? String(patrimonialUnitId) : undefined, quantity: quantity ? String(quantity) : undefined }] : null)
    if (!assignmentItems || assignmentItems.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un bien para asignar' }, { status: 400 })
    }

    const assignedAssets: Array<{ id: number; itemId: number; userId: number; assignmentDocNumber: string | null }> = []
    const allErrors: string[] = []

    // Recopilar todos los IDs para consultas por lotes
    interface AssignmentItemInput {
      itemId: string
      patrimonialUnitId?: string
      quantity?: string
    }
    const itemIds: number[] = assignmentItems
      .map((e: AssignmentItemInput) => e.itemId as string)
      .filter(Boolean)
      .map((id) => parseInt(id))

    const puIds: number[] = assignmentItems
      .map((e: AssignmentItemInput) => e.patrimonialUnitId as string)
      .filter(Boolean)
      .map((id) => parseInt(id))

    const [itemsMap, unitsMap] = await Promise.all([
      db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, quantity: true, name: true } }).then(items => 
        new Map(items.map(i => [i.id, i]))
      ),
      puIds.length > 0
        ? db.patrimonialUnit.findMany({ where: { id: { in: puIds } }, select: { id: true, isAvailable: true } }).then(units =>
            new Map(units.map(u => [u.id, u]))
          )
        : Promise.resolve(new Map())
    ])

    await db.$transaction(async (tx) => {
      for (const entry of assignmentItems) {
        const { itemId: iId, patrimonialUnitId: puId, quantity: qty } = entry

        if (!iId) {
          allErrors.push('Un item no tiene ID de bien')
          continue
        }

        const parsedItemId = parseInt(iId)
        const item = itemsMap.get(parsedItemId)
        if (!item) {
          allErrors.push(`Bien ID ${iId} no encontrado`)
          continue
        }

        const parsedQty = parseInt(qty || '1')
        if (item.quantity < parsedQty) {
          allErrors.push(`Stock insuficiente para "${item.name}". Disponible: ${item.quantity}`)
          continue
        }

        if (puId) {
          const parsedPuId = parseInt(puId)
          const unit = unitsMap.get(parsedPuId)
          if (!unit || !unit.isAvailable) {
            allErrors.push(`La unidad patrimonial ID ${puId} no está disponible`)
            continue
          }
          await tx.patrimonialUnit.update({
            where: { id: parsedPuId },
            data: { isAvailable: false, currentHolderId: userId },
          })
        }

        await tx.item.update({
          where: { id: parsedItemId },
          data: { quantity: { decrement: parsedQty } },
        })

        const created = await tx.assignedAsset.create({
          data: {
            userId,
            itemId: parsedItemId,
            patrimonialUnitId: puId ? parseInt(puId) : null,
            quantity: parsedQty,
            assignmentDocNumber,
            assignmentDocUrl: assignmentDocUrl || null,
            notes: notes || null,
          },
          include: {
            user: { select: { id: true, fullName: true, email: true, role: true, dni: true, phone: true, position: true, isActive: true, officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, createdAt: true, office: { select: { id: true, name: true, code: true } } } },
            item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true, minStock: true, warehouse: { select: { id: true, name: true } } } },
            patrimonialUnit: true,
          },
        })

        assignedAssets.push(created)
      }
    })

    if (assignedAssets.length === 0) {
      return NextResponse.json({ error: allErrors.join('. ') || 'No se pudo asignar ningún bien' }, { status: 400 })
    }

    await Promise.all(assignedAssets.map(aa =>
      logCreate(currentUser.id, 'PatrimonialUnit', aa.id, { itemId: aa.itemId, userId: aa.userId, assignmentDocNumber: aa.assignmentDocNumber })
    ))

    await Promise.all([
      cacheDelete(CacheKeys.itemList()),
      cacheDelete(CacheKeys.lowStockItems()),
    ])

    return NextResponse.json({
      assignedAssets,
      errors: allErrors.length > 0 ? allErrors : undefined,
      message: `${assignedAssets.length} bien(es) asignado(s) correctamente`,
    })
  } catch (error) {
    logger.error('Error al crear assigned assets:', error)
    return handleApiError(error)
  }
}
