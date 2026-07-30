'use client'

import * as XLSX from 'xlsx'

function escapeCSV(value: unknown): string {
  const str = value == null ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCSV<T>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
): void {
  if (data.length === 0) return

  const headers = columns.map((c) => c.label).join(',')
  const rows = data
    .map((row) => columns.map((c) => escapeCSV(row[c.key])).join(','))
    .join('\r\n')

  const bom = '\uFEFF'
  const csv = bom + headers + '\r\n' + rows

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportToExcel<T>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  filename: string,
): void {
  if (data.length === 0) return

  const wsData = [
    columns.map((c) => c.label),
    ...data.map((row) => columns.map((c) => row[c.key] ?? '')),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
