'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useConfigStore, useAuthStore } from '@/store'
import { apiFetch } from '@/lib/http'
import {
  Shield,
  AlertTriangle,
  Eye,
  MapPin,
  Monitor,
  Clock,
  User,
  RefreshCw,
  Search,
  Globe,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Activity,
  FileText,
  Edit3,
  Trash2,
  LogIn,
  LogOut,
  Key,
  Ban,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'

interface SecurityEvent {
  id: number
  userId: number | null
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'SUSPICIOUS_ACCESS' | 'PERMISSION_DENIED'
  ipAddress: string | null
  geolocation: string | null
  userAgent: string | null
  deviceFingerprint: string | null
  details: Record<string, unknown> | null
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  createdAt: string
  user?: {
    id: number
    fullName: string
    email: string
    role: string
  } | null
}

interface SecurityStats {
  total24h: number
  failedLogins24h: number
  suspiciousEvents24h: number
  uniqueIPs24h: number
}

interface SecurityResponse {
  events: SecurityEvent[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  statistics: SecurityStats
}

interface AuditLogEntry {
  id: number
  userId: number | null
  action: string
  entityType: string
  entityId: number | null
  description: string
  severity: string
  ipAddress: string | null
  userAgent: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user?: {
    id: number
    fullName: string
    email: string
    role: string
  } | null
}

interface AuditLogResponse {
  logs: AuditLogEntry[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de Sesión',
  LOGOUT: 'Cierre de Sesión',
  LOGIN_FAILED: 'Inicio Fallido',
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  AUTHORIZE: 'Autorización',
  REJECT: 'Rechazo',
  STATUS_CHANGE: 'Cambio de Estado',
  ROLE_CHANGE: 'Cambio de Rol',
  PASSWORD_CHANGE: 'Cambio de Contraseña',
  PIN_CHANGE: 'Cambio de PIN',
  EXPORT: 'Exportación',
  IMPORT: 'Importación',
  BACKUP: 'Respaldo',
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LOGIN: <LogIn className="h-4 w-4 text-green-500" />,
  LOGOUT: <LogOut className="h-4 w-4 text-gray-500" />,
  LOGIN_FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  CREATE: <FileText className="h-4 w-4 text-blue-500" />,
  UPDATE: <Edit3 className="h-4 w-4 text-yellow-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  AUTHORIZE: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  REJECT: <Ban className="h-4 w-4 text-red-500" />,
  STATUS_CHANGE: <Activity className="h-4 w-4 text-blue-500" />,
  ROLE_CHANGE: <Key className="h-4 w-4 text-purple-500" />,
  PASSWORD_CHANGE: <Key className="h-4 w-4 text-orange-500" />,
  PIN_CHANGE: <Key className="h-4 w-4 text-orange-500" />,
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Inicio de Sesión Exitoso',
  LOGIN_FAILED: 'Intento de Acceso Fallido',
  SUSPICIOUS_ACCESS: 'Acceso Sospechoso',
  PERMISSION_DENIED: 'Permiso Denegado'
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: 'bg-blue-500',
  WARNING: 'bg-yellow-500',
  CRITICAL: 'bg-red-500'
}

const EVENT_TYPE_ICONS: Record<string, React.ReactNode> = {
  LOGIN_SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  LOGIN_FAILED: <XCircle className="h-4 w-4 text-red-500" />,
  SUSPICIOUS_ACCESS: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  PERMISSION_DENIED: <AlertCircle className="h-4 w-4 text-orange-500" />
}

export function AuditoriaForenseModule() {
  const { config } = useConfigStore()
  useAuthStore()
  const [data, setData] = useState<SecurityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [migrationRequired, setMigrationRequired] = useState(false)
  const [filters, setFilters] = useState({
    eventType: '',
    severity: '',
    userId: '',
    ipAddress: ''
  })
  const [searchIP, setSearchIP] = useState('')

  const [auditData, setAuditData] = useState<AuditLogResponse | null>(null)
  const [isAuditLoading, setIsAuditLoading] = useState(false)
  const [auditFilters, setAuditFilters] = useState({ action: '', entityType: '', severity: '' })
  const [auditPage, setAuditPage] = useState(1)

  const fetchEvents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.eventType) params.append('eventType', filters.eventType)
      if (filters.severity) params.append('severity', filters.severity)
      if (filters.userId) params.append('userId', filters.userId)
      if (filters.ipAddress || searchIP) params.append('ipAddress', filters.ipAddress || searchIP)

      const response = await apiFetch(`/api/security-events?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
        if (result.migrationRequired) {
          setMigrationRequired(true)
          toast.warning(result.message)
        }
      }
    } catch (error) {
      console.error('Error al obtener security events:', error)
      toast.error('Error al cargar eventos de seguridad')
    } finally {
      setIsLoading(false)
    }
  }, [filters, searchIP])

  const fetchAuditLogs = useCallback(async () => {
    setIsAuditLoading(true)
    try {
      const params = new URLSearchParams()
      if (auditFilters.action) params.append('action', auditFilters.action)
      if (auditFilters.entityType) params.append('entityType', auditFilters.entityType)
      if (auditFilters.severity) params.append('severity', auditFilters.severity)
      if (auditPage > 1) params.append('page', String(auditPage))
      params.append('limit', '50')

      const response = await apiFetch(`/api/audit-logs?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setAuditData(result)
      }
    } catch (error) {
      console.error('Error al obtener audit logs:', error)
    } finally {
      setIsAuditLoading(false)
    }
  }, [auditFilters, auditPage])

  useEffect(() => {
    fetchEvents()
  }, [filters, fetchEvents])

  useEffect(() => {
    fetchAuditLogs()
  }, [auditFilters, auditPage, fetchAuditLogs])

  const handleSearchIP = () => {
    setFilters({ ...filters, ipAddress: searchIP })
  }

  // Analizar user agent para info del dispositivo
  const parseUserAgent = (ua: string | null): { browser: string; os: string; device: string } => {
    if (!ua) return { browser: 'Desconocido', os: 'Desconocido', device: 'Desconocido' }

    let browser = 'Desconocido'
    let os = 'Desconocido'
    let device = 'Desktop'

    if (ua.includes('Chrome')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari')) browser = 'Safari'
    else if (ua.includes('Edge')) browser = 'Edge'

    if (ua.includes('Windows')) os = 'Windows'
    else if (ua.includes('Mac')) os = 'macOS'
    else if (ua.includes('Linux')) os = 'Linux'
    else if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      device = 'Mobile'
    } else if (ua.includes('Tablet') || ua.includes('iPad')) {
      device = 'Tablet'
    }

    return { browser, os, device }
  }

  // Detectar patrones sospechosos
  const detectPatterns = (): string[] => {
    const patterns: string[] = []
    if (!data) return patterns

    // Múltiples intentos fallidos desde misma IP
    const failedByIP: Record<string, number> = {}
    data.events
      .filter(e => e.eventType === 'LOGIN_FAILED')
      .forEach(e => {
        if (e.ipAddress) {
          failedByIP[e.ipAddress] = (failedByIP[e.ipAddress] || 0) + 1
        }
      })

    Object.entries(failedByIP).forEach(([ip, count]) => {
      if (count >= 3) {
        patterns.push(`Múltiples intentos fallidos desde IP ${ip} (${count} intentos)`)
      }
    })

    // Eventos críticos
    const criticalEvents = data.events.filter(e => e.severity === 'CRITICAL')
    if (criticalEvents.length > 0) {
      patterns.push(`${criticalEvents.length} eventos críticos detectados`)
    }

    return patterns
  }

  const suspiciousPatterns = detectPatterns()

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Auditoría Forense</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Auditoría Forense
          </h1>
          <p className="text-muted-foreground">
            Monitoreo y análisis de eventos de seguridad
          </p>
        </div>
        <Button variant="outline" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eventos (24h)</p>
                <p className="text-2xl font-bold">{data?.statistics.total24h || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className={data?.statistics.failedLogins24h && data.statistics.failedLogins24h > 5 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Intentos Fallidos</p>
                <p className="text-2xl font-bold text-red-600">{data?.statistics.failedLogins24h || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className={data?.statistics.suspiciousEvents24h && data.statistics.suspiciousEvents24h > 0 ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eventos Sospechosos</p>
                <p className="text-2xl font-bold text-yellow-600">{data?.statistics.suspiciousEvents24h || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">IPs Únicas</p>
                <p className="text-2xl font-bold">{data?.statistics.uniqueIPs24h || 0}</p>
              </div>
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Migración Requerida */}
      {migrationRequired && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Migración de Base de Datos Requerida</AlertTitle>
          <AlertDescription className="text-yellow-700">
            La tabla de eventos de seguridad no existe en la base de datos. Ejecute el siguiente comando para crearla:
            <code className="block mt-2 p-2 bg-yellow-100 rounded text-sm font-mono">
              npx prisma db push
            </code>
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de Patrones Sospechosos */}
      {suspiciousPatterns.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Patrones Sospechosos Detectados</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              {suspiciousPatterns.map((pattern, i) => (
                <li key={i}>{pattern}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">
            <Activity className="h-4 w-4 mr-2" />
            Auditoría
          </TabsTrigger>
          <TabsTrigger value="events">
            <Eye className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="ips">
            <Globe className="h-4 w-4 mr-2" />
            Análisis IP
          </TabsTrigger>
          <TabsTrigger value="devices">
            <Smartphone className="h-4 w-4 mr-2" />
            Dispositivos
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Auditoría */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={auditFilters.action || '_all'} onValueChange={(v) => setAuditFilters({ ...auditFilters, action: v === '_all' ? '' : v })}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Acción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    <SelectItem value="CREATE">Creación</SelectItem>
                    <SelectItem value="UPDATE">Actualización</SelectItem>
                    <SelectItem value="DELETE">Eliminación</SelectItem>
                    <SelectItem value="AUTHORIZE">Autorización</SelectItem>
                    <SelectItem value="REJECT">Rechazo</SelectItem>
                    <SelectItem value="STATUS_CHANGE">Cambio Estado</SelectItem>
                    <SelectItem value="ROLE_CHANGE">Cambio Rol</SelectItem>
                    <SelectItem value="LOGIN">Inicio Sesión</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={auditFilters.entityType || '_all'} onValueChange={(v) => setAuditFilters({ ...auditFilters, entityType: v === '_all' ? '' : v })}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Entidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    <SelectItem value="User">Usuarios</SelectItem>
                    <SelectItem value="Order">Pedidos</SelectItem>
                    <SelectItem value="Item">Bienes</SelectItem>
                    <SelectItem value="Office">Oficinas</SelectItem>
                    <SelectItem value="Warehouse">Almacenes</SelectItem>
                    <SelectItem value="SystemConfig">Configuración</SelectItem>
                    <SelectItem value="FuelRequest">Combustible</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={auditFilters.severity || '_all'} onValueChange={(v) => setAuditFilters({ ...auditFilters, severity: v === '_all' ? '' : v })}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    <SelectItem value="INFO">Información</SelectItem>
                    <SelectItem value="WARNING">Advertencia</SelectItem>
                    <SelectItem value="CRITICAL">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {auditData?.logs.map((entry) => (
                    <div key={entry.id} className="p-4 hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {ACTION_ICONS[entry.action] || <Activity className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {ACTION_LABELS[entry.action] || entry.action}
                              </p>
                              <Badge variant="outline" className="text-xs">{entry.entityType}</Badge>
                              {entry.entityId && <span className="text-xs text-muted-foreground">ID: {entry.entityId}</span>}
                              <Badge className={`${entry.severity === 'CRITICAL' ? 'bg-red-500' : entry.severity === 'WARNING' ? 'bg-yellow-500' : 'bg-blue-500'} text-white text-xs`}>
                                {entry.severity}
                              </Badge>
                            </div>

                            {entry.user && (
                              <p className="text-sm text-muted-foreground">
                                <User className="h-3 w-3 inline mr-1" />
                                {entry.user.fullName} ({entry.user.email})
                              </p>
                            )}

                            <p className="text-sm text-muted-foreground mt-1">
                              {entry.description}
                            </p>

                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                              {entry.ipAddress && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {entry.ipAddress}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {isAuditLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      Cargando...
                    </div>
                  )}

                  {!isAuditLoading && auditData?.logs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron registros de auditoría</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {auditData && auditData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando página {auditData.pagination.page} de {auditData.pagination.totalPages} ({auditData.pagination.total} registros)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={auditPage >= auditData.pagination.totalPages} onClick={() => setAuditPage(p => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Pestaña de Eventos */}
        <TabsContent value="events" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <Select value={filters.eventType || '_all'} onValueChange={(v) => setFilters({ ...filters, eventType: v === '_all' ? '' : v })}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Tipo de evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos</SelectItem>
                    <SelectItem value="LOGIN_SUCCESS">Inicio Exitoso</SelectItem>
                    <SelectItem value="LOGIN_FAILED">Intento Fallido</SelectItem>
                    <SelectItem value="SUSPICIOUS_ACCESS">Acceso Sospechoso</SelectItem>
                    <SelectItem value="PERMISSION_DENIED">Permiso Denegado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.severity || '_all'} onValueChange={(v) => setFilters({ ...filters, severity: v === '_all' ? '' : v })}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Severidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas</SelectItem>
                    <SelectItem value="INFO">Información</SelectItem>
                    <SelectItem value="WARNING">Advertencia</SelectItem>
                    <SelectItem value="CRITICAL">Crítico</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2 flex-1">
                  <Input
                    placeholder="Buscar por IP..."
                    value={searchIP}
                    onChange={(e) => setSearchIP(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchIP()}
                  />
                  <Button onClick={handleSearchIP}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Eventos */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {data?.events.map((event) => (
                    <div key={event.id} className="p-4 hover:bg-muted/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {EVENT_TYPE_ICONS[event.eventType]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {EVENT_TYPE_LABELS[event.eventType]}
                              </p>
                              <Badge className={`${SEVERITY_COLORS[event.severity]} text-white text-xs`}>
                                {event.severity}
                              </Badge>
                            </div>
                            
                            {event.user && (
                              <p className="text-sm text-muted-foreground">
                                <User className="h-3 w-3 inline mr-1" />
                                {event.user.fullName} ({event.user.email})
                              </p>
                            )}

                            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
                              {event.ipAddress && (
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {event.ipAddress}
                                </span>
                              )}
                              {event.geolocation && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {event.geolocation}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: es })}
                              </span>
                            </div>

                            {event.userAgent && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {(() => {
                                  const { browser, os, device } = parseUserAgent(event.userAgent)
                                  return (
                                    <span className="flex items-center gap-2">
                                      <Monitor className="h-3 w-3" />
                                      {browser} en {os} ({device})
                                    </span>
                                  )
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {data?.events.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron eventos</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Análisis IP */}
        <TabsContent value="ips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Direcciones IP</CardTitle>
              <CardDescription>
                Distribución de eventos por dirección IP
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const ipStats: Record<string, { total: number; failed: number; success: number }> = {}
                data?.events.forEach(e => {
                  if (e.ipAddress) {
                    if (!ipStats[e.ipAddress]) {
                      ipStats[e.ipAddress] = { total: 0, failed: 0, success: 0 }
                    }
                    ipStats[e.ipAddress]!.total++
                    if (e.eventType === 'LOGIN_FAILED') {
                      ipStats[e.ipAddress]!.failed++
                    }
                    if (e.eventType === 'LOGIN_SUCCESS') {
                      ipStats[e.ipAddress]!.success++
                    }
                  }
                })

                const sortedIPs = Object.entries(ipStats)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 20)

                return (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {sortedIPs.map(([ip, stats]) => (
                        <div key={ip} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <code className="text-sm">{ip}</code>
                              <p className="text-xs text-muted-foreground">
                                {stats.total} eventos
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {stats.success > 0 && (
                              <Badge className="bg-green-500 text-white">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {stats.success}
                              </Badge>
                            )}
                            {stats.failed > 0 && (
                              <Badge className="bg-red-500 text-white">
                                <XCircle className="h-3 w-3 mr-1" />
                                {stats.failed}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}

                      {sortedIPs.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          No hay datos de IP disponibles
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Dispositivos */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Dispositivos</CardTitle>
              <CardDescription>
                Huellas digitales de dispositivos detectados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const deviceStats: Record<string, { count: number; lastSeen: Date; users: Set<string> }> = {}
                
                data?.events.forEach(e => {
                  if (e.deviceFingerprint || e.userAgent) {
                    const fingerprint = e.deviceFingerprint || e.userAgent || 'Unknown'
                    if (!deviceStats[fingerprint]) {
                      deviceStats[fingerprint] = { 
                        count: 0, 
                        lastSeen: new Date(0),
                        users: new Set()
                      }
                    }
                    deviceStats[fingerprint].count++
                    if (new Date(e.createdAt) > deviceStats[fingerprint].lastSeen) {
                      deviceStats[fingerprint].lastSeen = new Date(e.createdAt)
                    }
                    if (e.user?.fullName) {
                      deviceStats[fingerprint].users.add(e.user.fullName)
                    }
                  }
                })

                const sortedDevices = Object.entries(deviceStats)
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 10)

                return (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {sortedDevices.map(([fingerprint, stats], index) => (
                        <div key={fingerprint} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">Dispositivo {index + 1}</span>
                            </div>
                            <Badge variant="outline">{stats.count} eventos</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {fingerprint.substring(0, 50)}...
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Array.from(stats.users).map(user => (
                              <Badge key={user} variant="secondary" className="text-xs">
                                {user}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Última actividad: {format(stats.lastSeen, 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                        </div>
                      ))}

                      {sortedDevices.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          No hay datos de dispositivos disponibles
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
