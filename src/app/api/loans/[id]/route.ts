import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/api-handler'
import { logUpdate, logAudit, logDelete } from '@/lib/audit'
import { checkPinAttempt, recordFailedPinAttempt, resetPinAttempts } from '@/lib/pin-attempts'
import { cacheGetOrSet, CacheKeys, CacheTTL } from '@/lib/cache'
import bcrypt from 'bcryptjs'

async function getLoan(id: number) {
  return db.loan.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          item: { select: { id: true, name: true, code: true, quantity: true, status: true } },
        },
      },
      createdBy: { select: { id: true, fullName: true } },
      almaceneroAuth: { select: { id: true, fullName: true } },
      jefeAuth: { select: { id: true, fullName: true } },
      rejectionAuth: { select: { id: true, fullName: true } },
    },
  })
}

export const GET = apiHandler(async (request: NextRequest, _user) => {
  const id = parseInt(request.url.split('/').pop()!)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const loan = await getLoan(id)
  if (!loan) {
    return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ loan })
})

export const PUT = apiHandler(async (request: NextRequest, user) => {
  const id = parseInt(request.url.split('/').pop()!)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const body = await request.json()
  const { action } = body

  const loan = await db.loan.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!loan) {
    return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }

  const userId = user!.id
  const userRole = user!.role
  const canAuthLoans = !!(user as any).canAuthorizeLoans
  const { pin } = body

  async function validateLoanPin(pinInput: string | undefined): Promise<{ valid: boolean; remaining: number; locked: boolean; lockedUntil: number | null }> {
    const config = await cacheGetOrSet(CacheKeys.systemConfig(), () => db.systemConfig.findFirst({ where: { id: 1 } }), { ttl: CacheTTL.LONG })
    const maxAttempts = config?.maxPinAttempts || 5
    const lockoutMinutes = config?.pinLockoutMinutes || 15

    const attemptCheck = await checkPinAttempt(userId, maxAttempts, lockoutMinutes)
    if (attemptCheck.locked) {
      return { valid: false, remaining: 0, locked: true, lockedUntil: attemptCheck.lockedUntil }
    }

    const userRecord = await db.user.findUnique({ where: { id: userId }, select: { pin: true } })
    if (!userRecord?.pin) {
      return { valid: false, remaining: 0, locked: false, lockedUntil: null }
    }

    if (!pinInput || pinInput.length !== 4) {
      return { valid: false, remaining: 0, locked: false, lockedUntil: null }
    }

    const isValid = await bcrypt.compare(pinInput, userRecord.pin)
    if (!isValid) {
      await recordFailedPinAttempt(userId, maxAttempts, lockoutMinutes)
      const recheck = await checkPinAttempt(userId, maxAttempts, lockoutMinutes)
      return { valid: false, remaining: recheck.remaining, locked: recheck.locked, lockedUntil: recheck.lockedUntil }
    }

    await resetPinAttempts(userId)
    return { valid: true, remaining: maxAttempts, locked: false, lockedUntil: null }
  }

  switch (action) {
    case 'authorize_almacenero': {
      if (!['ADMINISTRADOR', 'ALMACENERO'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para autorizar como almacenero' }, { status: 403 })
      }
      if (loan.status !== 'PENDIENTE') {
        return NextResponse.json({ error: 'El préstamo no está pendiente' }, { status: 400 })
      }

      const pinResult = await validateLoanPin(pin)
      if (!pinResult.valid) {
        if (pinResult.locked) {
          const minsLeft = pinResult.lockedUntil ? Math.ceil((pinResult.lockedUntil - Date.now()) / 60000) : 15
          return NextResponse.json({ error: `Cuenta bloqueada por ${minsLeft} minutos.`, locked: true, lockedUntil: pinResult.lockedUntil }, { status: 403 })
        }
        return NextResponse.json({ error: 'PIN incorrecto.', remainingAttempts: pinResult.remaining }, { status: 403 })
      }

      await db.loan.update({
        where: { id },
        data: {
          status: 'AUTORIZADO_ALMACENERO',
          almaceneroAuthId: userId,
          almaceneroAuthAt: new Date(),
        },
      })

      await logUpdate(userId, 'Loan', id, { status: loan.status }, { status: 'AUTORIZADO_ALMACENERO' })

      const updated = await getLoan(id)
      return NextResponse.json({ loan: updated, message: 'Préstamo autorizado por almacenero' })
    }

    case 'authorize_jefe': {
      if (!['ADMINISTRADOR', 'JEFE_OFICINA'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para autorizar como jefe' }, { status: 403 })
      }
      if (loan.status !== 'AUTORIZADO_ALMACENERO') {
        return NextResponse.json({ error: 'El préstamo debe estar autorizado por almacenero primero' }, { status: 400 })
      }

      const pinResultJefe = await validateLoanPin(pin)
      if (!pinResultJefe.valid) {
        if (pinResultJefe.locked) {
          const minsLeft = pinResultJefe.lockedUntil ? Math.ceil((pinResultJefe.lockedUntil - Date.now()) / 60000) : 15
          return NextResponse.json({ error: `Cuenta bloqueada por ${minsLeft} minutos.`, locked: true, lockedUntil: pinResultJefe.lockedUntil }, { status: 403 })
        }
        return NextResponse.json({ error: 'PIN incorrecto.', remainingAttempts: pinResultJefe.remaining }, { status: 403 })
      }

      await db.loan.update({
        where: { id },
        data: {
          status: 'AUTORIZADO_JEFE',
          jefeAuthId: userId,
          jefeAuthAt: new Date(),
        },
      })

      await logUpdate(userId, 'Loan', id, { status: loan.status }, { status: 'AUTORIZADO_JEFE' })

      const updated = await getLoan(id)
      return NextResponse.json({ loan: updated, message: 'Préstamo autorizado por jefe' })
    }

    case 'confirm_loan': {
      if (!['ADMINISTRADOR', 'ALMACENERO'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para confirmar el préstamo' }, { status: 403 })
      }
      if (loan.status !== 'AUTORIZADO_JEFE') {
        return NextResponse.json({ error: 'El préstamo debe estar autorizado por ambas partes' }, { status: 400 })
      }

      const pinResultConfirm = await validateLoanPin(pin)
      if (!pinResultConfirm.valid) {
        if (pinResultConfirm.locked) {
          const minsLeft = pinResultConfirm.lockedUntil ? Math.ceil((pinResultConfirm.lockedUntil - Date.now()) / 60000) : 15
          return NextResponse.json({ error: `Cuenta bloqueada por ${minsLeft} minutos.`, locked: true, lockedUntil: pinResultConfirm.lockedUntil }, { status: 403 })
        }
        return NextResponse.json({ error: 'PIN incorrecto.', remainingAttempts: pinResultConfirm.remaining }, { status: 403 })
      }

      await db.$transaction(async (tx) => {
        await tx.loan.update({
          where: { id },
          data: { status: 'PRESTADO' },
        })

        const loanItems = await tx.loanItem.findMany({
          where: { loanId: id },
          include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true } } },
        })

        const puIds = loanItems.filter(li => li.itemType === 'PATRIMONIAL' && li.patrimonialUnitId).map(li => li.patrimonialUnitId!)
        if (puIds.length > 0) {
          await tx.patrimonialUnit.updateMany({
            where: { id: { in: puIds } },
            data: { isAvailable: false },
          })
        }
      })

      await logUpdate(userId, 'Loan', id, { status: loan.status }, { status: 'PRESTADO' })

      const updated = await getLoan(id)
      return NextResponse.json({ loan: updated, message: 'Préstamo confirmado' })
    }

    case 'return': {
      if (!['ADMINISTRADOR', 'ALMACENERO'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para registrar devolución' }, { status: 403 })
      }
      if (loan.status !== 'PRESTADO') {
        return NextResponse.json({ error: 'El préstamo no está en estado prestado' }, { status: 400 })
      }

      const pinResultReturn = await validateLoanPin(pin)
      if (!pinResultReturn.valid) {
        if (pinResultReturn.locked) {
          const minsLeft = pinResultReturn.lockedUntil ? Math.ceil((pinResultReturn.lockedUntil - Date.now()) / 60000) : 15
          return NextResponse.json({ error: `Cuenta bloqueada por ${minsLeft} minutos.`, locked: true, lockedUntil: pinResultReturn.lockedUntil }, { status: 403 })
        }
        return NextResponse.json({ error: 'PIN incorrecto.', remainingAttempts: pinResultReturn.remaining }, { status: 403 })
      }

      await db.$transaction(async (tx) => {
        await tx.loan.update({
          where: { id },
          data: {
            status: 'DEVUELTO',
            actualReturnDate: new Date(),
          },
        })

        const loanItems = await tx.loanItem.findMany({
          where: { loanId: id },
          include: { item: { select: { id: true, name: true, code: true, model: true, brand: true, category: true, unit: true, itemType: true, status: true, quantity: true } } },
        })

        const puIds = loanItems.filter(li => li.itemType === 'PATRIMONIAL' && li.patrimonialUnitId).map(li => li.patrimonialUnitId!)
        if (puIds.length > 0) {
          await tx.patrimonialUnit.updateMany({
            where: { id: { in: puIds } },
            data: { isAvailable: true },
          })
        }
      })

      await logUpdate(userId, 'Loan', id, { status: loan.status }, { status: 'DEVUELTO' })

      const updated = await getLoan(id)
      return NextResponse.json({ loan: updated, message: 'Devolución registrada correctamente' })
    }

    case 'restore': {
      if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para restaurar' }, { status: 403 })
      }

      await db.loan.update({ where: { id }, data: { deletedAt: null } })
      const updated = await getLoan(id)
      logAudit({ userId, action: 'UPDATE', entityType: 'Loan', entityId: id, severity: 'WARNING', description: `Préstamo ${updated?.documentNumber} restaurado de la papelera` })
      return NextResponse.json({ loan: updated, message: 'Préstamo restaurado correctamente' })
    }

    case 'permanent_delete': {
      if (userRole !== 'ADMINISTRADOR') {
        return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
      }

      const loanToDelete = await db.loan.findUnique({ where: { id }, select: { documentNumber: true } })
      await db.loan.delete({ where: { id } })
      logDelete(userId, 'Loan', id, { documentNumber: loanToDelete?.documentNumber }, `Préstamo ${loanToDelete?.documentNumber} eliminado permanentemente`)
      return NextResponse.json({ message: 'Préstamo eliminado permanentemente' })
    }

    case 'reject': {
      if (!['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos para rechazar' }, { status: 403 })
      }
      if (['DEVUELTO', 'RECHAZADO'].includes(loan.status)) {
        return NextResponse.json({ error: 'El préstamo ya fue finalizado' }, { status: 400 })
      }
      if (!body.reason?.trim()) {
        return NextResponse.json({ error: 'Debe proporcionar un motivo de rechazo' }, { status: 400 })
      }

      await db.loan.update({
        where: { id },
        data: {
          status: 'RECHAZADO',
          rejectionReason: body.reason,
          rejectionAuthId: userId,
          rejectionAt: new Date(),
        },
      })

      await logUpdate(userId, 'Loan', id, { status: loan.status }, { status: 'RECHAZADO' })

      const updated = await getLoan(id)
      return NextResponse.json({ loan: updated, message: 'Préstamo rechazado' })
    }

    case 'upload_signed_pdf': {
      if (!['ADMINISTRADOR', 'ALMACENERO'].includes(userRole) && !canAuthLoans) {
        return NextResponse.json({ error: 'No tiene permisos' }, { status: 403 })
      }
      if (!body.signedPdfUrl) {
        return NextResponse.json({ error: 'Debe proporcionar la URL del PDF' }, { status: 400 })
      }

      await db.loan.update({
        where: { id },
        data: { signedPdfUrl: body.signedPdfUrl },
      })

      logAudit({ userId, action: 'UPDATE', entityType: 'Loan', entityId: id, description: `PDF firmado cargado para préstamo #${id}` })

      const fullLoan = await getLoan(id)
      return NextResponse.json({ loan: fullLoan, message: 'PDF firmado cargado correctamente' })
    }

    default:
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }
})

export const DELETE = apiHandler(async (request: NextRequest, _user) => {
  const id = parseInt(request.url.split('/').pop()!)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const loan = await db.loan.findUnique({ where: { id }, select: { id: true, status: true, documentNumber: true } })
  if (!loan) {
    return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }

  if (!['PENDIENTE', 'RECHAZADO'].includes(loan.status)) {
    return NextResponse.json({ error: 'Solo se pueden eliminar préstamos pendientes o rechazados' }, { status: 400 })
  }

  await db.loan.update({ where: { id }, data: { deletedAt: new Date() } })

  logAudit({ userId: _user!.id, action: 'DELETE', entityType: 'Loan', entityId: id, description: `Préstamo ${loan.documentNumber} enviado a la papelera` })

  return NextResponse.json({ message: 'Préstamo enviado a la papelera' })
}, { roles: ['ADMINISTRADOR', 'ALMACENERO'] })
