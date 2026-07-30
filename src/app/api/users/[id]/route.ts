import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { updateUserSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logUpdate, logDelete, logRoleChange } from '@/lib/audit'

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

    if (currentUser.role !== 'ADMINISTRADOR' && currentUser.id !== parseInt(id)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true, fullName: true, dni: true, phone: true, position: true,
        email: true, role: true, isActive: true, isDriver: true, officeId: true,
        canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, canAuthorizeLoans: true,
        twoFactorEnabled: true, createdAt: true, pin: true,
        office: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, plate: true } }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { pin: _, ...safeUser } = user

    return NextResponse.json({ user: safeUser })
  } catch (error) {
    logger.error('Get user error:', error)
    return NextResponse.json({ error: 'Error al obtener usuario' }, { status: 500 })
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
    const { isDriver, vehicleId, password, pin, officeId, ...rest } = body
    const parseResult = updateUserSchema.safeParse(rest)
    if (!parseResult.success) {
      logger.error('Update user validation error:', JSON.stringify(rest))
      logger.error('Zod issues:', JSON.stringify(parseResult.error?.issues || []))
      return NextResponse.json({
        error: 'Datos inválidos',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      }, { status: 400 })
    }
    const updateData: Prisma.UserUpdateInput = { ...parseResult.data }
    if (officeId !== undefined) {
      updateData.office = officeId ? { connect: { id: parseInt(officeId, 10) } } : { disconnect: true }
    }
    // Actualizar PIN solo si cambió respecto al actual
    if (pin !== undefined && pin !== '****') {
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json({ error: 'El PIN debe tener exactamente 4 dígitos' }, { status: 400 })
      }
      const existingUser = await db.user.findUnique({ where: { id: parseInt(id) }, select: { pin: true } })
      const pinChanged = !existingUser?.pin || !(await bcrypt.compare(pin, existingUser.pin))
      if (pinChanged) {
        updateData.pin = await bcrypt.hash(pin, 10)
      }
    }

    // Manejar asignación de vehículo
    if (isDriver !== undefined) {
      if (isDriver && vehicleId) {
        const vehicleIdNum = parseInt(vehicleId, 10)
        if (isNaN(vehicleIdNum)) {
          return NextResponse.json({ error: 'ID de vehículo inválido' }, { status: 400 })
        }
        const vehicle = await db.vehicle.findUnique({
          where: { id: vehicleIdNum }
        })

        if (vehicle && vehicle.driverId === null) {
          await db.vehicle.updateMany({
            where: { driverId: parseInt(id) },
            data: { driverId: null }
          })

          updateData.vehicle = { connect: { id: vehicleIdNum } }
        }
      } else if (!isDriver) {
        await db.vehicle.updateMany({
          where: { driverId: parseInt(id) },
          data: { driverId: null }
        })
      }

      updateData.isDriver = isDriver
    }

    if (password) {
      updateData.password = await hashPassword(password)
    }

    // Obtener datos anteriores para auditoría
    const oldUser = await db.user.findUnique({ where: { id: parseInt(id) }, select: { role: true, fullName: true } })

    const user = await db.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: { 
        office: { select: { id: true, name: true } },
        vehicle: { select: { id: true, name: true, plate: true } }
      }
    })

    if (updateData.role && oldUser?.role && updateData.role !== oldUser.role) {
      logRoleChange(currentUser.id, parseInt(id), oldUser.role, updateData.role as string)
    }
    logUpdate(currentUser.id, 'User', parseInt(id), { role: oldUser?.role }, updateData, `Actualización de usuario ${user.fullName}`)

    await cacheDelete(CacheKeys.officeList())

    return NextResponse.json({ user })
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
    
    // Eliminar asignación de vehículo si existe
    await db.vehicle.updateMany({
      where: { driverId: parseInt(id) },
      data: { driverId: null }
    })
    
    const deletedUser = await db.user.findUnique({ where: { id: parseInt(id) }, select: { fullName: true } })
    await db.user.delete({
      where: { id: parseInt(id) }
    })

    logDelete(currentUser.id, 'User', parseInt(id), {}, `Usuario ${deletedUser?.fullName || `ID ${id}`} eliminado`)

    await cacheDelete(CacheKeys.officeList())

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete user error:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
