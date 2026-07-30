'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { ItemTimeline } from '@/components/ui/item-timeline'
import {
  QrCode,
  Search,
  MapPin,
  Clock,
  User,
  Package,
  ArrowRight,
  History,
  Loader2,
  Camera,
  Download,
  FileText,
  FileSpreadsheet,
  List,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ItemMovement, Item, QRScanLog } from '@/types'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

interface MovementWithDetails extends ItemMovement {
  item: Item
}

interface ScanLogWithDetails extends QRScanLog {
  item?: Item
}

export function TraceabilityModule() {
  const [searchCode, setSearchCode] = useState('')
  const [movements, setMovements] = useState<MovementWithDetails[]>([])
  const [scanLogs, setScanLogs] = useState<ScanLogWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMovement, setSelectedMovement] = useState<MovementWithDetails | null>(null)
  const [activeTab, setActiveTab] = useState('search')
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards')

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchRecentMovements(), fetchRecentScans()])
      setIsLoading(false)
    }
    loadData()
  }, [])

  const fetchRecentMovements = async () => {
    try {
      const response = await apiFetch('/api/traceability/movements?limit=50')
      if (response.ok) {
        const data = await response.json()
        setMovements(data.movements || [])
      }
    } catch (error) {
      console.error('Error al obtener movements:', error)
    }
  }

  const fetchRecentScans = async () => {
    try {
      const response = await apiFetch('/api/traceability/scans?limit=50')
      if (response.ok) {
        const data = await response.json()
        setScanLogs(data.scans || [])
      }
    } catch (error) {
      console.error('Error al obtener scans:', error)
    }
  }

  const searchByCode = async () => {
    if (!searchCode.trim()) {
      toast.error('Ingresa un código para buscar')
      return
    }

    setIsLoading(true)
    try {
      const response = await apiFetch(`/api/traceability/${encodeURIComponent(searchCode.trim())}`)
      if (response.ok) {
        const data = await response.json()
        if (data.movements && data.movements.length > 0) {
          setMovements(data.movements)
          setSelectedMovement(data.movements[0])
        } else {
          toast.info('No se encontraron movimientos para este código')
        }
      } else {
        throw new Error('Error en la búsqueda')
      }
    } catch (error) {
      console.error('Error al buscar:', error)
      toast.error('No se pudo realizar la búsqueda')
    } finally {
      setIsLoading(false)
    }
  }

  const getMovementTypeLabel = (from: string | null, to: string) => {
    if (!from) return { label: 'Ingreso', color: 'bg-green-500' }
    if (from === to) return { label: 'Reubicación', color: 'bg-blue-500' }
    return { label: 'Traslado', color: 'bg-amber-500' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trazabilidad QR</h1>
          <p className="text-muted-foreground">
            Historial de movimientos y escaneos de bienes
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/scan'}
        >
          <Camera className="h-4 w-4 mr-2" />
          Escanear QR
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const data = movements.map(m => ({
                bien: m.item.name,
                codigoPatrimonial: m.patrimonialCode,
                origen: m.fromLocation || '',
                destino: m.toLocation,
                responsable: m.movedBy.fullName,
                fecha: m.createdAt,
                motivo: m.reason || '',
              }))
              exportToCSV(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigoPatrimonial', label: 'Código Patrimonial' },
                { key: 'origen', label: 'Origen' },
                { key: 'destino', label: 'Destino' },
                { key: 'responsable', label: 'Responsable' },
                { key: 'fecha', label: 'Fecha' },
                { key: 'motivo', label: 'Motivo' },
              ], `trazabilidad-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const data = movements.map(m => ({
                bien: m.item.name,
                codigoPatrimonial: m.patrimonialCode,
                origen: m.fromLocation || '',
                destino: m.toLocation,
                responsable: m.movedBy.fullName,
                fecha: m.createdAt,
                motivo: m.reason || '',
              }))
              exportToExcel(data, [
                { key: 'bien', label: 'Bien' },
                { key: 'codigoPatrimonial', label: 'Código Patrimonial' },
                { key: 'origen', label: 'Origen' },
                { key: 'destino', label: 'Destino' },
                { key: 'responsable', label: 'Responsable' },
                { key: 'fecha', label: 'Fecha' },
                { key: 'motivo', label: 'Motivo' },
              ], `trazabilidad-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Barra de Búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Buscar por Código</CardTitle>
          <CardDescription>
            Ingresa un código patrimonial o de bien para ver su historial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Código patrimonial o código de bien..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && searchByCode()}
              />
            </div>
            <Button onClick={searchByCode} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search">
            <Package className="h-4 w-4 mr-2" />
            Movimientos
          </TabsTrigger>
          <TabsTrigger value="scans">
            <QrCode className="h-4 w-4 mr-2" />
            Escaneos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Lista de Movimientos */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Historial de Movimientos</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode(v => v === 'cards' ? 'timeline' : 'cards')}
                      className="gap-1.5"
                    >
                      <List className="h-4 w-4" />
                      {viewMode === 'cards' ? 'Vista Línea de Tiempo' : 'Vista Tarjetas'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {isLoading ? (
                      <ModuleSkeleton variant="cards" />
                    ) : movements.length === 0 ? (
                      <EmptyState icon={History} title="No hay movimientos registrados" />
                    ) : viewMode === 'timeline' ? (
                      <ItemTimeline
                        events={movements.map(m => ({
                          id: m.id,
                          date: m.createdAt,
                          title: m.item.name,
                          description: [
                            m.fromLocation ? `${m.fromLocation} → ${m.toLocation}` : m.toLocation,
                            m.reason ? `Motivo: ${m.reason}` : '',
                            `Código: ${m.patrimonialCode}`,
                          ].filter(Boolean).join(' · '),
                          icon: <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />,
                          color: getMovementTypeLabel(m.fromLocation, m.toLocation).color === 'bg-green-500'
                            ? 'bg-green-500'
                            : getMovementTypeLabel(m.fromLocation, m.toLocation).color === 'bg-blue-500'
                              ? 'bg-blue-500'
                              : 'bg-amber-500',
                        }))}
                      />
                    ) : (
                      <div className="space-y-2">
                        {movements.map((movement) => {
                          const typeInfo = getMovementTypeLabel(movement.fromLocation, movement.toLocation)
                          const isSelected = selectedMovement?.id === movement.id
                          
                          return (
                            <div
                              key={movement.id}
                              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                isSelected 
                                  ? 'border-primary bg-primary/5' 
                                  : 'hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedMovement(movement)}
                            >
                              <div className="flex items-start gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${typeInfo.color} text-white`}>
                                  <ArrowRight className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium">{movement.item.name}</p>
                                    <Badge variant="outline" className="text-xs">
                                      {typeInfo.label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Código: {movement.patrimonialCode}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {movement.movedBy.fullName}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Detalles del Movimiento */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalles del Movimiento</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedMovement ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Bien</Label>
                        <p className="font-medium">{selectedMovement.item.name}</p>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Código Patrimonial</Label>
                        <p className="font-mono">{selectedMovement.patrimonialCode}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Origen</Label>
                          <p>{selectedMovement.fromLocation || '-'}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Destino</Label>
                          <p>{selectedMovement.toLocation}</p>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Responsable</Label>
                        <p>{selectedMovement.movedBy.fullName}</p>
                      </div>
                      
                      <div>
                        <Label className="text-xs text-muted-foreground">Fecha</Label>
                        <p>{format(new Date(selectedMovement.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}</p>
                      </div>
                      
                      {selectedMovement.reason && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Motivo</Label>
                          <p>{selectedMovement.reason}</p>
                        </div>
                      )}
                      
                      {selectedMovement.latitude && selectedMovement.longitude && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Ubicación</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="h-4 w-4 text-red-500" />
                            <span className="text-sm">
                              {selectedMovement.latitude.toFixed(6)}, {selectedMovement.longitude.toFixed(6)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ArrowRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona un movimiento para ver detalles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scans" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Registro de Escaneos QR</CardTitle>
              <CardDescription>Últimos escaneos realizados en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {scanLogs.length === 0 ? (
                  <EmptyState icon={QrCode} title="No hay escaneos registrados" />
                ) : (
                  <div className="space-y-2">
                    {scanLogs.map((scan) => (
                      <div key={scan.id} className="p-4 rounded-lg border">
                        <div className="flex items-start gap-4">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10">
                            <QrCode className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">{scan.code}</p>
                              <Badge variant="outline" className="text-xs">
                                {scan.scanType}
                              </Badge>
                            </div>
                            {scan.item && (
                              <p className="text-sm text-muted-foreground">
                                {scan.item.name}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(scan.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {scan.scannedBy.fullName}
                              </span>
                              {scan.latitude && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Con ubicación
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
