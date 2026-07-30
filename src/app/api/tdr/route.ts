import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cacheDeletePattern } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))
    const status = searchParams.get('status')
    const tdrType = searchParams.get('tdrType')
    const category = searchParams.get('category')
    const deletedOnly = searchParams.get('deletedOnly') === 'true'

    const where: Record<string, unknown> = {}
    if (deletedOnly) {
      where.deletedAt = { not: null }
    } else {
      where.deletedAt = null
    }
    if (status) where.status = status
    if (tdrType) where.tdrType = tdrType
    if (category) where.category = category
    if (user.role !== 'ADMINISTRADOR' && user.role !== 'ALMACENERO' && user.role !== 'JEFE_OFICINA') {
      where.generatedById = user.id
    }

    const [tdrs, total] = await Promise.all([
      db.tDR.findMany({
        where,
        include: { generatedBy: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      db.tDR.count({ where }),
    ])

    const parsed = tdrs.map(t => ({ ...t, items: JSON.parse(t.items) }))

    return NextResponse.json({
      tdrs: parsed,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    logger.error('Error al obtener TDRs:', error)
    return NextResponse.json({ error: 'Error al obtener Términos de Referencia' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { tdrType, category, title, justification, objective, items, requirements, deliverySchedule, lugarEntrega, formaPago, presupuesto, penalidades, marcoLegal, riesgos, anticorrupcion, adicional, notes } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un bien' }, { status: 400 })
    }

    const { getNextDocumentNumber } = await import('@/lib/document-sequence')
    const { documentNumber } = await getNextDocumentNumber('TDR')

    const tdr = await db.tDR.create({
      data: {
        tdrNumber: documentNumber,
        tdrType: tdrType || 'BIENES',
        category: category || '',
        title: title || '',
        justification: justification || '',
        objective: objective || '',
        items: JSON.stringify(items),
        requirements: requirements || '',
        deliverySchedule: deliverySchedule || '',
        lugarEntrega: lugarEntrega || '',
        formaPago: formaPago || '',
        presupuesto: presupuesto || '',
        penalidades: penalidades || '',
        marcoLegal: marcoLegal || '',
        riesgos: riesgos || '',
        anticorrupcion: anticorrupcion || '',
        adicional: adicional || '',
        status: 'BORRADOR',
        generatedById: user.id,
        isAutomatic: false,
        notes: notes || null,
      },
      include: { generatedBy: { select: { id: true, fullName: true, email: true } } },
    })

    await cacheDeletePattern('tdr*')
    return NextResponse.json({ tdr: { ...tdr, items: JSON.parse(tdr.items) } }, { status: 201 })
  } catch (error) {
    logger.error('Error al crear TDR:', error)
    return NextResponse.json({ error: 'Error al crear Término de Referencia' }, { status: 500 })
  }
}
