import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType,
} from 'docx'
import { writeFile, mkdir } from 'fs/promises'
import { getCurrentYearDenomination } from '@/lib/year-denomination'
import path from 'path'
import type { TDRItem, TDRType } from '@/types'

const DOCUMENTS_DIR = path.join(process.cwd(), 'private', 'uploads', 'docs')

interface TDRDocxData {
  tdrNumber: string
  tdrType: TDRType
  category: string
  title: string
  justification: string
  objective: string
  items: TDRItem[]
  requirements: string
  deliverySchedule: string
  lugarEntrega: string
  formaPago: string
  presupuesto: string
  penalidades: string
  marcoLegal: string
  riesgos: string
  anticorrupcion: string
  adicional: string
  isAutomatic: boolean
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 200 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Times New Roman' })],
  })
}

function body(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 150 },
    children: [new TextRun({ text, size: 24, font: 'Times New Roman' })],
  })
}

function buildItemTechTable(items: TDRItem[]): Paragraph[] {
  const result: Paragraph[] = []
  items.forEach((item, i) => {
    result.push(new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: `${i + 1}. ${item.name} (${item.code})`, bold: true, size: 24, font: 'Times New Roman' })],
    }))
    result.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Denominación del bien: ${item.name}`, size: 22, font: 'Times New Roman' })] }))
    result.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Unidad de medida: ${item.unit}`, size: 22, font: 'Times New Roman' })] }))
    result.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Cantidad requerida: ${item.quantity}`, size: 22, font: 'Times New Roman' })] }))
    if (item.technicalSpecs) {
      result.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Especificaciones técnicas: ${item.technicalSpecs}`, size: 22, font: 'Times New Roman' })] }))
    }
  })
  return result
}

