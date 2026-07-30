import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('perPage') || '20')))

    const userIdFilter = searchParams.get('userId')
    let where: Record<string, unknown> = {}
    if (userIdFilter) {
      where = { userId: parseInt(userIdFilter) }
    } else {
      where = currentUser.role === 'ADMINISTRADOR' ? {} : { userId: currentUser.id }
    }

    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || String(perPage))))

    const [signatures, total] = await Promise.all([
      db.digitalSignature.findMany({
        where,
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { signedAt: 'desc' },
        skip: (page - 1) * perPage,
        take: limit,
      }),
      db.digitalSignature.count({ where }),
    ])

    return NextResponse.json({ signatures, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } })
  } catch (error) {
    logger.error('Get signatures error:', error)
    return NextResponse.json({ signatures: [] }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { documentType, documentId, signatureData } = body

    if (!documentType || !documentId || !signatureData) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null

    const signature = await db.digitalSignature.create({
      data: {
        documentType,
        documentId: parseInt(documentId),
        userId: currentUser.id,
        signatureData,
        ipAddress,
        userAgent,
      },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
    })

    logAudit({ userId: currentUser.id, action: 'AUTHORIZE', entityType: 'User', entityId: currentUser.id, description: `Firma digital registrada para ${documentType} #${documentId}` })

    return NextResponse.json({ signature })
  } catch (error) {
    logger.error('Save signature error:', error)
    return NextResponse.json({ error: 'Error al guardar firma' }, { status: 500 })
  }
}
