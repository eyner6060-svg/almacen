import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promises as fs, existsSync } from 'fs'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

let psqlCmdCache: string | null = null

async function findPsql(): Promise<string> {
  if (psqlCmdCache) return psqlCmdCache

  try {
    await new Promise<void>((resolve, reject) => {
      execFile('psql', ['--version'], { timeout: 5000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    psqlCmdCache = 'psql'
    return psqlCmdCache
  } catch {
    const pgDir = 'C:\\Program Files\\PostgreSQL'
    if (existsSync(pgDir)) {
      const versions = await fs.readdir(pgDir)
      versions.sort().reverse()
      for (const ver of versions) {
        const candidate = `${pgDir}\\${ver}\\bin\\psql.exe`
        if (existsSync(candidate)) {
          psqlCmdCache = candidate
          return candidate
        }
      }
    }
    throw new Error('psql no está instalado o no se encuentra en el PATH.')
  }
}

async function findPgDumpWindows(): Promise<string> {
  const pgDir = 'C:\\Program Files\\PostgreSQL'
  if (existsSync(pgDir)) {
    const versions = await fs.readdir(pgDir)
    versions.sort().reverse()
    for (const ver of versions) {
      const candidate = `${pgDir}\\${ver}\\bin\\pg_dump.exe`
      if (existsSync(candidate)) {
        return candidate
      }
    }
  }
  return 'pg_dump'
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { backupId, confirmPin, confirmationText } = await request.json()

    if (!backupId || typeof backupId !== 'number' || backupId <= 0) {
      return NextResponse.json({ error: 'ID de backup inválido' }, { status: 400 })
    }

    if (!confirmPin) {
      return NextResponse.json({ error: 'PIN de confirmación requerido' }, { status: 400 })
    }

    if (confirmationText !== 'RESTAURAR') {
      return NextResponse.json({ error: 'Debe escribir RESTAURAR para confirmar' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimit = await checkRateLimit(`restore:${currentUser.id}:${ip}`, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 2,
      message: 'Demasiados intentos de restauración. Intente en una hora.'
    })
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 })
    }

    if (!currentUser.pin || !(await bcrypt.compare(confirmPin, currentUser.pin))) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 403 })
    }

    const backup = await db.backupLog.findUnique({ where: { id: backupId } })
    if (!backup) {
      return NextResponse.json({ error: 'Copia de seguridad no encontrada' }, { status: 404 })
    }

    if (backup.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'La copia de seguridad no está completa' }, { status: 400 })
    }

    try {
      await fs.access(backup.filePath)
    } catch {
      return NextResponse.json({ error: 'Archivo de copia no encontrado en el servidor' }, { status: 404 })
    }

    const dbUrl = process.env.DATABASE_URL || ''
    const url = new URL(dbUrl)
    const dbName = url.pathname.replace('/', '')
    const pgUser = url.username
    const pgPass = url.password
    const pgHost = url.hostname
    const pgPort = url.port || '5432'

    try {
      const psqlCmd = await findPsql()
      const psqlEnv = { ...process.env, PGPASSWORD: pgPass }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const preRestoreBackup = await db.backupLog.create({
        data: {
          fileName: `pre-restore-${timestamp}.sql`,
          fileSize: BigInt(0),
          type: 'MANUAL',
          status: 'RUNNING',
          triggeredBy: currentUser.id,
          filePath: backup.filePath.replace(/\/[^/]+\.sql$/, `/pre-restore-${timestamp}.sql`)
        }
      })

      try {
        const pgDumpPath = process.platform === 'win32'
          ? await findPgDumpWindows().catch(() => 'pg_dump')
          : 'pg_dump'
        const dumpArgs = ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-d', dbName, '-F', 'p', '--no-owner', '--no-acl']
        await new Promise<void>((resolve, reject) => {
          execFile(pgDumpPath, dumpArgs, { timeout: 120000, env: psqlEnv }, (err) => {
            if (err) reject(new Error(`Error al crear backup previo: ${err.message}`))
            else resolve()
          })
        })
        await db.backupLog.update({
          where: { id: preRestoreBackup.id },
          data: { status: 'COMPLETED' }
        })
      } catch {
        await db.backupLog.update({
          where: { id: preRestoreBackup.id },
          data: { status: 'FAILED', errorMessage: 'Error al crear backup previo' }
        })
      }

      await new Promise<void>((resolve, reject) => {
        execFile(
          psqlCmd,
          ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-d', dbName, '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
          { timeout: 60000, env: psqlEnv },
          (err) => {
            if (err) reject(new Error(`Error al limpiar esquema: ${err.message}`))
            else resolve()
          }
        )
      })

      const sqlContent = await fs.readFile(backup.filePath, 'utf8')
      await new Promise<void>((resolve, reject) => {
        const proc = execFile(
          psqlCmd,
          ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-d', dbName],
          { timeout: 300000, maxBuffer: 200 * 1024 * 1024, env: psqlEnv },
          (err) => {
            if (err) reject(new Error(`Error al restaurar datos: ${err.message}`))
            else resolve()
          }
        )
        if (proc.stdin) {
          proc.stdin.write(sqlContent)
          proc.stdin.end()
        }
      })

      await logAudit({
        userId: currentUser.id,
        action: 'BACKUP_RESTORE',
        entityType: 'BackupLog',
        entityId: backupId,
        description: 'Base de datos restaurada desde: ' + backup.fileName,
        severity: 'CRITICAL',
      })

      return NextResponse.json({ success: true, message: 'Base de datos restaurada correctamente' })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al restaurar la base de datos'
      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}
