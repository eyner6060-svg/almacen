import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit, logDelete } from '@/lib/audit'
import { cacheDeletePattern } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMINISTRADOR', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const entity = searchParams.get('entity')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    type DeletedItem = {
      id: number
      entityType: string
      identifier: string
      label: string
      deletedAt: string
    }

    let items: DeletedItem[] = []
    let total = 0

    if (!entity || entity === 'all') {
      const [tdrs, tdrTotal, loans, loanTotal] = await Promise.all([
        db.tDR.findMany({
          where: { deletedAt: { not: null } },
          select: { id: true, tdrNumber: true, title: true, deletedAt: true },
          orderBy: { deletedAt: 'desc' },
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        db.tDR.count({ where: { deletedAt: { not: null } } }),
        db.loan.findMany({
          where: { deletedAt: { not: null } },
          select: { id: true, documentNumber: true, borrowerName: true, deletedAt: true },
          orderBy: { deletedAt: 'desc' },
          take: perPage,
          skip: (page - 1) * perPage,
        }),
        db.loan.count({ where: { deletedAt: { not: null } } }),
      ])

      items = [
        ...tdrs.map(t => ({ id: t.id, entityType: 'tdr', identifier: t.tdrNumber, label: t.title, deletedAt: t.deletedAt!.toISOString() })),
        ...loans.map(l => ({ id: l.id, entityType: 'loan', identifier: l.documentNumber, label: l.borrowerName, deletedAt: l.deletedAt!.toISOString() })),
      ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
      .slice(0, perPage)

      total = tdrTotal + loanTotal
    } else if (entity === 'tdr') {
      const tdrs = await db.tDR.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, tdrNumber: true, title: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      })
      items = tdrs.map(t => ({ id: t.id, entityType: 'tdr', identifier: t.tdrNumber, label: t.title, deletedAt: t.deletedAt!.toISOString() }))
      total = await db.tDR.count({ where: { deletedAt: { not: null } } })
    } else if (entity === 'loan') {
      const loans = await db.loan.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true, documentNumber: true, borrowerName: true, deletedAt: true },
        orderBy: { deletedAt: 'desc' },
        take: perPage,
        skip: (page - 1) * perPage,
      })
      items = loans.map(l => ({ id: l.id, entityType: 'loan', identifier: l.documentNumber, label: l.borrowerName, deletedAt: l.deletedAt!.toISOString() }))
      total = await db.loan.count({ where: { deletedAt: { not: null } } })
    }

    return NextResponse.json({
      items,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    })
  } catch (error) {
    logger.error('Error al obtener elementos eliminados:', error)
    return NextResponse.json({ error: 'Error al obtener elementos eliminados' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMINISTRADOR', 'JEFE_OFICINA'].includes(user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { entity, entityId, action } = body

    if (!entity || !entityId || !action) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const id = parseInt(entityId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    if (action === 'restore') {
      if (entity === 'tdr') {
        await db.tDR.update({ where: { id }, data: { deletedAt: null } })
        logAudit({ userId: user.id, action: 'UPDATE', entityType: 'TDR', entityId: id, severity: 'WARNING', description: `TDR #${id} restaurado de la papelera` })
      } else if (entity === 'loan') {
        await db.loan.update({ where: { id }, data: { deletedAt: null } })
        logAudit({ userId: user.id, action: 'UPDATE', entityType: 'Loan', entityId: id, severity: 'WARNING', description: `Préstamo #${id} restaurado de la papelera` })
      } else {
        return NextResponse.json({ error: 'Entidad no soportada' }, { status: 400 })
      }
      await cacheDeletePattern('tdr*')
      return NextResponse.json({ success: true, message: 'Elemento restaurado correctamente' })
    }

    if (action === 'permanent_delete') {
      if (user.role !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'Solo administradores pueden eliminar permanentemente' }, { status: 403 })
      }

      if (entity === 'tdr') {
        const tdr = await db.tDR.findUnique({ where: { id }, select: { tdrNumber: true } })
        await db.tDR.delete({ where: { id } })
        logDelete(user.id, 'TDR', id, { tdrNumber: tdr?.tdrNumber }, `TDR ${tdr?.tdrNumber} eliminado permanentemente desde la papelera`)
      } else if (entity === 'loan') {
        const loan = await db.loan.findUnique({ where: { id }, select: { documentNumber: true } })
        await db.loan.delete({ where: { id } })
        logDelete(user.id, 'Loan', id, { documentNumber: loan?.documentNumber }, `Préstamo ${loan?.documentNumber} eliminado permanentemente desde la papelera`)
      } else {
        return NextResponse.json({ error: 'Entidad no soportada' }, { status: 400 })
      }
      await cacheDeletePattern('tdr*')
      return NextResponse.json({ success: true, message: 'Elemento eliminado permanentemente' })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    logger.error('Error al procesar elemento eliminado:', error)
    return NextResponse.json({ error: 'Error al procesar elemento' }, { status: 500 })
  }
}
