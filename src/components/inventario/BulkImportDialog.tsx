'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  ArrowLeft,
  Table2,
  Columns3,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { useConfigStore } from '@/store'
import { parseExcel } from '@/lib/excel-parser'

const ITEM_FIELDS = [
  { key: 'nombre', label: 'Nombre *', required: true },
  { key: 'codigo', label: 'Código', required: false },
  { key: 'modelo', label: 'Modelo', required: false },
  { key: 'marca', label: 'Marca', required: false },
  { key: 'color', label: 'Color', required: false },
  { key: 'serie', label: 'Serie', required: false },
  { key: 'tipo', label: 'Tipo (CONSUMIBLE/PATRIMONIAL)', required: false },
  { key: 'categoria', label: 'Categoría', required: false },
  { key: 'cantidad', label: 'Cantidad', required: false },
  { key: 'unidad', label: 'Unidad de Medida', required: false },
  { key: 'stockMinimo', label: 'Stock Mínimo', required: false },
  { key: 'codigoPatrimonial', label: 'Código Patrimonial', required: false },
  { key: 'almacen', label: 'Almacén', required: false },
  { key: 'ubicacion', label: 'Ubicación', required: false },
  { key: 'especificaciones', label: 'Especificaciones Técnicas', required: false },
  { key: 'estado', label: 'Estado', required: false },
]

const FIELD_KEYS = ITEM_FIELDS.map(f => f.key)

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

type Step = 'upload' | 'mapping' | 'preview' | 'result'

