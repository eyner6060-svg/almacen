import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { cacheDeletePattern } from '@/lib/cache'
import { generateTDRDocx } from '@/lib/tdr-generator'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { tdrId, tdrType, category, title, justification, objective, items, requirements, deliverySchedule, lugarEntrega, formaPago, presupuesto, penalidades, marcoLegal, riesgos, anticorrupcion, adicional, notes } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un bien' }, { status: 400 })
    }

    const { getNextDocumentNumber } = await import('@/lib/document-sequence')
    const config = await db.systemConfig.findFirst({ where: { id: 1 }, select: { institutionName: true } })
    const institutionName = config?.institutionName || 'Almacén Institucional'

    let tdr
    let isNew = false

    if (tdrId) {
      tdr = await db.tDR.findUnique({ where: { id: tdrId } })
      if (!tdr) return NextResponse.json({ error: 'TDR no encontrado' }, { status: 404 })
    } else {
      isNew = true
      const { documentNumber } = await getNextDocumentNumber('TDR')
      tdr = await db.tDR.create({
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
          status: 'GENERADO',
          generatedById: user.id,
          isAutomatic: false,
          notes: notes || null,
        },
      })
    }

    const fileName = await generateTDRDocx(
      {
        tdrNumber: tdr.tdrNumber,
        tdrType: tdrType || tdr.tdrType || 'BIENES',
        category: category || tdr.category || '',
        title: title || tdr.title,
        justification: justification || tdr.justification,
        objective: objective || tdr.objective,
        items,
        requirements: requirements || tdr.requirements,
        deliverySchedule: deliverySchedule || tdr.deliverySchedule,
        lugarEntrega: lugarEntrega || tdr.lugarEntrega,
        formaPago: formaPago || tdr.formaPago,
        presupuesto: presupuesto || tdr.presupuesto,
        penalidades: penalidades || tdr.penalidades,
        marcoLegal: marcoLegal || tdr.marcoLegal,
        riesgos: riesgos || tdr.riesgos,
        anticorrupcion: anticorrupcion || tdr.anticorrupcion,
        adicional: adicional || tdr.adicional,
        isAutomatic: isNew,
      },
      institutionName,
    )

    const updatedTdr = await db.tDR.update({
      where: { id: tdr.id },
      data: {
        tdrType: tdrType || tdr.tdrType || 'BIENES',
        category: category || tdr.category || '',
        title: title || tdr.title,
        justification: justification || tdr.justification,
        objective: objective || tdr.objective,
        items: JSON.stringify(items),
        requirements: requirements || tdr.requirements,
        deliverySchedule: deliverySchedule || tdr.deliverySchedule,
        lugarEntrega: lugarEntrega || tdr.lugarEntrega,
        formaPago: formaPago || tdr.formaPago,
        presupuesto: presupuesto || tdr.presupuesto,
        penalidades: penalidades || tdr.penalidades,
        marcoLegal: marcoLegal || tdr.marcoLegal,
        riesgos: riesgos || tdr.riesgos,
        anticorrupcion: anticorrupcion || tdr.anticorrupcion,
        adicional: adicional || tdr.adicional,
        status: 'GENERADO',
        fileUrl: fileName,
        notes: notes || tdr.notes,
      },
      include: { generatedBy: { select: { id: true, fullName: true, email: true } } },
    })

    await cacheDeletePattern('tdr*')
    return NextResponse.json({
      tdr: { ...updatedTdr, items: JSON.parse(updatedTdr.items) },
      fileUrl: `/api/files/docs/${fileName}`,
    })
  } catch (error) {
    logger.error('Error al generar TDR:', error)
    return NextResponse.json({ error: 'Error al generar Término de Referencia' }, { status: 500 })
  }
}
