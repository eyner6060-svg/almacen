import { db } from '@/lib/db'

interface PredictionResult {
  itemId: number
  itemName: string
  itemCode: string
  category: string
  currentStock: number
  minStock: number
  predictedDemand: number
  confidence: number
  recommendedStock: number
  needsReorder: boolean
  daysUntilStockout: number | null
  historicalData: Array<{
    month: string
    demand: number
  }>
  trend: 'increasing' | 'stable' | 'decreasing'
  seasonalFactor: number
}

export async function calculatePredictions(
  itemId?: number,
  category?: string,
  monthsOfHistory: number = 6
): Promise<PredictionResult[]> {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - monthsOfHistory)

  const itemWhere: Record<string, unknown> = { isDeleted: false }
  if (itemId) itemWhere.id = itemId
  if (category) itemWhere.category = category

  const items = await db.item.findMany({
    where: itemWhere,
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      quantity: true,
      minStock: true,
      orderItems: {
        where: {
          order: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETADO'
          }
        },
        select: { quantity: true, order: { select: { createdAt: true } } },
        take: 1000,
      }
    },
    take: 500,
  })

  const predictions: PredictionResult[] = []

  for (const item of items) {
    const monthlyDemand: Record<string, number> = {}

    for (const orderItem of item.orderItems) {
      const monthKey = orderItem.order.createdAt.toISOString().slice(0, 7)
      monthlyDemand[monthKey] = (monthlyDemand[monthKey] || 0) + orderItem.quantity
    }

    const allMonths: string[] = []
    const tempDate = new Date(startDate)
    while (tempDate <= endDate) {
      const monthKey = tempDate.toISOString().slice(0, 7)
      allMonths.push(monthKey)
      if (!monthlyDemand[monthKey]) monthlyDemand[monthKey] = 0
      tempDate.setMonth(tempDate.getMonth() + 1)
    }

    const historicalData = allMonths.map(month => ({
      month,
      demand: monthlyDemand[month] || 0
    }))

    const totalDemand = Object.values(monthlyDemand).reduce((sum, d) => sum + d, 0)
    const avgMonthlyDemand = totalDemand / monthsOfHistory

    const firstHalf = allMonths.slice(0, Math.floor(allMonths.length / 2))
      .reduce((sum, m) => sum + (monthlyDemand[m] || 0), 0)
    const secondHalf = allMonths.slice(Math.floor(allMonths.length / 2))
      .reduce((sum, m) => sum + (monthlyDemand[m] || 0), 0)

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (secondHalf > firstHalf * 1.2) trend = 'increasing'
    else if (secondHalf < firstHalf * 0.8) trend = 'decreasing'

    const currentMonth = new Date().getMonth()
    const seasonalFactors: Record<number, number> = {
      0: 0.9, 1: 0.95, 2: 1.0, 3: 1.1, 4: 1.15, 5: 1.1,
      6: 0.85, 7: 0.8, 8: 0.9, 9: 1.05, 10: 1.1, 11: 1.2
    }
    const seasonalFactor = seasonalFactors[currentMonth] || 1.0

    let predictedDemand = avgMonthlyDemand * seasonalFactor
    if (trend === 'increasing') predictedDemand *= 1.1
    else if (trend === 'decreasing') predictedDemand *= 0.95

    predictedDemand = Math.round(predictedDemand)

    const dataPoints = Object.values(monthlyDemand).filter(d => d > 0).length
    const dataQuality = dataPoints / monthsOfHistory

    const demands = Object.values(monthlyDemand)
    const mean = demands.reduce((a, b) => a + b, 0) / demands.length
    const variance = demands.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / demands.length
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1

    const confidence = Math.min(0.95, Math.max(0.3, dataQuality * (1 - coefficientOfVariation * 0.5)))

    const safetyFactor = 1.5 - confidence * 0.5
    const recommendedStock = Math.ceil(predictedDemand * safetyFactor)

    let daysUntilStockout: number | null = null
    if (avgMonthlyDemand > 0) {
      const dailyDemand = avgMonthlyDemand / 30
      daysUntilStockout = Math.floor(item.quantity / dailyDemand)
    }

    const needsReorder = item.quantity <= recommendedStock || item.quantity <= item.minStock

    predictions.push({
      itemId: item.id,
      itemName: item.name,
      itemCode: item.code,
      category: item.category,
      currentStock: item.quantity,
      minStock: item.minStock,
      predictedDemand,
      confidence: Math.round(confidence * 100) / 100,
      recommendedStock,
      needsReorder,
      daysUntilStockout,
      historicalData,
      trend,
      seasonalFactor
    })
  }

  predictions.sort((a, b) => {
    if (a.needsReorder !== b.needsReorder) return a.needsReorder ? -1 : 1
    return b.predictedDemand - a.predictedDemand
  })

  return predictions
}
