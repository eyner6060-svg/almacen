import { NextRequest, NextResponse } from 'next/server'
import { access, readFile } from 'fs/promises'
import path from 'path'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`files:${user.id}:${ip}`, {
      windowMs: 60 * 1000,
      maxRequests: 120,
      message: 'Demasiadas solicitudes de archivos.'
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const { path: pathParts } = await params
    const relativePath = pathParts.join('/')

    const allowedBase = path.join(/* turbopackIgnore: true */ process.cwd(), 'private', 'uploads')
    const filePath = path.resolve(allowedBase, relativePath)

    if (!filePath.startsWith(allowedBase)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    try {
      await access(filePath)
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const content = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.html': 'text/html',
    }

    const contentType = mimeTypes[ext] || 'application/octet-stream'
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': content.length.toString(),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    }

    if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      const fileName = path.basename(filePath)
      headers['Content-Disposition'] = `inline; filename="${fileName}"`
    }

    return new NextResponse(content, { headers })
  } catch (error) {
    logger.error('File serve error:', error)
    return NextResponse.json({ error: 'Error al servir archivo' }, { status: 500 })
  }
}
