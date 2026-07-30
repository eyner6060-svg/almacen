import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate, logUpdate, logDelete } from '@/lib/audit'

// GET - Listar catálogo de bienes
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))

    const where: Prisma.ItemCatalogWhereInput = { isActive: true }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [catalog, total] = await Promise.all([
      db.itemCatalog.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ],
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.itemCatalog.count({ where }),
    ])

    // Obtener categorías únicas
    const categories = await db.itemCatalog.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    })

    return NextResponse.json({
      catalog,
      categories: categories.map(c => c.category),
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    logger.error('Error al obtener catalog:', error)
    return NextResponse.json({ error: 'Error al obtener catálogo' }, { status: 500 })
  }
}

// POST - Crear nuevo item en catálogo
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const data = await request.json()
    
    const item = await db.itemCatalog.create({
      data: {
        name: data.name,
        brand: data.brand || 'S/M',
        model: data.model || 'S/M',
        category: data.category,
        itemType: data.itemType || 'PATRIMONIAL',
        unit: data.unit || 'UNIDAD',
        technicalSpecs: data.technicalSpecs || null,
        defaultMinStock: data.defaultMinStock || 1,
        isActive: true
      }
    })

    logCreate(user.id, 'Item', item.id, { name: data.name, category: data.category, itemType: data.itemType })

    return NextResponse.json({ item })
  } catch (error) {
    logger.error('Error al crear catalog item:', error)
    return NextResponse.json({ error: 'Error al crear item en catálogo' }, { status: 500 })
  }
}

// PUT - Actualizar item del catálogo
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const data = await request.json()
    
    const item = await db.itemCatalog.update({
      where: { id: data.id },
      data: {
        name: data.name,
        brand: data.brand,
        model: data.model,
        category: data.category,
        itemType: data.itemType,
        unit: data.unit,
        technicalSpecs: data.technicalSpecs,
        defaultMinStock: data.defaultMinStock,
        isActive: data.isActive
      }
    })

    logUpdate(user.id, 'Item', data.id, {}, { name: data.name, category: data.category })

    return NextResponse.json({ item })
  } catch (error) {
    logger.error('Error updating catalog item:', error)
    return NextResponse.json({ error: 'Error al actualizar item del catálogo' }, { status: 500 })
  }
}

// DELETE - Eliminar item del catálogo
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Eliminación lógica
    await db.itemCatalog.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    })

    logDelete(user.id, 'Item', parseInt(id), {}, `Item de catálogo ID ${id} eliminado`)

    return NextResponse.json({ message: 'Item eliminado del catálogo' })
  } catch (error) {
    logger.error('Error al eliminar catalog item:', error)
    return NextResponse.json({ error: 'Error al eliminar item del catálogo' }, { status: 500 })
  }
}
