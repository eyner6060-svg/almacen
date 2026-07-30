import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { createIngressSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logCreate } from '@/lib/audit'
import { ItemType } from '@prisma/client'
import { dispatch } from '@/lib/jobs'

// GET - Listar ingresos con estadísticas
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const [ingresses, total, statsData] = await Promise.all([
      db.ingress.findMany({
        include: {
          item: { select: { id: true, name: true, code: true, itemType: true, category: true, unit: true } },
          receivedBy: { select: { id: true, fullName: true } },
          warehouse: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.ingress.count(),
      Promise.all([
        db.ingress.aggregate({ _count: true, _sum: { quantity: true }, where: { createdAt: { gte: today } } }),
        db.ingress.aggregate({ _count: true, _sum: { quantity: true }, where: { createdAt: { gte: weekAgo } } }),
        db.ingress.aggregate({ _count: true, _sum: { quantity: true }, where: { createdAt: { gte: monthAgo } } })
      ])
    ])

    const stats = {
      today: { count: statsData[0]._count, total: statsData[0]._sum.quantity || 0 },
      week: { count: statsData[1]._count, total: statsData[1]._sum.quantity || 0 },
      month: { count: statsData[2]._count, total: statsData[2]._sum.quantity || 0 }
    }

    return NextResponse.json({
      ingresses,
      stats,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    })
  } catch (error) {
    logger.error('Get ingresses error:', error)
    return NextResponse.json({ error: 'Error al obtener ingresos' }, { status: 500 })
  }
}

// POST - Crear nuevo ingreso (soporta múltiples items en lote)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado. Solo el Almacenero o Administrador puede registrar ingresos.' }, { status: 403 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`ingress-create:${ip}`, RateLimitPresets.CREATE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    const validated = createIngressSchema.parse(body)
    const { items, supplier, documentNumber, warehouseId, notes, receiptUrl } = validated

    // Para ingresos con muchos items (>30), procesar en segundo plano
    if (items.length > 30) {
      const jobId = dispatch('ingress:process', {
        items: items.map(i => ({ itemId: i.itemId, quantity: i.quantity, patrimonialCodes: i.patrimonialCodes })),
        ingressNumber: `ING-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        receivedById: currentUser.id,
        warehouseId,
        supplier: supplier || null,
        documentNumber: documentNumber || null,
        notes: notes || null,
        receiptUrl: receiptUrl || null,
      })

      return NextResponse.json({
        success: true,
        jobId,
        message: `Ingreso masivo iniciado en segundo plano (${items.length} items). Recibirá una notificación cuando termine.`,
        async: true
      })
    }

    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')

    // Precargar items y contar ingresos existentes
    const [existingItems, currentCount] = await Promise.all([
      db.item.findMany({
        where: { id: { in: items.map(i => i.itemId).filter(Boolean) } },
        select: { id: true, quantity: true, itemType: true, name: true }
      }),
      db.ingress.count()
    ])

    const itemsMap = new Map(existingItems.map(i => [i.id, i]))
    const ingressData: Array<{
      ingressNumber: string; itemId: number; quantity: number;
      previousStock: number; newStock: number; supplier: string | null;
      documentNumber: string | null; notes: string | null; receiptUrl: string | null;
      receivedById: number; warehouseId: number
    }> = []
    const patrimonialUpdates: Array<{
      itemId: number; customCodes: string[]; newQuantity: number
    }> = []
    let count = currentCount

    const errors: string[] = []

    for (const entry of items) {
      const { itemId, quantity, patrimonialCodes: customCodes } = entry
      if (!itemId || !quantity || quantity < 1) {
        errors.push(`Item ID inválido o cantidad inválida para itemId=${itemId}`)
        continue
      }

      const item = itemsMap.get(itemId)
      if (!item) {
        errors.push(`Item con ID ${itemId} no encontrado`)
        continue
      }

      count++
      const newStock = item.quantity + quantity

      ingressData.push({
        ingressNumber: `ING-${year}${month}-${String(count).padStart(4, '0')}`,
        itemId,
        quantity,
        previousStock: item.quantity,
        newStock,
        supplier: supplier || null,
        documentNumber: documentNumber || null,
        notes: notes || null,
        receiptUrl: receiptUrl || null,
        receivedById: currentUser.id,
        warehouseId
      })

      // Para bienes patrimoniales, generar/validar códigos patrimoniales
      if (item.itemType === ItemType.PATRIMONIAL) {
        patrimonialUpdates.push({ itemId, customCodes: customCodes || [], newQuantity: quantity })
      }
    }

    if (errors.length > 0) {
      // Si no se procesó ningún item correctamente, devolver 400
      if (ingressData.length === 0) {
        return NextResponse.json({ error: 'No se pudo procesar ningún item', details: errors }, { status: 400 })
      }
      // De lo contrario, continuar con una advertencia en la respuesta
    }

    // Procesar códigos patrimoniales y crear registros en transacción
    const patrimonialResults = await db.$transaction(async (tx) => {
      const results: Array<{ itemId: number; newCodes: string[] }> = []

      // Cargar unidades patrimoniales existentes para todos los items en lote
      const allItemIds = patrimonialUpdates.map(pu => pu.itemId)
      const existingUnitsMap = new Map<number, { patrimonialCode: string }[]>()
      if (allItemIds.length > 0) {
        const allExistingUnits = await tx.patrimonialUnit.findMany({
          where: { itemId: { in: allItemIds } },
          select: { itemId: true, patrimonialCode: true },
          orderBy: { id: 'desc' }
        })
        for (const unit of allExistingUnits) {
          if (!existingUnitsMap.has(unit.itemId)) existingUnitsMap.set(unit.itemId, [])
          existingUnitsMap.get(unit.itemId)!.push(unit)
        }
      }

      // Cargar items para códigos patrimoniales en lote
      const itemsMap = new Map<number, { patrimonialCodes: string | null; patrimonialCode: string | null }>()
      if (allItemIds.length > 0) {
        const allItems = await tx.item.findMany({
          where: { id: { in: allItemIds } },
          select: { id: true, patrimonialCodes: true, patrimonialCode: true }
        })
        for (const item of allItems) {
          itemsMap.set(item.id, item)
        }
      }

      // Pre-colectar todos los códigos para validar en un solo lote
      const allCodesToCheck: string[] = []
      const codesPerUpdate: Array<{ itemId: number; codes: string[] }> = []
      for (const pu of patrimonialUpdates) {
        const existingUnits = existingUnitsMap.get(pu.itemId) || []
        const allCodes = pu.customCodes.length > 0
          ? pu.customCodes
          : autoGeneratePatrimonialCodes(existingUnits.map(u => u.patrimonialCode), pu.newQuantity)
        allCodesToCheck.push(...allCodes)
        codesPerUpdate.push({ itemId: pu.itemId, codes: allCodes })
      }

      // Validar duplicados en un solo query - solo para códigos NUEVOS que no existen ya
      if (allCodesToCheck.length > 0) {
        const existingAllCodes = await tx.patrimonialUnit.findMany({
          where: { patrimonialCode: { in: allCodesToCheck } },
          select: { patrimonialCode: true }
        })
        if (existingAllCodes.length > 0) {
          throw new Error(`Los códigos patrimoniales ya existen: ${existingAllCodes.map(c => c.patrimonialCode).join(', ')}`)
        }
      }

      for (const { itemId, codes: allCodes } of codesPerUpdate) {

        // Crear las nuevas unidades patrimoniales que no existen ya
        const existingUnits = await tx.patrimonialUnit.findMany({
          where: { itemId, patrimonialCode: { in: allCodes } },
          select: { patrimonialCode: true }
        })
        const existingCodesSet = new Set(existingUnits.map(u => u.patrimonialCode))
        const codesToCreate = allCodes.filter(code => !existingCodesSet.has(code))
        
        if (codesToCreate.length > 0) {
          await tx.patrimonialUnit.createMany({
            data: codesToCreate.map(code => ({
              itemId,
              patrimonialCode: code,
              status: 'NUEVO' as const,
              isAvailable: true
            }))
          })
        }

        // Actualizar el JSON de códigos patrimoniales del Item
        const item = itemsMap.get(itemId)
        let existingJsonCodes: string[] = []
        try {
          existingJsonCodes = item?.patrimonialCodes ? JSON.parse(item.patrimonialCodes) : (item?.patrimonialCode ? [item.patrimonialCode] : [])
        } catch {
          existingJsonCodes = item?.patrimonialCode ? [item.patrimonialCode] : []
        }
        const updatedCodes = [...existingJsonCodes, ...allCodes]
        await tx.item.update({
          where: { id: itemId },
          data: {
            patrimonialCodes: JSON.stringify(updatedCodes),
            patrimonialCode: updatedCodes[0],
          }
        })

        results.push({ itemId, newCodes: allCodes })
      }

      // Crear todos los ingresos y actualizar stocks dentro de la transacción
      await tx.ingress.createMany({ data: ingressData })

      await Promise.all(
        ingressData.map(i =>
          tx.item.update({
            where: { id: i.itemId },
            data: { quantity: { increment: i.quantity } }
          })
        )
      )

      return results
    })

    // Recuperar los ingresos creados con sus relaciones
    const fullIngresses = await db.ingress.findMany({
      where: { ingressNumber: { in: ingressData.map(i => i.ingressNumber) } },
      include: {
        item: { select: { id: true, name: true, code: true, itemType: true, category: true, unit: true } },
        receivedBy: { select: { id: true, fullName: true } },
        warehouse: { select: { id: true, name: true } }
      },
      orderBy: { id: 'asc' }
    })

    await Promise.all(
      fullIngresses.map(ing =>
        logCreate(currentUser.id, 'Ingress', ing.id, { ingressNumber: ing.ingressNumber, itemId: ing.itemId, quantity: ing.quantity })
      )
    )

    await Promise.all([
      cacheDelete(CacheKeys.itemList()),
      cacheDelete(CacheKeys.lowStockItems()),
      cacheDelete(CacheKeys.warehouseList()),
    ])

    return NextResponse.json({
      ingresses: fullIngresses,
      count: fullIngresses.length,
      patrimonialCodesGenerated: patrimonialResults,
      ...(errors.length > 0 ? { warnings: errors } : {}),
    })
  } catch (error) {
    logger.error('Create ingress error:', error)
    return handleApiError(error)
  }
}

// Genera códigos patrimoniales secuenciales basados en los existentes
function autoGeneratePatrimonialCodes(existingCodes: string[], quantity: number): string[] {
  let maxNum = 0
  let prefix = 'PAT-'

  for (const code of existingCodes) {
    const match = code.match(/^(.+?)(\d+)$/)
    if (match) {
      const [, prefixMatch, numMatch] = match
      if (prefixMatch && numMatch) {
        prefix = prefixMatch
        const num = parseInt(numMatch, 10)
        if (num > maxNum) maxNum = num
      }
    }
  }

  const codes: string[] = []
  for (let i = 0; i < quantity; i++) {
    maxNum++
    codes.push(`${prefix}${String(maxNum).padStart(6, '0')}`)
  }

  return codes
}
