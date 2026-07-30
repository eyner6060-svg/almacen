import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheGetOrSet, CacheKeys } from '@/lib/cache'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const stats = await cacheGetOrSet(
      CacheKeys.dashboardStats(),
      async () => {
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

        const [
          totalItems,
          lowStockItemsRaw,
          monthlyOrders,
          pendingOrders,
          patrimonialItemsOnLoan,
          usersWithMostOrders,
          mostRequestedItems,
          ordersByStatus,
          itemsByCategory,
          fuelInventory,
          fuelRequestsData,
          totalPatrimonialUnits,
          patrimonialUnitsByStatus,
          patrimonialUnitsOutCount,
          overdueReturnsCount
        ] = await Promise.all([
          db.item.count({ where: { isDeleted: false } }),
          db.$queryRaw<Array<{
            id: bigint; name: string; quantity: number; minStock: number; warehouse_name: string | null
          }>>(Prisma.sql`
            SELECT i.id, i.name, i.quantity, i."minStock", w.name as warehouse_name
            FROM "Item" i
            LEFT JOIN "Warehouse" w ON w.id = i."warehouseId"
            WHERE i.quantity <= i."minStock" AND i."isDeleted" = false
            ORDER BY (i."minStock" - i.quantity) DESC
            LIMIT 100
          `),
          db.order.count({ where: { createdAt: { gte: firstDayOfMonth } } }),
          db.order.count({ where: { status: 'PENDIENTE' } }),
          db.orderItem.findMany({
            where: {
              item: { itemType: 'PATRIMONIAL' },
              issueDate: { not: null },
              actualReturnDate: null
            },
            select: {
              id: true,
              patrimonialCode: true,
              item: { select: { id: true, name: true, brand: true } },
              order: { 
                select: { 
                  id: true, 
                  orderNumber: true, 
                  requestedBy: { select: { id: true, fullName: true, office: { select: { name: true } } } } 
                } 
              }
            }
          }),
          db.order.groupBy({
            by: ['requestedById'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5
          }),
          db.orderItem.groupBy({
            by: ['itemId'],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5
          }),
          db.order.groupBy({ by: ['status'], _count: { id: true } }),
          db.item.groupBy({ by: ['category'], _count: { id: true } }),
          db.fuelInventory.findMany({ select: { id: true, fuelType: true, quantity: true, updatedAt: true } }),
          db.fuelRequest.findMany({
            where: { createdAt: { gte: sixMonthsAgo }, status: { in: ['AUTORIZADO', 'COMPLETADO'] } },
            select: { fuelType: true, quantity: true, createdAt: true, requestedById: true },
            take: 1000,
          }),
          db.patrimonialUnit.count(),
          db.patrimonialUnit.groupBy({ by: ['status'], _count: { id: true } }),
          db.patrimonialUnit.count({ where: { isAvailable: false } }),
          db.orderItem.count({
            where: {
              item: { itemType: 'PATRIMONIAL' },
              issueDate: { not: null },
              actualReturnDate: null,
              expectedReturnDate: { lt: now }
            }
          })
        ])

        const lowStockItems = lowStockItemsRaw.map(item => ({
          id: Number(item.id),
          name: item.name,
          quantity: item.quantity,
          minStock: item.minStock,
          warehouse: item.warehouse_name ? { name: item.warehouse_name } : null,
        }))

        const userIds = usersWithMostOrders.map(u => u.requestedById)
        const users = userIds.length > 0 ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, position: true }
        }) : []

        const itemIds = mostRequestedItems.map(i => i.itemId)
        const itemsData = itemIds.length > 0 ? await db.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true, brand: true, category: true }
        }) : []

        const fuelUserIds = [...new Set(fuelRequestsData.map(r => r.requestedById))]
        const fuelUsers = fuelUserIds.length > 0 ? await db.user.findMany({
          where: { id: { in: fuelUserIds } },
          select: { id: true, fullName: true }
        }) : []

        const fuelByUser = new Map<number, number>()
        fuelRequestsData.forEach(req => {
          fuelByUser.set(req.requestedById, (fuelByUser.get(req.requestedById) || 0) + req.quantity)
        })

        const monthlyFuelData = new Map<string, { gasoline: number; petroleum: number }>()
        fuelRequestsData.forEach(req => {
          const monthKey = `${req.createdAt.getFullYear()}-${String(req.createdAt.getMonth() + 1).padStart(2, '0')}`
          const current = monthlyFuelData.get(monthKey) || { gasoline: 0, petroleum: 0 }
          if (req.fuelType === 'GASOLINA') {
            current.gasoline += req.quantity
          } else {
            current.petroleum += req.quantity
          }
          monthlyFuelData.set(monthKey, current)
        })

        return {
          totalItems,
          lowStockItems,
          monthlyOrders,
          pendingOrders,
          patrimonialItemsOnLoan,
          totalPatrimonialUnits,
          patrimonialUnitsOut: patrimonialUnitsOutCount,
          patrimonialUnitsOverdue: overdueReturnsCount,
          patrimonialUnitsByStatus,
          usersWithMostOrders: usersWithMostOrders.map(u => ({
            user: users.find(us => us.id === u.requestedById),
            count: u._count.id
          })),
          mostRequestedItems: mostRequestedItems.map(i => ({
            item: itemsData.find(it => it.id === i.itemId),
            totalQuantity: i._sum.quantity
          })),
          ordersByStatus,
          itemsByCategory,
          fuelInventory,
          usersWithMostFuelRequests: Array.from(fuelByUser.entries())
            .map(([id, totalGallons]) => ({
              user: fuelUsers.find(u => u.id === id),
              totalGallons
            }))
            .sort((a, b) => b.totalGallons - a.totalGallons)
            .slice(0, 5),
          fuelRequestsByMonth: Array.from(monthlyFuelData.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month))
        }
      },
      { ttl: 300 }
    )

    return NextResponse.json(stats)
  } catch (error) {
    logger.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
