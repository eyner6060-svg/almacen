import { NextRequest, NextResponse } from 'next/server'
import { Prisma, WarrantyStatus, OrderStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { format, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import { logger } from '@/lib/logger'
import { getCurrentYearDenomination } from '@/lib/year-denomination'

type ReportRow = Record<string, string | number | boolean | null | undefined>

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'INVENTORY'
    const format_type = searchParams.get('format') || 'csv'
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
    const title = reportTitles[type] || 'Reporte'

    // Obtener datos según tipo (misma lógica que ruta principal)
    switch (type) {
      case 'INVENTORY': {
        const inventoryWhere: Prisma.ItemWhereInput = {
          isDeleted: false,
        }
        if (status && status !== 'all') {
          inventoryWhere.status = status
        }
        if (category && category !== 'all') {
          inventoryWhere.category = category
        }

        const items = await db.item.findMany({
          where: inventoryWhere,
          include: {
            warehouse: true,
            patrimonialUnits: { select: { patrimonialCode: true, status: true } },
          },
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
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            item: { select: { name: true } },
            movedBy: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })

        data = movements.map((m) => ({
          Fecha: format(m.createdAt, 'dd/MM/yyyy HH:mm'),
          'Código Patrimonial': m.patrimonialCode || 'S/N',
          Bien: m.item.name,
          'Ubicación Origen': m.fromLocation || '-',
          'Ubicación Destino': m.toLocation,
          Usuario: m.movedBy.fullName,
          Motivo: m.reason || '-',
        }))
        break
      }

      case 'CONSUMPTION': {
        const orders = await db.order.findMany({
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
            status: 'COMPLETADO',
          },
          include: {
            office: { select: { id: true, name: true, code: true } },
            items: { select: { id: true, quantity: true } },
          },
          take: 5000,
        })

        const consumptionByOffice = orders.reduce((acc, order) => {
          const officeName = order.office.name
          if (!acc[officeName]) {
            acc[officeName] = { pedidos: 0, items: 0 }
          }
          acc[officeName].pedidos++
          acc[officeName].items += order.items.reduce((sum, item) => sum + item.quantity, 0)
          return acc
        }, {} as Record<string, { pedidos: number; items: number }>)

        data = Object.entries(consumptionByOffice).map(([office, stats]) => ({
          Oficina: office,
          Pedidos: stats.pedidos,
          'Total Items': stats.items,
        }))
        break
      }

      case 'AUDIT': {
        const auditWhere: Prisma.AuditLogWhereInput = {
          createdAt: {
            gte: start,
            lte: end,
          },
        }
        if (action && action !== 'all') {
          auditWhere.action = action
        }

        const auditLogs = await db.auditLog.findMany({
          where: auditWhere,
          include: {
            user: { select: { fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        })

        data = auditLogs.map((log) => ({
          Fecha: format(log.createdAt, 'dd/MM/yyyy HH:mm'),
          Usuario: log.user?.fullName || 'Sistema',
          Acción: log.action,
          Entidad: log.entityType,
          'ID Entidad': log.entityId || '-',
          Descripción: log.description,
          IP: log.ipAddress || '-',
          Severidad: log.severity,
        }))
        break
      }

      case 'WARRANTY': {
        const warrantyWhere: Prisma.WarrantyWhereInput = {}
        if (warrantyStatus && warrantyStatus !== 'all') {
          warrantyWhere.status = warrantyStatus as WarrantyStatus
        }

        const warranties = await db.warranty.findMany({
          where: warrantyWhere,
          select: {
            id: true,
            supplierName: true,
            purchaseDate: true,
            expiryDate: true,
            status: true,
            item: { select: { name: true } },
          },
          orderBy: { expiryDate: 'asc' },
          take: 5000,
        })

        const now = new Date()
        data = warranties.map((w) => {
          const daysRemaining = Math.ceil((new Date(w.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          return {
            Bien: w.item.name,
            Proveedor: w.supplierName || '-',
            'Fecha Compra': format(new Date(w.purchaseDate), 'dd/MM/yyyy'),
            Vencimiento: format(new Date(w.expiryDate), 'dd/MM/yyyy'),
            Estado: w.status,
            'Días Restantes': daysRemaining,
          }
        })
        break
      }

      case 'ORDERS': {
        const orderWhere: Prisma.OrderWhereInput = {
          createdAt: {
            gte: start,
            lte: end,
          },
        }
        if (status && status !== 'all') {
          orderWhere.status = status as OrderStatus
        }
        if (officeId && officeId !== 'all') {
          orderWhere.officeId = parseInt(officeId)
        }

        const ordersList = await db.order.findMany({
          where: orderWhere,
          select: {
            id: true,
            orderNumber: true,
            createdAt: true,
            status: true,
            requestedBy: {
              select: {
                fullName: true,
                office: { select: { name: true } },
              },
            },
            items: {
              select: {
                quantity: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })

        data = ordersList.map((o) => ({
          Número: o.orderNumber,
          Fecha: format(new Date(o.createdAt), 'dd/MM/yyyy'),
          Solicitante: o.requestedBy.fullName,
          Oficina: o.requestedBy.office?.name || '-',
          Estado: o.status,
          Items: o.items.length,
          'Total Unidades': o.items.reduce((sum, i) => sum + i.quantity, 0),
        }))
        break
      }
    }
    
    // Exportar según el formato
    switch (format_type) {
      case 'csv':
        return exportCSV(data, title)
      case 'excel':
        return exportExcel(data, title)
      case 'pdf':
        return exportPDF(data, title)
      default:
        return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
    }
  } catch (error) {
    logger.error('Error exporting report:', error)
    return NextResponse.json({ error: 'Error al exportar el reporte' }, { status: 500 })
  }
}

function exportCSV(data: ReportRow[], title: string): NextResponse {
  if (data.length === 0) {
    return new NextResponse('Sin datos para exportar', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${title}_${format(new Date(), 'yyyy-MM-dd')}.csv"`,
      },
    })
  }

  const headers = Object.keys(data[0]!)
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h]
        const str = String(val ?? '')
        // Escapar comillas y envolver si contiene coma o comilla
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(',')
    ),
  ]

  const csvContent = csvRows.join('\n')

  return new NextResponse('\ufeff' + csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${title}_${format(new Date(), 'yyyy-MM-dd')}.csv"`,
    },
  })
}

function exportExcel(data: ReportRow[], title: string): NextResponse {
  if (data.length === 0) {
    // Crear libro vacío con encabezados
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Sin datos para exportar']])
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
    
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${title}_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
      },
    })
  }

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte')

  // Ajuste automático de columnas
  const firstRow = data[0] ?? {}
  const colWidths = Object.keys(firstRow).map((key) => ({
    wch: Math.max(
      key.length,
      ...data.slice(0, 100).map((row) => String(row[key] ?? '').length)
    ) + 2,
  }))
  ws['!cols'] = colWidths

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${title}_${format(new Date(), 'yyyy-MM-dd')}.xlsx"`,
    },
  })
}

