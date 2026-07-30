'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useConfigStore, useAuthStore } from '@/store'
import {
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
  Server,
  History,
  ChevronDown,
  ChevronRight,
  Info,
  Search,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

interface SyncLog {
  id: number
  system: string
  operation: string
  entityType: string
  recordsTotal: number
  recordsSuccess: number
  recordsFailed: number
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
  startedAt: string
  completedAt: string | null
  errorDetails?: Record<string, unknown> | null
}

interface SyncStatus {
  lastSync: SyncLog | null
  history: SyncLog[]
  availableEntityTypes: Array<{
    value: string
    label: string
    description: string
  }>
}

export function SincronizacionModule() {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedEntityType, setSelectedEntityType] = useState<string>('items')
  const [forceFull, setForceFull] = useState(false)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchStatus = async () => {
    try {
      const response = await apiFetch('/api/sync')
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error al obtener sync status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleSync = async () => {
    if (!selectedEntityType) {
      toast.error('Seleccione un tipo de entidad')
      return
    }

    setIsSyncing(true)
    try {
      const response = await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: selectedEntityType,
          forceFull: forceFull
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          toast.success(`Sincronización completada: ${result.result.recordsSuccess} registros`)
        } else {
          toast.error('Error en la sincronización')
        }
        fetchStatus()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Error al sincronizar')
      }
    } catch (error) {
      console.error('Error de sincronización:', error)
      toast.error('Error de conexión')
    } finally {
      setIsSyncing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Exitoso</Badge>
      case 'PARTIAL':
        return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Parcial</Badge>
      case 'FAILED':
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Fallido</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getEntityTypeLabel = (type: string) => {
    const found = status?.availableEntityTypes.find(e => e.value === type)
    return found?.label || type
  }

  const historyList = status?.history || []
  const filteredHistory = historyList.filter(h => {
    const matchesSearch = normalizeText(getEntityTypeLabel(h.entityType)).includes(normalizeText(search))
    const matchesStatus = statusFilter === 'all' || h.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (isLoading) {
    return <ModuleSkeleton variant="cards" />
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Sincronización SIGA
          </h1>
          <p className="text-muted-foreground">
            Sincronización de datos con el Sistema Integrado de Gestión Administrativa
          </p>
        </div>
        <Button variant="outline" onClick={fetchStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
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
              const data = filteredHistory.map(h => ({
                entidad: h.entityType,
                operacion: h.operation,
                registrosTotal: h.recordsTotal,
                registrosExitosos: h.recordsSuccess,
                registrosFallidos: h.recordsFailed,
                estado: h.status,
                iniciado: h.startedAt,
                completado: h.completedAt || '',
              }))
              exportToCSV(data, [
                { key: 'entidad', label: 'Entidad' },
                { key: 'operacion', label: 'Operación' },
                { key: 'registrosTotal', label: 'Total Registros' },
                { key: 'registrosExitosos', label: 'Exitosos' },
                { key: 'registrosFallidos', label: 'Fallidos' },
                { key: 'estado', label: 'Estado' },
                { key: 'iniciado', label: 'Iniciado' },
                { key: 'completado', label: 'Completado' },
              ], `sincronizacion-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileText className="h-4 w-4 mr-2" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const data = filteredHistory.map(h => ({
                entidad: h.entityType,
                operacion: h.operation,
                registrosTotal: h.recordsTotal,
                registrosExitosos: h.recordsSuccess,
                registrosFallidos: h.recordsFailed,
                estado: h.status,
                iniciado: h.startedAt,
                completado: h.completedAt || '',
              }))
              exportToExcel(data, [
                { key: 'entidad', label: 'Entidad' },
                { key: 'operacion', label: 'Operación' },
                { key: 'registrosTotal', label: 'Total Registros' },
                { key: 'registrosExitosos', label: 'Exitosos' },
                { key: 'registrosFallidos', label: 'Fallidos' },
                { key: 'estado', label: 'Estado' },
                { key: 'iniciado', label: 'Iniciado' },
                { key: 'completado', label: 'Completado' },
              ], `sincronizacion-${new Date().toISOString().slice(0, 10)}`)
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Último Estado de Sincronización */}
      {status?.lastSync && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Última Sincronización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {format(new Date(status.lastSync.startedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entidad</p>
                <p className="font-medium">{getEntityTypeLabel(status.lastSync.entityType)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registros</p>
                <p className="font-medium">
                  {status.lastSync.recordsSuccess} / {status.lastSync.recordsTotal}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                {getStatusBadge(status.lastSync.status)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sync">
            <Play className="h-4 w-4 mr-2" />
            Ejecutar Sync
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Historial
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Sincronización */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ejecutar Sincronización Manual</CardTitle>
              <CardDescription>
                Seleccione la entidad a sincronizar y ejecute la sincronización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.role !== 'ADMINISTRADOR' && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Permisos Insuficientes</AlertTitle>
                  <AlertDescription>
                    Solo los administradores pueden ejecutar sincronizaciones manuales.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Entidad a Sincronizar</label>
                  <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {status?.availableEntityTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {status?.availableEntityTypes.find(t => t.value === selectedEntityType)?.description}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Opciones</label>
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      id="forceFull"
                      checked={forceFull}
                      onChange={(e) => setForceFull(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="forceFull" className="text-sm">
                      Forzar sincronización completa
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Si está marcado, actualizará todos los registros existentes
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleSync} 
                disabled={isSyncing || user?.role !== 'ADMINISTRADOR'}
                className="w-full md:w-auto"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Sincronización
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Estadísticas Rápidas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {status?.history.filter(h => h.status === 'SUCCESS').length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Exitosas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {status?.history.filter(h => h.status === 'PARTIAL').length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Parciales</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {status?.history.filter(h => h.status === 'FAILED').length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Fallidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Pestaña de Historial */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4 pb-0">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por entidad..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="SUCCESS">Exitosos</SelectItem>
                    <SelectItem value="PARTIAL">Parciales</SelectItem>
                    <SelectItem value="FAILED">Fallidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardHeader>
              <CardTitle>Historial de Sincronizaciones</CardTitle>
              <CardDescription>
                Registro de todas las sincronizaciones realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredHistory.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {filteredHistory.map((log) => (
                      <div key={log.id} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          <div className="flex items-center gap-4">
                            {expandedLog === log.id ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium">{getEntityTypeLabel(log.entityType)}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(log.startedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm">
                                {log.recordsSuccess} / {log.recordsTotal} registros
                              </p>
                              {log.completedAt && (
                                <p className="text-xs text-muted-foreground">
                                  Duración: {Math.round(
                                    (new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
                                  )}s
                                </p>
                              )}
                            </div>
                            {getStatusBadge(log.status)}
                          </div>
                        </div>

                        {expandedLog === log.id && log.errorDetails && (
                          <div className="px-4 pb-4 pt-0">
                            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                              <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                                Detalles del Error
                              </p>
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(log.errorDetails, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState icon={Database} title={search || statusFilter !== 'all' ? 'No se encontraron registros con los filtros actuales' : 'No hay registros de sincronización'} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Panel de Información */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Sobre la Sincronización SIGA</p>
              <ul className="list-disc list-inside space-y-1">
                <li>La sincronización importa datos del Sistema Integrado de Gestión Administrativa</li>
                <li>Los bienes sincronizados se crean como nuevos registros si no existen</li>
                <li>La sincronización completa actualiza todos los registros existentes</li>
                <li>Se recomienda sincronizar periódicamente para mantener datos actualizados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
