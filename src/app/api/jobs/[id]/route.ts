import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getJobResult } from '@/lib/jobs'
import fs from 'fs/promises'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const result = getJobResult(id)
    if (!result) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error al consultar job:', error)
    return NextResponse.json({ error: 'Error al consultar el job' }, { status: 500 })
  }
}

// Endpoint para descargar archivo generado por un job de reporte
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const result = getJobResult(id)
    if (!result) {
      return NextResponse.json({ error: 'Job no encontrado' }, { status: 404 })
    }

    const jobResult = result.result as { filePath?: string; fileName?: string; contentType?: string } | undefined

    if (result.status !== 'completed' || !jobResult?.filePath) {
      return NextResponse.json({ error: 'El archivo aún no está disponible' }, { status: 400 })
    }

    try {
      const content = await fs.readFile(jobResult.filePath)
      const fileName = jobResult.fileName || 'download'

      return new NextResponse(content, {
        headers: {
          'Content-Type': jobResult.contentType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${fileName}"`
        }
      })
    } catch {
      return NextResponse.json({ error: 'El archivo ya no está disponible' }, { status: 410 })
    }
  } catch (error) {
    logger.error('Error al descargar archivo:', error)
    return NextResponse.json({ error: 'Error al descargar el archivo' }, { status: 500 })
  }
}