export function BulkImportDialog({ open, onOpenChange, onImportComplete }: Props) {
  const { config } = useConfigStore()
  const primaryColor = config?.primaryColor || '#1e40af'

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([])
  const [sourceColumns, setSourceColumns] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<{
    success: number
    errors: Array<{ row: number; error: string }>
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setParsedData([])
    setSourceColumns([])
    setColumnMapping({})
    setResult(null)
    setIsImporting(false)
  }, [])

  const handleFile = useCallback(async (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Formato no soportado. Use .csv, .xlsx o .xls')
      return
    }

    setFile(f)
    try {
      const records = await parseExcel(f)
      if (records.length === 0) {
        toast.error('El archivo está vacío o no tiene datos válidos')
        return
      }
      setParsedData(records)
      const cols = Object.keys(records[0]!)
      setSourceColumns(cols)

      const autoMap: Record<string, string> = {}
      cols.forEach(col => {
        const match = FIELD_KEYS.find(k => col.includes(k) || k.includes(col))
        if (match) autoMap[col] = match
      })
      setColumnMapping(autoMap)

      setStep('mapping')
    } catch {
      toast.error('Error al leer el archivo')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const waitForJobResult = async (jobId: string, maxRetries = 30): Promise<{ success: number; errors: Array<{ row: number; error: string }> } | null> => {
    for (let i = 0; i < maxRetries; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try {
        const res = await apiFetch(`/api/jobs/${jobId}`)
        if (!res.ok) continue
        const jobData = await res.json()
        if (jobData.status === 'completed') {
          const r = jobData.result as { successCount: number; errorCount: number; success: Array<{ row: number }>; errors: Array<{ row: number; error: string }> }
          return {
            success: r?.successCount ?? 0,
            errors: r?.errors ?? [],
          }
        }
        if (jobData.status === 'failed') {
          return {
            success: 0,
            errors: [{ row: 0, error: jobData.error || 'Error desconocido en el procesamiento' }],
          }
        }
      } catch { /* esperar siguiente intento */ }
    }
    return null
  }

  const handleImport = async () => {
    if (!file) return
    setIsImporting(true)
    setResult(null)

    try {
      const mappedData = parsedData.map((record) => {
        const mapped: Record<string, string> = {}
        Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
          const val = record[sourceCol] ?? ''
          if (targetField && val) {
            mapped[targetField] = val
          }
        })
        if (!mapped.nombre && !mapped.name) {
          const nameCol = sourceColumns.find(c => c.includes('nombre') || c.includes('name'))
          if (nameCol) mapped.nombre = record[nameCol] ?? ''
        }
        return mapped
      })

      const csvHeader = FIELD_KEYS.join(',')
      const csvRows = mappedData.map(row => {
        return FIELD_KEYS.map(k => {
          const val = row[k] ?? ''
          return `"${String(val).replace(/"/g, '""')}"`
        }).join(',')
      })
      const csvContent = [csvHeader, ...csvRows].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const formData = new FormData()
      formData.append('file', blob, 'import.csv')

      const response = await apiFetch('/api/items/bulk-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Error al importar')
        return
      }

      const jobId = data.jobId as string
      if (!jobId) {
        toast.error('Error: no se pudo iniciar el job de importación')
        return
      }

      toast.info('Procesando importación...')

      const jobResult = await waitForJobResult(jobId)
      if (!jobResult) {
        toast.error('La importación está tomando más tiempo de lo esperado. Consulte el resultado más tarde.')
        return
      }

      setResult(jobResult)
      setStep('result')
      if (jobResult.errors.length === 0) {
        toast.success(`${jobResult.success} bien(es) importado(s) correctamente`)
      } else {
        toast.warning(`Importación completada con ${jobResult.errors.length} error(es)`)
      }
      onImportComplete()
    } catch {
      toast.error('Error al importar los datos')
    } finally {
      setIsImporting(false)
    }
  }

  const previewRows = parsedData.slice(0, 10)
  const displayColumns = sourceColumns.slice(0, 6)

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) reset()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-semibold text-xl text-zinc-900 dark:text-white">
                Importar desde Excel
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                {step === 'upload' && 'Seleccione un archivo .csv, .xlsx o .xls'}
                {step === 'mapping' && 'Revise y configure la asignación de columnas'}
                {step === 'result' && 'Resultado de la importación'}
              </DialogDescription>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 shadow-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Paso 1: Carga */}
          {step === 'upload' && (
            <>
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Info className="h-4 w-4" />
                  <span className="font-medium text-sm">Formato esperado del archivo</span>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  La primera fila debe contener los nombres de las columnas. El sistema intentará asignarlas automáticamente. Columnas disponibles:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ITEM_FIELDS.map((f) => (
                    <span
                      key={f.key}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                        f.required
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                          : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {f.label}
                      {f.required && <span className="text-red-500 font-bold">*</span>}
                    </span>
                  ))}
                </div>
              </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Upload
                    className="h-8 w-8"
                    style={{ color: primaryColor }}
                  />
                </div>
                <div>
                  <p className="text-lg font-medium text-zinc-900 dark:text-white">
                    {isDragging ? 'Suelte el archivo aquí' : 'Arrastre su archivo aquí'}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    o haga clic para seleccionar un archivo
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  .csv, .xlsx, .xls
                </Badge>
              </div>
            </div>
            </>
          )}

          {/* Paso 2: Asignación de columnas */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                    <Columns3 className="h-4 w-4" />
                    <span className="font-medium">
                      {parsedData.length} filas encontradas.
                    </span>
                    <span>
                      Asigne cada columna del archivo al campo correspondiente.
                    </span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sourceColumns.map((col) => (
                  <div key={col} className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Columna: <span className="font-mono text-zinc-800 dark:text-zinc-200">{col}</span>
                    </Label>
                    <Select
                      value={columnMapping[col] ?? ''}
                      onValueChange={(val) =>
                        setColumnMapping((prev) => ({ ...prev, [col]: val }))
                      }
                    >
                      <SelectTrigger className="h-9 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white">
                        <SelectValue placeholder="— No importar —" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 max-h-60">
                        <SelectItem value="__skip__" className="text-zinc-500">
                          — No importar —
                        </SelectItem>
                        {ITEM_FIELDS.map((field) => (
                          <SelectItem
                            key={field.key}
                            value={field.key}
                            className="text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          >
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Vista previa */}
              {previewRows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                    <Table2 className="h-4 w-4" />
                    Vista previa (primeras {previewRows.length} filas)
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <Table responsiveCards>
                      <TableHeader>
                        <TableRow className="bg-zinc-50 dark:bg-zinc-800/50">
                          <TableHead className="text-xs w-10">#</TableHead>
                          {displayColumns.map((col) => (
                            <TableHead key={col} className="text-xs font-mono whitespace-nowrap">
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRows.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-zinc-400">{idx + 1}</TableCell>
                            {displayColumns.map((col) => (
                              <TableCell key={col} className="text-xs max-w-[150px] truncate">
                                {row[col] || <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {parsedData.length > 10 && (
                    <p className="text-xs text-zinc-400 mt-1">
                      ...y {parsedData.length - 10} filas más
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Resultado */}
          {step === 'result' && result && (
            <div className="space-y-4 text-center py-8">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{ backgroundColor: result.errors.length === 0 ? '#22c55e20' : '#f59e0b20' }}
              >
                {result.errors.length === 0 ? (
                  <Check className="h-10 w-10 text-green-500" />
                ) : (
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                  Importación {result.errors.length === 0 ? 'completada' : 'con advertencias'}
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                  {result.success} bien(es) procesado(s)
                  {result.errors.length > 0 && `, ${result.errors.length} error(es)`}
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left max-h-40 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <p key={idx} className="text-sm text-red-600 dark:text-red-400">
                      Fila {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones del pie */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-zinc-200 dark:border-zinc-800">
          {step === 'upload' && (
            <div />
          )}
          {step === 'mapping' && (
            <Button
              variant="outline"
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setStep('upload')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Cambiar archivo
            </Button>
          )}
          {step === 'result' && (
            <div />
          )}

          <div className="flex gap-3">
            {(step === 'upload' || step === 'result') && (
              <Button
                variant="outline"
                className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  onOpenChange(false)
                  reset()
                }}
              >
                Cerrar
              </Button>
            )}
            {step === 'mapping' && (
              <>
                <Button
                  variant="outline"
                  className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    onOpenChange(false)
                    reset()
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={isImporting}
                  style={{ backgroundColor: primaryColor }}
                  className="text-white"
                  onClick={handleImport}
                >
                  {isImporting ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar {parsedData.length} bienes
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 'result' && (
              <Button
                style={{ backgroundColor: primaryColor }}
                className="text-white"
                onClick={() => {
                  onOpenChange(false)
                  reset()
                }}
              >
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
