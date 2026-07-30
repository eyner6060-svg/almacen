import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { dispatch } from '@/lib/jobs'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || !['ADMINISTRADOR', 'ALMACENERO'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Guardar archivo temporalmente
    const buffer = Buffer.from(await file.arrayBuffer())
    const tempDir = os.tmpdir()
    const tempFilePath = path.join(tempDir, `bulk-upload-${Date.now()}-${file.name}`)
    await fs.writeFile(tempFilePath, buffer)

    // Disparar job asincrónico
    const jobId = dispatch('bulk-upload:process', {
      tempFilePath,
      userId: currentUser.id
    })

    return NextResponse.json({
      jobId,
      status: 'processing',
      message: 'Carga masiva iniciada. Use GET /api/jobs/' + jobId + ' para consultar el resultado.'
    })

  } catch (error) {
    logger.error('Bulk Error de subida:', error)
    return NextResponse.json({ error: 'Error al iniciar la carga masiva' }, { status: 500 })
  }
}
