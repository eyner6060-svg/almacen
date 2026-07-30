import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createRequest, getRequests } from '@/lib/assignment-requests'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filterUserId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '50')))

    const result = currentUser.role === 'ADMINISTRADOR' || currentUser.role === 'ALMACENERO'
      ? await getRequests(filterUserId ? parseInt(filterUserId) : undefined, page, perPage)
      : await getRequests(currentUser.id, page, perPage)

    return NextResponse.json({
      requests: result.requests,
      pagination: { page, perPage, total: result.total, totalPages: Math.ceil(result.total / perPage) },
    })
  } catch (error) {
    logger.error('Error al obtener assignment requests:', error)
    return NextResponse.json({ requests: [], error: 'Error al obtener solicitudes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { items, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un bien' }, { status: 400 })
    }

    const itemIds = items.map((i: { itemId: string }) => parseInt(i.itemId))
    if (itemIds.some(isNaN)) {
      return NextResponse.json({ error: 'ID de bien inválido' }, { status: 400 })
    }
    const dbItems = await db.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true }
    })
    const itemMap = new Map(dbItems.map(i => [i.id, i.name]))
    const enrichedItems = items.map((item: { itemId: string; quantity?: string; patrimonialUnitId?: string }) => {
      const itemName = itemMap.get(parseInt(item.itemId))
      if (!itemName) throw new Error(`Item con ID ${item.itemId} no encontrado`)
      return { ...item, itemName }
    })

    const requestData = await createRequest({
      userId: currentUser.id,
      userName: currentUser.fullName,
      userOffice: currentUser.office?.name || 'Sin oficina',
      items: enrichedItems.map((i: { itemId: string; quantity?: string; itemName?: string }) => ({
        itemId: parseInt(i.itemId),
        itemName: i.itemName || '',
        quantity: parseInt(i.quantity ?? '1'),
      })),
      notes: notes || '',
    })

    return NextResponse.json({ request: requestData })
  } catch (error) {
    logger.error('Error al crear assignment request:', error)
    return NextResponse.json({ error: 'Error al crear solicitud' }, { status: 500 })
  }
}
