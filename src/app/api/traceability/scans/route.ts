import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logCreate } from '@/lib/audit'

// GET - Obtener escaneos QR recientes
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const scans = await db.qRScanLog.findMany({
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            patrimonialCode: true,
            category: true,
          }
        },
        scannedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ scans })
  } catch (error) {
    logger.error('Error al obtener scans:', error)
    return NextResponse.json({ scans: [], error: 'Error al obtener escaneos' }, { status: 500 })
  }
}

// POST - Registrar un nuevo escaneo QR
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { code, itemId, scanType, latitude, longitude, deviceInfo } = body

    if (!code || !scanType) {
      return NextResponse.json({ error: 'Código y tipo de escaneo son requeridos' }, { status: 400 })
    }

    const scan = await db.qRScanLog.create({
      data: {
        code,
        itemId: itemId ? parseInt(itemId) : null,
        scanType,
        scannedById: user.id,
        latitude,
        longitude,
        deviceInfo,
      },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        scannedBy: {
          select: {
            id: true,
            fullName: true,
          }
        },
      },
    })

    logCreate(user.id, 'Item', scan.id, { code, scanType })

    return NextResponse.json({ scan })
  } catch (error) {
    logger.error('Error logging scan:', error)
    return NextResponse.json({ error: 'Error al registrar escaneo' }, { status: 500 })
  }
}
