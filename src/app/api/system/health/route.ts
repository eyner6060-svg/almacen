import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const startTime = Date.now()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
    try {
      await db.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'down'
    }

    const uptimeMs = Date.now() - startTime
    const uptimeHours = Math.floor(uptimeMs / 3600000)
    const uptimeMinutes = Math.floor((uptimeMs % 3600000) / 60000)
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`

    return NextResponse.json({
      dbStatus,
      cacheStatus: 'healthy',
      uptime,
    })
  } catch (error) {
    logger.error('Error obteniendo health:', error)
    return NextResponse.json(
      { error: 'Error al obtener estado del sistema' },
      { status: 500 }
    )
  }
}
