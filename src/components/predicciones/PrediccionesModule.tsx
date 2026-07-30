'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useConfigStore } from '@/store'
import { AnimatedContainer } from '@/components/ui/animated-container'
import {
  TrendingUp,
  AlertTriangle,
  Package,
  BarChart3,
  RefreshCw,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { ModuleSkeleton } from '@/components/ui/module-skeleton'
import { exportToCSV, exportToExcel } from '@/lib/export-utils'

interface PredictionItem {
  itemId: number
  itemName: string
  itemCode: string
  category: string
  currentStock: number
  minStock: number
  predictedDemand: number
  confidence: number
  recommendedStock: number
  needsReorder: boolean
  daysUntilStockout: number | null
  historicalData: Array<{
    month: string
    demand: number
  }>
  trend: 'increasing' | 'stable' | 'decreasing'
  seasonalFactor: number
}

interface PredictionResponse {
  predictions: PredictionItem[]
  generatedAt: string
  parameters: {
    monthsOfHistory: number
    itemId: string | null
    category: string | null
  }
  summary: {
    totalItems: number
    itemsNeedingReorder: number
    averageConfidence: number
  }
}

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444'
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return CONFIDENCE_COLORS.high
  if (confidence >= 0.5) return CONFIDENCE_COLORS.medium
  return CONFIDENCE_COLORS.low
}

