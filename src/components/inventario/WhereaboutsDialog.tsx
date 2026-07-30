'use client'

import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/http'
import type { WhereaboutsResponse, WhereaboutsUnit } from '@/types'
import { MapPin, User, Calendar, FileText, Loader2, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface WhereaboutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: number
  itemName: string
}

const REFERENCE_LABELS: Record<string, string> = {
  ORDER: 'Pedido',
  LOAN: 'Préstamo',
  ASSIGNMENT: 'Asignación',
}

export function WhereaboutsDialog({ open, onOpenChange, itemId, itemName }: WhereaboutsDialogProps) {
  const [data, setData] = useState<WhereaboutsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      return
    }

    const fetchWhereabouts = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await apiFetch(`/api/items/${itemId}/whereabouts`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        } else {
          const err = await response.json()
          setError(err.error || 'Error al obtener ubicación')
        }
      } catch {
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    fetchWhereabouts()
  }, [open, itemId])

  const getReasonIcon = (reason: string) => {
    if (reason.includes('Pedido')) return <FileText className="h-3.5 w-3.5 text-blue-500" />
    if (reason.includes('Préstamo')) return <FileText className="h-3.5 w-3.5 text-purple-500" />
    if (reason.includes('Asignado')) return <User className="h-3.5 w-3.5 text-green-500" />
    return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Ubicación de Unidades Patrimoniales
          </DialogTitle>
          <DialogDescription>
            {itemName} — Rastreo de todas las unidades patrimoniales
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{data.totalUnits}</p>
                <p className="text-xs text-muted-foreground">Total unidades</p>
              </div>
              <div className="flex-1 rounded-lg border p-3 text-center border-green-200 bg-green-50">
                <p className="text-2xl font-bold text-green-700">{data.availableUnits}</p>
                <p className="text-xs text-green-600">Disponibles</p>
              </div>
              <div className="flex-1 rounded-lg border p-3 text-center border-orange-200 bg-orange-50">
                <p className="text-2xl font-bold text-orange-700">{data.unavailableUnits.length}</p>
                <p className="text-xs text-orange-600">Fuera</p>
              </div>
            </div>

            {data.unavailableUnits.length > 0 ? (
              <ScrollArea className="max-h-[50vh] pr-2">
                <div className="space-y-2">
                  {data.unavailableUnits.map((unit: WhereaboutsUnit) => (
                    <div key={unit.patrimonialCode} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getReasonIcon(unit.reason)}
                          <span className="font-mono text-sm font-medium">{unit.patrimonialCode}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {REFERENCE_LABELS[unit.referenceType] || unit.referenceType}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Ubicación:</span>
                          <span className="font-medium truncate">{unit.currentLocation || 'Desconocida'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Responsable:</span>
                          <span className="font-medium truncate">
                            {unit.currentHolder || 'No registrado'}
                          </span>
                        </div>
                        {unit.holderDni && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">DNI:</span>
                            <span className="text-xs">{unit.holderDni}</span>
                          </div>
                        )}
                        {unit.referenceNumber && (
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">Doc:</span>
                            <span className="font-medium text-xs">{unit.referenceNumber}</span>
                          </div>
                        )}
                      </div>

                      {unit.since && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Desde: {format(new Date(unit.since), 'dd/MM/yyyy', { locale: es })}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Todas las unidades están disponibles en el almacén</p>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
