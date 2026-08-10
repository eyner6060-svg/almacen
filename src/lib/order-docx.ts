import type { Order } from '@/types'

interface OrderDocxBranding {
  institutionName?: string
  logoUrl?: string | null
  primaryColor?: string
}

export async function downloadOrderDeliveryDocx(order: Order, config?: OrderDocxBranding) {
  const docx = await import('docx')
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, VerticalAlign, ShadingType,
  } = docx

  const institutionName = config?.institutionName || 'INSTITUCIÓN'
  const primaryColor = config?.primaryColor || '#1e40af'
  const now = new Date()

  const headerCell = (text: string, width: number) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, fill: primaryColor.replace('#', '') },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 18, font: 'Times New Roman', color: 'FFFFFF' })],
      }),
    ],
  })

  const bodyCell = (text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, size: 18, font: 'Times New Roman' })],
      }),
    ],
  })

  const solidBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }

  const border = {
    top: solidBorder,
    bottom: solidBorder,
    left: solidBorder,
    right: solidBorder,
  }

  const tableWidths = {
    n: 500,
    code: 1500,
    name: 3400,
    patrimonial: 1400,
    marca: 1400,
    modelo: 1400,
    color: 900,
    estado: 1300,
    unidad: 900,
    cantidad: 900,
  }
  const totalWidth = tableWidths.n + tableWidths.code + tableWidths.name + tableWidths.patrimonial +
    tableWidths.marca + tableWidths.modelo + tableWidths.color + tableWidths.estado +
    tableWidths.unidad + tableWidths.cantidad

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('#', tableWidths.n),
      headerCell('CÓDIGO', tableWidths.code),
      headerCell('DESCRIPCIÓN DEL BIEN', tableWidths.name),
      headerCell('CÓD. PATRIM.', tableWidths.patrimonial),
      headerCell('MARCA', tableWidths.marca),
      headerCell('MODELO', tableWidths.modelo),
      headerCell('COLOR', tableWidths.color),
      headerCell('ESTADO', tableWidths.estado),
      headerCell('UNIDAD', tableWidths.unidad),
      headerCell('CANT.', tableWidths.cantidad),
    ],
  })

  const bodyRows = order.items.map((oi, i) => {
    const patrimonialCode = oi.patrimonialUnit?.patrimonialCode || oi.item.patrimonialCode || oi.patrimonialCode || 'S/N'
    const estado = oi.patrimonialUnit?.status || oi.item.status || 'OPERATIVO'
    return new TableRow({
      children: [
        bodyCell(String(i + 1), tableWidths.n, AlignmentType.CENTER),
        bodyCell(oi.item.code || '', tableWidths.code, AlignmentType.CENTER),
        bodyCell(oi.item.name || '', tableWidths.name),
        bodyCell(patrimonialCode, tableWidths.patrimonial, AlignmentType.CENTER),
        bodyCell(oi.item.brand || 'S/M', tableWidths.marca),
        bodyCell(oi.item.model || 'S/M', tableWidths.modelo),
        bodyCell(oi.item.color || '-', tableWidths.color, AlignmentType.CENTER),
        bodyCell(estado, tableWidths.estado, AlignmentType.CENTER),
        bodyCell(oi.item.unit || 'UNIDAD', tableWidths.unidad, AlignmentType.CENTER),
        bodyCell(String(oi.quantity), tableWidths.cantidad, AlignmentType.CENTER),
      ],
    })
  })

  const itemsTable = new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    borders: border,
    rows: [headerRow, ...bodyRows],
  })

  const infoRow = (label: string, value: string) => new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Times New Roman' }),
      new TextRun({ text: value || '---', size: 22, font: 'Times New Roman' }),
    ],
  })

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 22 }, paragraph: { spacing: { after: 120, line: 300 } } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: institutionName.toUpperCase(), bold: true, size: 30, font: 'Times New Roman' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'SISTEMA DE GESTIÓN DE ALMACÉN', size: 20, font: 'Times New Roman', color: '555555' })],
        }),
        new Paragraph({ spacing: { after: 200 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'ORDEN DE SALIDA DE BIENES', bold: true, size: 28, font: 'Times New Roman' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: `N° ${order.orderNumber}`, bold: true, size: 24, font: 'Times New Roman' })],
        }),
        infoRow('FECHA', now.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })),
        infoRow('OFICINA', order.office?.name),
        infoRow('SOLICITANTE', order.requestedBy?.fullName),
        infoRow('CÉDULA / DNI', order.requestedBy?.dni),
        infoRow('CARGO', order.requestedBy?.position),
        new Paragraph({ spacing: { after: 200 } }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Bienes que se entregan, detallados a continuación:', size: 22, font: 'Times New Roman' })],
        }),
        itemsTable,
        new Paragraph({ spacing: { after: 200 } }),
        infoRow('OBSERVACIONES', order.notes || '-'),
        new Paragraph({ spacing: { after: 400 } }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Documento generado automáticamente por el Sistema de Gestión de Almacén', italics: true, size: 18, font: 'Times New Roman', color: '777777' })],
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Orden_Salida_${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
