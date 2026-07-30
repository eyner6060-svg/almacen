import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promises as fs, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const [backups, config] = await Promise.all([
      db.backupLog.findMany({
        select: { id: true, type: true, fileName: true, fileSize: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.systemConfig.findFirst({ where: { id: 1 }, select: { backupPath: true, backupRetentionDays: true } }),
    ])

    const serialized = backups.map(b => ({
      ...b,
      fileSize: Number(b.fileSize),
    }))

    return NextResponse.json({ backups: serialized, config })
  } catch (error) {
    return handleApiError(error)
  }
}

let pgDumpCmdCache: string | null = null

async function findPgDump(): Promise<string> {
  if (pgDumpCmdCache) return pgDumpCmdCache

  try {
    await new Promise<void>((resolve, reject) => {
      execFile('pg_dump', ['--version'], { timeout: 5000 }, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
    pgDumpCmdCache = 'pg_dump'
    return pgDumpCmdCache
  } catch {
    const pgDir = 'C:\\Program Files\\PostgreSQL'
    if (existsSync(pgDir)) {
      const versions = await fs.readdir(pgDir)
      versions.sort().reverse()
      for (const ver of versions) {
        const candidate = `${pgDir}\\${ver}\\bin\\pg_dump.exe`
        if (existsSync(candidate)) {
          pgDumpCmdCache = candidate
          return candidate
        }
      }
    }
    throw new Error(
      'pg_dump no está instalado o no se encuentra en el PATH. ' +
      'Instale PostgreSQL Tools (https://www.postgresql.org/download/)'
    )
  }
}

export async function POST() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const backupsBase = path.join(/* turbopackIgnore: true */ process.cwd(), 'backups')
    mkdirSync(backupsBase, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `backup-${timestamp}.sql`
    const filePath = path.join(backupsBase, fileName)

    const dbUrl = process.env.DATABASE_URL || ''
    const url = new URL(dbUrl)
    const dbName = url.pathname.replace('/', '')
    const pgUser = url.username
    const pgPass = url.password
    const pgHost = url.hostname
    const pgPort = url.port || '5432'

    const backupLog = await db.backupLog.create({
      data: {
        fileName,
        fileSize: BigInt(0),
        type: 'MANUAL',
        status: 'RUNNING',
        filePath,
        triggeredBy: currentUser.id,
      },
    })

    try {
      const pgDumpCmd = await findPgDump()

      const output = await new Promise<string>((resolve, reject) => {
        execFile(
          pgDumpCmd,
          ['-h', pgHost, '-p', pgPort, '-U', pgUser, '-d', dbName, '-F', 'p', '--no-owner', '--no-acl'],
          {
            maxBuffer: 100 * 1024 * 1024,
            timeout: 300000,
            env: { ...process.env, PGPASSWORD: pgPass },
          },
          (err, stdout) => {
            if (err) reject(err)
            else resolve(stdout)
          }
        )
      })

      await fs.writeFile(filePath, output, 'utf8')
      const stats = await fs.stat(filePath)

      await db.backupLog.update({
        where: { id: backupLog.id },
        data: { status: 'COMPLETED', fileSize: BigInt(stats.size), completedAt: new Date() },
      })

      await logAudit({
        userId: currentUser.id,
        action: 'BACKUP_CREATE',
        entityType: 'BackupLog',
        entityId: backupLog.id,
        description: `Copia de seguridad manual: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
        severity: 'INFO',
      })

      return NextResponse.json({ id: backupLog.id, fileName, status: 'COMPLETED' })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al ejecutar pg_dump'
      await db.backupLog.update({
        where: { id: backupLog.id },
        data: { status: 'FAILED', errorMessage, completedAt: new Date() },
      })

      try { await fs.unlink(filePath) } catch { /* ignorar */ }

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}
