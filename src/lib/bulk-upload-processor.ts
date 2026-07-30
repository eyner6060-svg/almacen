import { db } from '@/lib/db'
import { cacheDelete, CacheKeys } from '@/lib/cache'

import * as XLSX from 'xlsx'

interface ExcelRow {
  nombre: string
  codigo?: string
  modelo?: string
  marca?: string
  color?: string
  serie?: string
  tipo?: string
  categoria?: string
  cantidad?: number | string
  stockMinimo?: number | string
  codigoPatrimonial?: string
  codigosPatrimoniales?: string
  almacen?: string
  ubicacion?: string
  especificaciones?: string
  estado?: string
}

interface BulkUploadResult {
  successCount: number
  errorCount: number
  total: number
  success: Array<{ row: number; name: string; code: string; type: string; quantity: number; patrimonialCodes?: string[] }>
  errors: Array<{ row: number; error: string }>
  message: string
}

function esCodigoInvalido(code: string): boolean {
  const limpio = code.trim().toUpperCase()
  return limpio === '' || limpio === 'S/S' || limpio === 'S/C' || limpio === 'SIN CODIGO'
    || limpio === 'SIN CÓDIGO' || limpio === 'N/A' || limpio === 'NINGUNO' || limpio === 'SIN'
    || limpio === 'S.C.'
}

function generarSiguienteCodigo(
  nextNum: { value: number },
  existingSet: Set<string>
): string {
  while (existingSet.has(`PAT-${String(nextNum.value).padStart(6, '0')}`)) {
    nextNum.value++
  }
  const code = `PAT-${String(nextNum.value).padStart(6, '0')}`
  nextNum.value++
  return code
}

function procesarCodigosPatrimoniales(
  input: string,
  nextNum: { value: number },
  existingSet: Set<string>
): { codes: string[]; autoGenerados: number } {
  const raw = String(input || '')
  if (!raw.trim()) return { codes: [], autoGenerados: 0 }

  const parts = raw.split(/[,\n;]/).map(c => c.trim()).filter(c => c)
  const codes: string[] = []
  let autoGenerados = 0

  for (const part of parts) {
    if (esCodigoInvalido(part)) {
      codes.push(generarSiguienteCodigo(nextNum, existingSet))
      autoGenerados++
    } else {
      codes.push(part)
    }
  }

  return { codes, autoGenerados }
}

