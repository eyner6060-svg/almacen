'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { useConfigStore } from '@/store'
import { apiFetch } from '@/lib/http'
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  Calendar as CalendarIcon,
  Eye,
  Loader2,
  Package,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart,
  Table as TableIcon,
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns'
import { es } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: 'INVENTORY' | 'MOVEMENTS' | 'CONSUMPTION' | 'AUDIT' | 'WARRANTY' | 'ORDERS'
  icon: React.ElementType
  columns: string[]
  defaultFilters: Record<string, unknown>
}

interface ReportData {
  title: string
  generatedAt: string
  data: Record<string, unknown>[]
  summary: Record<string, number>
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'inventory',
    name: 'Inventario Actual',
    description: 'Estado actual del inventario con niveles de stock',
    type: 'INVENTORY',
    icon: Package,
    columns: ['nombre', 'codigo', 'modelo', 'marca', 'color', 'serie', 'tipo', 'categoria', 'cantidad', 'unidad', 'stockMinimo', 'codigoPatrimonial', 'almacen', 'ubicacion', 'especificaciones', 'estado'],
    defaultFilters: { status: 'all', category: 'all' },
  },
  {
    id: 'movements',
    name: 'Movimientos de Inventario',
    description: 'Historial de ingresos y salidas de bienes',
    type: 'MOVEMENTS',
    icon: TrendingUp,
    columns: ['Fecha', 'Tipo', 'Bien', 'Cantidad', 'Usuario', 'Observaciones'],
    defaultFilters: { type: 'all' },
  },
  {
    id: 'consumption',
    name: 'Consumo por Oficina',
    description: 'Análisis de consumo por área u oficina',
    type: 'CONSUMPTION',
    icon: PieChart,
    columns: ['Oficina', 'Pedidos', 'Total Items', 'Último Pedido'],
    defaultFilters: {},
  },
  {
    id: 'audit',
    name: 'Registro de Auditoría',
    description: 'Log de acciones y cambios en el sistema',
    type: 'AUDIT',
    icon: AlertTriangle,
    columns: ['Fecha', 'Usuario', 'Acción', 'Entidad', 'Detalles', 'IP'],
    defaultFilters: { action: 'all' },
  },
  {
    id: 'warranty',
    name: 'Estado de Garantías',
    description: 'Bienes con garantía activa y próximas a vencer',
    type: 'WARRANTY',
    icon: ClipboardList,
    columns: ['Bien', 'Proveedor', 'Fecha Compra', 'Vencimiento', 'Estado', 'Días Restantes'],
    defaultFilters: { status: 'all' },
  },
  {
    id: 'orders',
    name: 'Reporte de Pedidos',
    description: 'Historial completo de pedidos',
    type: 'ORDERS',
    icon: FileText,
    columns: ['Número', 'Fecha', 'Solicitante', 'Oficina', 'Estado', 'Items'],
    defaultFilters: { status: 'all' },
  },
]

