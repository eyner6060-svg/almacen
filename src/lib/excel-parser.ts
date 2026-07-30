'use client'

import * as XLSX from 'xlsx'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []
  const headers = parseCSVLine(headerLine).map(h => h.trim().toLowerCase())
  const records: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const values = parseCSVLine(line)
    if (values.length === 0) continue

    const record: Record<string, string> = {}
    headers.forEach((header, idx) => {
      record[header] = values[idx]?.trim() ?? ''
    })
    records.push(record)
  }

  return records
}

function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

export async function parseExcel(file: File): Promise<Record<string, string>[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'csv') {
    const text = await file.text()
    return parseCSV(text)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []
    const worksheet = workbook.Sheets[sheetName]!
    const records: Record<string, string>[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: '',
    }).map((row: unknown) => {
      const normalized: Record<string, string> = {}
      for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
        normalized[key.toLowerCase().trim()] = String(val ?? '')
      }
      return normalized
    })
    return records
  }

  throw new Error('Formato de archivo no soportado. Use .csv, .xlsx o .xls')
}
