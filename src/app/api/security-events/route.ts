import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { headers } from 'next/headers'
import { logger } from '@/lib/logger'

type EventType = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'SUSPICIOUS_ACCESS' | 'PERMISSION_DENIED'
type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

async function checkTableExists(): Promise<boolean> {
  // Verificar si la tabla existe
  try {
    // Segura: consulta fija sin entrada de usuario
    await db.$queryRaw`SELECT 1 FROM "SecurityEvent" LIMIT 1`
    return true
  } catch {
    return false
  }
}

// Geolocalización simple por IP
function getGeolocationFromIP(ip: string | null): string | null {
  if (!ip) return null
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1' || ip === '127.0.0.1') {
    return 'Local'
  }
  return 'Desconocido'
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Verificar si la tabla existe primero
    const tableExists = await checkTableExists()
    if (!tableExists) {
      return NextResponse.json({
        events: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0
        },
        statistics: {
          total24h: 0,
          failedLogins24h: 0,
          suspiciousEvents24h: 0,
          uniqueIPs24h: 0
        },
        migrationRequired: true,
        message: 'La tabla de eventos de seguridad no existe. Ejecute: npx prisma db push'
      })
    }

    const { searchParams } = new URL(request.url)
    const eventType = searchParams.get('eventType') as EventType | null
    const severity = searchParams.get('severity') as Severity | null
    const userId = searchParams.get('userId')
    const ipAddress = searchParams.get('ipAddress')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Prisma.SecurityEventWhereInput = {}

    if (eventType) where.eventType = eventType
    if (severity) where.severity = severity
    if (userId) where.userId = parseInt(userId)
    if (ipAddress) where.ipAddress = ipAddress
    if (startDate) where.createdAt = { ...(where.createdAt as object), gte: new Date(startDate) }
    if (endDate) where.createdAt = { ...(where.createdAt as object), lte: new Date(endDate) }

    const [events, total] = await Promise.all([
      db.securityEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.securityEvent.count({ where })
    ])

    const twentyFourHAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [stats, failedLogins24h, suspiciousEvents24h, uniqueIPs] = await Promise.all([
      db.securityEvent.aggregate({
        where: { createdAt: { gte: twentyFourHAgo } },
        _count: { id: true }
      }),
      db.securityEvent.count({
        where: { eventType: 'LOGIN_FAILED', createdAt: { gte: twentyFourHAgo } }
      }),
      db.securityEvent.count({
        where: { severity: { in: ['WARNING', 'CRITICAL'] }, createdAt: { gte: twentyFourHAgo } }
      }),
      db.securityEvent.findMany({
        where: { ipAddress: { not: null }, createdAt: { gte: twentyFourHAgo } },
        distinct: ['ipAddress'],
        select: { ipAddress: true }
      }),
    ])

    return NextResponse.json({
      events: events.map(e => ({
        ...e,
        geolocation: e.geolocation || getGeolocationFromIP(e.ipAddress)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      statistics: {
        total24h: stats._count.id,
        failedLogins24h,
        suspiciousEvents24h,
        uniqueIPs24h: uniqueIPs.length
      }
    })
  } catch (error) {
    logger.error('Error al obtener security events:', error)
    // Devolver datos vacíos en lugar de error para evitar romper la UI
    return NextResponse.json({
      events: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
      },
      statistics: {
        total24h: 0,
        failedLogins24h: 0,
        suspiciousEvents24h: 0,
        uniqueIPs24h: 0
      },
      error: 'Error al obtener eventos de seguridad',
      migrationRequired: true,
      message: 'Ejecute: npx prisma db push para crear las tablas necesarias'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar si la tabla existe primero
    const tableExists = await checkTableExists()
    if (!tableExists) {
      return NextResponse.json({ 
        error: 'Tabla no disponible. Ejecute: npx prisma db push',
        migrationRequired: true 
      }, { status: 503 })
    }

    const body = await request.json()
    const {
      userId,
      eventType,
      ipAddress,
      userAgent,
      deviceFingerprint,
      details,
      severity
    } = body

    if (!eventType || !severity) {
      return NextResponse.json({ 
        error: 'eventType y severity son requeridos' 
      }, { status: 400 })
    }

    // Obtener IP y User-Agent real si no se proveyeron
    let actualIP = ipAddress
    let actualUserAgent = userAgent
    
    try {
      const headersList = await headers()
      actualIP = ipAddress || 
        headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headersList.get('x-real-ip') ||
        headersList.get('cf-connecting-ip') ||
        null
      actualUserAgent = userAgent || headersList.get('user-agent') || null
    } catch {
      // Ignorar errores de encabezado
    }

    const geolocation = getGeolocationFromIP(actualIP)

    // Crear evento de seguridad
    const securityEvent = await db.securityEvent.create({
      data: {
        userId,
        eventType,
        ipAddress: actualIP,
        userAgent: actualUserAgent,
        deviceFingerprint,
        geolocation,
        details: details ? JSON.stringify(details) : null,
        severity
      }
    })

    return NextResponse.json({
      success: true,
      event: securityEvent
    }, { status: 201 })
  } catch (error) {
    logger.error('Error al crear security event:', error)
    return NextResponse.json({ 
      error: 'Error al registrar evento de seguridad',
      migrationRequired: true 
    }, { status: 500 })
  }
}
