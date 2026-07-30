import fs from 'fs'
import path from 'path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  data?: unknown
  timestamp: string
  module?: string
}

interface Transport {
  log(entry: LogEntry, formatted: string): void
}

class ConsoleTransport implements Transport {
  log(entry: LogEntry, formatted: string): void {
    switch (entry.level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      default:
        console.debug(formatted)
    }
  }
}

class FileTransport implements Transport {
  private stream: fs.WriteStream | null = null
  private logDir: string
  private currentDate: string

  constructor() {
    this.logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs')
    this.currentDate = ''
    this.ensureStream()
  }

  private getDate(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private ensureStream(): void {
    const date = this.getDate()
    if (date === this.currentDate && this.stream) return

    if (this.stream) {
      this.stream.end()
    }

    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
      const filePath = path.join(this.logDir, `${date}.log`)
      this.stream = fs.createWriteStream(filePath, { flags: 'a' })
      this.currentDate = date
    } catch {
      // No se pudo crear el archivo de log
    }
  }

  log(_entry: LogEntry, formatted: string): void {
    this.ensureStream()
    if (this.stream) {
      this.stream.write(formatted + '\n')
    }
  }
}

const transports: Transport[] = [new ConsoleTransport()]

if (process.env.NODE_ENV === 'production' || process.env.FILE_LOGGING === 'true') {
  transports.push(new FileTransport())
}

function formatLog(entry: LogEntry): string {
  const prefix = entry.module ? `[${entry.module}]` : ''
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
  return `${entry.timestamp} ${entry.level.toUpperCase()} ${prefix} ${entry.message}${data}`
}

function getTimestamp(): string {
  return new Date().toISOString()
}

function log(level: LogLevel, message: string, data?: unknown, module?: string): void {
  const entry: LogEntry = { level, message, data, timestamp: getTimestamp(), module }
  const formatted = formatLog(entry)
  for (const t of transports) {
    t.log(entry, formatted)
  }
}

export const logger = {
  debug: (message: string, data?: unknown, module?: string) => log('debug', message, data, module),
  info: (message: string, data?: unknown, module?: string) => log('info', message, data, module),
  warn: (message: string, data?: unknown, module?: string) => log('warn', message, data, module),
  error: (message: string, error?: unknown, module?: string) => {
    const data = error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    log('error', message, data, module)
  },
}

export function addTransport(transport: Transport): void {
  transports.push(transport)
}
