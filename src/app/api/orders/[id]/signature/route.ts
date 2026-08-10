import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/logger'
import { cacheDeletePattern, CacheKeys } from '@/lib/cache'
import { logAudit } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || (currentUser.role !== 'ADMINISTRADOR' && currentUser.role !== 'ALMACENERO')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (order.status !== 'COMPLETADO') {
      return NextResponse.json({ error: 'El pedido debe estar COMPLETADO para firmar el documento de salida' }, { status: 400 })
    }

    const body = await request.json()
    const { html, signatureData, certData } = body

    if (!html || !signatureData) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const sanitized = order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `Orden_Salida_${sanitized}_${Date.now()}.html`
    const dirPath = join(process.cwd(), 'private', 'uploads', 'docs')
    const filePath = join(dirPath, filename)

    await mkdir(dirPath, { recursive: true })
    await writeFile(filePath, html, 'utf-8')

    const docUrl = `/api/files/docs/${filename}`
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null

    const signature = await db.digitalSignature.create({
      data: {
        documentType: 'ORDER',
        documentId: orderId,
        userId: currentUser.id,
        signatureData,
        certData: certData || null,
        ipAddress,
        userAgent,
      },
    })

    await db.order.update({
      where: { id: orderId },
      data: { pdfUrl: docUrl, signedPdfUrl: docUrl },
    })

    cacheDeletePattern(`order:detail:${orderId}`)
    cacheDeletePattern(CacheKeys.order(orderId))

    logAudit({
      userId: currentUser.id,
      action: 'AUTHORIZE',
      entityType: 'Order',
      entityId: orderId,
      description: `Documento de salida firmado para ${order.orderNumber} (${signature.id})`,
    })

    return NextResponse.json({ url: docUrl, signature })
  } catch (error) {
    logger.error('Error al firmar documento de pedido:', error)
    return NextResponse.json({ error: 'Error al firmar documento' }, { status: 500 })
  }
}
