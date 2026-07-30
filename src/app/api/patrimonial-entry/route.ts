import { NextRequest, NextResponse } from 'next/server'
import { ItemType, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

interface ItemEntryInput {
  name: string
  category: string
  model?: string
  brand?: string
  color?: string
  series?: string
  customPatrimonialCode?: string
  technicalSpecs?: string
}

// GET - Obtener plantillas de bienes para ingreso rápido
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Obtener categorías únicas
    const categories = await db.item.findMany({
      distinct: ['category'],
      select: { category: true }
    })

    // Obtener bienes de referencia (para usar como plantilla)
    const templateItems = await db.item.findMany({
      where: { itemType: 'PATRIMONIAL' },
      select: {
        id: true,
        name: true,
        model: true,
        brand: true,
        category: true,
        technicalSpecs: true
      }
    })

    return NextResponse.json({ 
      categories: categories.map(c => c.category),
      templateItems 
    })
  } catch (error) {
    logger.error('Get patrimonial entry data error:', error)
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 })
  }
}

// POST - Ingresar bienes patrimoniales (crea múltiples registros únicos)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!['ALMACENERO', 'ADMINISTRADOR'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { 
      items,
      warehouseId,
      supplier,
      documentNumber,
      notes
    } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No se especificaron bienes a ingresar' }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json({ error: 'Debe especificar un almacén' }, { status: 400 })
    }

    const errors: Array<{ item: unknown; error: string }> = []
    const validItems: ItemEntryInput[] = []

    // 1. Prevalidar campos requeridos
    for (const itemData of items) {
      const item = itemData as ItemEntryInput
      if (!item.name || !item.category) {
        errors.push({ item: itemData, error: 'Nombre y categoría son requeridos' })
      } else {
        validItems.push(item)
      }
    }

    if (validItems.length === 0) {
      return NextResponse.json({ success: false, created: 0, items: [], errors })
    }

    // 2. Pregenerar códigos de bienes (una consulta por categoría única)
    const itemsByCategory: Record<string, ItemEntryInput[]> = {}
    for (const item of validItems) {
      const cat = item.category as string
      if (!itemsByCategory[cat]) itemsByCategory[cat] = []
      itemsByCategory[cat].push(item)
    }

    const codeMap = new Map<ItemEntryInput, string>()
    const prefixes = [...new Set(Object.keys(itemsByCategory).map(c => c.substring(0, 2).toUpperCase()))]
    const lastItemsMap = new Map<string, string | null>()
    if (prefixes.length > 0) {
      const lastItems = await Promise.all(
        prefixes.map(prefix =>
          db.item.findFirst({
            where: { code: { startsWith: prefix } },
            orderBy: { code: 'desc' },
            select: { code: true }
          }).then(r => [prefix, r?.code ?? null] as [string, string | null])
        )
      )
      for (const [prefix, code] of lastItems) {
        lastItemsMap.set(prefix, code)
      }
    }
    for (const [category, catItems] of Object.entries(itemsByCategory)) {
      const prefix = category.substring(0, 2).toUpperCase()
      const lastCode = lastItemsMap.get(prefix)
      let nextNumber = 1
      if (lastCode) {
        const match = lastCode.match(/(\d+)$/)
        if (match && match[1]) {
          nextNumber = parseInt(match[1]) + 1
        }
      }
      for (const item of catItems) {
        codeMap.set(item, `${prefix}-${nextNumber.toString().padStart(4, '0')}`)
        nextNumber++
      }
    }

    // 3. Pregenerar códigos patrimoniales
    const lastPatItem = await db.item.findFirst({
      where: { patrimonialCode: { not: null } },
      orderBy: { id: 'desc' },
      select: { patrimonialCode: true }
    })
    let nextPatNumber = 1
    if (lastPatItem?.patrimonialCode) {
      const match = lastPatItem.patrimonialCode.match(/PAT-(\d+)/)
      if (match && match[1]) {
        nextPatNumber = parseInt(match[1]) + 1
      }
    }

    const itemsWithCodes: Array<{
      itemData: ItemEntryInput
      code: string
      patrimonialCode: string
    }> = []

    for (const itemData of validItems) {
      const customPatrimonialCode = itemData.customPatrimonialCode
      const patrimonialCode = customPatrimonialCode || `PAT-${nextPatNumber.toString().padStart(6, '0')}`
      if (!customPatrimonialCode) {
        nextPatNumber++
      }
      itemsWithCodes.push({
        itemData,
        code: codeMap.get(itemData)!,
        patrimonialCode
      })
    }

    // 4. Verificar duplicados de códigos patrimoniales personalizados (una consulta)
    const customCodes = itemsWithCodes
      .filter(i => i.itemData.customPatrimonialCode)
      .map(i => i.patrimonialCode)

    if (customCodes.length > 0) {
      const existing = await db.item.findMany({
        where: { patrimonialCode: { in: customCodes } },
        select: { patrimonialCode: true }
      })
      const existingSet = new Set(existing.map(e => e.patrimonialCode))
      const filtered: typeof itemsWithCodes = []
      for (const item of itemsWithCodes) {
        if (item.itemData.customPatrimonialCode && existingSet.has(item.patrimonialCode)) {
          errors.push({ item: item.itemData, error: `El código patrimonial ${item.patrimonialCode} ya existe` })
        } else {
          filtered.push(item)
        }
      }
      itemsWithCodes.length = 0
      itemsWithCodes.push(...filtered)
    }

    if (itemsWithCodes.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        items: [],
        errors: errors.length > 0 ? errors : undefined
      })
    }

    // 5. Generar numeración de ingreso
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const count = await db.ingress.count()
    const ingressNumberBase = `ING-${year}${month}-${String(count + 1).padStart(4, '0')}`

    // 6. Transacción única: createMany items, reconsulta, createMany ingresos
    const createdItems = await db.$transaction(async (tx) => {
      const itemCreateData: Prisma.ItemCreateManyInput[] = itemsWithCodes.map(i => ({
        name: i.itemData.name,
        model: i.itemData.model || 'S/M',
        brand: i.itemData.brand || 'S/M',
        color: i.itemData.color,
        series: i.itemData.series || 'S/S',
        code: i.code,
        patrimonialCode: i.patrimonialCode,
        itemType: ItemType.PATRIMONIAL,
        category: i.itemData.category,
        quantity: 1,
        minStock: 1,
        status: 'OPERATIVO',
        warehouseId: parseInt(warehouseId),
        technicalSpecs: i.itemData.technicalSpecs
      }))

      await tx.item.createMany({ data: itemCreateData })

      const codes = itemsWithCodes.map(i => i.code)
      const items = await tx.item.findMany({
        where: { code: { in: codes } },
        include: { warehouse: true }
      })

      const ingressData = items.map(item => ({
        ingressNumber: `${ingressNumberBase}-${item.id}`,
        itemId: item.id,
        quantity: 1,
        previousStock: 0,
        newStock: 1,
        supplier: supplier as string | undefined,
        documentNumber: documentNumber as string | undefined,
        notes: (notes as string) || `Ingreso de bien patrimonial - ${item.patrimonialCode}`,
        receivedById: currentUser.id,
        warehouseId: parseInt(warehouseId)
      }))

      await tx.ingress.createMany({ data: ingressData })

      return items
    })

    for (const item of createdItems) {
      logCreate(currentUser.id, 'Item', item.id, {
        name: item.name,
        patrimonialCode: item.patrimonialCode,
        itemType: 'PATRIMONIAL'
      })
    }

    return NextResponse.json({ 
      success: true,
      created: createdItems.length,
      items: createdItems,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('Create patrimonial entry error:', error)
    return NextResponse.json({ error: 'Error al registrar el ingreso de bienes patrimoniales' }, { status: 500 })
  }
}