function generateBienesTDR(tdr: TDRDocxData, institution: string): Document {
  const cat = tdr.category ? `DE ${tdr.category}` : ''
  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { after: 200, line: 360 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: institution.toUpperCase(), bold: true, size: 28, font: 'Times New Roman' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'DIRECCIÓN DE TELECOMUNICACIONES', bold: true, size: 24, font: 'Times New Roman' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'SUB DIRECCIÓN DE MANTENIMIENTO Y OPERACIONES', bold: true, size: 22, font: 'Times New Roman' })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: getCurrentYearDenomination(), italics: true, size: 20, font: 'Times New Roman', color: '444444' })]
        }),
        new Paragraph({ spacing: { after: 200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `TÉRMINO DE REFERENCIA N° ${tdr.tdrNumber}`, bold: true, size: 28, font: 'Times New Roman' })] }),

        heading('1. FINALIDAD PÚBLICA.'),
        body(tdr.justification || `El presente proceso busca contar con la ADQUISICIÓN ${cat}. Que permitirá cumplir con las actividades programadas en la ejecución del proyecto "CONGLOMERADO DE PROYECTO DE APOYO A LA COMUNICACIÓN COMUNAL (CPACC)", permitiendo así el avance físico financiero de los trabajos proyectados.`),

        heading('2. OBJETIVO DE LA CONTRATACIÓN.'),
        body(tdr.objective || `Seleccionar una persona natural o jurídica para la ADQUISICIÓN ${cat}, que deberá cumplir de acuerdo a lo requerido, para así garantizar una correcta funcionalidad de las operaciones de la Dirección Regional de Telecomunicaciones.`),

        heading('3. ENFOQUE DE LA CONTRATACIÓN.'),
        body(`Seleccionar una persona natural o jurídica para la ADQUISICIÓN ${cat}, cuyas especificaciones se detallan a continuación:`),

        heading(`4. CARACTERÍSTICAS TÉCNICAS.`),
        body(`4.1. Descripción de los Bienes a Contratar`),
        body(`4.2. Características Técnicas:`),
        ...buildItemTechTable(tdr.items),

        heading('5. LUGAR DE ENTREGA Y PLAZO DE ENTREGA DEL BIEN.'),
        body(`5.1. Lugar: ${tdr.lugarEntrega || 'Los bienes materia de la presente convocatoria se entregarán en el almacén de la Central de DRTCA, ubicado en el Jr. Manuel Gonzales Prada N° 325 - Ayacucho - Jesús Nazarenas - Ayacucho. El costo de entrega del bien incluye (carga y descarga), hasta el almacén Central.'}`),
        body(`5.2. Plazo: ${tdr.deliverySchedule || 'Los bienes se entregarán en el plazo de CINCO (5) días calendario contabilizados a partir del día siguiente de la firma del contrato y/o la notificación de la Orden de Compra.'}`),

        heading('6. CONFORMIDAD.'),
        body('La recepción y conformidad de los bienes se rigen conforme a lo dispuesto en el artículo 144 del Reglamento de la Ley General de Contrataciones Públicas. La recepción de los bienes estará a cargo del responsable de almacén Central y la conformidad estará emitida por la Dirección de Telecomunicaciones y Sub Dirección de Mantenimiento y Operaciones de DTEL.'),

        heading('7. FORMA Y CONDICIONES DE PAGO.'),
        body(tdr.formaPago || 'El pago se realizará en UN PAGO ÚNICO, previa recepción del responsable del almacén central e informe de conformidad del Área Usuaria.'),

        heading('8. REQUISITOS DEL PROVEEDOR.'),
        body(tdr.requirements || '• Ser Persona Natural o Persona Jurídica.\n• Tener Registro Único de Contribuyente habilitado.\n• Poseer Código de Cuenta Interbancario registrado.\n• Tener Registro Nacional de Proveedores (RNP) vigente.'),

        heading('9. PRESUPUESTO ESTIMADO.'),
        body(tdr.presupuesto || 'Por determinar según cotizaciones.'),

        heading('10. PENALIDADES.'),
        body(tdr.penalidades || 'Penalidad por mora: Se aplicará de conformidad con el artículo 120 del Reglamento de la Ley N° 32069, Ley General de Contrataciones Públicas.'),

        heading('11. MARCO LEGAL.'),
        body(tdr.marcoLegal || 'El marco legal comprende la Ley N° 32069, Ley General de Contrataciones Públicas y su Reglamento aprobado por Decreto Supremo N° 009-2025-EF, así como las directivas que emita la Dirección General de Abastecimiento del MEF y demás normativa aplicable.'),

        heading('12. GESTIÓN DE RIESGOS.'),
        body(tdr.riesgos || 'Se identifican como riesgos principales: retraso en la entrega de los bienes por causas logísticas del proveedor, recepción de bienes con especificaciones técnicas no conformes. Se establece un plan de respuesta con penalidades y supervisión técnica.'),

        heading('13. ANTICORRUPCIÓN Y ANTISOBORNO.'),
        body(tdr.anticorrupcion || 'El contratista declara no haber ofrecido ningún beneficio ilegal a servidores de la entidad y se obliga a mantener una conducta proba e íntegra durante la vigencia del contrato.'),

        heading('14. SOLUCIÓN DE CONTROVERSIAS.'),
        body('Las controversias que surjan entre las partes durante la ejecución del contrato se resuelven mediante conciliación y arbitraje.'),

        heading('15. RESPONSABILIDAD POR VICIOS OCULTOS.'),
        body('De conformidad al literal c) del art. 69 de la Ley 32069, el contratista es responsable por la calidad ofrecida y por los vicios ocultos por un plazo no menor de un año.'),

        ...(tdr.isAutomatic ? [
          new Paragraph({ spacing: { before: 400 } }),
          body('Nota: El presente Término de Referencia ha sido generado automáticamente por el Sistema de Gestión de Almacén debido a que los bienes se encuentran con stock por debajo del mínimo requerido. Es responsabilidad del área usuaria validar y completar la información antes de su uso oficial.'),
        ] : []),
      ],
    }],
  })
}

