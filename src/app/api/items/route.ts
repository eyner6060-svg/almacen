import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createItemSchema } from '@/lib/validations'
import { cacheGetOrSet, cacheDelete, CacheKeys, CacheTTL } from '@/lib/cache'
import { ItemType, Prisma } from '@prisma/client'
import { apiHandler } from '@/lib/api-handler'
import { logCreate } from '@/lib/audit'

export const GET = apiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const status = searchParams.get('status') || ''
  const itemType = searchParams.get('itemType') || ''
  const warehouseId = searchParams.get('warehouseId') || ''
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const deletedOnly = searchParams.get('deletedOnly') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(500, Math.max(1, parseInt(searchParams.get('perPage') || '20')))
  const includeCategories = searchParams.get('categories') !== 'false'
  const view = searchParams.get('view') || 'list'

  const where: Prisma.ItemWhereInput = {}

  if (deletedOnly) {
    where.isDeleted = true
  } else if (!includeDeleted) {
    where.isDeleted = false
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { patrimonialCode: { contains: search, mode: 'insensitive' } },
    ]
  }

  if (category) where.category = category
  if (status) where.status = status
  if (itemType) where.itemType = itemType as ItemType
  if (warehouseId) where.warehouseId = parseInt(warehouseId)

  // Filtrar solo unidades patrimoniales disponibles (solo cuando se especifica)
  if (searchParams.get('hideUnavailablePatrimonial') === 'true') {
    where.AND = [
      {
        OR: [
          { patrimonialUnits: { none: {} } },
          { patrimonialUnits: { some: { isAvailable: true } } }
        ]
      }
    ]
  }

  const itemInclude = view === 'detail' ? {
    warehouse: { select: { id: true, name: true, location: true } },
    patrimonialUnits: {
      select: { id: true, patrimonialCode: true, status: true, isAvailable: true }
    }
  } : {
    warehouse: { select: { id: true, name: true, location: true } },
  }

  const [items, total] = await Promise.all([
    db.item.findMany({
      where,
      include: itemInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage
    }),
    db.item.count({ where }),
  ])

  const categories = includeCategories
    ? await cacheGetOrSet(
        CacheKeys.itemCategories(),
        () => db.item.findMany({
          where: { isDeleted: false },
          distinct: ['category'],
          select: { category: true }
        }).then(r => r.map(c => c.category)),
        { ttl: CacheTTL.MEDIUM }
      )
    : []

  return NextResponse.json({ 
    items,
    categories,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  })
})

export const POST = apiHandler(async (request: NextRequest, user) => {
  const userId = user!.id
  const body = await request.json()
  createItemSchema.parse(body)
  const {
    name, model, brand, color, series, code, patrimonialCode, patrimonialCodes,
    itemType, category, unit, imageUrl, quantity, minStock, status,
    location, warehouseId, technicalSpecs, supportDocumentUrl
  } = body

  const existingItem = await db.item.findUnique({ where: { code }, select: { id: true, isDeleted: true, code: true } })
  if (existingItem) {
    if (existingItem.isDeleted) {
      return NextResponse.json(
        { error: `El código "${code}" pertenece a un bien eliminado en la papelera. Puede restaurarlo desde la papelera o usar un código diferente.` },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Ya existe un bien activo con ese código' },
      { status: 409 }
    )
  }

  let finalPatrimonialCode: string | null = null
  let finalPatrimonialCodes: string | null = null
  const patrimonialCodesArray: string[] = []

  if (itemType === 'PATRIMONIAL') {
    if (patrimonialCodes && patrimonialCodes.trim()) {
      const codes = patrimonialCodes.split('\n').map((c: string) => c.trim()).filter((c: string) => c)
      const quantityNum = parseInt(quantity) || 1
      
      if (codes.length !== quantityNum) {
        return NextResponse.json(
          { error: `Debe ingresar ${quantityNum} códigos patrimoniales. Ingresados: ${codes.length}` },
          { status: 400 }
        )
      }
      
      const existingCodes = await db.patrimonialUnit.findMany({
        where: { patrimonialCode: { in: codes } },
        select: { patrimonialCode: true }
      })
      if (existingCodes.length > 0) {
        return NextResponse.json(
          { error: `El código patrimonial "${existingCodes[0]!.patrimonialCode}" ya existe` },
          { status: 400 }
        )
      }
      
      patrimonialCodesArray.push(...codes)
      finalPatrimonialCodes = JSON.stringify(codes)
      finalPatrimonialCode = codes[0]
    } else if (patrimonialCode && patrimonialCode.trim()) {
      const existingPatrimonial = await db.patrimonialUnit.findUnique({
        where: { patrimonialCode }
      })
      if (existingPatrimonial) {
        return NextResponse.json(
          { error: 'Ya existe un bien con ese código patrimonial' },
          { status: 400 }
        )
      }
      finalPatrimonialCode = patrimonialCode
      patrimonialCodesArray.push(patrimonialCode)
    }
  }

  const item = await db.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        name,
        model: model || 'S/M',
        brand: brand || 'S/M',
        color,
        series: series || 'S/S',
        code,
        patrimonialCode: finalPatrimonialCode,
        patrimonialCodes: finalPatrimonialCodes,
        itemType: itemType as ItemType,
        category,
        unit: unit || 'UNIDAD',
        imageUrl,
        quantity: parseInt(quantity) || 0,
        minStock: parseInt(minStock) || 5,
        status: status || 'NUEVO',
        location,
        warehouseId: parseInt(warehouseId),
        technicalSpecs,
        supportDocumentUrl
      },
      include: { warehouse: { select: { id: true, name: true, location: true } } }
    })

    if (patrimonialCodesArray.length > 0) {
      await tx.patrimonialUnit.createMany({
        data: patrimonialCodesArray.map(pCode => ({
          itemId: created.id,
          patrimonialCode: pCode,
          status: created.status,
          isAvailable: true
        }))
      })
    }

    return created
  })

  const patrimonialUnits = patrimonialCodesArray.length > 0
    ? await db.patrimonialUnit.findMany({
        where: { itemId: item.id },
        select: { id: true, patrimonialCode: true, status: true, isAvailable: true }
      })
    : []

  await Promise.all([
    cacheDelete(CacheKeys.itemList()),
    cacheDelete(CacheKeys.itemCategories()),
    cacheDelete(CacheKeys.warehouseList()),
    cacheDelete(CacheKeys.dashboardStats()),
  ])

  await logCreate(userId, 'Item', item.id, { name, code, itemType, quantity: parseInt(quantity) || 0 })

  return NextResponse.json({ 
    item: { ...item, patrimonialUnits }
  })
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })
