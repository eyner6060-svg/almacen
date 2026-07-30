import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

// Verificar si la tabla existe
async function checkTableExists(): Promise<boolean> {
  try {
    // Segura: consulta fija sin entrada de usuario
    await db.$queryRaw`SELECT 1 FROM "WorkflowExecution" LIMIT 1`
    return true
  } catch {
    return false
  }
}

// GET - Obtener ejecuciones de workflow
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar si la tabla existe primero
    const tableExists = await checkTableExists()
    if (!tableExists) {
      return NextResponse.json({
        executions: [],
        migrationRequired: true,
        message: 'La tabla de ejecuciones de workflow no existe. Ejecute: npx prisma db push'
      })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    const where: Prisma.WorkflowExecutionWhereInput = {}
    if (status) {
      where.status = status
    }

    const executions = await db.workflowExecution.findMany({
      where,
      include: {
        rule: {
          select: {
            name: true,
            triggerType: true,
          },
        },
      },
      orderBy: { executedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ executions })
  } catch (error) {
    logger.error('Error al obtener workflow executions:', error)
    // Devolver datos vacíos en lugar de error
    return NextResponse.json({
      executions: [],
      error: 'Error al obtener ejecuciones',
      migrationRequired: true,
      message: 'Ejecute: npx prisma db push para crear las tablas necesarias'
    })
  }
}