async function exportPDF(data: ReportRow[], title: string): Promise<NextResponse> {
  const sysConfig = await db.systemConfig.findFirst({
    where: { id: 1 },
    select: { institutionName: true },
  })
  const institutionName = sysConfig?.institutionName || 'Almacén Institucional'
  // Generar HTML simple que puede imprimirse como PDF
  const firstRow = data[0] ?? {}
  const headers = Object.keys(firstRow)
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #1e40af; margin-bottom: 5px; }
        .date { color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #1e40af; color: white; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 20px; font-size: 10px; color: #666; text-align: center; }
        @media print {
          body { margin: 0; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h2 style="color: #1e40af; margin: 0 0 3px; font-size: 14px;">${institutionName}</h2>
      <p style="font-size: 11px; margin: 0 0 15px; font-style: italic; color: #666;">${getCurrentYearDenomination()}</p>
      <h1 style="margin-bottom: 5px;">${title}</h1>
      <div class="date">Generado el ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}</div>
      
      <table>
        <thead>
          <tr>
            ${headers.map((h) => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map((row) => `
            <tr>
              ${headers.map((h) => `<td>${row[h] ?? '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        Sistema de Gestión de Almacén - Página 1 de 1
      </div>
    </body>
    </html>
  `

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${title}_${format(new Date(), 'yyyy-MM-dd')}.html"`,
    },
  })
}

const reportTitles: Record<string, string> = {
  INVENTORY: 'Reporte de Inventario',
  MOVEMENTS: 'Reporte de Movimientos',
  CONSUMPTION: 'Reporte de Consumo por Oficina',
  AUDIT: 'Reporte de Auditoría',
  WARRANTY: 'Reporte de Garantías',
  ORDERS: 'Reporte de Pedidos',
}