export function PrediccionesModule() {
  const { config } = useConfigStore()
  const [data, setData] = useState<PredictionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [monthsHistory, setMonthsHistory] = useState<string>('6')
  const [selectedItem, setSelectedItem] = useState<PredictionItem | null>(null)

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCategory && selectedCategory !== 'all') {
        params.append('category', selectedCategory)
      }
      params.append('months', monthsHistory)

      const response = await apiFetch(`/api/predictions?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error al obtener predictions:', error)
      toast.error('Error al cargar predicciones')
    } finally {
      setIsLoading(false)
    }
  }, [selectedCategory, monthsHistory])

  useEffect(() => {
    fetchPredictions()
  }, [selectedCategory, monthsHistory, fetchPredictions])

  const predictionColumns = [
    { key: 'itemCode' as const, label: 'Código' },
    { key: 'itemName' as const, label: 'Nombre' },
    { key: 'category' as const, label: 'Categoría' },
    { key: 'currentStock' as const, label: 'Stock Actual' },
    { key: 'minStock' as const, label: 'Stock Mínimo' },
    { key: 'predictedDemand' as const, label: 'Demanda Predicha' },
    { key: 'recommendedStock' as const, label: 'Stock Recomendado' },
    { key: 'confidence' as const, label: 'Confianza' },
    { key: 'trend' as const, label: 'Tendencia' },
    { key: 'daysUntilStockout' as const, label: 'Días hasta Agotamiento' },
    { key: 'needsReorder' as const, label: 'Requiere Reposición' },
  ]

  const getExportData = () =>
    filteredPredictions.map(p => ({
      ...p,
      confidence: `${Math.round(p.confidence * 100)}%`,
      trend: p.trend === 'increasing' ? 'En aumento' : p.trend === 'decreasing' ? 'En descenso' : 'Estable',
      daysUntilStockout: p.daysUntilStockout ?? 'N/A',
      needsReorder: p.needsReorder ? 'Sí' : 'No',
    }))

  // Obtener categorías únicas
  const categories = data?.predictions
    ? [...new Set(data.predictions.map(p => p.category))]
    : []

  // Filtrar predicciones
  const filteredPredictions = data?.predictions
    ? selectedCategory === 'all'
      ? data.predictions
      : data.predictions.filter(p => p.category === selectedCategory)
    : []

          // Datos del gráfico para bienes que necesitan reorden
  const reorderData = filteredPredictions
    .filter(p => p.needsReorder)
    .slice(0, 10)
    .map(p => ({
      name: p.itemName.length > 15 ? p.itemName.substring(0, 15) + '...' : p.itemName,
      actual: p.currentStock,
      recomendado: p.recommendedStock,
      minimo: p.minStock
    }))

  // Distribución de confianza
  const confidenceDistribution = [
    { name: 'Alta (>70%)', value: filteredPredictions.filter(p => p.confidence >= 0.7).length, color: CONFIDENCE_COLORS.high },
    { name: 'Media (50-70%)', value: filteredPredictions.filter(p => p.confidence >= 0.5 && p.confidence < 0.7).length, color: CONFIDENCE_COLORS.medium },
    { name: 'Baja (<50%)', value: filteredPredictions.filter(p => p.confidence < 0.5).length, color: CONFIDENCE_COLORS.low }
  ].filter(d => d.value > 0)

  // Distribución de tendencias
  const trendDistribution = [
    { name: 'En aumento', value: filteredPredictions.filter(p => p.trend === 'increasing').length, color: '#22c55e' },
    { name: 'Estable', value: filteredPredictions.filter(p => p.trend === 'stable').length, color: '#3b82f6' },
    { name: 'En descenso', value: filteredPredictions.filter(p => p.trend === 'decreasing').length, color: '#f59e0b' }
  ].filter(d => d.value > 0)

  if (isLoading) {
    return <ModuleSkeleton variant="kpi" />
  }

  return (
    <AnimatedContainer className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" style={{ color: config?.primaryColor }} />
            Predicciones de Demanda
          </h1>
          <p className="text-muted-foreground">
            Análisis predictivo basado en datos históricos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthsHistory} onValueChange={setMonthsHistory}>
            <SelectTrigger className="w-40">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchPredictions}>
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
              <DropdownMenuItem onClick={() => exportToCSV(getExportData(), predictionColumns, `predicciones-${new Date().toISOString().slice(0, 10)}`)}>
                <FileText className="h-4 w-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel(getExportData(), predictionColumns, `predicciones-${new Date().toISOString().slice(0, 10)}`)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bienes Analizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data?.summary.totalItems || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos {monthsHistory} meses de historial
            </p>
          </CardContent>
        </Card>

        <Card className={data?.summary.itemsNeedingReorder && data.summary.itemsNeedingReorder > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Requieren Reposición
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {data?.summary.itemsNeedingReorder || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bienes con stock bajo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confianza Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round((data?.summary.averageConfidence || 0) * 100)}%
            </div>
            <Progress 
              value={(data?.summary.averageConfidence || 0) * 100} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Generado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">
              {data?.generatedAt 
                ? formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true, locale: es })
                : '-'
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.generatedAt 
                ? format(new Date(data.generatedAt), 'dd/MM/yyyy HH:mm', { locale: es })
                : ''
              }
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">
            <Package className="h-4 w-4 mr-2" />
            Lista de Bienes
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gráficos
          </TabsTrigger>
        </TabsList>

        {/* Pestaña de Lista */}
        <TabsContent value="list" className="space-y-4">
          {/* Bienes que Necesitan Reorden */}
          {filteredPredictions.filter(p => p.needsReorder).length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Bienes que Requieren Reposición Inmediata
                </CardTitle>
                <CardDescription>
                  Estos bienes tienen stock insuficiente según las predicciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {filteredPredictions
                      .filter(p => p.needsReorder)
                      .map((item) => (
                        <div 
                          key={item.itemId}
                          className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.itemName}</p>
                            <p className="text-sm text-muted-foreground">{item.itemCode}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">
                                {item.currentStock} / {item.recommendedStock}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Demanda predicha: {item.predictedDemand}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Todas las Predicciones */}
          <Card>
            <CardHeader>
              <CardTitle>Todas las Predicciones</CardTitle>
              <CardDescription>
                Lista completa de predicciones de demanda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredPredictions.map((item) => (
                    <div 
                      key={item.itemId}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.itemName}</p>
                          {item.trend === 'increasing' && (
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                          )}
                          {item.trend === 'decreasing' && (
                            <ArrowDownRight className="h-4 w-4 text-amber-500" />
                          )}
                          {item.trend === 'stable' && (
                            <Minus className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.itemCode} • {item.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Stock</p>
                          <p className="font-medium">{item.currentStock}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Predicción</p>
                          <p className="font-medium">{item.predictedDemand}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Confianza</p>
                          <Badge 
                            style={{ 
                              backgroundColor: getConfidenceColor(item.confidence),
                              color: 'white'
                            }}
                          >
                            {Math.round(item.confidence * 100)}%
                          </Badge>
                        </div>
                        {item.needsReorder && (
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña de Gráficos */}
        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Gráfico de Comparación de Stock */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Actual vs Recomendado</CardTitle>
                <CardDescription>
                  Bienes que requieren reposición
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reorderData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={reorderData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="actual" fill="#ef4444" name="Actual" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="recomendado" fill="#22c55e" name="Recomendado" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="minimo" fill="#f59e0b" name="Mínimo" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mr-2 text-green-500" />
                    No hay bienes que requieran reposición
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribución de Confianza */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Confianza</CardTitle>
                <CardDescription>
                  Calidad de las predicciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={confidenceDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {confidenceDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribución de Tendencias */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Tendencias</CardTitle>
                <CardDescription>
                  Comportamiento de la demanda
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={trendDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {trendDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Demanda Histórica del Bien Seleccionado */}
            {selectedItem && (
              <Card>
                <CardHeader>
                  <CardTitle>Demanda Histórica: {selectedItem.itemName}</CardTitle>
                  <CardDescription>
                    Últimos {selectedItem.historicalData.length} meses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={selectedItem.historicalData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" fontSize={10} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="demand" 
                        stroke={config?.primaryColor || '#1e40af'} 
                        strokeWidth={2}
                        name="Demanda"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Panel de Información */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Sobre las Predicciones</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Las predicciones se basan en el historial de pedidos completados</li>
                <li>El factor estacional ajusta la predicción según el mes actual</li>
                <li>La confianza indica la calidad de la predicción (basada en consistencia de datos)</li>
                <li>El stock recomendado incluye un factor de seguridad</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </AnimatedContainer>
  )
}
