import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const estados = await db.itemStatusEnum.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ estados })
  } catch (error) {
    logger.error('Get estados error:', error)
    return NextResponse.json({ error: 'Error al obtener estados' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, label, color } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del estado es requerido' }, { status: 400 })
    }
    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'La etiqueta del estado es requerida' }, { status: 400 })
    }

    const nameKey = name.trim().toUpperCase().replace(/\s+/g, '_')

    const existing = await db.itemStatusEnum.findUnique({ where: { name: nameKey } })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un estado con ese nombre' }, { status: 409 })
    }

    const estado = await db.itemStatusEnum.create({
      data: {
        name: nameKey,
        label: label.trim(),
        color: color || 'gray'
      }
    })

    return NextResponse.json({ estado }, { status: 201 })
  } catch (error) {
    logger.error('Create estado error:', error)
    return NextResponse.json({ error: 'Error al crear estado' }, { status: 500 })
  }
}
