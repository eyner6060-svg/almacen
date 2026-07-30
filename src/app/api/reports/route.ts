import { NextRequest, NextResponse } from 'next/server'
import { Prisma, WarrantyStatus, OrderStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { dispatch } from '@/lib/jobs'
import { logger } from '@/lib/logger'
import { format, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

type ReportRow = Record<string, string | number | boolean | null | undefined>

const reportTitles: Record<string, string> = {
  INVENTORY: 'Reporte de Inventario',
  MOVEMENTS: 'Reporte de Movimientos',
  CONSUMPTION: 'Reporte de Consumo por Oficina',
  AUDIT: 'Reporte de Auditoría',
  WARRANTY: 'Reporte de Garantías',
  ORDERS: 'Reporte de Pedidos',
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'INVENTORY'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const officeId = searchParams.get('officeId')
    const action = searchParams.get('action')
    const warrantyStatus = searchParams.get('warrantyStatus')

    const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date())
    const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date())

    let data: ReportRow[] = []

    switch (type) {
      case 'INVENTORY': {
        const inventoryWhere: Prisma.ItemWhereInput = { isDeleted: false }
        if (status && status !== 'all') inventoryWhere.status = status
        if (category && category !== 'all') inventoryWhere.category = category

        const items = await db.item.findMany({
          where: inventoryWhere,
          include: { warehouse: { select: { name: true } }, patrimonialUnits: { select: { patrimonialCode: true, status: true } } },
          orderBy: { name: 'asc' },
          take: 5000,
        })

        data = items.flatMap((item) => {
          if (item.itemType === 'PATRIMONIAL' && item.patrimonialUnits.length > 0) {
            return item.patrimonialUnits.map((unit) => ({
              nombre: item.name,
              codigo: item.code,
              modelo: item.model,
              marca: item.brand,
              color: item.color || '',
              serie: item.series || '',
              tipo: item.itemType,
              categoria: item.category,
              cantidad: 1,
              unidad: item.unit,
              stockMinimo: item.minStock,
              codigoPatrimonial: unit.patrimonialCode,
              almacen: item.warehouse.name,
              ubicacion: item.location || '',
              especificaciones: item.technicalSpecs || '',
              estado: unit.status || item.status,
            }))
          }
          return [{
            nombre: item.name,
            codigo: item.code,
            modelo: item.model,
            marca: item.brand,
            color: item.color || '',
            serie: item.series || '',
            tipo: item.itemType,
            categoria: item.category,
            cantidad: item.quantity,
            unidad: item.unit,
            stockMinimo: item.minStock,
            codigoPatrimonial: item.patrimonialCode || '',
            almacen: item.warehouse.name,
            ubicacion: item.location || '',
            especificaciones: item.technicalSpecs || '',
            estado: item.status,
          }]
        })
        break
      }

      case 'MOVEMENTS': {
        const movements = await db.itemMovement.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: { item: { select: { name: true } }, movedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })

        data = movements.map((m) => ({
          Fecha: format(m.createdAt, 'dd/MM/yyyy HH:mm', { locale: es }),
          Tipo: m.fromLocation ? `Salida de ${m.fromLocation}` : 'Ingreso a almacén',
          Bien: m.item.name,
          Cantidad: 1,
          Usuario: m.movedBy.fullName,
          Observaciones: m.reason || '-',
        }))
        break
      }

      case 'CONSUMPTION': {
        const orders = await db.order.findMany({
          where: { createdAt: { gte: start, lte: end }, status: 'COMPLETADO' },
          include: { office: { select: { name: true } }, items: { select: { quantity: true } } },
          take: 5000,
        })

        const consumptionByOffice = orders.reduce((acc, order) => {
          const officeName = order.office.name
          if (!acc[officeName]) {
            acc[officeName] = { pedidos: 0, items: 0, ultimoPedido: order.createdAt }
          }
          acc[officeName].pedidos++
          acc[officeName].items += order.items.reduce((sum, i) => sum + i.quantity, 0)
          if (order.createdAt > acc[officeName].ultimoPedido) {
            acc[officeName].ultimoPedido = order.createdAt
          }
          return acc
        }, {} as Record<string, { pedidos: number; items: number; ultimoPedido: Date }>)

        data = Object.entries(consumptionByOffice).map(([office, stats]) => ({
          Oficina: office,
          Pedidos: stats.pedidos,
          'Total Items': stats.items,
          'Último Pedido': format(stats.ultimoPedido, 'dd/MM/yyyy', { locale: es }),
        }))
        break
      }

      case 'AUDIT': {
        const auditWhere: Prisma.AuditLogWhereInput = { createdAt: { gte: start, lte: end } }
        if (action && action !== 'all') auditWhere.action = action

        const auditLogs = await db.auditLog.findMany({
          where: auditWhere,
          include: { user: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 500,
        })

        data = auditLogs.map((log) => ({
          Fecha: format(log.createdAt, 'dd/MM/yyyy HH:mm', { locale: es }),
          Usuario: log.user?.fullName || 'Sistema',
          Acción: log.action,
          Entidad: log.entityType,
          Detalles: log.description,
          IP: log.ipAddress || '-',
        }))
        break
      }

      case 'WARRANTY': {
        const warrantyWhere: Prisma.WarrantyWhereInput = {}
        if (warrantyStatus && warrantyStatus !== 'all') warrantyWhere.status = warrantyStatus as WarrantyStatus

        const warranties = await db.warranty.findMany({
          where: warrantyWhere,
          include: { item: { select: { name: true } } },
          orderBy: { expiryDate: 'asc' },
          take: 5000,
        })

        const now = new Date()
        data = warranties.map((w) => ({
          Bien: w.item.name,
          Proveedor: w.supplierName || '-',
          'Fecha Compra': format(new Date(w.purchaseDate), 'dd/MM/yyyy', { locale: es }),
          Vencimiento: format(new Date(w.expiryDate), 'dd/MM/yyyy', { locale: es }),
          Estado: w.status,
          'Días Restantes': Math.ceil((new Date(w.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        }))
        break
      }

      case 'ORDERS': {
        const orderWhere: Prisma.OrderWhereInput = { createdAt: { gte: start, lte: end } }
        if (status && status !== 'all') orderWhere.status = status as OrderStatus
        if (officeId && officeId !== 'all') orderWhere.officeId = parseInt(officeId)

        const ordersList = await db.order.findMany({
          where: orderWhere,
          include: {
            requestedBy: { select: { fullName: true, office: { select: { name: true } } } },
            items: { select: { id: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })

        data = ordersList.map((o) => ({
          Número: o.orderNumber,
          Fecha: format(new Date(o.createdAt), 'dd/MM/yyyy', { locale: es }),
          Solicitante: o.requestedBy.fullName,
          Oficina: o.requestedBy.office?.name || '-',
          Estado: o.status,
          Items: o.items.length,
        }))
        break
      }
    }

    return NextResponse.json({
      title: reportTitles[type] || 'Reporte',
      generatedAt: new Date().toISOString(),
      data,
      summary: {
        total_registros: data.length,
        ...(type === 'INVENTORY' && {
          stock_total: data.reduce((sum, r) => sum + Number(r['cantidad'] || 0), 0),
        }),
        ...(type === 'ORDERS' && {
          total_unidades: data.reduce((sum, r) => sum + Number(r['Items'] || 0), 0),
        }),
      },
    })
  } catch (error) {
    logger.error('Error al generar reporte:', error)
    return NextResponse.json({ error: 'Error al generar el reporte' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { type, format, startDate, endDate, category, status, officeId, action, warrantyStatus } = body

    const validFormats = ['csv', 'excel']
    if (format && !validFormats.includes(format)) {
      return NextResponse.json({ error: 'Formato no soportado. Use csv o excel.' }, { status: 400 })
    }

    const reportTitles: Record<string, string> = {
      INVENTORY: 'Reporte_de_Inventario',
      MOVEMENTS: 'Reporte_de_Movimientos',
      CONSUMPTION: 'Reporte_de_Consumo',
      AUDIT: 'Reporte_de_Auditoria',
      ORDERS: 'Reporte_de_Pedidos'
    }

    const reportType = type || 'INVENTORY'
    const title = reportTitles[reportType] || 'Reporte'

    const jobId = dispatch('reports:generate', {
      type: reportType,
      format: format || 'csv',
      filters: { startDate, endDate, category, status, officeId, action, warrantyStatus },
      title
    })

    return NextResponse.json({
      jobId,
      status: 'processing',
      message: `Generación de reporte iniciada. Use POST /api/jobs/${jobId} para descargar cuando esté listo.`
    })

  } catch (error) {
    logger.error('Error al crear reporte:', error)
    return NextResponse.json({ error: 'Error al crear el reporte' }, { status: 500 })
  }
}
