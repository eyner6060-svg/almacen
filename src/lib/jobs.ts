import { logger } from '@/lib/logger'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync, statSync, unlinkSync, readdirSync, existsSync } from 'fs'
import { promises as fsPromises } from 'fs'
import path from 'path'
import os from 'os'

type JobHandler = (payload: Record<string, unknown>) => Promise<void>

interface JobDefinition {
  handler: JobHandler
  maxRetries?: number
  retryDelayMs?: number
}

interface QueuedJob {
  id: string
  type: string
  payload: Record<string, unknown>
  attempts: number
  maxRetries: number
  retryDelayMs: number
  createdAt: number
}

interface ScheduledJob {
  type: string
  intervalMs: number
  handler: () => Promise<void> | void
}

interface JobResult {
  jobId: string
  status: 'processing' | 'completed' | 'failed'
  type: string
  result?: unknown
  error?: string
  createdAt: number
  completedAt?: number
}

const handlers = new Map<string, JobDefinition>()
const queue: QueuedJob[] = []
const activeJobs = new Set<string>()
const jobResults = new Map<string, JobResult>()
const schedules: ScheduledJob[] = []
let scheduleTimers: NodeJS.Timeout[] = []
const JOB_TIMEOUT_MS = 30000

let processing = false
let jobIdCounter = 0
let _jobSystemInitialized = false

function generateJobId(): string {
  return `job_${++jobIdCounter}_${Date.now()}`
}

export function registerJob(type: string, definition: JobDefinition): void {
  handlers.set(type, definition)
}

function ensureJobSystemInitialized(): void {
  if (!_jobSystemInitialized) {
    registerDefaultJobs()
    _jobSystemInitialized = true
  }
}

export function dispatch(type: string, payload: Record<string, unknown>): string {
  ensureJobSystemInitialized()
  const def = handlers.get(type)
  if (!def) return ''
  const jobId = generateJobId()
  const jobPayload = { ...payload, _jobId: jobId }
  queue.push({
    id: jobId,
    type,
    payload: jobPayload,
    attempts: 0,
    maxRetries: def.maxRetries ?? 2,
    retryDelayMs: def.retryDelayMs ?? 1000,
    createdAt: Date.now()
  })
  jobResults.set(jobId, { jobId, status: 'processing', type, createdAt: Date.now() })
  if (!processing) processQueue()
  return jobId
}

export function getJobResult(jobId: string): JobResult | null {
  return jobResults.get(jobId) || null
}

async function processQueue(): Promise<void> {
  processing = true
  while (queue.length > 0) {
    const job = queue.shift()
    if (!job || activeJobs.has(job.id)) continue
    activeJobs.add(job.id)
    const def = handlers.get(job.type)
    if (!def) { activeJobs.delete(job.id); continue }
    const timeout = setTimeout(() => {
      activeJobs.delete(job.id)
    }, JOB_TIMEOUT_MS)
    try {
      await def.handler(job.payload)
      clearTimeout(timeout)
      const existing = jobResults.get(job.id)
      if (existing) {
        existing.status = 'completed'
        existing.completedAt = Date.now()
      }
    } catch (error) {
      clearTimeout(timeout)
      job.attempts++
      if (job.attempts <= job.maxRetries) {
        queue.push(job)
        await new Promise(r => setTimeout(r, job.retryDelayMs * job.attempts))
      } else {
        const existing = jobResults.get(job.id)
        if (existing) {
          existing.status = 'failed'
          existing.error = error instanceof Error ? error.message : 'Error desconocido'
          existing.completedAt = Date.now()
        }
      }
    } finally {
      activeJobs.delete(job.id)
    }
  }
  processing = false
}

export function registerSchedule(type: string, intervalMs: number, handler: () => Promise<void> | void): void {
  const existingIndex = schedules.findIndex(s => s.type === type)
  if (existingIndex >= 0) {
    schedules.splice(existingIndex, 1)
  }
  schedules.push({ type, intervalMs, handler })
}

function startSchedules(): void {
  stopSchedules()
  for (const schedule of schedules) {
    const timer = setInterval(async () => {
      try {
        await schedule.handler()
      } catch (error) {
        logger.error(`[SCHEDULE] Error en ${schedule.type}:`, error)
      }
    }, schedule.intervalMs)
    scheduleTimers.push(timer)
  }
}

