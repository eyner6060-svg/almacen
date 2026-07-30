import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { calculatePredictions } from '@/lib/predictions'
import { cacheGet, cacheSet, CacheKeys, CacheTTL } from '@/lib/cache'
import { logger } from '@/lib/logger'

interface PredictionCacheData {
  predictions: Array<{
    itemId: number
    predictedDemand: number
    confidence: number
    needsReorder: boolean
  }>
  generatedAt: string
  parameters: {
    monthsOfHistory: number
    itemId: string | null
    category: string | null
  }
  summary: {
    totalItems: number
    itemsNeedingReorder: number
    averageConfidence: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const category = searchParams.get('category')
    const months = searchParams.get('months')

    // Intentar usar cache si no hay filtros específicos
    if (!itemId && !category && !months) {
      const cached = await cacheGet<PredictionCacheData>(CacheKeys.predictionResults())
      if (cached) return NextResponse.json(cached)
    }

    const monthsOfHistory = months ? parseInt(months) : 6

    const predictions = await calculatePredictions(
      itemId ? parseInt(itemId) : undefined,
      category || undefined,
      monthsOfHistory
    )

    // Guardar predicciones en BD para seguimiento (usando createMany)
    const predictionRecords = predictions.slice(0, 50).map(pred => ({
      itemId: pred.itemId,
      predictionDate: new Date(),
      predictedDemand: pred.predictedDemand,
      confidence: pred.confidence,
      basedOnMonths: monthsOfHistory
    }))

    if (predictionRecords.length > 0) {
      try {
        await db.demandPrediction.createMany({ data: predictionRecords })
      } catch { logger.warn('Error al guardar registros de predicción') }
    }

    const response = {
      predictions,
      generatedAt: new Date().toISOString(),
      parameters: {
        monthsOfHistory,
        itemId: itemId || null,
        category: category || null
      },
      summary: {
        totalItems: predictions.length,
        itemsNeedingReorder: predictions.filter(p => p.needsReorder).length,
        averageConfidence: predictions.length > 0
          ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100) / 100
          : 0
      }
    }

    // Guardar en caché resultado si no hay filtros
    if (!itemId && !category && !months) {
      await cacheSet(CacheKeys.predictionResults(), response, { ttl: CacheTTL.HOUR })
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Error en predicción:', error)
    return NextResponse.json({ error: 'Error al generar predicciones' }, { status: 500 })
  }
}
