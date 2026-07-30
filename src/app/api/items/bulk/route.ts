import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/api-handler'
import { cacheDelete, CacheKeys } from '@/lib/cache'

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json()
  const { action, ids } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No se proporcionaron items' }, { status: 400 })
  }

  const itemIds = ids.map((id: string | number) => parseInt(String(id)))

  switch (action) {
    case 'softDelete': {
      await db.item.updateMany({
        where: { id: { in: itemIds } },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      })
      await Promise.all([
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.itemCategories()),
        cacheDelete(CacheKeys.lowStockItems()),
        cacheDelete(CacheKeys.warehouseList()),
        cacheDelete(CacheKeys.dashboardStats()),
      ])
      return NextResponse.json({ 
        success: true, 
        count: itemIds.length,
        message: `${itemIds.length} bien(es) movido(s) a la papelera` 
      })
    }

    case 'restore': {
      await db.item.updateMany({
        where: { id: { in: itemIds } },
        data: {
          isDeleted: false,
          deletedAt: null
        }
      })
      await Promise.all([
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.itemCategories()),
        cacheDelete(CacheKeys.lowStockItems()),
        cacheDelete(CacheKeys.warehouseList()),
        cacheDelete(CacheKeys.dashboardStats()),
      ])
      return NextResponse.json({ 
        success: true, 
        count: itemIds.length,
        message: `${itemIds.length} bien(es) restaurado(s)` 
      })
    }

    case 'permanentDelete': {
      await db.$transaction(async (tx) => {
        await tx.itemMovement.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.itemStatusLog.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.warranty.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.demandPrediction.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.qRScanLog.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.assignedAsset.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.orderItem.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.ingress.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.patrimonialUnit.deleteMany({ where: { itemId: { in: itemIds } } })
        await tx.item.deleteMany({ where: { id: { in: itemIds } } })
      })
      await Promise.all([
        cacheDelete(CacheKeys.itemList()),
        cacheDelete(CacheKeys.itemCategories()),
        cacheDelete(CacheKeys.lowStockItems()),
        cacheDelete(CacheKeys.warehouseList()),
        cacheDelete(CacheKeys.dashboardStats()),
      ])
      return NextResponse.json({ 
        success: true, 
        count: itemIds.length,
        message: `${itemIds.length} bien(es) eliminado(s) permanentemente` 
      })
    }

    default:
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })
