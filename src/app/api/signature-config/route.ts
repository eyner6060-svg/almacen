import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate, logUpdate, logDelete } from '@/lib/audit'

// GET: Obtener configuraciones de firma
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const where: Prisma.SignatureConfigWhereInput = { isActive: true }
    if (type) {
      where.type = type
    }

    const configs = await db.signatureConfig.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { position: 'asc' }
      ]
    })

    return NextResponse.json({ configs })
  } catch (error) {
    logger.error('Get signature configs error:', error)
    return NextResponse.json({ error: 'Error al obtener configuración de firmas' }, { status: 500 })
  }
}

// POST: Crear configuración de firma (solo ADMINISTRADOR)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, isRequired } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Tipo y título son requeridos' },
        { status: 400 }
      )
    }

    // Obtener posición máxima actual para este tipo
    const maxPosition = await db.signatureConfig.aggregate({
      where: { type },
      _max: { position: true }
    })

    const position = (maxPosition._max.position || 0) + 1

    const config = await db.signatureConfig.create({
      data: {
        type,
        position,
        title,
        isRequired: isRequired ?? true
      }
    })

    logCreate(currentUser.id, 'SystemConfig', config.id, { type, title })

    return NextResponse.json({ config })
  } catch (error) {
    logger.error('Create signature config error:', error)
    return NextResponse.json({ error: 'Error al crear configuración de firma' }, { status: 500 })
  }
}

// PUT: Actualizar configuración de firma
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { id, title, position, isRequired, isActive } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const updateData: Prisma.SignatureConfigUpdateInput = {}
    if (title !== undefined) updateData.title = title
    if (position !== undefined) updateData.position = position
    if (isRequired !== undefined) updateData.isRequired = isRequired
    if (isActive !== undefined) updateData.isActive = isActive

    const config = await db.signatureConfig.update({
      where: { id },
      data: updateData
    })

    logUpdate(currentUser.id, 'SystemConfig', id, {}, updateData)

    return NextResponse.json({ config })
  } catch (error) {
    logger.error('Update signature config error:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}

// DELETE: Eliminar configuración de firma (eliminación lógica)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = parseInt(searchParams.get('id') || '0')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Eliminación lógica
    await db.signatureConfig.update({
      where: { id },
      data: { isActive: false }
    })

    logDelete(currentUser.id, 'SystemConfig', id, {}, `Configuración de firma ID ${id} eliminada`)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete signature config error:', error)
    return NextResponse.json({ error: 'Error al eliminar configuración' }, { status: 500 })
  }
}
