import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

// GET - Obtener todas las reglas de workflow
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const workflows = await db.workflowRule.findMany({
      include: {
        _count: {
          select: { executions: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ workflows })
  } catch (error) {
    logger.error('Error al obtener workflows:', error)
    return NextResponse.json({ workflows: [], error: 'Error al obtener flujos de trabajo' }, { status: 500 })
  }
}

// POST - Crear una nueva regla de workflow
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, triggerType, conditions, actions, isActive, priority } = body

    if (!name || !triggerType) {
      return NextResponse.json({ error: 'Nombre y tipo de disparador son requeridos' }, { status: 400 })
    }

    const workflow = await db.workflowRule.create({
      data: {
        name,
        description,
        triggerType,
        conditions: conditions || '[]',
        actions: actions || '[]',
        isActive: isActive ?? true,
        priority: priority ?? 0,
      },
    })

    logCreate(user.id, 'SystemConfig', workflow.id, { name, triggerType })

    return NextResponse.json({ workflow })
  } catch (error) {
    logger.error('Error al crear workflow:', error)
    return NextResponse.json({ error: 'Error al crear flujo de trabajo' }, { status: 500 })
  }
}