function generateCombustibleTDR(tdr: TDRDocxData, institution: string): Document {
  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 }, paragraph: { spacing: { after: 200, line: 360 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: institution.toUpperCase(), bold: true, size: 28, font: 'Times New Roman' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'DIRECCIÓN DE TELECOMUNICACIONES', bold: true, size: 24, font: 'Times New Roman' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'SUB DIRECCIÓN DE MANTENIMIENTO Y OPERACIONES', bold: true, size: 22, font: 'Times New Roman' })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: getCurrentYearDenomination(), italics: true, size: 20, font: 'Times New Roman', color: '444444' })]
        }),
        new Paragraph({ spacing: { after: 200 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: `TÉRMINO DE REFERENCIA N° ${tdr.tdrNumber}`, bold: true, size: 28, font: 'Times New Roman' })] }),

        heading('1. FINALIDAD PÚBLICA.'),
        body(tdr.justification || `El presente proceso busca contar con la ADQUISICIÓN DE COMBUSTIBLE. Que permitirá cumplir con las actividades programadas en la ejecución del proyecto "CONGLOMERADO DE PROYECTO DE APOYO A LA COMUNICACIÓN COMUNAL (CPACC)", permitiendo así el avance físico financiero de los trabajos proyectados.`),

        heading('2. ANTECEDENTES.'),
        body(`La Dirección de Telecomunicaciones - Sub Dirección de Mantenimiento y Operaciones de la DRTCA, tiene la finalidad esencial de fomentar el desarrollo integral y sostenible, de acuerdo con los planes y programas de desarrollo nacional, regionales y locales. Es así que a través del proyecto "CONGLOMERADO DE PROYECTO DE APOYO A LA COMUNICACIÓN COMUNAL (CPACC)", con un presupuesto HABILITADO TOTAL asignado, cuyo objetivo central es fortalecer el cumplimiento de las funciones transferidas por el MTC, como también el cumplimiento del POI.`),

        heading('3. OBJETIVO.'),
        body(tdr.objective || `Objetivo General: El presente proceso busca adquirir COMBUSTIBLE, para la ejecución de las metas institucionales. Objetivo Específico: Requerir combustible para cumplir con los objetivos y realizar de manera eficiente y oportuna las actividades trazadas en la Dirección Regional de Telecomunicaciones.`),

        heading('4. DESCRIPCIÓN GENERAL DEL REQUERIMIENTO.'),
        body(`Seleccionar una persona natural o jurídica para la ADQUISICIÓN DE COMBUSTIBLE. El combustible deberá cumplir de acuerdo a lo requerido, para así garantizar una correcta funcionalidad de las operaciones.`),

        heading('5. CARACTERÍSTICAS TÉCNICAS.'),
        body('5.1. Características Generales:'),
        ...buildItemTechTable(tdr.items),

        heading('6. CONDICIONES DE CONTRATACIÓN.'),
        body(`Modalidad de Pago: ${tdr.formaPago || 'El presente procedimiento se rige por la modalidad de PRECIOS UNITARIOS, de conformidad con el artículo 130 del Reglamento.'}`),
        body(`Plazo de Entrega: ${tdr.deliverySchedule || 'Los bienes se entregarán en el plazo de VEINTE (20) DÍAS CALENDARIO contabilizados a partir del día siguiente del perfeccionamiento del contrato.'}`),
        body(`Lugar de Entrega: ${tdr.lugarEntrega || 'Los bienes se entregarán en el surtidor del proveedor ganador previa presentación de vales de combustible emitido por el responsable de Almacén Central de la DRTCA.'}`),

        heading('7. PRESUPUESTO ESTIMADO.'),
        body(tdr.presupuesto || 'Por determinar según cotizaciones del mercado.'),

        heading('8. REQUISITOS DEL PROVEEDOR.'),
        body(tdr.requirements || '• Ser Persona Natural o Persona Jurídica.\n• Tener RUC habilitado.\n• Contar con RNP vigente.\n• Experiencia mínima de 2 años en el rubro.'),

        heading('9. PENALIDADES.'),
        body(tdr.penalidades || 'Penalidad por mora: Se aplicará automáticamente por cada día de atraso, de conformidad con el artículo 120 del Reglamento.'),

        heading('10. GESTIÓN DE RIESGOS.'),
        body(tdr.riesgos || 'Se identifican como riesgos principales: variación del precio del combustible, retraso en la entrega, incumplimiento de especificaciones técnicas.'),

        heading('11. MARCO LEGAL.'),
        body(tdr.marcoLegal || 'Ley N° 32069, Ley General de Contrataciones Públicas y su Reglamento aprobado por D.S. N° 009-2025-EF. Disposiciones del OSCE y demás normativa aplicable.'),

        heading('12. ANTICORRUPCIÓN Y ANTISOBORNO.'),
        body(tdr.anticorrupcion || 'El contratista se obliga a mantener una conducta proba e íntegra durante la vigencia del contrato, absteniéndose de ofrecer cualquier beneficio ilegal a funcionarios públicos.'),

        ...(tdr.isAutomatic ? [
          new Paragraph({ spacing: { before: 400 } }),
          body('Nota: El presente Término de Referencia ha sido generado automáticamente por el Sistema de Gestión de Almacén. Es responsabilidad del área usuaria validar y completar la información antes de su uso oficial.'),
        ] : []),
      ],
    }],
  })
}

export async function generateTDRDocx(tdr: TDRDocxData, institutionName: string): Promise<string> {
  await mkdir(DOCUMENTS_DIR, { recursive: true })

  const doc = tdr.tdrType === 'COMBUSTIBLE'
    ? generateCombustibleTDR(tdr, institutionName)
    : generateBienesTDR(tdr, institutionName)

  const buffer = await Packer.toBuffer(doc)
  const sanitized = `${tdr.tdrNumber}_${tdr.tdrType}`.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `TDR_${sanitized}_${Date.now()}.docx`
  const filePath = path.join(DOCUMENTS_DIR, fileName)
  await writeFile(filePath, buffer)
  return fileName
}
