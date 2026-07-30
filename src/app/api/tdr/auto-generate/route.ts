import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const allItems = await db.item.findMany({
      where: {
        isDeleted: false,
        itemType: 'CONSUMIBLE',
      },
      select: {
        id: true,
        name: true,
        code: true,
        quantity: true,
        minStock: true,
        unit: true,
        category: true,
        technicalSpecs: true,
      },
      orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
    })
    const lowStockItems = allItems.filter(i => i.quantity <= i.minStock)

    if (lowStockItems.length === 0) {
      return NextResponse.json({ message: 'No hay bienes con stock bajo', generated: false, count: 0 })
    }

    const [{ generateTDRDocx }, { getNextDocumentNumber }] = await Promise.all([
      import('@/lib/tdr-generator'),
      import('@/lib/document-sequence')
    ])

    const [{ documentNumber }, adminUser, config] = await Promise.all([
      getNextDocumentNumber('TDR'),
      db.user.findFirst({
        where: { role: 'ADMINISTRADOR', isActive: true },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      db.systemConfig.findFirst({
        where: { id: 1 },
        select: { institutionName: true },
      })
    ])

    if (!adminUser) {
      return NextResponse.json({ error: 'No hay administradores activos en el sistema' }, { status: 500 })
    }

    const institutionName = config?.institutionName || 'Almacén Institucional'

    const itemsData = lowStockItems.map(i => ({
      itemId: i.id,
      name: i.name,
      code: i.code,
      quantity: Math.max(i.minStock - i.quantity + 5, 10),
      unit: i.unit,
      technicalSpecs: i.technicalSpecs,
      currentStock: i.quantity,
      minStock: i.minStock,
      category: i.category,
    }))

    const totalItems = itemsData.reduce((sum, i) => sum + i.quantity, 0)
    const itemNames = itemsData.map(i => i.name).join(', ')

    const tdrData = {
      tdrNumber: documentNumber,
      tdrType: 'BIENES' as const,
      category: '',
      title: `Adquisición de Bienes de Consumo - Stock Bajo`,
      justification: `El sistema ha detectado que los siguientes bienes de consumo se encuentran con stock igual o inferior al mínimo requerido: ${itemNames}. En total se requiere adquirir ${totalItems} unidades distribuidas en ${itemsData.length} tipos de bienes. Esta situación afecta la continuidad de las operaciones institucionales, por lo que resulta necesario y urgente proceder con la contratación para reponer el stock y garantizar el normal funcionamiento de las actividades.`,
      objective: `Adquirir ${totalItems} unidades de bienes de consumo para cubrir el déficit de stock detectado y asegurar un stock de seguridad suficiente para los próximos meses, conforme a las especificaciones técnicas detalladas en el presente documento.`,
      items: itemsData,
      requirements: '',
      deliverySchedule: '',
      lugarEntrega: '',
      formaPago: '',
      presupuesto: '',
      penalidades: '',
      marcoLegal: '',
      riesgos: '',
      anticorrupcion: '',
      adicional: '',
      isAutomatic: true,
    }

    const fileName = await generateTDRDocx(tdrData, institutionName)

    const tdr = await db.tDR.create({
      data: {
        tdrNumber: documentNumber,
        tdrType: 'BIENES',
        category: '',
        title: tdrData.title,
        justification: tdrData.justification,
        objective: tdrData.objective,
        items: JSON.stringify(itemsData),
        status: 'GENERADO',
        fileUrl: fileName,
        generatedById: adminUser.id,
        isAutomatic: true,
      },
    })

    const notifUsers = await db.user.findMany({
      where: {
        OR: [
          { role: 'ADMINISTRADOR' },
          { role: 'ALMACENERO' },
        ],
        isActive: true,
        id: { not: adminUser.id },
      },
      select: { id: true },
    })

    await Promise.all([
      notifUsers.length > 0
        ? db.notification.createMany({
            data: notifUsers.map(u => ({
              userId: u.id,
              title: 'TDR Generado Automáticamente',
              message: `Se ha generado el TDR N° ${tdr.tdrNumber} para la adquisición de ${itemsData.length} bienes con stock bajo (${totalItems} unidades).`,
              type: 'STOCK_BAJO' as any,
              relatedId: tdr.id,
            })),
          })
        : Promise.resolve(),
      db.notification.create({
        data: {
          userId: adminUser.id,
          title: 'TDR Generado Automáticamente',
          message: `Se ha generado el TDR N° ${tdr.tdrNumber} para la adquisición de ${itemsData.length} bienes con stock bajo (${totalItems} unidades). Revise y complete los datos antes de su uso oficial.`,
          type: 'STOCK_BAJO' as any,
          relatedId: tdr.id,
        },
      }),
    ])

    logger.info(`[TDR AUTO] Generado TDR ${tdr.tdrNumber} con ${itemsData.length} items (${totalItems} unidades)`)

    return NextResponse.json({
      message: `TDR ${tdr.tdrNumber} generado automáticamente con ${itemsData.length} bienes`,
      generated: true,
      count: lowStockItems.length,
      tdr: { ...tdr, items: itemsData },
      fileUrl: `/api/files/docs/${fileName}`,
    })
  } catch (error) {
    logger.error('Error al generar TDR automático:', error)
    return NextResponse.json({ error: 'Error al generar TDR automático' }, { status: 500 })
  }
}
