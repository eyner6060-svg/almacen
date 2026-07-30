import { db } from './db'

interface DocumentSequenceConfig {
  prefix: string
  label: string
}

const SEQUENCES: Record<string, DocumentSequenceConfig> = {
  PRESTAMO: { prefix: 'PRESTAMO', label: 'Documento de Préstamo' },
  VALE_COMBUSTIBLE: { prefix: 'VALE_COMBUSTIBLE', label: 'Vale de Combustible' },
  ORDEN_SALIDA: { prefix: 'ORDEN_SALIDA', label: 'Orden de Salida' },
  INGRESO: { prefix: 'INGRESO', label: 'Ingreso de Bienes' },
  ACTA_RETORNO: { prefix: 'ACTA_RETORNO', label: 'Acta de Retorno de Bienes' },
  TDR: { prefix: 'TDR', label: 'Término de Referencia' },
}

export async function getNextDocumentNumber(type: string): Promise<{ documentNumber: string; documentLabel: string }> {
  const config = SEQUENCES[type]
  if (!config) {
    throw new Error(`Tipo de documento no válido: ${type}`)
  }

  const year = new Date().getFullYear()

  const sequence = await db.documentSequence.upsert({
    where: { prefix: config.prefix },
    create: {
      prefix: config.prefix,
      label: config.label,
      counter: 1,
      year,
    },
    update: {
      counter: { increment: 1 },
      year,
    },
  })

  // Si cambió el año, reiniciar contador
  if (sequence.year !== year) {
    const resetSequence = await db.documentSequence.update({
      where: { prefix: config.prefix },
      data: { counter: 1, year },
    })
    const num = String(resetSequence.counter).padStart(3, '0')
    return {
      documentNumber: `${config.prefix}-${num}`,
      documentLabel: config.label,
    }
  }

  const num = String(sequence.counter).padStart(3, '0')
  return {
    documentNumber: `${config.prefix}-${num}`,
    documentLabel: config.label,
  }
}


