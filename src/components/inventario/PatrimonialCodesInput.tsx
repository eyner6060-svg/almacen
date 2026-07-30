'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { 
  Plus, Trash2, AlertCircle, CheckCircle, Copy, Sparkles, 
  FileText, List, Grid, X, QrCode
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  quantity: number
  value: string[]
  onChange: (codes: string[]) => void
  existingCodes?: string[]
  disabled?: boolean
}

export function PatrimonialCodesInput({ 
  quantity, 
  value, 
  onChange, 
  existingCodes = [],
  disabled = false 
}: Props) {
  const [inputMode, setInputMode] = useState<'list' | 'bulk'>('list')
  const [bulkText, setBulkText] = useState('')
  const [newCode, setNewCode] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    if (value.length > 0 && bulkText === '') {
      setBulkText(value.join('\n'))
    }
  }, [value, bulkText])

  // Validar códigos duplicados dentro del mismo input
  const duplicates = value.filter((code, index) => value.indexOf(code) !== index)
  
  // Validar códigos que ya existen en la base de datos
  const existingDuplicates = value.filter(code => existingCodes.includes(code))

  // Agregar un código individual
  const addCode = () => {
    if (!newCode.trim()) return
    
    if (value.includes(newCode.trim())) {
      toast.error('El código ya está en la lista')
      return
    }
    
    if (existingCodes.includes(newCode.trim())) {
      toast.error('El código ya existe en el sistema')
      return
    }
    
    onChange([...value, newCode.trim()])
    setNewCode('')
  }

  // Eliminar un código
  const removeCode = (index: number) => {
    const newCodes = [...value]
    newCodes.splice(index, 1)
    onChange(newCodes)
  }

  // Procesar texto masivo
  const processBulkText = () => {
    const codes = bulkText
      .split(/[\n,;]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
    
    // Verificar duplicados en el texto
    const uniqueCodes = [...new Set(codes)]
    
    // Verificar códigos que ya existen
    const duplicatesInSystem = uniqueCodes.filter(c => existingCodes.includes(c))
    
    if (duplicatesInSystem.length > 0) {
      toast.error(`${duplicatesInSystem.length} código(s) ya existen en el sistema: ${duplicatesInSystem.slice(0, 3).join(', ')}...`)
      return
    }
    
    onChange(uniqueCodes)
    setBulkText(uniqueCodes.join('\n'))
    toast.success(`${uniqueCodes.length} códigos procesados`)
  }

  // Generar códigos automáticamente
  const generateCodes = () => {
    const prefix = 'PAT'
    const codes: string[] = []
    
    // Encontrar el último número usado en existingCodes
    let maxNum = 0
    existingCodes.forEach(code => {
      const match = code.match(/PAT-(\d+)/)
      if (match && match[1]) {
        const num = parseInt(match[1])
        if (num > maxNum) maxNum = num
      }
    })
    
    // También verificar los códigos actuales
    value.forEach(code => {
      const match = code.match(/PAT-(\d+)/)
      if (match && match[1]) {
        const num = parseInt(match[1])
        if (num > maxNum) maxNum = num
      }
    })

    // Generar códigos consecutivos
    for (let i = 0; i < quantity; i++) {
      const num = maxNum + i + 1
      codes.push(`${prefix}-${String(num).padStart(6, '0')}`)
    }
    
    onChange(codes)
    setBulkText(codes.join('\n'))
    toast.success(`Se generaron ${codes.length} códigos automáticamente`)
  }

  // Limpiar todos los códigos
  const clearAll = () => {
    onChange([])
    setBulkText('')
    setNewCode('')
  }

  // Copiar códigos al portapapeles
  const copyToClipboard = () => {
    navigator.clipboard.writeText(value.join('\n'))
    toast.success('Códigos copiados al portapapeles')
  }

  const isComplete = value.length === quantity && duplicates.length === 0 && existingDuplicates.length === 0
  const isValidating = value.length > 0 && (duplicates.length > 0 || existingDuplicates.length > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold flex items-center gap-2">
          Códigos Patrimoniales
          <Badge variant={isComplete ? 'default' : isValidating ? 'destructive' : 'secondary'}>
            {value.length} / {quantity} unidades
          </Badge>
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInputMode(inputMode === 'list' ? 'bulk' : 'list')}
            disabled={disabled}
          >
            {inputMode === 'list' ? (
              <>
                <FileText className="h-4 w-4 mr-1" />
                Modo Texto
              </>
            ) : (
              <>
                <List className="h-4 w-4 mr-1" />
                Modo Lista
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={generateCodes}
            disabled={disabled}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Auto-generar
          </Button>
          {value.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={disabled}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Indicadores de estado */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {isComplete && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Códigos completos
            </Badge>
          )}
          {value.length !== quantity && (
            <Badge variant="outline" className="text-amber-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Faltan {quantity - value.length} código(s)
            </Badge>
          )}
          {duplicates.length > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {duplicates.length} código(s) duplicado(s)
            </Badge>
          )}
          {existingDuplicates.length > 0 && (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {existingDuplicates.length} código(s) ya existen en el sistema
            </Badge>
          )}
        </div>
      )}

      {inputMode === 'bulk' ? (
        // Modo texto masivo
        <div className="space-y-2">
          <Textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Ingrese ${quantity} códigos, uno por línea o separados por comas:&#10;PAT-000001&#10;PAT-000002&#10;PAT-000003`}
            rows={Math.min(10, quantity + 1)}
            disabled={disabled}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {bulkText.split(/[\n,;]+/).filter(c => c.trim()).length} códigos detectados
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={processBulkText}
              disabled={disabled}
            >
              Procesar Códigos
            </Button>
          </div>
        </div>
      ) : (
        // Modo lista individual
        <div className="space-y-3">
          {/* Input para agregar código */}
          <div className="flex gap-2">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="Ingrese un código patrimonial"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCode()
                }
              }}
              disabled={disabled || value.length >= quantity}
              className="font-mono"
            />
            <Button
              type="button"
              onClick={addCode}
              disabled={disabled || !newCode.trim() || value.length >= quantity}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Lista de códigos */}
          {value.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Códigos ingresados:</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  >
                    {viewMode === 'grid' ? (
                      <List className="h-4 w-4" />
                    ) : (
                      <Grid className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyToClipboard}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {viewMode === 'grid' ? (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg max-h-60 overflow-y-auto">
                  {value.map((code, index) => {
                    const isDuplicate = duplicates.includes(code) || existingDuplicates.includes(code)
                    return (
                      <div
                        key={`${code}-${index}`}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm font-mono ${
                          isDuplicate 
                            ? 'bg-red-100 text-red-800 border border-red-300' 
                            : 'bg-background border'
                        }`}
                      >
                        <span>{code}</span>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => removeCode(index)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {value.map((code, index) => {
                    const isDuplicate = duplicates.includes(code) || existingDuplicates.includes(code)
                    return (
                      <div
                        key={`${code}-${index}`}
                        className={`flex items-center justify-between p-2 rounded-md text-sm font-mono ${
                          isDuplicate 
                            ? 'bg-red-100 text-red-800 border border-red-300' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                          {code}
                        </span>
                        {!disabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCode(index)}
                            className="h-6 w-6 p-0 text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {value.length === 0 && (
            <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
              <QrCode className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay códigos ingresados</p>
              <p className="text-xs mt-1">Use el campo de arriba o el botón "Auto-generar"</p>
            </div>
          )}
        </div>
      )}

      {/* Información adicional */}
      <p className="text-xs text-muted-foreground">
        Cada bien patrimonial debe tener un código único. Si no tiene códigos predefinidos, 
        puede usar el botón "Auto-generar" para crear códigos consecutivos.
      </p>
    </div>
  )
}
