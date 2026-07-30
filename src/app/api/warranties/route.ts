import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createWarrantySchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const [warranties, total] = await Promise.all([
      db.warranty.findMany({
        include: {
          item: {
            select: {
              id: true, name: true, code: true, category: true, itemType: true, unit: true, status: true
            }
          },
        },
        orderBy: { expiryDate: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.warranty.count(),
    ])

    return NextResponse.json({ warranties, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } })
  } catch (error) {
    logger.error('Error al obtener warranties:', error)
    return NextResponse.json({ warranties: [], error: 'Error al obtener garantías' }, { status: 500 })
  }
}

// POST - Crear una nueva garantía
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    createWarrantySchema.parse(body)
    const {
      itemId,
      purchaseDate,
      expiryDate,
      supplierName,
      supplierContact,
      warrantyTerms,
      documentUrl,
      notes,
      status,
    } = body

    // Verificar si el item ya tiene garantía
    const existingWarranty = await db.warranty.findUnique({
      where: { itemId: parseInt(itemId) },
    })

    if (existingWarranty) {
      return NextResponse.json({ error: 'Este bien ya tiene una garantía registrada' }, { status: 400 })
    }

    const warranty = await db.warranty.create({
      data: {
        itemId: parseInt(itemId),
        purchaseDate: new Date(purchaseDate),
        expiryDate: new Date(expiryDate),
        supplierName,
        supplierContact,
        warrantyTerms,
        documentUrl,
        notes,
        status: status || 'ACTIVE',
      },
      include: {
        item: { select: { id: true, name: true, code: true, category: true, itemType: true, unit: true, status: true } },
      },
    })

    logCreate(user.id, 'Warranty', warranty.id, { itemId, supplierName, expiryDate })

    return NextResponse.json({ warranty })
  } catch (error) {
    return handleApiError(error)
  }
}
