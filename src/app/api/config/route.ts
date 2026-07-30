import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cacheDelete, CacheKeys } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { unlinkSync } from 'fs'
import path from 'path'

export async function GET() {
  try {
    let config = await db.systemConfig.findFirst({ where: { id: 1 } })
    if (!config) {
      config = await db.systemConfig.create({
        data: {
          institutionName: 'Almacén Institucional',
          primaryColor: '#1e40af',
          secondaryColor: '#3b82f6',
          accentColor: '#f59e0b',
          tabTitle: 'Almacén'
        }
      })
    }

    return NextResponse.json({ config })
  } catch (error) {
    logger.error('Get config error:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const {
      institutionName, logoUrl, primaryColor, secondaryColor,
      accentColor, faviconUrl, tabTitle, footerText,
      force2FA, exemptedRoles, maxPinAttempts, pinLockoutMinutes
    } = body

    let config = await db.systemConfig.findFirst({ where: { id: 1 } })

    const oldLogoUrl = config?.logoUrl || null
    const oldFaviconUrl = config?.faviconUrl || null

    if (config) {
      config = await db.systemConfig.update({
        where: { id: config.id },
        data: {
          institutionName,
          logoUrl,
          primaryColor,
          secondaryColor,
          accentColor,
          faviconUrl,
          tabTitle,
          footerText,
          force2FA: force2FA ?? false,
          exemptedRoles: exemptedRoles ? JSON.stringify(exemptedRoles) : '[]',
          maxPinAttempts: maxPinAttempts ?? 5,
          pinLockoutMinutes: pinLockoutMinutes ?? 15,
        }
      })
    } else {
      config = await db.systemConfig.create({
        data: {
          institutionName,
          logoUrl,
          primaryColor,
          secondaryColor,
          accentColor,
          faviconUrl,
          tabTitle,
          footerText,
          force2FA: force2FA ?? false,
          exemptedRoles: exemptedRoles ? JSON.stringify(exemptedRoles) : '[]',
          maxPinAttempts: maxPinAttempts ?? 5,
          pinLockoutMinutes: pinLockoutMinutes ?? 15,
        }
      })
    }

    await cacheDelete(CacheKeys.systemConfig())

    // Eliminar archivos anteriores si ya no se usan
    const tryDeleteOldFile = (oldUrl: string | null, newUrl: string | null | undefined) => {
      if (!oldUrl || oldUrl === newUrl) return
      const { resolve } = path
      const fullPath = oldUrl.startsWith('/api/files/')
        ? resolve(process.cwd(), 'private', oldUrl.replace('/api/files/', 'uploads/'))
        : oldUrl.startsWith('/uploads/')
          ? resolve(process.cwd(), 'public', oldUrl)
          : null
      if (fullPath) {
        try { unlinkSync(fullPath) } catch { /* ignorar */ }
      }
    }
    tryDeleteOldFile(oldLogoUrl, logoUrl)
    tryDeleteOldFile(oldFaviconUrl, faviconUrl)

    logAudit({ userId: currentUser.id, action: 'UPDATE', entityType: 'SystemConfig', entityId: config.id, description: `Actualización de configuración del sistema por ${currentUser.id}` })

    return NextResponse.json({ config })
  } catch (error) {
    logger.error('Update config error:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}