function stopSchedules(): void {
  for (const timer of scheduleTimers) {
    clearInterval(timer)
  }
  scheduleTimers = []
}

// Limpiar resultados de jobs antiguos cada hora
function cleanupJobResults(): void {
  const oneHourAgo = Date.now() - 3600000
  for (const [id, result] of jobResults.entries()) {
    if (result.completedAt && result.completedAt < oneHourAgo) {
      jobResults.delete(id)
    }
  }
}

export function registerDefaultJobs(): void {
  registerJob('cache:invalidate', {
    handler: async (payload: Record<string, unknown>) => {
      const { cacheDeletePattern } = await import('@/lib/cache')
      await cacheDeletePattern(payload.pattern as string)
    },
    maxRetries: 1,
    retryDelayMs: 500
  })

  registerJob('webhooks:deliver', {
    handler: async (payload: Record<string, unknown>) => {
      const { deliverWebhooksSync } = await import('@/lib/webhooks/service')
      await deliverWebhooksSync(payload.event as string, payload.data as Record<string, unknown>)
    },
    maxRetries: 1,
    retryDelayMs: 5000
  })

  registerJob('notifications:create', {
    handler: async (payload: Record<string, unknown>) => {
      const { db } = await import('@/lib/db')
      const { cacheDeletePattern } = await import('@/lib/cache')
      const notifications = payload.notifications as Array<Record<string, unknown>>
      if (notifications.length > 0) {
        // Los datos vienen serializados desde el payload del job (dinámico)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db.notification.createMany as any)({ data: notifications })
        await cacheDeletePattern('notifications')
      }
    },
    maxRetries: 2,
    retryDelayMs: 1000
  })

  // Procesamiento asíncrono de ingresos masivos
  registerJob('ingress:process', {
    handler: async (payload: Record<string, unknown>) => {
      const { db } = await import('@/lib/db')
      const { cacheDelete, CacheKeys } = await import('@/lib/cache')
      const { logCreate } = await import('@/lib/audit')

      const { ingressNumber, items, receivedById, warehouseId, supplier, documentNumber, notes, receiptUrl } = payload

      const itemsArr = items as Array<{
        itemId: number; quantity: number; patrimonialCodes?: string[]
      }>

      if (!itemsArr || itemsArr.length === 0) return

      await db.$transaction(async (tx) => {
        const itemIds = itemsArr.map(i => i.itemId)

        // Pre-cargar items en lote
        const preloadedItems = await tx.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, quantity: true, patrimonialCodes: true, patrimonialCode: true }
        })
        const itemsMap = new Map(preloadedItems.map(i => [i.id, i]))

        // Pre-coleccionar todos los códigos patrimoniales para un solo query
        const allPatCodes = itemsArr
          .filter(i => i.patrimonialCodes && i.patrimonialCodes.length > 0)
          .flatMap(i => i.patrimonialCodes!)
        const existingCodes = allPatCodes.length > 0
          ? await tx.patrimonialUnit.findMany({
              where: { patrimonialCode: { in: allPatCodes } },
              select: { patrimonialCode: true, itemId: true }
            })
          : []
        const existingCodeSet = new Set(existingCodes.map(e => e.patrimonialCode))

        for (const ingressItem of itemsArr) {
          const { itemId, quantity, patrimonialCodes } = ingressItem

          // Validar códigos patrimoniales
          if (patrimonialCodes && patrimonialCodes.length > 0) {
            const newCodes = patrimonialCodes.filter(
              (c: string) => !existingCodeSet.has(c)
            )

            if (newCodes.length > 0) {
              await tx.patrimonialUnit.createMany({
                data: newCodes.map(code => ({
                  itemId,
                  patrimonialCode: code,
                  status: 'OPERATIVO',
                  isAvailable: true
                }))
              })
            }

            // Actualizar el JSON de códigos del Item
            const item = itemsMap.get(itemId)
            if (item) {
              const existingJsonCodes: string[] = item.patrimonialCodes
                ? JSON.parse(item.patrimonialCodes)
                : (item.patrimonialCode ? [item.patrimonialCode] : [])

              const updatedCodes = [...new Set([...existingJsonCodes, ...newCodes])]
              await tx.item.update({
                where: { id: itemId },
                data: {
                  patrimonialCodes: JSON.stringify(updatedCodes),
                  patrimonialCode: updatedCodes[0] || null,
                }
              })
            }
          }

          // Actualizar stock usando datos precargados
          const currentItem = itemsMap.get(itemId)
          if (currentItem) {
            const previousStock = currentItem.quantity
            await tx.item.update({
              where: { id: itemId },
              data: { quantity: { increment: quantity } }
            })

            // Crear registro de ingreso
            await tx.ingress.create({
              data: {
                ingressNumber: `${ingressNumber}-${itemId}`,
                itemId,
                quantity,
                previousStock,
                newStock: previousStock + quantity,
                supplier: supplier as string | undefined,
                documentNumber: documentNumber as string | undefined,
                notes: notes as string | undefined,
                receiptUrl: receiptUrl as string | undefined,
                receivedById: receivedById as number,
                warehouseId: warehouseId as number,
              }
            })
          }
        }
      })

      // Auditoría
      if (receivedById) {
        await logCreate(receivedById as number, 'Ingress', 0, {
          items: itemsArr.map(i => ({ itemId: i.itemId, quantity: i.quantity }))
        })
      }

      // Invalidar cachés
      await Promise.all([
        cacheDelete(CacheKeys.ingressList()),
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.dashboardStats()),
        cacheDelete(CacheKeys.warehouseList()),
      ])
    },
    maxRetries: 2,
    retryDelayMs: 2000
  })

  // Sincronización asíncrona con sistemas externos
  registerJob('sync:process', {
    handler: async (payload: Record<string, unknown>) => {
      const { db } = await import('@/lib/db')
      const { cacheDelete, CacheKeys } = await import('@/lib/cache')
      const { logger } = await import('@/lib/logger')

      const { entityType, records, syncLogId, userId, ipAddress } = payload
      const recordsArr = records as Array<Record<string, unknown>>

      if (!recordsArr || recordsArr.length === 0) return

      let successCount = 0
      let errorCount = 0
      const errors: Record<string, unknown>[] = []

      try {
        if (entityType === 'items') {
          await db.$transaction(
            recordsArr.map((record) => {
              const { codigo, nombre, categoria, tipo, status } = record
              const code = (codigo || record.code) as string
              return db.item.upsert({
                where: { code },
                update: {
                  name: (nombre || record.name) as string,
                  category: (categoria || record.category) as string,
                  status: (status || 'OPERATIVO') as string,
                },
                create: {
                  name: (nombre || record.name) as string,
                  code,
                  category: (categoria || record.category) as string,
                  itemType: (tipo || record.itemType || 'CONSUMIBLE') as 'CONSUMIBLE' | 'PATRIMONIAL',
                  status: (status || 'OPERATIVO') as string,
                  warehouseId: 1,
                }
              })
            })
          )
          successCount = recordsArr.length
        } else if (entityType === 'patrimonial_codes') {
          const sigaCodes = [...new Set(recordsArr.map(r => (r.codigoSIGA || r.codigoSIGA) as string).filter(Boolean))]
          const items = sigaCodes.length > 0
            ? await db.item.findMany({ where: { code: { in: sigaCodes } }, select: { id: true, code: true } })
            : []
          const itemByCode = new Map(items.map(i => [i.code, i.id]))
          const validOps = []
          for (const record of recordsArr) {
            const sigaCode = (record.codigoSIGA || record.codigoSIGA) as string
            const patrimonialCode = (record.codigoPatrimonial || record.codigoPatrimonial) as string
            const estado = (record.estado || record.estado) as string
            const itemId = itemByCode.get(sigaCode)
            if (!itemId) {
              errorCount++
              errors.push({ record: JSON.stringify({ sigaCode, patrimonialCode }), error: 'Código SIGA no encontrado' })
              continue
            }
            validOps.push(db.patrimonialUnit.upsert({
              where: { patrimonialCode },
              update: { status: estado || 'OPERATIVO', itemId },
              create: { itemId, patrimonialCode, status: estado || 'OPERATIVO', isAvailable: true }
            }))
          }
          if (validOps.length > 0) {
            await db.$transaction(validOps)
          }
          successCount = validOps.length
        } else {
          throw new Error(`Tipo de entidad desconocido: ${entityType}`)
        }
      } catch (err) {
        errorCount = recordsArr.length
        errors.push({ error: String(err) })
        logger.error(`[SYNC JOB] Error al sincronizar ${entityType}:`, err)
      }

      // Actualizar registro de sincronización
      if (syncLogId) {
        try {
          const status = errorCount === 0 ? 'SUCCESS' : errorCount < recordsArr.length ? 'PARTIAL' : 'FAILED'
          await db.syncLog.update({
            where: { id: syncLogId as number },
            data: {
              recordsSuccess: successCount,
              recordsFailed: errorCount,
              status,
              errorDetails: errors.length > 0 ? JSON.stringify({ errors }) : null,
              completedAt: new Date()
            }
          })

          // Auditoría de finalización
          if (userId) {
            await db.auditLog.create({
              data: {
                userId: userId as number,
                action: 'IMPORT',
                entityType: 'SyncLog',
                entityId: syncLogId as number,
                ipAddress: ipAddress as string | undefined,
                description: `Sincronización completada: ${entityType} - ${successCount}/${recordsArr.length} registros`,
                severity: status === 'FAILED' ? 'CRITICAL' : 'WARNING'
              }
            })
          }
        } catch (logErr) {
          logger.error('[SYNC JOB] Error updating sync log:', logErr)
        }
      }

      logger.info(`[SYNC JOB] Completado ${entityType}: ${successCount} éxitos, ${errorCount} errores`)

      await cacheDelete(CacheKeys.itemList())
      await cacheDelete(CacheKeys.dashboardStats())
    },
    maxRetries: 1,
    retryDelayMs: 5000
  })

  // Limpieza de sesiones expiradas en BD (cada 10 min)
  registerJob('cleanup:auth-sessions', {
    handler: async () => {
      const { db } = await import('@/lib/db')
      try {
        const INACTIVITY_TIMEOUT_MINUTES = 30
        await db.userSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: new Date() } },
              { lastActivity: { lt: new Date(Date.now() - INACTIVITY_TIMEOUT_MINUTES * 60 * 1000) } }
            ]
          }
        })
      } catch (error) {
        logger.error('[JOBS] Error al limpiar sesiones expiradas:', error)
      }
    },
    maxRetries: 1,
    retryDelayMs: 2000
  })

  // Limpieza de bloqueos por IP (cada 1 min)
  registerJob('cleanup:ip-block', {
    handler: async () => {
      const { ipStore, WINDOW_MS } = await import('@/lib/ip-block')
      const now = Date.now()
      for (const [ip, entry] of ipStore.entries()) {
        if (now > entry.firstAttempt + WINDOW_MS && !entry.blockedUntil) {
          ipStore.delete(ip)
        }
        if (entry.blockedUntil && now > entry.blockedUntil) {
          ipStore.delete(ip)
        }
      }
    },
    maxRetries: 0
  })

  // Limpieza de límite de tasa (cada 1 min)
  registerJob('cleanup:rate-limit', {
    handler: async () => {
      const { rateLimitBackend } = await import('@/lib/rate-limit')
      rateLimitBackend?.cleanup?.()
    },
    maxRetries: 0
  })

  // Limpieza de caché en memoria (cada 5 min)
  registerJob('cleanup:cache', {
    handler: async () => {
      const { clearExpiredCacheEntries } = await import('@/lib/cache')
      clearExpiredCacheEntries()
    },
    maxRetries: 0
  })

  // Procesar carga masiva de bienes
  registerJob('bulk-upload:process', {
    handler: async (payload: Record<string, unknown>) => {
      const { processBulkUpload } = await import('./bulk-upload-processor')
      const p = payload as { tempFilePath: string; userId: number; _jobId: string }
      const result = await processBulkUpload(p.tempFilePath, p.userId)
      const existing = jobResults.get(p._jobId)
      if (existing) {
        existing.result = result
      }
      const fs = fsPromises
      try { await fs.unlink(p.tempFilePath) } catch { /* ignorar */ }
    },
    maxRetries: 1,
    retryDelayMs: 3000
  })

  // Generar reporte asincrónico
  registerJob('reports:generate', {
    handler: async (payload: Record<string, unknown>) => {
      const p = payload as { _jobId: string; type: string; format: string; filters: Record<string, string | null>; title: string }
      const { db } = await import('@/lib/db')
      const { format: dateFormat, startOfDay, endOfDay } = await import('date-fns')
      const XLSX = await import('xlsx')
      const fs = fsPromises

      const start = p.filters.startDate
        ? startOfDay(new Date(p.filters.startDate))
        : startOfDay(new Date())
      const end = p.filters.endDate
        ? endOfDay(new Date(p.filters.endDate))
        : endOfDay(new Date())

      let data: Record<string, unknown>[] = []

      switch (p.type) {
        case 'INVENTORY': {
          const where: Record<string, unknown> = { isDeleted: false }
          if (p.filters.status && p.filters.status !== 'all') where.status = p.filters.status
          if (p.filters.category && p.filters.category !== 'all') where.category = p.filters.category
          const items = await db.item.findMany({
            where,
            include: { warehouse: { select: { id: true, name: true } }, patrimonialUnits: { select: { patrimonialCode: true, status: true } } },
            orderBy: { name: 'asc' },
            take: 5000
          })
          data = items.flatMap(item => {
            if (item.itemType === 'PATRIMONIAL' && item.patrimonialUnits.length > 0) {
              return item.patrimonialUnits.map(unit => ({
                nombre: item.name,
                codigo: item.code,
                modelo: item.model,
                marca: item.brand,
                color: item.color || '',
                serie: item.series || '',
                tipo: item.itemType,
                categoria: item.category,
                cantidad: 1,
                unidad: item.unit || 'UNIDAD',
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
              unidad: item.unit || 'UNIDAD',
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
            include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, itemType: true, status: true } }, movedBy: { select: { id: true, fullName: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5000
          })
          data = movements.map(m => ({
            Fecha: dateFormat(m.createdAt, 'dd/MM/yyyy HH:mm'),
            'Código Patrimonial': m.patrimonialCode || 'S/N',
            Bien: m.item.name,
            'Ubicación Origen': m.fromLocation || '-',
            'Ubicación Destino': m.toLocation,
            Usuario: m.movedBy.fullName,
            Motivo: m.reason || '-'
          }))
          break
        }
        case 'CONSUMPTION': {
          const orders = await db.order.findMany({
            where: { createdAt: { gte: start, lte: end }, status: 'COMPLETADO' },
            include: { office: { select: { id: true, name: true, code: true } }, items: { select: { id: true, quantity: true } } },
            take: 5000
          })
          const byOffice = orders.reduce((acc, order) => {
            const name = order.office.name
            if (!acc[name]) acc[name] = { pedidos: 0, items: 0 }
            acc[name].pedidos++
            acc[name].items += order.items.reduce((sum, i) => sum + i.quantity, 0)
            return acc
          }, {} as Record<string, { pedidos: number; items: number }>)
          data = Object.entries(byOffice).map(([office, stats]) => ({
            Oficina: office,
            Pedidos: stats.pedidos,
            'Total Items': stats.items
          }))
          break
        }
        case 'AUDIT': {
          const auditWhere: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
          if (p.filters.action && p.filters.action !== 'all') auditWhere.action = p.filters.action
          const logs = await db.auditLog.findMany({ where: auditWhere, include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 1000 })
          data = logs.map(log => ({
            Fecha: dateFormat(log.createdAt, 'dd/MM/yyyy HH:mm'),
            Usuario: log.user?.fullName || 'Sistema',
            Acción: log.action,
            Entidad: log.entityType,
            'ID Entidad': log.entityId || '-',
            Descripción: log.description,
            IP: log.ipAddress || '-',
            Severidad: log.severity
          }))
          break
        }
        case 'ORDERS': {
          const orderWhere: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
          if (p.filters.status && p.filters.status !== 'all') orderWhere.status = p.filters.status
          if (p.filters.officeId && p.filters.officeId !== 'all') orderWhere.officeId = parseInt(p.filters.officeId)
          const orderList = await db.order.findMany({
            where: orderWhere,
            include: { requestedBy: { select: { id: true, fullName: true, office: { select: { name: true } } } }, items: { select: { id: true, quantity: true } } },
            orderBy: { createdAt: 'desc' },
            take: 5000
          })
          data = orderList.map(o => ({
            Número: o.orderNumber,
            Fecha: dateFormat(new Date(o.createdAt), 'dd/MM/yyyy'),
            Solicitante: o.requestedBy.fullName,
            Oficina: o.requestedBy.office?.name || '-',
            Estado: o.status,
            Items: o.items.length,
            'Total Unidades': o.items.reduce((sum, i) => sum + i.quantity, 0)
          }))
          break
        }
      }

      // Generar archivo
      const tmpDir = os.tmpdir()
      const fileName = `${p.title.replace(/\s+/g, '_')}_${Date.now()}`
      let filePath: string
      let contentType: string

      if (p.format === 'csv') {
        filePath = path.join(tmpDir, `${fileName}.csv`)
        const headers = data.length > 0 ? Object.keys(data[0]!) : []
        const csvRows = [
          headers.join(','),
          ...data.map(row =>
            headers.map(h => {
              const val = String(row[h] ?? '')
              return val.includes(',') || val.includes('"') || val.includes('\n')
                ? `"${val.replace(/"/g, '""')}"`
                : val
            }).join(',')
          )
        ]
        await fs.writeFile(filePath, '\ufeff' + csvRows.join('\n'), 'utf-8')
        contentType = 'text/csv; charset=utf-8'
      } else {
        filePath = path.join(tmpDir, `${fileName}.xlsx`)
        const wb = XLSX.utils.book_new()
        if (data.length > 0) {
          const ws = XLSX.utils.json_to_sheet(data)
          const colWidths = Object.keys(data[0]!).map(key => ({
            wch: Math.max(key.length, ...data.slice(0, 100).map(row => String(row[key] ?? '').length)) + 2
          }))
          ws['!cols'] = colWidths
          XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
        } else {
          const ws = XLSX.utils.aoa_to_sheet([['Sin datos para exportar']])
          XLSX.utils.book_append_sheet(wb, ws, 'Reporte')
        }
        XLSX.writeFile(wb, filePath)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      const existing = jobResults.get(p._jobId)
      if (existing) {
        existing.result = { filePath, contentType, fileName: path.basename(filePath) }
      }
    },
    maxRetries: 1,
    retryDelayMs: 5000
  })

  // Pre-cálculo de predicciones
  registerJob('predictions:precompute', {
    handler: async () => {
      const { calculatePredictions } = await import('@/lib/predictions')
      const { cacheSet, CacheKeys, CacheTTL } = await import('@/lib/cache')
      const predictions = await calculatePredictions()
      const summary = {
        predictions,
        generatedAt: new Date().toISOString(),
        parameters: { monthsOfHistory: 6, itemId: null, category: null },
        summary: {
          totalItems: predictions.length,
          itemsNeedingReorder: predictions.filter((p) => p.needsReorder).length,
          averageConfidence: predictions.length > 0
            ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100) / 100
            : 0
        }
      }
      await cacheSet(CacheKeys.predictionResults(), summary as unknown as Record<string, unknown>, { ttl: CacheTTL.HOUR })
    },
    maxRetries: 1,
    retryDelayMs: 10000
  })

  // Detección automática de stock bajo y generación de TDRs
  registerJob('tdr:auto-generate', {
    handler: async () => {
      try {
        const { db } = await import('@/lib/db')
        const { logger } = await import('@/lib/logger')

        const allItems = await db.item.findMany({
          where: {
            isDeleted: false,
            itemType: 'CONSUMIBLE',
          },
          select: { id: true, name: true, code: true, quantity: true, minStock: true, unit: true, category: true, technicalSpecs: true },
          orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
        })
        const lowStockItems = allItems.filter(i => i.quantity <= i.minStock)

        if (lowStockItems.length === 0) return

        // Verificar si ya existe un TDR automático reciente (últimas 24h) para los mismos items
        const recentTdr = await db.tDR.findFirst({
          where: {
            isAutomatic: true,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
          select: { id: true, items: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })

        if (recentTdr) {
          const recentItems = JSON.parse(recentTdr.items) as Array<{ itemId: number }>
          const recentItemIds = new Set(recentItems.map(i => i.itemId))
          const currentItemIds = new Set(lowStockItems.map(i => i.id))
          const allSame = lowStockItems.every(i => recentItemIds.has(i.id)) && recentItems.every(i => currentItemIds.has(i.itemId))
          if (allSame) {
            logger.info(`[TDR AUTO] Saltando generación automática: ya existe TDR reciente #${recentTdr.id} para los mismos bienes`)
            return
          }
        }

        const { generateTDRDocx } = await import('@/lib/tdr-generator')
        const { getNextDocumentNumber } = await import('@/lib/document-sequence')
        const { documentNumber } = await getNextDocumentNumber('TDR')

        const adminUser = await db.user.findFirst({
          where: { role: 'ADMINISTRADOR', isActive: true },
          select: { id: true },
          orderBy: { id: 'asc' },
        })

        if (!adminUser) {
          logger.warn('[TDR AUTO] No hay administradores activos para asignar el TDR')
          return
        }

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

        const config = await db.systemConfig.findFirst({ where: { id: 1 }, select: { institutionName: true } })
        const institutionName = config?.institutionName || 'Almacén Institucional'

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
            OR: [{ role: 'ADMINISTRADOR' }, { role: 'ALMACENERO' }],
            isActive: true,
            id: { not: adminUser.id },
          },
          select: { id: true },
        })

        if (notifUsers.length > 0) {
          await db.notification.createMany({
            data: notifUsers.map(u => ({
              userId: u.id,
              title: 'TDR Generado Automáticamente',
              message: `Se ha generado el TDR N° ${tdr.tdrNumber} para la adquisición de ${itemsData.length} bienes con stock bajo (${totalItems} unidades).`,
              type: 'STOCK_BAJO' as any,
              relatedId: tdr.id,
            })),
          })
        }

        await db.notification.create({
          data: {
            userId: adminUser.id,
            title: 'TDR Generado Automáticamente',
            message: `Se ha generado el TDR N° ${tdr.tdrNumber} para la adquisición de ${itemsData.length} bienes con stock bajo (${totalItems} unidades). Revise y complete los datos antes de su uso oficial.`,
            type: 'STOCK_BAJO' as any,
            relatedId: tdr.id,
          },
        })

        logger.info(`[TDR AUTO] TDR ${tdr.tdrNumber} generado automáticamente con ${itemsData.length} items`)
        const { cacheDeletePattern } = await import('@/lib/cache')
        await cacheDeletePattern('tdr*')
      } catch (error) {
        const { logger } = await import('@/lib/logger')
        logger.error('[TDR AUTO] Error en generación automática de TDR:', error)
      }
    },
    maxRetries: 2,
    retryDelayMs: 60000,
  })

  registerJob('backup:run', {
    handler: async (payload) => {
      const type = (payload.type as string) || 'SCHEDULED'
      const db = (await import('@/lib/db')).db
      const config = await db.systemConfig.findFirst({ where: { id: 1 } })

      const backupsBase = path.resolve(process.cwd(), 'backups')
      mkdirSync(backupsBase, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `backup-auto-${timestamp}.sql`
      const filePath = path.join(backupsBase, fileName)

      const dbUrl = process.env.DATABASE_URL || ''
      const url = new URL(dbUrl)
      const dbName = url.pathname.replace('/', '')
      const pgUser = url.username
      const pgPass = url.password
      const pgHost = url.hostname
      const pgPort = url.port || '5432'

      const backupLog = await db.backupLog.create({
        data: {
          fileName,
          fileSize: BigInt(0),
          type: type === 'MANUAL' ? 'MANUAL' : 'SCHEDULED',
          status: 'RUNNING',
          filePath,
        },
      })

      try {
        // Buscar pg_dump en PATH o rutas comunes de Windows
        let pgDumpPath = 'pg_dump'
        try {
          execFileSync('pg_dump', ['--version'], { encoding: 'utf8', timeout: 5000 })
        } catch {
          if (process.platform === 'win32') {
            const pgDir = 'C:\\Program Files\\PostgreSQL'
            if (existsSync(pgDir)) {
              const versions = readdirSync(pgDir).sort().reverse()
              for (const ver of versions) {
                const candidate = `${pgDir}\\${ver}\\bin\\pg_dump.exe`
                if (existsSync(candidate)) {
                  pgDumpPath = candidate
                  break
                }
              }
            }
          }
          if (pgDumpPath === 'pg_dump') {
            throw new Error(
              'pg_dump no está instalado o no se encuentra en el PATH. ' +
              'Instale PostgreSQL Tools (https://www.postgresql.org/download/) ' +
              'o agregue la ruta de instalación al PATH del sistema.'
            )
          }
        }

        const output = execFileSync(
          pgDumpPath,
          ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-d', dbName, '-F', 'p', '--no-owner', '--no-acl'],
          { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, timeout: 300000, env: { ...process.env, PGPASSWORD: pgPass } }
        )
        writeFileSync(filePath, output, 'utf8')
        const stats = statSync(filePath)

        await db.backupLog.update({
          where: { id: backupLog.id },
          data: { status: 'COMPLETED', fileSize: BigInt(stats.size), completedAt: new Date() },
        })

        // Limpiar copias de seguridad antiguas
        if (config?.backupRetentionDays && config.backupRetentionDays > 0) {
          const cutoff = new Date(Date.now() - config.backupRetentionDays * 86400000)
          const oldBackups = await db.backupLog.findMany({
            where: { createdAt: { lt: cutoff }, status: 'COMPLETED' },
          })
          for (const old of oldBackups) {
            try { unlinkSync(old.filePath) } catch { /* ignorar */ }
          }
          if (oldBackups.length > 0) {
            await db.backupLog.deleteMany({ where: { id: { in: oldBackups.map(o => o.id) } } })
          }
        }

        const user = payload.userId
          ? await db.user.findUnique({ where: { id: payload.userId as number }, select: { id: true } })
          : null

        if (user) {
          const { logAudit } = await import('@/lib/audit')
          await logAudit({
            userId: user.id,
            action: 'BACKUP_AUTO',
            entityType: 'BackupLog',
            entityId: backupLog.id,
            description: 'Copia de seguridad automática: ' + fileName,
            severity: 'INFO' as const,
          })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar pg_dump'
        await db.backupLog.update({
          where: { id: backupLog.id },
          data: { status: 'FAILED', errorMessage, completedAt: new Date() },
        })
        try { unlinkSync(filePath) } catch { /* ignorar */ }
      }
    },
    maxRetries: 2,
    retryDelayMs: 30000,
  })
}

export function initJobSystem(): void {
  registerDefaultJobs()

  // Registrar trabajos programados
  registerSchedule('cleanup:auth-sessions', 10 * 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('cleanup:auth-sessions', {})
  })

  registerSchedule('cleanup:ip-block', 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('cleanup:ip-block', {})
  })

  registerSchedule('cleanup:rate-limit', 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('cleanup:rate-limit', {})
  })

  registerSchedule('cleanup:cache', 5 * 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('cleanup:cache', {})
  })

  registerSchedule('cleanup:job-results', 60 * 60 * 1000, cleanupJobResults)

  // Pre-cálculo de predicciones cada 6 horas
  registerSchedule('predictions:precompute', 6 * 60 * 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('predictions:precompute', {})
  })

  // Generación automática de TDRs por stock bajo (cada 12 horas)
  registerSchedule('tdr:auto-generate', 12 * 60 * 60 * 1000, async () => {
    const { dispatch } = await import('./jobs')
    dispatch('tdr:auto-generate', {})
  })

  // Copia de seguridad automática programada (cada minuto verifica si debe ejecutar)
  registerSchedule('backup:scheduled', 60 * 1000, async () => {
    try {
      const { db } = await import('@/lib/db')
      const { cacheGetOrSet } = await import('@/lib/cache')
      const config = await cacheGetOrSet(
        'backup:config:scheduler',
        () => db.systemConfig.findFirst({
          select: { backupEnabled: true, backupSchedule: true },
        }),
        { ttl: 120 }
      )
      if (!config?.backupEnabled || !config.backupSchedule) return

      const intervalMinutes = parseInt(config.backupSchedule)
      if (isNaN(intervalMinutes) || intervalMinutes <= 0) return

      const lastBackup = await db.backupLog.findFirst({
        where: { type: 'SCHEDULED', status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })

      const now = Date.now()
      const elapsed = lastBackup ? now - lastBackup.createdAt.getTime() : Infinity

      if (elapsed >= intervalMinutes * 60 * 1000) {
        const { dispatch } = await import('./jobs')
        dispatch('backup:run', { type: 'SCHEDULED' })
      }
    } catch { /* ignorar */ }
  })

  startSchedules()
}
