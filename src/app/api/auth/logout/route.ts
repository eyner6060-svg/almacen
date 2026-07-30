import { NextResponse } from 'next/server'
import { clearSession, getCurrentUser } from '@/lib/auth'
import { logLogout } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST() {
  try {
    const user = await getCurrentUser()
    if (user) {
      await logLogout(user.id)
    }
    await clearSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    )
  }
}
