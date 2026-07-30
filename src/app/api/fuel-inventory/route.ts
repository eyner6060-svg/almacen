import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { FuelType } from '@prisma/client'
import { logger } from '@/lib/logger'
import { logCreate, logAudit } from '@/lib/audit'
import { z } from 'zod'

// Función para generar número de ingreso correlativo
async function generateEntryNumber(): Promise<string> {
  const lastEntry = await db.fuelEntry.findFirst({
    orderBy: { id: 'desc' },
    select: { entryNumber: true }
  })
  
  let nextNumber = 1
  if (lastEntry?.entryNumber) {
    const match = lastEntry.entryNumber.match(/ING-(\d+)/)
    if (match && match[1]) {
      nextNumber = parseInt(match[1]) + 1
    }
  }
  
  return `ING-${nextNumber.toString().padStart(6, '0')}`
}

// GET: Obtener inventario de combustible
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const inventory = await db.fuelInventory.findMany({
      where: { fuelType: { in: ['GASOLINA', 'PETROLEO'] as FuelType[] } }
    })

    const existingTypes = new Set(inventory.map(i => i.fuelType))
    const missingTypes = (['GASOLINA', 'PETROLEO'] as FuelType[]).filter(t => !existingTypes.has(t))

    if (missingTypes.length > 0) {
      const created = await Promise.all(
        missingTypes.map(ft => db.fuelInventory.create({
          data: { fuelType: ft, quantity: 0, minStock: 10 }
        }))
      )
      inventory.push(...created)
    }

    return NextResponse.json({ inventory })
  } catch (error) {
    logger.error('Get fuel inventory error:', error)
    return NextResponse.json({ error: 'Error al obtener inventario de combustible' }, { status: 500 })
  }
}

// POST: Agregar combustible al inventario (solo ALMACENERO o ADMINISTRADOR)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const fuelEntrySchema = z.object({
      fuelType: z.enum(['GASOLINA', 'PETROLEO']),
      quantity: z.number().positive(),
      supplier: z.string().max(200).optional(),
      documentNumber: z.string().max(100).optional(),
      notes: z.string().max(500).optional(),
    })
    const validated = fuelEntrySchema.parse(body)

    const inventory = await db.fuelInventory.upsert({
      where: { fuelType: validated.fuelType as FuelType },
      update: {},
      create: { fuelType: validated.fuelType as FuelType, quantity: 0, minStock: 10 }
    })

    const previousStock = inventory.quantity
    const newStock = previousStock + validated.quantity

    // Generar número de ingreso
    const entryNumber = await generateEntryNumber()

    // Actualizar inventario y crear registro en transacción
    const [updatedInventory, fuelEntry] = await db.$transaction([
      // Actualizar inventario
      db.fuelInventory.update({
        where: { fuelType: validated.fuelType as FuelType },
        data: { quantity: newStock }
      }),
      // Crear registro de ingreso
      db.fuelEntry.create({
        data: {
          entryNumber,
          fuelType: validated.fuelType as FuelType,
          quantity: validated.quantity,
          previousStock,
          newStock,
          supplier: validated.supplier,
          documentNumber: validated.documentNumber,
          notes: validated.notes,
          receivedById: currentUser.id,
          fuelInventoryId: inventory.id
        }
      })
    ])

    logCreate(currentUser.id, 'FuelEntry', fuelEntry.id, { fuelType: validated.fuelType, quantity: validated.quantity, supplier: validated.supplier })

    return NextResponse.json({ 
      inventory: updatedInventory,
      entry: fuelEntry,
      message: `Ingreso ${entryNumber} registrado correctamente`
    })
  } catch (error) {
    logger.error('Update fuel inventory error:', error)
    return NextResponse.json({ error: 'Error al actualizar inventario' }, { status: 500 })
  }
}

// Actualizar: establece el nivel de stock mínimo
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ALMACENERO' && currentUser.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { fuelType, minStock } = body

    if (!fuelType || parseFloat(minStock) < 0) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    const inventory = await db.fuelInventory.upsert({
      where: { fuelType: fuelType as FuelType },
      update: { minStock: parseFloat(minStock) },
      create: { fuelType: fuelType as FuelType, quantity: 0, minStock: parseFloat(minStock) }
    })

    logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'FuelEntry', entityId: inventory.id, description: `Stock mínimo de ${fuelType} actualizado a ${minStock}` })

    return NextResponse.json({ inventory })
  } catch (error) {
    logger.error('Update min stock error:', error)
    return NextResponse.json({ error: 'Error al actualizar stock mínimo' }, { status: 500 })
  }
}
