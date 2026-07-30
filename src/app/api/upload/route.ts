import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const MAX_UPLOAD_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024

const DANGEROUS_EXTENSIONS = new Set(['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'jar', 'php', 'asp', 'aspx'])

// Magic bytes para validar tipos de archivo reales
const FILE_SIGNATURES: Record<string, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [new Uint8Array([0x47, 0x49, 0x46])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  'application/pdf': [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
}

function detectMimeTypeFromBytes(bytes: Uint8Array): string | null {
  for (const [mime, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const sig of signatures) {
      if (bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b)) {
        return mime
      }
    }
  }
  return null
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\./, '')
    .toLowerCase()
}

function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()?.toLowerCase() || 'bin' : 'bin'
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Límite de tasa
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`upload:${ip}`, RateLimitPresets.UPLOAD)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    const formData = await request.formData()
    const files = formData.getAll('file') as File[]
    const type = sanitizeFilename((formData.get('type') as string) || 'general')

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
    }

    if (files.length > MAX_UPLOAD_FILES) {
      return NextResponse.json({ error: `Máximo ${MAX_UPLOAD_FILES} archivos por carga` }, { status: 400 })
    }

    const file = files[0]
    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo permitido (10MB)' },
        { status: 400 }
      )
    }

    const extension = getExtension(file.name)
    if (DANGEROUS_EXTENSIONS.has(extension)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }

    // Validación de tipo MIME declarado
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes (JPEG, PNG, GIF, WebP)' },
        { status: 400 }
      )
    }

    // Validación de magic bytes para detectar tipo real del archivo
    const arrBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrBuf.slice(0, 8))
    const detectedMime = detectMimeTypeFromBytes(bytes)
    if (!detectedMime || detectedMime !== file.type) {
      return NextResponse.json(
        { error: 'El contenido del archivo no coincide con el tipo declarado' },
        { status: 400 }
      )
    }

    const uniqueId = randomUUID().replace(/-/g, '').substring(0, 16)
    const timestamp = Date.now()
    const safeExtension = extension.substring(0, 5)
    const uniqueFilename = `${type}_${uniqueId}_${timestamp}.${safeExtension}`

    const isLogo = type === 'logo'
    const uploadDir = path.join(process.cwd(), isLogo ? 'public' : 'private', 'uploads')

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, uniqueFilename)
    const buffer = Buffer.from(arrBuf)

    await writeFile(filePath, buffer)

    const publicUrl = isLogo ? `/uploads/${uniqueFilename}` : `/api/files/${uniqueFilename}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename: uniqueFilename,
      originalName: sanitizeFilename(file.name),
      size: file.size,
      type: file.type
    })

  } catch (error) {
    logger.error('Error de subida:', error)
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint de subida de archivos',
    maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
    allowedTypes: Array.from(ALLOWED_MIME_TYPES),
  })
}
