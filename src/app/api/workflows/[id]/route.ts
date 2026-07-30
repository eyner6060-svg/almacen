import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logUpdate, logDelete } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// GET - Obtener regla de workflow individual
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const workflow = await db.workflowRule.findUnique({
      where: { id: parseInt(id) },
      include: {
        executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
        },
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ workflow })
  } catch (error) {
    logger.error('Error fetching workflow:', error)
    return NextResponse.json({ error: 'Error al obtener flujo de trabajo' }, { status: 500 })
  }
}

// PUT - Actualizar regla de workflow
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, triggerType, conditions, actions, isActive, priority } = body

    const workflow = await db.workflowRule.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(triggerType && { triggerType }),
        ...(conditions && { conditions }),
        ...(actions && { actions }),
        ...(isActive !== undefined && { isActive }),
        ...(priority !== undefined && { priority }),
      },
    })

    logUpdate(user.id, 'SystemConfig', parseInt(id), {}, { name })

    return NextResponse.json({ workflow })
  } catch (error) {
    logger.error('Error updating workflow:', error)
    return NextResponse.json({ error: 'Error al actualizar flujo de trabajo' }, { status: 500 })
  }
}

// DELETE - Eliminar regla de workflow
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    await db.workflowRule.delete({
      where: { id: parseInt(id) },
    })

    logDelete(user.id, 'SystemConfig', parseInt(id), {}, `Workflow ID ${id} eliminado`)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting workflow:', error)
    return NextResponse.json({ error: 'Error al eliminar flujo de trabajo' }, { status: 500 })
  }
}
