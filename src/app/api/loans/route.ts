import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/api-handler'
import { getNextDocumentNumber } from '@/lib/document-sequence'
import { Prisma } from '@prisma/client'
import type { LoanStatus } from '@/types'

export const GET = apiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || ''
  const search = searchParams.get('search') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))
  const deletedOnly = searchParams.get('deletedOnly') === 'true'

  const where: Prisma.LoanWhereInput = {}
  where.deletedAt = deletedOnly ? { not: null } : null

  if (status) where.status = status as LoanStatus

  if (search) {
    where.OR = [
      { documentNumber: { contains: search, mode: 'insensitive' } },
      { borrowerName: { contains: search, mode: 'insensitive' } },
      { borrowerDni: { contains: search } },
    ]
  }

  const [loans, total] = await Promise.all([
    db.loan.findMany({
      where,
      include: {
        items: {
          include: {
            item: { select: { id: true, name: true, code: true, status: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
        almaceneroAuth: { select: { id: true, fullName: true } },
        jefeAuth: { select: { id: true, fullName: true } },
        rejectionAuth: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.loan.count({ where }),
  ])

  return NextResponse.json({
    loans,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  })
})

export const POST = apiHandler(async (request: NextRequest, user) => {
  const body = await request.json()
  const {
    borrowerName,
    borrowerDni,
    borrowerPhone,
    borrowerAddress,
    expectedReturnDate,
    reason,
    items,
  } = body

  if (!borrowerName?.trim()) {
    return NextResponse.json({ error: 'El nombre del prestatario es requerido' }, { status: 400 })
  }
  if (!expectedReturnDate) {
    return NextResponse.json({ error: 'La fecha de retorno esperada es requerida' }, { status: 400 })
  }
  if (!reason?.trim()) {
    return NextResponse.json({ error: 'El motivo del préstamo es requerido' }, { status: 400 })
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Debe seleccionar al menos un bien' }, { status: 400 })
  }

  const { documentNumber, documentLabel } = await getNextDocumentNumber('PRESTAMO')

  const loan = await db.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        documentNumber,
        documentLabel,
        borrowerName: borrowerName.trim(),
        borrowerDni: borrowerDni?.trim() || null,
        borrowerPhone: borrowerPhone?.trim() || null,
        borrowerAddress: borrowerAddress?.trim() || null,
        expectedReturnDate: new Date(expectedReturnDate),
        reason: reason.trim(),
        createdById: user!.id,
      },
    })

    const itemIds = items.map((i: { itemId: number }) => i.itemId)
    const dbItems = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true, name: true, code: true, brand: true, model: true, category: true,
        itemType: true, patrimonialCode: true,
        patrimonialUnits: { where: { isAvailable: true }, select: { id: true, patrimonialCode: true } }
      },
    })

    const itemsMap = new Map(dbItems.map((i) => [i.id, i]))

    const loanItemsData = items.map((item: { itemId: number; quantity?: number; patrimonialUnitId?: number | null }) => {
      const dbItem = itemsMap.get(item.itemId)
      if (!dbItem) {
        throw new Error(`Bien con ID ${item.itemId} no encontrado`)
      }

      let patrimonialUnitId: number | null = item.patrimonialUnitId ? Number(item.patrimonialUnitId) : null
      let patrimonialCode: string | null = null

      if (patrimonialUnitId) {
        const unit = dbItem.patrimonialUnits.find(u => u.id === patrimonialUnitId)
        if (!unit) {
          throw new Error(`Unidad patrimonial ${patrimonialUnitId} no disponible para ${dbItem.name}`)
        }
        patrimonialCode = unit.patrimonialCode
      } else if (dbItem.itemType === 'PATRIMONIAL') {
        if (dbItem.patrimonialUnits.length > 0) {
          const unit = dbItem.patrimonialUnits[0]!
          patrimonialUnitId = unit.id
          patrimonialCode = unit.patrimonialCode
        } else {
          patrimonialCode = dbItem.patrimonialCode
        }
      }

      return {
        loanId: created.id,
        itemId: dbItem.id,
        quantity: item.quantity || 1,
        patrimonialUnitId,
        itemName: dbItem.name,
        itemCode: dbItem.code,
        itemBrand: dbItem.brand,
        itemModel: dbItem.model,
        itemCategory: dbItem.category,
        patrimonialCode,
        itemType: dbItem.itemType,
      }
    })

    await tx.loanItem.createMany({ data: loanItemsData })

    return tx.loan.findUnique({
      where: { id: created.id },
      include: {
        items: {
          include: {
            item: { select: { id: true, name: true, code: true, status: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    })
  })

  const notifUsers = await db.user.findMany({
    where: {
      role: { in: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'] },
      isActive: true,
      id: { not: user!.id }
    },
    select: { id: true }
  })

  if (notifUsers.length > 0) {
    await db.notification.createMany({
      data: notifUsers.map(u => ({
        userId: u.id,
        title: 'Nuevo Préstamo Registrado',
        message: `Se ha registrado el préstamo N° ${documentNumber} a nombre de ${borrowerName} por ${items.length} bienes`,
        type: 'PRESTAMO_CREADO' as any,
        relatedId: loan!.id
      }))
    })
  }

  return NextResponse.json({ loan }, { status: 201 })
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })
