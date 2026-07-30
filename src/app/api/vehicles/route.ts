import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { createVehicleSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

// GET: Listar vehículos
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const [vehicles, total] = await Promise.all([
      db.vehicle.findMany({
        select: {
          id: true, name: true, plate: true, description: true, isActive: true, driverId: true, createdAt: true,
          driver: {
            select: { id: true, fullName: true, dni: true, office: { select: { id: true, name: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.vehicle.count()
    ])

    return NextResponse.json({
      vehicles,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    })
  } catch (error) {
    logger.error('Get vehicles error:', error)
    return NextResponse.json({ error: 'Error al obtener vehículos' }, { status: 500 })
  }
}

// POST: Crear vehículo (solo ADMINISTRADOR)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    createVehicleSchema.parse(body)
    const { name, plate, description, driverId } = body

    // Verificar si la placa ya existe
    const existingVehicle = await db.vehicle.findUnique({
      where: { plate },
      select: { id: true }
    })

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Ya existe un vehículo con esa placa' },
        { status: 400 }
      )
    }

    const vehicle = await db.vehicle.create({
      data: {
        name,
        plate,
        description,
        driverId: driverId || null
      },
      include: {
        driver: {
          select: { id: true, fullName: true, dni: true, email: true, role: true, phone: true, isActive: true, office: { select: { id: true, name: true } } }
        }
      }
    })

    logCreate(currentUser.id, 'Vehicle', vehicle.id, { name, plate })

    return NextResponse.json({ vehicle })
  } catch (error) {
    return handleApiError(error)
  }
}
