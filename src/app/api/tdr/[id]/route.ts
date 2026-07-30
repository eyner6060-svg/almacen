import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cacheDeletePattern } from '@/lib/cache'
import { logAudit, logDelete } from '@/lib/audit'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const tdr = await db.tDR.findFirst({
      where: { id: parseInt(id), deletedAt: null },
      include: {
        generatedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    if (!tdr) return NextResponse.json({ error: 'TDR no encontrado' }, { status: 404 })

    return NextResponse.json({ tdr: { ...tdr, items: JSON.parse(tdr.items) } })
  } catch (error) {
    logger.error('Error al obtener TDR:', error)
    return NextResponse.json({ error: 'Error al obtener TDR' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { tdrType, category, title, justification, objective, items, requirements, deliverySchedule, lugarEntrega, formaPago, presupuesto, penalidades, marcoLegal, riesgos, anticorrupcion, adicional, status, notes } = body

    const existing = await db.tDR.findUnique({ where: { id: parseInt(id) } })
    if (!existing) return NextResponse.json({ error: 'TDR no encontrado' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (tdrType !== undefined) data.tdrType = tdrType
    if (category !== undefined) data.category = category
    if (title !== undefined) data.title = title
    if (justification !== undefined) data.justification = justification
    if (objective !== undefined) data.objective = objective
    if (items !== undefined) data.items = JSON.stringify(items)
    if (requirements !== undefined) data.requirements = requirements
    if (deliverySchedule !== undefined) data.deliverySchedule = deliverySchedule
    if (lugarEntrega !== undefined) data.lugarEntrega = lugarEntrega
    if (formaPago !== undefined) data.formaPago = formaPago
    if (presupuesto !== undefined) data.presupuesto = presupuesto
    if (penalidades !== undefined) data.penalidades = penalidades
    if (marcoLegal !== undefined) data.marcoLegal = marcoLegal
    if (riesgos !== undefined) data.riesgos = riesgos
    if (anticorrupcion !== undefined) data.anticorrupcion = anticorrupcion
    if (adicional !== undefined) data.adicional = adicional
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes

    const tdr = await db.tDR.update({
      where: { id: parseInt(id) },
      data,
      include: {
        generatedBy: { select: { id: true, fullName: true, email: true } },
      },
    })

    await cacheDeletePattern('tdr*')

    logAudit({ userId: user.id, action: 'UPDATE', entityType: 'TDR', entityId: tdr.id, description: `TDR ${tdr.tdrNumber} actualizado` })

    return NextResponse.json({ tdr: { ...tdr, items: JSON.parse(tdr.items) } })
  } catch (error) {
    logger.error('Error al actualizar TDR:', error)
    return NextResponse.json({ error: 'Error al actualizar TDR' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (action === 'restore') {
      if (!['ADMINISTRADOR', 'JEFE_OFICINA', 'ALMACENERO'].includes(user.role)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const existing = await db.tDR.findUnique({ where: { id: parseInt(id) } })
      if (!existing || !existing.deletedAt) {
        return NextResponse.json({ error: 'TDR no encontrado o no eliminado' }, { status: 404 })
      }

      await db.tDR.update({
        where: { id: parseInt(id) },
        data: { deletedAt: null },
      })

      await cacheDeletePattern('tdr*')
      logAudit({ userId: user.id, action: 'UPDATE', entityType: 'TDR', entityId: parseInt(id), severity: 'WARNING', description: `TDR ${existing.tdrNumber} restaurado de la papelera` })
      return NextResponse.json({ success: true, message: 'TDR restaurado correctamente' })
    }

    if (action === 'permanent_delete') {
      if (user.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
      }

      const existing = await db.tDR.findUnique({ where: { id: parseInt(id) } })
      if (!existing) return NextResponse.json({ error: 'TDR no encontrado' }, { status: 404 })

      await db.tDR.delete({ where: { id: parseInt(id) } })
      await cacheDeletePattern('tdr*')
      logDelete(user.id, 'TDR', parseInt(id), { tdrNumber: existing.tdrNumber }, `TDR ${existing.tdrNumber} eliminado permanentemente`)
      return NextResponse.json({ success: true, message: 'TDR eliminado permanentemente' })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    logger.error('Error al procesar TDR:', error)
    return NextResponse.json({ error: 'Error al procesar TDR' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await db.tDR.findUnique({ where: { id: parseInt(id) } })
    if (!existing) return NextResponse.json({ error: 'TDR no encontrado' }, { status: 404 })

    await db.tDR.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() },
    })
    await cacheDeletePattern('tdr*')

    logAudit({ userId: user.id, action: 'DELETE', entityType: 'TDR', entityId: parseInt(id), description: `TDR ${existing.tdrNumber} enviado a la papelera` })

    return NextResponse.json({ success: true, message: 'TDR enviado a la papelera' })
  } catch (error) {
    logger.error('Error al eliminar TDR:', error)
    return NextResponse.json({ error: 'Error al eliminar TDR' }, { status: 500 })
  }
}
