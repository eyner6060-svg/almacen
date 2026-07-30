import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { setCsrfCookie } from '@/lib/csrf'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const response = NextResponse.json({ user })

    if (user) {
      await setCsrfCookie(response)
    }

    return response
  } catch (error) {
    logger.error('Get current user error:', error)
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    )
  }
}
