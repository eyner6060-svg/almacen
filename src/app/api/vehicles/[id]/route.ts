import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { updateVehicleSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import { logger } from '@/lib/logger'
import { logUpdate, logDelete } from '@/lib/audit'

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
    const vehicle = await db.vehicle.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true, name: true, plate: true, description: true, isActive: true, driverId: true,
        driver: {
          select: { id: true, fullName: true, dni: true, email: true, role: true, isActive: true, office: { select: { id: true, name: true } } }
        }
      }
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    logger.error('Get vehicle error:', error)
    return NextResponse.json({ error: 'Error al obtener vehículo' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    updateVehicleSchema.parse(body)
    const { name, plate, description, isActive, driverId } = body

    // Verificar si el vehículo existe
    const existingVehicle = await db.vehicle.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, plate: true }
    })

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 })
    }

    // Verificar si la placa cambia y si hay conflicto
    if (plate && plate !== existingVehicle.plate) {
      const plateConflict = await db.vehicle.findUnique({
        where: { plate }
      })
      if (plateConflict) {
        return NextResponse.json(
          { error: 'Ya existe un vehículo con esa placa' },
          { status: 400 }
        )
      }
    }

    // Construir datos de actualización
    const updateData: Prisma.VehicleUpdateInput = {}
    if (name !== undefined) updateData.name = name
    if (plate !== undefined) updateData.plate = plate
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive
    
    // Manejar asignación de conductor
    if (driverId !== undefined) {
      if (driverId === null || driverId === '') {
        updateData.driver = { disconnect: true }
      } else {
        // Verificar que el conductor existe y no tiene otro vehículo asignado
        const driver = await db.user.findUnique({
          where: { id: parseInt(driverId) },
          select: { id: true }
        })
        if (driver) {
          updateData.driver = { connect: { id: parseInt(driverId) } }
        }
      }
    }

    const vehicle = await db.vehicle.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true, name: true, plate: true, description: true, isActive: true, driverId: true,
        driver: {
          select: { id: true, fullName: true, dni: true, email: true, role: true, isActive: true, office: { select: { id: true, name: true } } }
        }
      }
    })

    logUpdate(currentUser.id, 'Vehicle', parseInt(id), { plate: existingVehicle.plate }, updateData)

    return NextResponse.json({ vehicle })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    // Verificar si tiene solicitudes de combustible
    const fuelRequestsCount = await db.fuelRequest.count({
      where: { vehicleId: parseInt(id) }
    })

    if (fuelRequestsCount > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar el vehículo porque tiene solicitudes de combustible asociadas' },
        { status: 400 }
      )
    }

    // Eliminar asignación de conductor primero
    await db.vehicle.update({
      where: { id: parseInt(id) },
      data: { driverId: null }
    })

    const deletedVehicle = await db.vehicle.delete({
      where: { id: parseInt(id) },
      select: { name: true, plate: true }
    })

    logDelete(currentUser.id, 'Vehicle', parseInt(id), {}, `Vehículo ${deletedVehicle?.name || `ID ${id}`} (${deletedVehicle?.plate || ''}) eliminado`)

    return NextResponse.json({ success: true, message: 'Vehículo eliminado correctamente' })
  } catch (error) {
    logger.error('Delete vehicle error:', error)
    return NextResponse.json({ error: 'Error al eliminar vehículo' }, { status: 500 })
  }
}