export async function processBulkUpload(filePath: string, _userId: number): Promise<BulkUploadResult> {
  const fs = await import('fs/promises')

  // Limpiar archivo temporal al finalizar
  const cleanup = async () => {
    try { await fs.unlink(filePath) } catch { /* ignorar */ }
  }

  try {
    const buffer = await fs.readFile(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      await cleanup()
      return { successCount: 0, errorCount: 0, total: 0, success: [], errors: [], message: 'El archivo no contiene hojas de cálculo' }
    }
    const worksheet = workbook.Sheets[sheetName]!

    const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' }) as ExcelRow[]

    if (rawData.length === 0) {
      await cleanup()
      return { successCount: 0, errorCount: 0, total: 0, success: [], errors: [], message: 'El archivo está vacío' }
    }

  const warehouses = await db.warehouse.findMany()
  const warehouseMap = new Map(warehouses.map(w => [w.name.toLowerCase(), w.id]))

  const lastItem = await db.item.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  let nextItemNum = (lastItem?.id || 0) + 1

  const BATCH_SIZE = 5000
  const existingCodes = new Set<string>()
  let cursor = 0
  while (true) {
    const batch = await db.item.findMany({ skip: cursor, take: BATCH_SIZE, select: { code: true } })
    if (batch.length === 0) break
    for (const item of batch) { if (item.code) existingCodes.add(item.code) }
    cursor += batch.length
  }

  const existingPatrimonialCodes = new Set<string>()
  cursor = 0
  while (true) {
    const batch = await db.patrimonialUnit.findMany({ skip: cursor, take: BATCH_SIZE, select: { patrimonialCode: true } })
    if (batch.length === 0) break
    for (const unit of batch) { existingPatrimonialCodes.add(unit.patrimonialCode) }
    cursor += batch.length
  }

  cursor = 0
  while (true) {
    const batch = await db.item.findMany({ skip: cursor, take: BATCH_SIZE, where: { patrimonialCode: { not: null } }, select: { patrimonialCode: true } })
    if (batch.length === 0) break
    for (const item of batch) { if (item.patrimonialCode) existingPatrimonialCodes.add(item.patrimonialCode) }
    cursor += batch.length
  }

  // Calcular el siguiente número para códigos patrimoniales auto-generados
  let maxPatNum = 0
  for (const code of existingPatrimonialCodes) {
    const m = code.match(/PAT-(\d+)/)
    if (m) maxPatNum = Math.max(maxPatNum, parseInt(m[1] ?? '0'))
  }
  const nextPatNum = { value: maxPatNum + 1 }

  const results = {
    success: [] as BulkUploadResult['success'],
    errors: [] as BulkUploadResult['errors']
  }

  // Agrupar filas que comparten mismos datos (nombre, modelo, marca, color, serie, categoria, almacen)
  // para crear UN solo item con múltiples unidades patrimoniales
  type GroupKey = string
  interface GroupedRow {
    rows: ExcelRow[]
    rowNums: number[]
    patrimonialCodes: string[]
    totalQuantity: number
    name: string
    model: string
    brand: string
    color: string | null
    series: string
    category: string
    warehouseName: string
    minStock: number
    location: string | null
    technicalSpecs: string | null
    itemType: 'CONSUMIBLE' | 'PATRIMONIAL'
    itemCode: string | null
    status: string
  }

  function buildGroupKey(row: ExcelRow, warehouseId: number, itemType: 'CONSUMIBLE' | 'PATRIMONIAL'): GroupKey {
    const baseName = String(row.nombre || '').trim().toLowerCase()
    if (itemType === 'PATRIMONIAL') {
      return `${baseName}|${warehouseId}|PATRIMONIAL`
    }
    return [
      baseName,
      String(row.modelo || 'S/M').trim().toLowerCase(),
      String(row.marca || 'S/M').trim().toLowerCase(),
      (row.color || '').toString().trim().toLowerCase(),
      String(row.serie || 'S/S').trim().toLowerCase(),
      String(row.categoria || 'General').trim().toLowerCase(),
      warehouseId,
      'CONSUMIBLE',
      String(row.estado || 'OPERATIVO').trim().toUpperCase(),
    ].join('|')
  }

  const groups = new Map<GroupKey, GroupedRow>()

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i]
    if (!row) continue
    const rowNum = i + 2

    if (!row.nombre || String(row.nombre).trim() === '') {
      results.errors.push({ row: rowNum, error: 'El nombre es obligatorio' })
      continue
    }

    const tipoStr = String(row.tipo || '').toUpperCase()
    const hasPatrimonialCode = !!(row.codigoPatrimonial || row.codigosPatrimoniales || '').toString().trim()
    const itemType: 'CONSUMIBLE' | 'PATRIMONIAL' =
      tipoStr.includes('PATRIMONIAL') || hasPatrimonialCode ? 'PATRIMONIAL' : 'CONSUMIBLE'

    const warehouseName = row.almacen ? String(row.almacen).trim().toLowerCase() : ''
    let warehouseId = warehouseMap.get(warehouseName)
    if (!warehouseId) {
      warehouseId = warehouses.length > 0 ? warehouses[0]!.id : 0
      if (!warehouseId) {
        results.errors.push({ row: rowNum, error: 'No hay almacenes configurados' })
        continue
      }
    }

    const groupKey = buildGroupKey(row, warehouseId, itemType)

    if (groups.has(groupKey)) {
      const existing = groups.get(groupKey)!
      existing.rows.push(row)
      existing.rowNums.push(rowNum)

      if (itemType === 'PATRIMONIAL') {
        const codesInput = row.codigosPatrimoniales || row.codigoPatrimonial || ''
        if (codesInput && String(codesInput).trim()) {
          const { codes } = procesarCodigosPatrimoniales(codesInput, nextPatNum, existingPatrimonialCodes)
          existing.patrimonialCodes.push(...codes)
          existing.totalQuantity = existing.patrimonialCodes.length
        } else {
          const newCode = generarSiguienteCodigo(nextPatNum, existingPatrimonialCodes)
          existing.patrimonialCodes.push(newCode)
          existing.totalQuantity = existing.patrimonialCodes.length
        }
      } else {
        const qty = parseInt(String(row.cantidad || '1')) || 1
        existing.totalQuantity += qty
      }
    } else {
      const quantity = parseInt(String(row.cantidad || '1')) || 1
      const minStock = parseInt(String(row.stockMinimo || '5')) || 5
      const patrimonialCodes: string[] = []

      if (itemType === 'PATRIMONIAL') {
        const codesInput = row.codigosPatrimoniales || row.codigoPatrimonial || ''
        if (codesInput && String(codesInput).trim()) {
          const { codes } = procesarCodigosPatrimoniales(codesInput, nextPatNum, existingPatrimonialCodes)
          patrimonialCodes.push(...codes)
        } else {
          const newCode = generarSiguienteCodigo(nextPatNum, existingPatrimonialCodes)
          patrimonialCodes.push(newCode)
        }
      }

      const status = String(row.estado || 'OPERATIVO').trim().toUpperCase()

      groups.set(groupKey, {
        rows: [row],
        rowNums: [rowNum],
        patrimonialCodes,
        totalQuantity: itemType === 'PATRIMONIAL' ? Math.max(1, patrimonialCodes.length) : quantity,
        name: String(row.nombre).trim(),
        model: String(row.modelo || 'S/M').trim(),
        brand: String(row.marca || 'S/M').trim(),
        color: row.color ? String(row.color).trim() : null,
        series: String(row.serie || 'S/S').trim(),
        category: String(row.categoria || 'General').trim(),
        warehouseName: String(row.almacen || '').trim(),
        minStock,
        location: row.ubicacion ? String(row.ubicacion).trim() : null,
        technicalSpecs: row.especificaciones ? String(row.especificaciones).trim() : null,
        itemType,
        itemCode: row.codigo ? String(row.codigo).trim() : null,
        status,
      })
    }
  }

  // Crear items a partir de los grupos
  for (const group of groups.values()) {
    try {
      // Validar códigos patrimoniales antes de crear
      if (group.itemType === 'PATRIMONIAL' && group.patrimonialCodes.length > 0) {
        const dupeCodes = group.patrimonialCodes.filter(c => existingPatrimonialCodes.has(c))
        if (dupeCodes.length > 0) {
          for (const rn of group.rowNums) {
            results.errors.push({ row: rn, error: `El código patrimonial "${dupeCodes[0]}" ya existe` })
          }
          continue
        }
      }

      let itemCode = group.itemCode
      if (itemCode) {
        if (existingCodes.has(itemCode)) {
          for (const rn of group.rowNums) {
            results.errors.push({ row: rn, error: `El código "${itemCode}" ya existe` })
          }
          continue
        }
      } else {
        itemCode = `IT-${String(nextItemNum).padStart(5, '0')}`
        nextItemNum++
      }

      let warehouseId = warehouseMap.get(group.warehouseName.toLowerCase())
      if (!warehouseId) warehouseId = warehouses[0]?.id ?? 0

      const finalPatrimonialCodes = group.patrimonialCodes.length > 0 ? JSON.stringify(group.patrimonialCodes) : null
      const finalPatrimonialCode = group.patrimonialCodes[0] || null

      const item = await db.item.create({
        data: {
          name: group.name,
          model: group.model,
          brand: group.brand,
          color: group.color,
          series: group.series,
          code: itemCode,
          patrimonialCode: finalPatrimonialCode,
          patrimonialCodes: finalPatrimonialCodes,
          itemType: group.itemType,
          category: group.category,
          quantity: group.totalQuantity,
          minStock: group.minStock,
          status: group.status,
          location: group.location,
          warehouseId,
          technicalSpecs: group.technicalSpecs,
        }
      })

      if (group.patrimonialCodes.length > 0) {
        const uniqueCodes = [...new Set(group.patrimonialCodes)]
        await db.patrimonialUnit.createMany({
          data: uniqueCodes.map(pCode => ({
            itemId: item.id,
            patrimonialCode: pCode,
            status: group.status,
            isAvailable: true,
          }))
        })
      }

      for (const rn of group.rowNums) {
        results.success.push({
          row: rn,
          name: item.name,
          code: item.code,
          type: item.itemType,
          quantity: item.quantity,
          patrimonialCodes: group.patrimonialCodes.length > 0 ? group.patrimonialCodes : undefined,
        })
      }

      // Marcar códigos como usados
      if (itemCode) existingCodes.add(itemCode)
      for (const pc of group.patrimonialCodes) existingPatrimonialCodes.add(pc)

    } catch (error: unknown) {
      for (const rn of group.rowNums) {
        results.errors.push({ row: rn, error: error instanceof Error ? error.message : 'Error desconocido' })
      }
    }
    }

  // Invalidar cachés para que los contadores se actualicen
  await Promise.all([
    cacheDelete(CacheKeys.itemList()),
    cacheDelete(CacheKeys.itemCategories()),
    cacheDelete(CacheKeys.lowStockItems()),
    cacheDelete(CacheKeys.warehouseList()),
    cacheDelete(CacheKeys.dashboardStats()),
  ])

  await cleanup()
  return {
    successCount: results.success.length,
    errorCount: results.errors.length,
    total: rawData.length,
    success: results.success,
    errors: results.errors,
    message: `Proceso completado: ${results.success.length} bienes importados, ${results.errors.length} errores`
  }
  } catch (error) {
    await cleanup()
    throw error
  }
}