const COLORS = ['#1e40af', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

export function ReportesModule() {
  const { config } = useConfigStore()
  
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [previewTab, setPreviewTab] = useState<'table' | 'chart'>('table')
  const [categories, setCategories] = useState<string[]>([])
  const [offices, setOffices] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    // Obtener categorías y oficinas para filtros
    const fetchFilters = async () => {
      try {
        const [catRes, offRes] = await Promise.all([
          apiFetch('/api/items?perPage=1'),
          apiFetch('/api/offices'),
        ])
        
        if (catRes.ok) {
          const catData = await catRes.json()
          const uniqueCategories = [...new Set(catData.items?.map((i: { category: string }) => i.category) || [])] as string[]
          setCategories(uniqueCategories)
        }
        
        if (offRes.ok) {
          const offData = await offRes.json()
          setOffices(offData.offices || [])
        }
      } catch (error) {
        console.error('Error al obtener filter data:', error)
      }
    }
    
    fetchFilters()
  }, [])

  const generateReport = async () => {
    if (!selectedTemplate) return
    
    setIsLoading(true)
    setReportData(null)
    
    try {
      const params = new URLSearchParams({
        type: selectedTemplate.type,
        startDate: dateRange?.from?.toISOString() || '',
        endDate: dateRange?.to?.toISOString() || '',
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value && value !== 'all') acc[key] = value
          return acc
        }, {} as Record<string, string>),
      })
      
      const response = await apiFetch(`/api/reports?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
        toast.success('El reporte se ha generado exitosamente')
      } else {
        throw new Error('Error al generar el reporte')
      }
    } catch (error) {
      console.error('Error al generar reporte:', error)
      toast.error('No se pudo generar el reporte')
    } finally {
      setIsLoading(false)
    }
  }

  const exportReport = async (exportFormat: 'pdf' | 'excel' | 'csv') => {
    if (!selectedTemplate) return
    
    setIsExporting(true)
    try {
      const params = new URLSearchParams({
        template: selectedTemplate.id,
        format: exportFormat,
        startDate: dateRange?.from?.toISOString() || '',
        endDate: dateRange?.to?.toISOString() || '',
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value && value !== 'all') acc[key] = value
          return acc
        }, {} as Record<string, string>),
      })
      
      const response = await apiFetch(`/api/reports/export?${params}`)
      
      if (response.ok) {
        if (exportFormat === 'pdf') {
          const html = await response.text()
          const printWindow = window.open('', '_blank')
          if (printWindow) {
            printWindow.document.write(html)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => printWindow.print(), 500)
          }
        } else {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${selectedTemplate.name}_${format(new Date(), 'yyyy-MM-dd')}.${exportFormat === 'excel' ? 'xlsx' : exportFormat}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
        
        toast.success('El archivo se ha descargado exitosamente')
      } else {
        throw new Error('Error al exportar')
      }
    } catch (error) {
      console.error('Error al exportar reporte:', error)
      toast.error('No se pudo exportar el reporte')
    } finally {
      setIsExporting(false)
    }
  }

  const setQuickDateRange = (range: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const now = new Date()
    switch (range) {
      case 'today':
        setDateRange({ from: now, to: now })
        break
      case 'week':
        setDateRange({ from: subDays(now, 7), to: now })
        break
      case 'month':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
        break
      case 'quarter':
        setDateRange({ from: subDays(now, 90), to: now })
        break
      case 'year':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) })
        break
    }
  }

  const chartData = useMemo(() => {
    if (!reportData?.data) return []
    const aggregated = new Map<string, number>()
    for (const row of reportData.data) {
      const name = String(row['nombre'] || row['name'] || row['Oficina'] || row['Categoría'] || 'Item')
      const value = Number(row['cantidad'] || row['value'] || row['Total Items'] || row['Stock'] || 1)
      aggregated.set(name, (aggregated.get(name) || 0) + value)
    }
    return Array.from(aggregated.entries()).map(([name, value]) => ({ name, value }))
  }, [reportData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Genera y exporta reportes personalizados</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plantillas de Reporte */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Plantillas de Reporte</CardTitle>
            <CardDescription>Selecciona el tipo de reporte a generar</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {reportTemplates.map((template) => {
                  const Icon = template.icon
                  const isSelected = selectedTemplate?.id === template.id
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template)
                        setFilters(template.defaultFilters as Record<string, string>)
                        setReportData(null)
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md ${
                        isSelected 
                          ? 'border-primary bg-primary/5 shadow-sm' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${config?.primaryColor}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: config?.primaryColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{template.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Filtros y Opciones */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Configuración del Reporte</CardTitle>
            <CardDescription>Ajusta los filtros y parámetros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rango de Fechas */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Rango de Fechas</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange('today')}>
                  Hoy
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange('week')}>
                  Esta Semana
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange('month')}>
                  Este Mes
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange('quarter')}>
                  Este Trimestre
                </Button>
                <Button variant="outline" size="sm" onClick={() => setQuickDateRange('year')}>
                  Este Año
                </Button>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'dd/MM/yyyy', { locale: es })} -{' '}
                          {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
                        </>
                      ) : (
                        format(dateRange.from, 'dd/MM/yyyy', { locale: es })
                      )
                    ) : (
                      <span>Seleccionar fechas</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Filtros Dinámicos según plantilla */}
            {selectedTemplate && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Filtros Adicionales</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedTemplate.type === 'INVENTORY' && (
                    <>
                      <div>
                        <Label className="text-xs">Estado</Label>
                        <Select value={filters.status || 'all'} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="OPERATIVO">Operativo</SelectItem>
                            <SelectItem value="AVERIADO">Averiado</SelectItem>
                            <SelectItem value="BAJA">Baja</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Categoría</Label>
                        <Select value={filters.category || 'all'} onValueChange={(v) => setFilters({ ...filters, category: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedTemplate.type === 'ORDERS' && (
                    <>
                      <div>
                        <Label className="text-xs">Estado</Label>
                        <Select value={filters.status || 'all'} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                            <SelectItem value="AUTORIZADO_JEFE">Autorizado Jefe</SelectItem>
                            <SelectItem value="AUTORIZADO_ALMACENERO">Autorizado Almacenero</SelectItem>
                            <SelectItem value="COMPLETADO">Completado</SelectItem>
                            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Oficina</Label>
                        <Select value={filters.officeId || 'all'} onValueChange={(v) => setFilters({ ...filters, officeId: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar oficina" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {offices.map((office) => (
                              <SelectItem key={office.id} value={String(office.id)}>{office.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {selectedTemplate.type === 'AUDIT' && (
                    <div>
                      <Label className="text-xs">Tipo de Acción</Label>
                      <Select value={filters.action || 'all'} onValueChange={(v) => setFilters({ ...filters, action: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar acción" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="CREATE">Creación</SelectItem>
                          <SelectItem value="UPDATE">Actualización</SelectItem>
                          <SelectItem value="DELETE">Eliminación</SelectItem>
                          <SelectItem value="LOGIN">Inicio de Sesión</SelectItem>
                          <SelectItem value="AUTHORIZE">Autorización</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedTemplate.type === 'WARRANTY' && (
                    <div>
                      <Label className="text-xs">Estado de Garantía</Label>
                      <Select value={filters.warrantyStatus || 'all'} onValueChange={(v) => setFilters({ ...filters, warrantyStatus: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="ACTIVE">Activa</SelectItem>
                          <SelectItem value="EXPIRED">Vencida</SelectItem>
                          <SelectItem value="CLAIMED">Reclamada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botón de Generar */}
            <div className="flex gap-2">
              <Button 
                onClick={generateReport} 
                disabled={!selectedTemplate || isLoading}
                className="flex-1"
                style={{ backgroundColor: config?.primaryColor }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Generar Reporte
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vista Previa del Reporte */}
      {reportData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg">{selectedTemplate?.name}</CardTitle>
                <CardDescription>
                  Generado el {format(new Date(reportData.generatedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportReport('pdf')}
                  disabled={isExporting}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportReport('excel')}
                  disabled={isExporting}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportReport('csv')}
                  disabled={isExporting}
                >
                  <TableIcon className="mr-2 h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Estadísticas de Resumen */}
            {reportData.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {Object.entries(reportData.summary).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="bg-muted p-4 rounded-lg">
                    <p className="text-2xl font-bold" style={{ color: config?.primaryColor }}>
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Pestañas de Vista Previa */}
            <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as 'table' | 'chart')}>
              <TabsList>
                <TabsTrigger value="table">
                  <TableIcon className="mr-2 h-4 w-4" />
                  Tabla
                </TabsTrigger>
                <TabsTrigger value="chart">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Gráfico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="table" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="border rounded-lg overflow-hidden">
                    <Table responsiveCards>
                      <TableHeader>
                        <TableRow className="bg-muted">
                          {selectedTemplate?.columns.map((col) => (
                            <TableHead key={col}>
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.data.map((row, index) => (
                          <TableRow key={index}>
                            {selectedTemplate?.columns.map((col) => (
                              <TableCell key={col}>
                                {String(row[col] ?? '-')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="chart" className="mt-4">
                {chartData.length > 0 ? (
                  <div className="h-[400px]">
                    <Tabs defaultValue="bar">
                      <TabsList className="mb-4">
                        <TabsTrigger value="bar">Barras</TabsTrigger>
                        <TabsTrigger value="pie">Circular</TabsTrigger>
                        <TabsTrigger value="line">Líneas</TabsTrigger>
                      </TabsList>

                      <TabsContent value="bar">
                        <ResponsiveContainer width="100%" height={350}>
                          <RechartsBarChart data={chartData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill={config?.primaryColor || '#1e40af'} radius={[4, 4, 0, 0]} />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </TabsContent>

                      <TabsContent value="pie">
                        <ResponsiveContainer width="100%" height={350}>
                          <RechartsPieChart>
                            <Pie
                              data={chartData.slice(0, 8)}
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              dataKey="value"
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {chartData.slice(0, 8).map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </TabsContent>

                      <TabsContent value="line">
                        <ResponsiveContainer width="100%" height={350}>
                          <LineChart data={chartData.slice(0, 10)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="value" stroke={config?.primaryColor || '#1e40af'} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No hay datos suficientes para mostrar el gráfico
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Estado Vacío */}
      {!reportData && !isLoading && selectedTemplate && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Configura los filtros y genera el reporte</h3>
              <p className="text-muted-foreground mt-1">
                Haz clic en "Generar Reporte" para ver los datos
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
