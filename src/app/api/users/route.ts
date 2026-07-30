import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { logCreate } from '@/lib/audit'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { maskDNI, maskEmail, maskPhone } from '@/lib/encryption'
import { createUserSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/api-error'
import bcrypt from 'bcryptjs'
import { Role, Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Límite de tasa de solicitudes
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`users-get:${ip}`, RateLimitPresets.API)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const [users, total] = await Promise.all([
      db.user.findMany({
        select: {
          id: true, fullName: true, email: true, role: true, dni: true,
          phone: true, isActive: true, position: true, createdAt: true, updatedAt: true,
          officeId: true, isDriver: true, canAuthorizeOrders: true, canAuthorizeFuel: true, canAuthorizeAssignments: true, canAuthorizeLoans: true,
          office: { select: { id: true, name: true } },
          vehicle: { select: { id: true, name: true, plate: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage
      }),
      db.user.count()
    ])

    const safeUsers = users.map(user => ({
      ...user,
      dni: currentUser.role === 'ALMACENERO' ? user.dni : maskDNI(user.dni),
      phone: user.phone ? (currentUser.role === 'ALMACENERO' ? user.phone : maskPhone(user.phone)) : null,
      email: currentUser.role === 'ALMACENERO' ? user.email : maskEmail(user.email)
    }))

    return NextResponse.json({
      users: safeUsers,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
    })
  } catch (error) {
    logger.error('Get users error:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`users-create:${ip}`, RateLimitPresets.CREATE)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const body = await request.json()
    const validated = createUserSchema.parse(body)
    const { fullName, dni, phone, position, email, password, role, officeId, isDriver, vehicleId, pin } = validated

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { dni }]
      },
      select: { id: true, email: true }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe un usuario con ese email o DNI' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    const hashedPin = pin ? await bcrypt.hash(pin, 10) : null

    const userData: Prisma.UserCreateInput = {
      fullName,
      dni,
      phone: phone || null,
      position: position || '',
      email: email.toLowerCase(),
      password: hashedPassword,
      pin: hashedPin,
      role: role as Role,
      office: officeId ? { connect: { id: Number(officeId) } } : undefined,
      isDriver: isDriver || false,
    }

    if (isDriver && vehicleId) {
      const vehicle = await db.vehicle.findUnique({ where: { id: Number(vehicleId) } })
      if (vehicle && vehicle.driverId === null) {
        userData.vehicle = { connect: { id: Number(vehicleId) } }
      }
    }

    const user = await db.user.create({
      data: userData,
      include: {
        office: true,
        vehicle: true
      }
    })

    // Log de auditoría
    await logCreate(
      currentUser.id,
      'User',
      user.id,
      {
        fullName: user.fullName,
        email: maskEmail(user.email),
        role: user.role,
        isDriver: user.isDriver
      },
      `Usuario ${user.fullName} creado con rol ${user.role}`
    )

    // Invalidar cachés
    await Promise.all([
      cacheDelete(CacheKeys.userList()),
      cacheDelete(CacheKeys.officeList()),
    ])

    // Devolver usuario sin datos sensibles
    const { password: _, pin: __, ...safeUser } = user

    return NextResponse.json({ user: safeUser })
  } catch (error) {
    return handleApiError(error)
  }
}
